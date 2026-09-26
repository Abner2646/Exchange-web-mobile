// Unit tests for admin balance-mutation dual control (Maker-Checker → privileged single-operator
// balance ops: manual adjustment, cross-user transfer, block, unblock). The USD magnitude that drives
// the decision is computed SERVER-SIDE from the real crypto + amount (never a client-declared value);
// the $20k hard ceiling is enforced by makerChecker.requiresDualControl (used here for real, not mocked).
// Design: NOTHING moves at propose time — the executor performs the ledger posting only once a DISTINCT
// checker approves, so a reject/expiry needs no compensator (the mutation simply never ran).
const money = require('../../utils/money');

jest.mock('../../models', () => ({
  sequelize: { transaction: jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })) },
  UserBalance: { updateBalance: jest.fn(), blockBalance: jest.fn(), unblockBalance: jest.fn() },
}));
jest.mock('./ledger/operations', () => ({ transferInternal: jest.fn() }));

// makerChecker loads governance.model at require-time; stub it so requiresDualControl (pure)
// stays REAL while the DB entity never initializes against the mocked sequelize.
jest.mock('../governance/governance.model', () => ({
  PendingAdminAction: { create: jest.fn(), findByPk: jest.fn(), update: jest.fn() },
}));

jest.mock('../aml/amlValuation', () => ({ getUsdValue: jest.fn() }));
jest.mock('../config/businessConfig', () => ({ getNumber: jest.fn(), getBoolean: jest.fn() }));

const amlValuation = require('../aml/amlValuation');
const businessConfig = require('../config/businessConfig');
const makerChecker = require('../governance/makerChecker.service');
const { UserBalance } = require('../../models');
const ledgerOps = require('./ledger/operations');
const svc = require('./adminBalanceDualControl.service');

const TX = { LOCK: { UPDATE: 'UPDATE' } };

describe('adminBalanceDualControl.evaluate — server-side USD decision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    businessConfig.getNumber.mockResolvedValue(5000);
    businessConfig.getBoolean.mockResolvedValue(true);
  });

  const freshPair = (usd) => ({ usd, source: 'pair', priceAsOf: new Date() });

  test('adjustment below the threshold (fresh price) → no dual control', async () => {
    amlValuation.getUsdValue.mockResolvedValue(freshPair('4000'));
    const res = await svc.evaluate('crypto-1', '1');
    expect(res.dualControl).toBe(false);
    expect(res.amountUsd).toBe('4000');
  });

  test('adjustment above the threshold → dual control required', async () => {
    amlValuation.getUsdValue.mockResolvedValue(freshPair('6000'));
    const res = await svc.evaluate('crypto-1', '2');
    expect(res.dualControl).toBe(true);
    expect(res.amountUsd).toBe('6000');
  });

  test('a NEGATIVE amount (debit) is valued by its magnitude |amount|', async () => {
    amlValuation.getUsdValue.mockResolvedValue(freshPair('6000'));
    const res = await svc.evaluate('crypto-1', '-2');
    expect(res.dualControl).toBe(true);
    // The valuation must be requested for the absolute magnitude, not the signed value.
    expect(amlValuation.getUsdValue).toHaveBeenCalledWith('crypto-1', '2');
  });

  test('the $20k hard ceiling cannot be bypassed by a threshold misconfigured higher', async () => {
    businessConfig.getNumber.mockResolvedValue(50000);
    amlValuation.getUsdValue.mockResolvedValue(freshPair('30000'));
    const res = await svc.evaluate('crypto-1', '3');
    expect(res.dualControl).toBe(true);
  });

  test('a STALE pair price fails CLOSED even if it values below the threshold', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    amlValuation.getUsdValue.mockResolvedValue({ usd: '4000', source: 'pair', priceAsOf: twoHoursAgo });
    const res = await svc.evaluate('crypto-1', '1');
    expect(res.dualControl).toBe(true);
  });

  test('a stable-source valuation is always fresh and trusted', async () => {
    amlValuation.getUsdValue.mockResolvedValue({ usd: '100', source: 'stable', priceAsOf: new Date() });
    const res = await svc.evaluate('crypto-1', '1');
    expect(res.dualControl).toBe(false);
  });

  test('an unvaluable asset fails CLOSED by default (config-overridable)', async () => {
    amlValuation.getUsdValue.mockResolvedValue({ usd: null, source: 'unknown' });
    const res = await svc.evaluate('crypto-x', '999');
    expect(res.dualControl).toBe(true);
    expect(res.amountUsd).toBeNull();
    expect(businessConfig.getBoolean).toHaveBeenCalledWith('admin_balance_dual_control_on_unvaluable', true);
  });

  test('an unvaluable asset can be allowed through if the operator disables the fail-closed policy', async () => {
    amlValuation.getUsdValue.mockResolvedValue({ usd: null, source: 'unknown' });
    businessConfig.getBoolean.mockResolvedValue(false);
    const res = await svc.evaluate('crypto-x', '1');
    expect(res.dualControl).toBe(false);
  });
});

describe('adminBalanceDualControl executors — perform the deferred ledger posting on approval', () => {
  beforeEach(() => jest.clearAllMocks());

  test('updateExecutor applies the manual adjustment inside the approval tx', async () => {
    await svc.updateExecutor({ userId: 'u1', cryptoId: 'c1', amount: '100', type: 'available' }, TX);
    expect(UserBalance.updateBalance).toHaveBeenCalledWith('u1', 'c1', '100', 'available', TX);
  });

  test('blockExecutor blocks the balance inside the approval tx', async () => {
    await svc.blockExecutor({ userId: 'u1', cryptoId: 'c1', amount: '50' }, TX);
    expect(UserBalance.blockBalance).toHaveBeenCalledWith('u1', 'c1', '50', TX);
  });

  test('unblockExecutor unblocks the balance inside the approval tx', async () => {
    await svc.unblockExecutor({ userId: 'u1', cryptoId: 'c1', amount: '50' }, TX);
    expect(UserBalance.unblockBalance).toHaveBeenCalledWith('u1', 'c1', '50', TX);
  });

  test('transferExecutor moves funds between users inside the approval tx', async () => {
    await svc.transferExecutor({ fromUserId: 'u1', toUserId: 'u2', cryptoId: 'c1', amount: '75', reference: 'ref-1' }, TX);
    expect(ledgerOps.transferInternal).toHaveBeenCalledWith(
      { remitenteId: 'u1', destinatarioId: 'u2', criptomonedaId: 'c1', cantidad: '75', referencia: 'ref-1' },
      TX
    );
  });
});

describe('adminBalanceDualControl.register — wires all four executors, no compensators', () => {
  test('registers an executor for each admin balance action type', () => {
    svc.register();
    expect(makerChecker._executors.get(svc.ACTIONS.UPDATE)).toBe(svc.updateExecutor);
    expect(makerChecker._executors.get(svc.ACTIONS.BLOCK)).toBe(svc.blockExecutor);
    expect(makerChecker._executors.get(svc.ACTIONS.UNBLOCK)).toBe(svc.unblockExecutor);
    expect(makerChecker._executors.get(svc.ACTIONS.TRANSFER)).toBe(svc.transferExecutor);
  });

  test('registers NO compensator (nothing is held at propose time → reject/expiry never moved money)', () => {
    svc.register();
    expect(makerChecker._compensators.get(svc.ACTIONS.UPDATE)).toBeUndefined();
    expect(makerChecker._compensators.get(svc.ACTIONS.TRANSFER)).toBeUndefined();
  });
});
