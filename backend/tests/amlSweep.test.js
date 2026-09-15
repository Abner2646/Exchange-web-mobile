// backend/tests/amlSweep.test.js
jest.mock('../modules/aml/amlConfig', () => ({ isMonitoringEnabled: jest.fn(), getThreshold: jest.fn() }));
jest.mock('../modules/aml/amlDataAccess', () => ({
  recentWithdrawals: jest.fn(), recentConfirmedDeposits: jest.fn(), recentCompletedP2P: jest.fn(),
}));
jest.mock('../modules/aml/amlConsumer', () => ({ handleEvent: jest.fn() }));
const amlConfig = require('../modules/aml/amlConfig');
const da = require('../modules/aml/amlDataAccess');
const consumer = require('../modules/aml/amlConsumer');
const sweep = require('../modules/aml/amlSweep');

describe('amlSweep.runSweep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    amlConfig.getThreshold.mockResolvedValue(48);
    da.recentWithdrawals.mockResolvedValue([]);
    da.recentConfirmedDeposits.mockResolvedValue([]);
    da.recentCompletedP2P.mockResolvedValue([]);
    consumer.handleEvent.mockResolvedValue(undefined);
  });

  test('monitoring OFF → no enumeration, no replay', async () => {
    amlConfig.isMonitoringEnabled.mockResolvedValue(false);
    const res = await sweep.runSweep();
    expect(res).toEqual({ scanned: 0, byType: { WithdrawalTransmitted: 0, DepositConfirmed: 0, P2PTransactionCompleted: 0 } });
    expect(da.recentWithdrawals).not.toHaveBeenCalled();
    expect(consumer.handleEvent).not.toHaveBeenCalled();
  });

  test('replays each recent row with the correct event shape', async () => {
    amlConfig.isMonitoringEnabled.mockResolvedValue(true);
    da.recentWithdrawals.mockResolvedValue([{ id: 'w1', userId: 'u1', cryptoId: 'c1', amount: '2.5' }]);
    da.recentConfirmedDeposits.mockResolvedValue([{ id: 'd1', userId: 'u2', cryptoId: 'c1', amount: '1' }]);
    da.recentCompletedP2P.mockResolvedValue([{ id: 'p1', buyerId: 'a', sellerId: 'b' }]);
    const res = await sweep.runSweep();

    expect(res.scanned).toBe(3);
    expect(res.byType).toEqual({ WithdrawalTransmitted: 1, DepositConfirmed: 1, P2PTransactionCompleted: 1 });
    expect(consumer.handleEvent).toHaveBeenCalledWith({ id: 'w1', type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: 'w1', userId: 'u1', cryptoId: 'c1', amount: '2.5' } });
    expect(consumer.handleEvent).toHaveBeenCalledWith({ id: 'd1', type: 'DepositConfirmed', payload: { blockchainTransactionId: 'd1', userId: 'u2', cryptoId: 'c1', amount: '1' } });
    expect(consumer.handleEvent).toHaveBeenCalledWith({ id: 'p1', type: 'P2PTransactionCompleted', payload: { buyerId: 'a', sellerId: 'b', transaction: { id: 'p1' } } });
  });

  test('a throwing handleEvent for one row does not stop the others (per-row isolation)', async () => {
    amlConfig.isMonitoringEnabled.mockResolvedValue(true);
    da.recentWithdrawals.mockResolvedValue([{ id: 'w1', userId: 'u1', cryptoId: 'c1', amount: '1' }, { id: 'w2', userId: 'u1', cryptoId: 'c1', amount: '1' }]);
    consumer.handleEvent.mockRejectedValueOnce(new Error('boom')); // w1 throws
    const res = await sweep.runSweep();
    expect(res.scanned).toBe(2); // both attempted
    expect(consumer.handleEvent).toHaveBeenCalledTimes(2);
  });
});
