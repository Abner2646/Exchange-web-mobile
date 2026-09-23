const money = require('../../utils/money');

jest.mock('../../models', () => {
  const transactionMock = jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
  return { sequelize: { transaction: transactionMock } };
});

jest.mock('./governance.model', () => ({
  PendingAdminAction: { create: jest.fn(), findByPk: jest.fn(), update: jest.fn() }
}));

jest.mock('../config/businessConfig', () => ({ getNumber: jest.fn().mockResolvedValue(24) }));

const { PendingAdminAction } = require('./governance.model');
const svc = require('./makerChecker.service');

function fakeAction(overrides = {}) {
  return {
    id: 'action-1',
    actionType: 'test_action',
    payload: { foo: 'bar' },
    amountUsd: '1000',
    status: 'pending',
    makerUserId: 'maker-1',
    checkerUserId: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h in the future
    update: jest.fn().mockImplementation(function (patch) { Object.assign(this, patch); return this; }),
    ...overrides
  };
}

describe('makerChecker.requiresDualControl — hard ceiling is inviolable', () => {
  test('below configured threshold → no dual control', () => {
    expect(svc.requiresDualControl('4000', '5000')).toBe(false);
  });
  test('above configured threshold → dual control', () => {
    expect(svc.requiresDualControl('6000', '5000')).toBe(true);
  });
  test('a threshold misconfigured ABOVE $20k cannot bypass the hard ceiling', () => {
    // threshold 50k, action 30k: below threshold but above the $20k hard ceiling → dual required
    expect(svc.requiresDualControl('30000', '50000')).toBe(true);
  });
  test('exactly at the ceiling is not "above" it', () => {
    expect(svc.requiresDualControl('20000', '50000')).toBe(false);
    expect(svc.requiresDualControl('20000.01', '50000')).toBe(true);
  });
  test('null amount (non-monetary action) never requires dual control by amount', () => {
    expect(svc.requiresDualControl(null, '5000')).toBe(false);
  });
});

describe('makerChecker.approve — 4-eyes + second factor + atomic execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    svc._executors.clear();
  });

  test('rejects when checker === maker (hard incompatibility), executor never runs', async () => {
    PendingAdminAction.findByPk.mockResolvedValue(fakeAction({ makerUserId: 'same' }));
    const executor = jest.fn();
    svc.registerExecutor('test_action', executor);

    await expect(svc.approve({
      actionId: 'action-1',
      checkerUserId: 'same',
      verifyCheckerSecondFactor: jest.fn().mockResolvedValue(true)
    })).rejects.toMatchObject({ code: 'MAKER_CHECKER_SAME_USER' });

    expect(executor).not.toHaveBeenCalled();
  });

  test('rejects when checker equals maker under different id casing (normalized 4-eyes)', async () => {
    PendingAdminAction.findByPk.mockResolvedValue(fakeAction({ makerUserId: 'ABC-123' }));
    const executor = jest.fn();
    svc.registerExecutor('test_action', executor);

    await expect(svc.approve({
      actionId: 'action-1',
      checkerUserId: 'abc-123',
      verifyCheckerSecondFactor: jest.fn().mockResolvedValue(true)
    })).rejects.toMatchObject({ code: 'MAKER_CHECKER_SAME_USER' });

    expect(executor).not.toHaveBeenCalled();
  });

  test('rejects on invalid checker second factor, executor never runs', async () => {
    PendingAdminAction.findByPk.mockResolvedValue(fakeAction());
    const executor = jest.fn();
    svc.registerExecutor('test_action', executor);

    await expect(svc.approve({
      actionId: 'action-1',
      checkerUserId: 'checker-1',
      verifyCheckerSecondFactor: jest.fn().mockRejectedValue(new Error('bad code'))
    })).rejects.toMatchObject({ code: 'MAKER_CHECKER_MFA_INVALID' });

    expect(executor).not.toHaveBeenCalled();
  });

  test('expired action is marked expired and refused', async () => {
    const expired = fakeAction({ expiresAt: new Date(Date.now() - 1000) });
    PendingAdminAction.findByPk.mockResolvedValue(expired);
    svc.registerExecutor('test_action', jest.fn());

    await expect(svc.approve({
      actionId: 'action-1',
      checkerUserId: 'checker-1',
      verifyCheckerSecondFactor: jest.fn().mockResolvedValue(true)
    })).rejects.toMatchObject({ code: 'MAKER_CHECKER_EXPIRED' });

    expect(expired.status).toBe('expired');
  });

  test('a non-pending action cannot be approved twice (idempotency guard)', async () => {
    PendingAdminAction.findByPk.mockResolvedValue(fakeAction({ status: 'executed' }));
    await expect(svc.approve({
      actionId: 'action-1',
      checkerUserId: 'checker-1',
      verifyCheckerSecondFactor: jest.fn().mockResolvedValue(true)
    })).rejects.toMatchObject({ code: 'MAKER_CHECKER_INVALID_STATE' });
  });

  test('valid distinct checker + valid factor → executor runs and action is executed', async () => {
    const action = fakeAction();
    PendingAdminAction.findByPk.mockResolvedValue(action);
    const executor = jest.fn().mockResolvedValue({ ok: true });
    svc.registerExecutor('test_action', executor);

    const result = await svc.approve({
      actionId: 'action-1',
      checkerUserId: 'checker-1',
      verifyCheckerSecondFactor: jest.fn().mockResolvedValue(true)
    });

    expect(executor).toHaveBeenCalledWith(action.payload, expect.any(Object));
    expect(action.status).toBe('executed');
    expect(action.checkerUserId).toBe('checker-1');
    expect(result.result).toEqual({ ok: true });
  });

  test('missing executor for the action type fails safe (no silent approval)', async () => {
    PendingAdminAction.findByPk.mockResolvedValue(fakeAction());
    await expect(svc.approve({
      actionId: 'action-1',
      checkerUserId: 'checker-1',
      verifyCheckerSecondFactor: jest.fn().mockResolvedValue(true)
    })).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('makerChecker.propose', () => {
  beforeEach(() => jest.clearAllMocks());
  test('creates a pending action with a TTL in the future', async () => {
    PendingAdminAction.create.mockImplementation((data) => Promise.resolve(data));
    const before = Date.now();
    const created = await svc.propose({ makerUserId: 'maker-1', actionType: 'test_action', amountUsd: '30000' });
    expect(created.status).toBe('pending');
    expect(created.makerUserId).toBe('maker-1');
    expect(created.amountUsd).toBe('30000');
    expect(new Date(created.expiresAt).getTime()).toBeGreaterThan(before);
  });
});
