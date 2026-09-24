require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, User, Crypto } = require('../../models');
const { PendingAdminAction } = require('../../modules/governance/governance.model');
const makerChecker = require('../../modules/governance/makerChecker.service');
const dualControl = require('../../modules/wallets/withdrawalDualControl.service');
const businessConfig = require('../../modules/config/businessConfig');

// USDT is a stable symbol → amlValuation values it 1:1 in USD, so the server-side USD magnitude
// of the withdrawal is deterministic (no SwapPair seeding needed). Default dual-control threshold
// is $5,000 (no seeded config row → fallback), hard ceiling $20,000.
async function seedUsdt() {
  return Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum' });
}
async function withdraw(user, usdt, amount, address = '0xclean') {
  return BlockchainTransaction.createWithdrawal({
    userId: user.id, cryptoId: usdt.id, amount, destinationAddress: address,
  });
}

beforeEach(async () => {
  await resetDb();
  businessConfig.clearCache();
  dualControl.register(); // wire the release executor into the engine (done at app boot in prod)
});
afterAll(async () => { await sequelize.close(); });

describe('large-withdrawal dual control (Maker-Checker wiring)', () => {
  test('a withdrawal at/under the threshold is NOT held and is claimable', async () => {
    const user = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(user, usdt, '10000');

    const w = await withdraw(user, usdt, '5000'); // exactly at threshold → not "above" → no hold
    expect(w.dualControlPending).toBe(false);
    expect(await PendingAdminAction.count()).toBe(0);
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(true);
  });

  test('a withdrawal above the threshold is HELD, proposes a pending action, and is NOT claimable', async () => {
    const user = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(user, usdt, '10000');

    const w = await withdraw(user, usdt, '6000');
    const held = await BlockchainTransaction.findByPk(w.id);
    expect(held.dualControlPending).toBe(true);
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(false);

    // The pending action carries the SERVER-computed USD magnitude, not a maker-declared value.
    const actions = await PendingAdminAction.findAll();
    expect(actions).toHaveLength(1);
    expect(actions[0].actionType).toBe('large_withdrawal_release');
    expect(actions[0].amountUsd).toBe('6000');
    expect(actions[0].makerUserId).toBe(user.id);
    expect(actions[0].payload.withdrawalId).toBe(w.id);
    expect(actions[0].status).toBe('pending');

    // Defense-in-depth: a direct transmit cannot bypass the dual-control hold.
    await expect(BlockchainTransaction.markWithdrawalAsSent(w.id, '0xhash', 0))
      .rejects.toThrow(/doble control/);
  });

  test('a distinct checker approval releases the hold → the withdrawal becomes claimable', async () => {
    const user = await f.seedUser();
    const checker = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(user, usdt, '10000');

    const w = await withdraw(user, usdt, '6000');
    const action = (await PendingAdminAction.findAll())[0];

    await makerChecker.approve({
      actionId: action.id,
      checkerUserId: checker.id,
      verifyCheckerSecondFactor: async () => true, // TOTP verified elsewhere; stubbed here
    });

    const released = await BlockchainTransaction.findByPk(w.id);
    expect(released.dualControlPending).toBe(false);
    expect((await PendingAdminAction.findByPk(action.id)).status).toBe('executed');
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(true);
  });

  test('the maker cannot be their own checker (4-eyes) → hold stays, withdrawal stays unclaimable', async () => {
    const user = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(user, usdt, '10000');

    const w = await withdraw(user, usdt, '6000');
    const action = (await PendingAdminAction.findAll())[0];

    await expect(makerChecker.approve({
      actionId: action.id,
      checkerUserId: user.id, // same human as the maker
      verifyCheckerSecondFactor: async () => true,
    })).rejects.toMatchObject({ code: 'MAKER_CHECKER_SAME_USER' });

    const stillHeld = await BlockchainTransaction.findByPk(w.id);
    expect(stillHeld.dualControlPending).toBe(true);
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(false);
  });

  test('above the $20k hard ceiling is held even if the threshold is misconfigured higher', async () => {
    await businessConfig.set('withdrawal_dual_control_usd_threshold', '50000');
    const user = await f.seedUser();
    const usdt = await seedUsdt();
    await f.seedBalance(user, usdt, '100000');

    const w = await withdraw(user, usdt, '30000'); // below the (bad) 50k threshold but above 20k ceiling
    expect((await BlockchainTransaction.findByPk(w.id)).dualControlPending).toBe(true);
  });
});
