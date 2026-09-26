require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { Crypto } = require('../../models');
const { PendingAdminAction } = require('../../modules/governance/governance.model');
const makerChecker = require('../../modules/governance/makerChecker.service');
const adminDualControl = require('../../modules/balances/adminBalanceDualControl.service');
const businessConfig = require('../../modules/config/businessConfig');

// USDT is a stable symbol → amlValuation values it 1:1 in USD, so the server-side USD magnitude is
// deterministic (no SwapPair seeding). Default admin threshold $5,000 (no seeded row → fallback).
async function seedUsdt() {
  return Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum' });
}

// Replicates the controller's decision: value server-side, and if it crosses the threshold, propose a
// deferred Maker-Checker action instead of posting. Returns the pending action (nothing has moved yet).
async function proposeUpdate(operator, usdt, userId, amount, type = 'available') {
  const dc = await adminDualControl.evaluate(usdt.id, amount);
  expect(dc.dualControl).toBe(true);
  return adminDualControl.propose({
    makerUserId: operator.id,
    actionType: adminDualControl.ACTIONS.UPDATE,
    payload: { userId, cryptoId: usdt.id, amount: String(amount), type },
    amountUsd: dc.amountUsd,
  });
}

beforeEach(async () => {
  await resetDb();
  businessConfig.clearCache();
  adminDualControl.register(); // wire the executors into the engine (done at app boot in prod)
});
afterAll(async () => { await sequelize.close(); });

describe('admin balance mutation dual control — deferred posting (nothing moves until approval)', () => {
  test('a large manual adjustment is proposed and posts NOTHING until a distinct checker approves', async () => {
    const operator = await f.seedUser();
    const checker = await f.seedUser();
    const target = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(target, usdt, '10000');

    const action = await proposeUpdate(operator, usdt, target.id, '6000');

    // Nothing moved at propose time.
    expect((await f.getBalance(target, usdt)).availableBalance).toBe('10000.00000000');
    expect(action.actionType).toBe('admin_balance_update');
    expect(action.amountUsd).toBe('6000');
    expect(action.status).toBe('pending');

    // A distinct checker approves → the executor posts the credit inside the approval tx.
    await makerChecker.approve({
      actionId: action.id, checkerUserId: checker.id, verifyCheckerSecondFactor: async () => true,
    });
    expect((await f.getBalance(target, usdt)).availableBalance).toBe('16000.00000000');
    expect((await PendingAdminAction.findByPk(action.id)).status).toBe('executed');
  });

  test('rejecting a proposed adjustment moves NO money (nothing was held)', async () => {
    const operator = await f.seedUser();
    const checker = await f.seedUser();
    const target = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(target, usdt, '10000');

    const action = await proposeUpdate(operator, usdt, target.id, '6000');
    await makerChecker.reject({ actionId: action.id, checkerUserId: checker.id, reason: 'no' });

    expect((await f.getBalance(target, usdt)).availableBalance).toBe('10000.00000000');
    expect((await PendingAdminAction.findByPk(action.id)).status).toBe('rejected');
  });

  test('the maker cannot approve their own admin balance action (4-eyes)', async () => {
    const operator = await f.seedUser();
    const target = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(target, usdt, '10000');

    const action = await proposeUpdate(operator, usdt, target.id, '6000');
    await expect(makerChecker.approve({
      actionId: action.id, checkerUserId: operator.id, verifyCheckerSecondFactor: async () => true,
    })).rejects.toMatchObject({ code: 'MAKER_CHECKER_SAME_USER' });
    expect((await f.getBalance(target, usdt)).availableBalance).toBe('10000.00000000'); // untouched
  });

  test('a large cross-user transfer moves funds only on approval', async () => {
    const operator = await f.seedUser();
    const checker = await f.seedUser();
    const from = await f.seedUser();
    const to = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(from, usdt, '10000');

    const dc = await adminDualControl.evaluate(usdt.id, '6000');
    const action = await adminDualControl.propose({
      makerUserId: operator.id,
      actionType: adminDualControl.ACTIONS.TRANSFER,
      payload: { fromUserId: from.id, toUserId: to.id, cryptoId: usdt.id, amount: '6000', reference: `admin-transfer:test-${from.id}` },
      amountUsd: dc.amountUsd,
    });

    // Nothing moved yet (the recipient has no ledger account at all → '0').
    expect((await f.getBalance(from, usdt)).availableBalance).toBe('10000.00000000');
    expect((await f.getBalance(to, usdt)).availableBalance).toBe('0');

    await makerChecker.approve({
      actionId: action.id, checkerUserId: checker.id, verifyCheckerSecondFactor: async () => true,
    });
    expect((await f.getBalance(from, usdt)).availableBalance).toBe('4000.00000000');
    expect((await f.getBalance(to, usdt)).availableBalance).toBe('6000.00000000');
  });

  test('a large block moves available→blocked only on approval', async () => {
    const operator = await f.seedUser();
    const checker = await f.seedUser();
    const target = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(target, usdt, '10000');

    const dc = await adminDualControl.evaluate(usdt.id, '6000');
    const action = await adminDualControl.propose({
      makerUserId: operator.id,
      actionType: adminDualControl.ACTIONS.BLOCK,
      payload: { userId: target.id, cryptoId: usdt.id, amount: '6000' },
      amountUsd: dc.amountUsd,
    });
    expect((await f.getBalance(target, usdt)).blockedBalance).toBe('0'); // no blocked account yet → nothing moved

    await makerChecker.approve({
      actionId: action.id, checkerUserId: checker.id, verifyCheckerSecondFactor: async () => true,
    });
    const bal = await f.getBalance(target, usdt);
    expect(bal.availableBalance).toBe('4000.00000000');
    expect(bal.blockedBalance).toBe('6000.00000000');
  });

  test('an adjustment at/under the threshold is NOT dual-controlled (executes immediately)', async () => {
    const usdt = await seedUsdt();
    const dc = await adminDualControl.evaluate(usdt.id, '5000'); // exactly at threshold → not "above"
    expect(dc.dualControl).toBe(false);
  });
});
