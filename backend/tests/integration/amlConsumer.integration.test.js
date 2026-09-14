// backend/tests/integration/amlConsumer.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, P2PTransaction, Crypto, AmlCase, User, P2POffer, PaymentMethod } = require('../../models');
const businessConfig = require('../../modules/config/businessConfig');
const consumer = require('../../modules/aml/amlConsumer');
const { randomUUID } = require('crypto');

beforeEach(async () => { await resetDb(); businessConfig.clearCache(); });
afterAll(async () => { await sequelize.close(); });

async function deposit(userId, cryptoId, amount, minutesAgo) {
  return BlockchainTransaction.create({ userId, cryptoId, type: 'deposit', amount, status: 'confirmed', txHash: `d-${Math.random()}`, confirmations: 3, requiresApproval: false, created_at: new Date(Date.now() - minutesAgo * 60000) });
}

describe('amlConsumer (S3, S4)', () => {
  test('monitoring OFF → no case', async () => {
    const u = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    await deposit(u.id, c.id, '1', 5);
    await consumer.handleEvent({ id: randomUUID(), type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: 'w1', userId: u.id, cryptoId: c.id, amount: '0.95' } });
    expect(await AmlCase.count()).toBe(0);
  });

  test('S3 fires on a fast deposit→withdrawal and opens a high case + raises risk', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    const u = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    await deposit(u.id, c.id, '1', 5); // 5 min ago
    const evtId = randomUUID();
    await consumer.handleEvent({ id: evtId, type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: 'w1', userId: u.id, cryptoId: c.id, amount: '0.95' } });
    const cases = await AmlCase.findAll();
    expect(cases).toHaveLength(1);
    expect(cases[0].signalId).toBe('S3');
    expect((await User.findByPk(u.id)).amlRiskLevel).toBe('high');
    // idempotent: same event again → still one case (dedupeKey is the same)
    await consumer.handleEvent({ id: randomUUID(), type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: 'w1', userId: u.id, cryptoId: c.id, amount: '0.95' } });
    expect(await AmlCase.count()).toBe(1);
  });

  test('S4 fires when the same P2P pair repeats past the threshold', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    await businessConfig.set('aml.s4.count', '2');
    const a = await f.seedUser(); const b = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    // Real FK dependencies required by the p2p_transactions table
    const offer = await P2POffer.create({ userId: a.id, type: 'sell', cryptoId: c.id, minAmount: '0.001', maxAmount: '10', unitPrice: '1', fiatCurrency: 'USD', active: true });
    const pm = await PaymentMethod.create({ name: 'Bank Transfer' });
    const base = { offerId: offer.id, cryptoId: c.id, amount: '1', unitPrice: '1', fiatAmount: '1', fiatCurrency: 'USD', paymentMethodId: pm.id, status: 'completed' };
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id });
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id });
    await consumer.handleEvent({ id: randomUUID(), type: 'P2PTransactionCompleted', payload: { buyerId: a.id, sellerId: b.id, transaction: { id: 'p1' } } });
    const cases = await AmlCase.findAll();
    expect(cases).toHaveLength(1);
    expect(cases[0].signalId).toBe('S4');
    // both parties are named in the case evidence → the seller's raised risk is
    // traceable to a case (no flag without a case).
    expect(cases[0].evidence.buyerId).toBe(a.id);
    expect(cases[0].evidence.sellerId).toBe(b.id);
    // both parties flagged
    expect((await User.findByPk(a.id)).amlRiskLevel).toBe('medium');
    expect((await User.findByPk(b.id)).amlRiskLevel).toBe('medium');
  });
});
