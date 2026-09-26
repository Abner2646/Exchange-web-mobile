// Unit tests for the large-withdrawal dual-control wiring (Maker-Checker → withdrawals).
// The USD magnitude that drives the dual-control decision is computed SERVER-SIDE from the
// real withdrawal (crypto + amount), never trusted from a maker-declared value. The $20k
// hard ceiling is enforced by makerChecker.requiresDualControl (used here for real, not mocked).
const money = require('../../utils/money');

jest.mock('../../models', () => ({
  sequelize: { transaction: jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })) },
  BlockchainTransaction: { releaseDualControlHold: jest.fn(), cancelDualControlHold: jest.fn() },
}));

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
const { BlockchainTransaction } = require('../../models');
const svc = require('./withdrawalDualControl.service');

const TX = { LOCK: { UPDATE: 'UPDATE' } };

describe('withdrawalDualControl.evaluate — server-side USD decision', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    businessConfig.getNumber.mockResolvedValue(5000);
    businessConfig.getBoolean.mockResolvedValue(true);
  });

  const freshPair = (usd) => ({ usd, source: 'pair', priceAsOf: new Date() });

  test('valuable withdrawal below the threshold (fresh price) → no dual control', async () => {
    amlValuation.getUsdValue.mockResolvedValue(freshPair('4000'));
    const res = await svc.evaluate('crypto-1', '1', TX);
    expect(res.dualControl).toBe(false);
    expect(res.amountUsd).toBe('4000');
    expect(amlValuation.getUsdValue).toHaveBeenCalledWith('crypto-1', '1', TX);
  });

  test('valuable withdrawal above the threshold → dual control required', async () => {
    amlValuation.getUsdValue.mockResolvedValue(freshPair('6000'));
    const res = await svc.evaluate('crypto-1', '2', TX);
    expect(res.dualControl).toBe(true);
    expect(res.amountUsd).toBe('6000');
  });

  test('the $20k hard ceiling cannot be bypassed by a threshold misconfigured higher', async () => {
    businessConfig.getNumber.mockResolvedValue(50000); // threshold above the hard ceiling
    amlValuation.getUsdValue.mockResolvedValue(freshPair('30000'));
    const res = await svc.evaluate('crypto-1', '3', TX);
    expect(res.dualControl).toBe(true); // 30k > 20k ceiling → dual control regardless
  });

  test('a STALE pair price fails CLOSED even if it values below the threshold (anti feed-freeze bypass)', async () => {
    // A frozen/manipulated feed could undervalue a truly-large withdrawal below $5k and skip 4-eyes.
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    amlValuation.getUsdValue.mockResolvedValue({ usd: '4000', source: 'pair', priceAsOf: twoHoursAgo });
    const res = await svc.evaluate('crypto-1', '1', TX);
    expect(res.dualControl).toBe(true);
  });

  test('a pair price with no timestamp is untrusted → fails closed', async () => {
    amlValuation.getUsdValue.mockResolvedValue({ usd: '10', source: 'pair', priceAsOf: null });
    const res = await svc.evaluate('crypto-1', '1', TX);
    expect(res.dualControl).toBe(true);
  });

  test('a stable-source valuation (USDT etc.) is always fresh and trusted', async () => {
    amlValuation.getUsdValue.mockResolvedValue({ usd: '100', source: 'stable', priceAsOf: new Date() });
    const res = await svc.evaluate('crypto-1', '1', TX);
    expect(res.dualControl).toBe(false);
  });

  test('unvaluable asset fails CLOSED by default (cannot prove it is under the ceiling)', async () => {
    amlValuation.getUsdValue.mockResolvedValue({ usd: null, source: 'unknown' });
    const res = await svc.evaluate('crypto-x', '999', TX);
    expect(res.dualControl).toBe(true);
    expect(res.amountUsd).toBeNull();
    // The fail-closed policy is a business-config default (editable from the admin panel).
    expect(businessConfig.getBoolean).toHaveBeenCalledWith('withdrawal_dual_control_on_unvaluable', true);
  });

  test('unvaluable asset can be allowed through if the operator disables the fail-closed policy', async () => {
    amlValuation.getUsdValue.mockResolvedValue({ usd: null, source: 'unknown' });
    businessConfig.getBoolean.mockResolvedValue(false);
    const res = await svc.evaluate('crypto-x', '1', TX);
    expect(res.dualControl).toBe(false);
  });
});

describe('withdrawalDualControl.releaseExecutor — atomic release on approval', () => {
  beforeEach(() => jest.clearAllMocks());

  test('releases the hold and returns a result when the row was in a releasable state', async () => {
    BlockchainTransaction.releaseDualControlHold.mockResolvedValue(1);
    const result = await svc.releaseExecutor({ withdrawalId: 'w-1' }, TX);
    expect(BlockchainTransaction.releaseDualControlHold).toHaveBeenCalledWith('w-1', TX);
    expect(result).toEqual({ released: true, withdrawalId: 'w-1' });
  });

  test('throws (rolling back the approval) when no releasable hold matched', async () => {
    BlockchainTransaction.releaseDualControlHold.mockResolvedValue(0);
    await expect(svc.releaseExecutor({ withdrawalId: 'w-missing' }, TX)).rejects.toThrow();
  });
});

describe('withdrawalDualControl.cancelCompensator — atomic cancel+refund on reject/expiry', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cancels the held withdrawal (refunding the user) via the model, inside the passed tx', async () => {
    // A rejected/expired large_withdrawal_release must return the held funds to the user and
    // terminate the withdrawal — otherwise the row is stranded in the dual-control hold forever.
    BlockchainTransaction.cancelDualControlHold.mockResolvedValue(1);
    await svc.cancelCompensator({ withdrawalId: 'w-1' }, TX);
    expect(BlockchainTransaction.cancelDualControlHold).toHaveBeenCalledWith('w-1', TX);
  });

  test('is a safe no-op when nothing was held (idempotent) — does not throw', async () => {
    // Unlike the release executor, the compensator never throws on a 0-match: the hold is already
    // resolved, so there is nothing to refund. Matches the launchpad compensator contract.
    BlockchainTransaction.cancelDualControlHold.mockResolvedValue(0);
    await expect(svc.cancelCompensator({ withdrawalId: 'w-gone' }, TX)).resolves.toBeUndefined();
  });
});

describe('withdrawalDualControl.propose — records the pending action', () => {
  beforeEach(() => jest.clearAllMocks());

  test('proposes a large_withdrawal_release action carrying the server-computed amountUsd', async () => {
    const spy = jest.spyOn(makerChecker, 'propose').mockResolvedValue({ id: 'action-1' });
    await svc.propose({ withdrawalId: 'w-1', makerUserId: 'u-1', amountUsd: '6000' }, TX);
    expect(spy).toHaveBeenCalledWith(
      { makerUserId: 'u-1', actionType: svc.ACTION_TYPE, payload: { withdrawalId: 'w-1' }, amountUsd: '6000' },
      { transaction: TX }
    );
    spy.mockRestore();
  });
});

describe('withdrawalDualControl.register — wires the executor + compensator into the engine', () => {
  test('registers the release executor under its action type', () => {
    svc.register();
    expect(makerChecker._executors.get(svc.ACTION_TYPE)).toBe(svc.releaseExecutor);
  });

  test('registers the cancel+refund compensator under its action type', () => {
    svc.register();
    expect(makerChecker._compensators.get(svc.ACTION_TYPE)).toBe(svc.cancelCompensator);
  });
});
