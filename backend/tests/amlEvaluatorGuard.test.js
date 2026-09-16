// backend/tests/amlEvaluatorGuard.test.js
// Unit tests for the payload validation guard in amlEvaluator.evaluate().
// Verifies that malformed events (missing key fields) return [] without crashing.
jest.mock('../modules/aml/amlConfig', () => ({ isMonitoringEnabled: jest.fn(), getThreshold: jest.fn() }));
jest.mock('../modules/aml/amlDataAccess', () => ({
  confirmedDepositsInWindow: jest.fn(), withdrawalsInWindow: jest.fn(),
  p2pCompletedCountBetween: jest.fn(), onchainMovementsInWindow: jest.fn(),
  userProfile: jest.fn(),
}));
jest.mock('../modules/aml/amlValuation', () => ({ getUsdValue: jest.fn() }));
const evaluator = require('../modules/aml/amlEvaluator');

describe('amlEvaluator payload validation', () => {
  test('WithdrawalTransmitted with missing userId returns empty results (no crash)', async () => {
    // No mocking needed — guard fires before any DA call
    const results = await evaluator.evaluate({ type: 'WithdrawalTransmitted', payload: { cryptoId: 'c1', amount: '1' } });
    expect(results).toEqual([]);
  });

  test('P2PTransactionCompleted with missing buyerId returns empty results', async () => {
    const results = await evaluator.evaluate({ type: 'P2PTransactionCompleted', payload: { sellerId: 's1', transaction: { id: 't1' } } });
    expect(results).toEqual([]);
  });

  it('returns [] for WithdrawalTransmitted missing blockchainTransactionId', async () => {
    const results = await evaluator.evaluate({
      type: 'WithdrawalTransmitted',
      payload: { userId: 'u1', cryptoId: 'c1', amount: '100' }, // no blockchainTransactionId
    });
    expect(results).toEqual([]);
  });
});
