require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, User, AmlCase } = require('../../models');
const businessConfig = require('../../modules/config/businessConfig');
const denylist = require('../../modules/aml/denylist.model');

// NOTE: f.seedCripto(symbol) hard-codes network 'test', so create the crypto
// explicitly with network 'ethereum' here and add denylist entries with the SAME
// network. For the balance/withdrawal seeding, mirror
// tests/integration/ethWithdrawal.integration.test.js (it shows the exact funding
// setup createWithdrawal's blockBalance needs).
const { Crypto } = require('../../models');
async function seedAndWithdraw(address) {
  const user = await f.seedUser();
  const eth = await Crypto.create({ symbol: 'ETH', name: 'ETH', network: 'ethereum' });
  await f.seedBalance(user, eth, '10'); // funds funding:available so blockBalance can deduct
  const w = await BlockchainTransaction.createWithdrawal({
    userId: user.id, cryptoId: eth.id, amount: '1', destinationAddress: address,
  });
  return { user, eth, w };
}

beforeEach(async () => {
  await resetDb();
  businessConfig.clearCache();
});
afterAll(async () => { await sequelize.close(); });

describe('S5 withdrawal hold', () => {
  test('monitoring OFF: denylisted address is NOT held (byte-for-byte legacy)', async () => {
    await denylist.addAddress({ address: '0xbad', network: 'ethereum', source: 'OFAC' });
    const { w } = await seedAndWithdraw('0xbad');
    expect(w.requiresApproval).toBe(false);
    expect(await AmlCase.count()).toBe(0);
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(true); // claimable
  });

  test('enforcement ON + denylisted: held, case opened, risk raised, NOT claimable', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    await businessConfig.set('aml.holdEnforcement.enabled', 'true');
    await denylist.addAddress({ address: '0xbad', network: 'ethereum', source: 'OFAC' });
    const { user, w } = await seedAndWithdraw('0xbad');
    const held = await BlockchainTransaction.findByPk(w.id);
    expect(held.requiresApproval).toBe(true);
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(false); // NOT claimable
    const cases = await AmlCase.findAll();
    expect(cases).toHaveLength(1);
    expect(cases[0].signalId).toBe('S5');
    expect(cases[0].severity).toBe('high');
    const u = await User.findByPk(user.id);
    expect(u.amlRiskLevel).toBe('high');
    expect(u.amlReviewPending).toBe(true);
    // Defense-in-depth: even a direct markWithdrawalAsSent cannot transmit a held row.
    await expect(BlockchainTransaction.markWithdrawalAsSent(w.id, '0xhash', 0))
      .rejects.toThrow(/hold AML/);
  });

  test('shadow mode (monitoring ON, enforcement OFF): case opened but NOT held', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    await businessConfig.set('aml.holdEnforcement.enabled', 'false');
    await denylist.addAddress({ address: '0xbad', network: 'ethereum', source: 'OFAC' });
    const { w } = await seedAndWithdraw('0xbad');
    expect(w.requiresApproval).toBe(false); // NOT held
    expect(await AmlCase.count()).toBe(1); // but observed
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(true); // proceeds normally
  });

  test('monitoring ON, clean address: no case, claimable', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    await businessConfig.set('aml.holdEnforcement.enabled', 'true');
    const { w } = await seedAndWithdraw('0xclean');
    expect(w.requiresApproval).toBe(false);
    expect(await AmlCase.count()).toBe(0);
  });
});
