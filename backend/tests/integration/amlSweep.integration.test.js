// backend/tests/integration/amlSweep.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, Crypto, AmlCase, User } = require('../../models');
const businessConfig = require('../../modules/config/businessConfig');
const sweep = require('../../modules/aml/amlSweep');
const consumer = require('../../modules/aml/amlConsumer');

beforeEach(async () => { await resetDb(); businessConfig.clearCache(); });
afterAll(async () => { await sequelize.close(); });

async function seedFastDepositThenWithdrawal() {
  const u = await f.seedUser();
  const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
  await BlockchainTransaction.create({ userId: u.id, cryptoId: c.id, type: 'deposit', amount: '1', status: 'confirmed', txHash: `d-${Math.random()}`, confirmations: 3, requiresApproval: false });
  const w = await BlockchainTransaction.create({ userId: u.id, cryptoId: c.id, type: 'withdrawal', amount: '0.95', status: 'processing', txHash: `w-${Math.random()}`, confirmations: 0, requiresApproval: false });
  return { u, c, w };
}

describe('amlSweep end-to-end', () => {
  test('monitoring OFF → sweep is a no-op', async () => {
    await seedFastDepositThenWithdrawal();
    const res = await sweep.runSweep();
    expect(res.scanned).toBe(0);
    expect(await AmlCase.count()).toBe(0);
  });

  test('sweep opens the S3 case the on-event path would have (safety net)', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    const { u } = await seedFastDepositThenWithdrawal();
    const res = await sweep.runSweep();
    expect(res.scanned).toBeGreaterThanOrEqual(2); // deposit + withdrawal
    const s3 = await AmlCase.findOne({ where: { signalId: 'S3' } });
    expect(s3).not.toBeNull();
    expect((await User.findByPk(u.id)).amlRiskLevel).toBe('high');
  });

  test('idempotent with on-event: if handleEvent already opened the case, the sweep opens no duplicate', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    const { u, c, w } = await seedFastDepositThenWithdrawal();
    // On-event first: the real handler opens the S3 case.
    await consumer.handleEvent({ id: w.id, type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: w.id, userId: u.id, cryptoId: c.id, amount: '0.95' } });
    expect(await AmlCase.count()).toBe(1);
    // Then the sweep replays the same activity → still exactly one case.
    await sweep.runSweep();
    expect(await AmlCase.count()).toBe(1);
  });
});
