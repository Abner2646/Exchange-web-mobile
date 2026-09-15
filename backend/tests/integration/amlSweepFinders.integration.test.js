// backend/tests/integration/amlSweepFinders.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, P2PTransaction, Crypto, P2POffer, PaymentMethod } = require('../../models');
const da = require('../../modules/aml/amlDataAccess');

const HOUR = 3600 * 1000;
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

async function backdate(id, ts) {
  await sequelize.query('UPDATE blockchain_transactions SET created_at = :ts WHERE id = :id', { replacements: { ts, id } });
}
async function tx(over) {
  const row = await BlockchainTransaction.create({
    userId: over.userId, cryptoId: over.cryptoId, type: over.type, amount: over.amount,
    status: over.status, txHash: `h-${Math.random()}`, confirmations: 0, requiresApproval: false,
  });
  if (over.created_at) await backdate(row.id, over.created_at);
  return row;
}

describe('amlDataAccess recent (cross-user) finders', () => {
  test('recentWithdrawals + recentConfirmedDeposits exclude failed/pending and old rows, across users', async () => {
    const u1 = await f.seedUser(); const u2 = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const now = Date.now();
    await tx({ userId: u1.id, cryptoId: c.id, type: 'withdrawal', amount: '1', status: 'confirmed', created_at: new Date(now - HOUR) });  // included (transmitted)
    await tx({ userId: u2.id, cryptoId: c.id, type: 'withdrawal', amount: '2', status: 'failed', created_at: new Date(now - HOUR) });   // excluded
    await tx({ userId: u1.id, cryptoId: c.id, type: 'withdrawal', amount: '4', status: 'processing', created_at: new Date(now - HOUR) }); // excluded: not yet transmitted
    await tx({ userId: u1.id, cryptoId: c.id, type: 'withdrawal', amount: '3', status: 'completed', created_at: new Date(now - 72 * HOUR) }); // too old
    await tx({ userId: u2.id, cryptoId: c.id, type: 'deposit', amount: '5', status: 'confirmed', created_at: new Date(now - HOUR) });
    await tx({ userId: u2.id, cryptoId: c.id, type: 'deposit', amount: '9', status: 'pending', created_at: new Date(now - HOUR) });   // excluded

    const since = new Date(now - 48 * HOUR);
    const wds = await da.recentWithdrawals(since);
    expect(wds.map(r => r.amount)).toEqual(['1.00000000']);
    expect(wds[0].userId).toBe(u1.id);
    const deps = await da.recentConfirmedDeposits(since);
    expect(deps.map(r => r.amount)).toEqual(['5.00000000']);
  });

  test('recentCompletedP2P returns completed pairs in the window', async () => {
    const a = await f.seedUser(); const b = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const offer = await P2POffer.create({ userId: a.id, type: 'sell', cryptoId: c.id, minAmount: '0.001', maxAmount: '10', unitPrice: '1', fiatCurrency: 'USD', active: true });
    const pm = await PaymentMethod.create({ name: 'Bank Transfer' });
    const base = { offerId: offer.id, cryptoId: c.id, amount: '1', unitPrice: '1', fiatAmount: '1', fiatCurrency: 'USD', paymentMethodId: pm.id };
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id, status: 'completed' });
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id, status: 'cancelled' }); // excluded
    const rows = await da.recentCompletedP2P(new Date(Date.now() - 48 * HOUR));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ buyerId: a.id, sellerId: b.id });
    expect(rows[0].id).toBeDefined();
  });
});
