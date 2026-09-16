// tests/integration/amlDataAccess.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, P2PTransaction, Crypto, P2POffer, PaymentMethod } = require('../../models');
const da = require('../../modules/aml/amlDataAccess');

const HOUR = 3600 * 1000;
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

// Creates a BlockchainTransaction row, then back-dates created_at via raw SQL.
// Sequelize's timestamps:true always writes now() on INSERT and also ignores
// the created_at field in update() calls (managed field). Raw SQL is the only
// reliable way to set a past created_at in tests.
async function tx(over) {
  const row = await BlockchainTransaction.create({
    userId: over.userId, cryptoId: over.cryptoId, type: over.type, amount: over.amount,
    status: over.status, txHash: over.txHash || `h-${Math.random()}`, confirmations: 0,
    requiresApproval: false,
  });
  if (over.created_at) {
    await sequelize.query(
      'UPDATE blockchain_transactions SET created_at = :ts WHERE id = :id',
      { replacements: { ts: over.created_at, id: row.id } }
    );
    row.created_at = over.created_at;
  }
  return row;
}

describe('amlDataAccess', () => {
  test('withdrawalsInWindow excludes failed and old rows', async () => {
    const u = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const now = Date.now();
    await tx({ userId: u.id, cryptoId: c.id, type: 'withdrawal', amount: '1', status: 'processing', created_at: new Date(now - HOUR) });
    await tx({ userId: u.id, cryptoId: c.id, type: 'withdrawal', amount: '2', status: 'failed', created_at: new Date(now - HOUR) });
    await tx({ userId: u.id, cryptoId: c.id, type: 'withdrawal', amount: '3', status: 'completed', created_at: new Date(now - 48 * HOUR) });
    const rows = await da.withdrawalsInWindow(u.id, new Date(now - 24 * HOUR));
    // amount MUST stay a canonical Decimal string (no float leak): assert the string form.
    expect(rows.map(r => r.amount)).toEqual(['1.00000000']); // only the recent non-failed one
  });

  test('confirmedDepositsInWindow filters by crypto + confirmed status + window', async () => {
    const u = await f.seedUser();
    const btc = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const eth = await Crypto.create({ symbol: 'ETH', name: 'ETH', network: 'ethereum' });
    const now = Date.now();
    await tx({ userId: u.id, cryptoId: btc.id, type: 'deposit', amount: '5', status: 'confirmed', created_at: new Date(now - 10 * 60 * 1000) });
    await tx({ userId: u.id, cryptoId: btc.id, type: 'deposit', amount: '9', status: 'pending', created_at: new Date(now - 10 * 60 * 1000) });
    await tx({ userId: u.id, cryptoId: eth.id, type: 'deposit', amount: '7', status: 'confirmed', created_at: new Date(now - 10 * 60 * 1000) });
    const rows = await da.confirmedDepositsInWindow(u.id, btc.id, new Date(now - 60 * 60 * 1000));
    expect(rows.map(r => r.amount)).toEqual(['5.00000000']);
  });

  test('onchainMovementsInWindow returns both a non-failed withdrawal and a confirmed deposit', async () => {
    const u = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const now = Date.now();
    await tx({ userId: u.id, cryptoId: c.id, type: 'withdrawal', amount: '1', status: 'processing', created_at: new Date(now - HOUR) });
    await tx({ userId: u.id, cryptoId: c.id, type: 'deposit', amount: '2', status: 'confirmed', created_at: new Date(now - HOUR) });
    await tx({ userId: u.id, cryptoId: c.id, type: 'deposit', amount: '9', status: 'pending', created_at: new Date(now - HOUR) }); // excluded
    await tx({ userId: u.id, cryptoId: c.id, type: 'withdrawal', amount: '8', status: 'failed', created_at: new Date(now - HOUR) }); // excluded
    const rows = await da.onchainMovementsInWindow(u.id, new Date(now - 24 * HOUR));
    expect(rows.map(r => r.type).sort()).toEqual(['deposit', 'withdrawal']);
    expect(rows.map(r => r.amount).sort()).toEqual(['1.00000000', '2.00000000']);
  });

  test('userProfile returns both createdAt and dailyLimitUsd in one call', async () => {
    const u = await f.seedUser();
    // f.seedUser creates a User; set a known dailyLimitUsd
    await u.update({ dailyLimitUsd: '5000' });
    const p = await da.userProfile(u.id);
    expect(p.createdAt).toBeInstanceOf(Date);
    expect(p.dailyLimitUsd).toBe('5000.00'); // canonical decimal string
  });

  test('userProfile returns nulls for a missing user', async () => {
    // Users table uses UUIDs; use a nil UUID that cannot exist in the DB.
    const p = await da.userProfile('00000000-0000-0000-0000-000000000000');
    expect(p).toEqual({ createdAt: null, dailyLimitUsd: null });
  });

  test('userProfile returns null dailyLimitUsd when the field is null', async () => {
    const u = await f.seedUser();
    await u.update({ dailyLimitUsd: null });
    const p = await da.userProfile(u.id);
    expect(p.dailyLimitUsd).toBeNull();
  });

  test('p2pCompletedCountBetween counts the unordered pair, completed only, in window', async () => {
    const a = await f.seedUser(); const b = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    // Need real FK rows: a P2POffer and a PaymentMethod
    const offer = await P2POffer.create({
      userId: a.id, type: 'sell', cryptoId: c.id,
      minAmount: '0.001', maxAmount: '10', unitPrice: '1', fiatCurrency: 'USD', active: true,
    });
    const pm = await PaymentMethod.create({ name: 'Bank Transfer' });
    const base = { offerId: offer.id, cryptoId: c.id, amount: '1', unitPrice: '1', fiatAmount: '1', fiatCurrency: 'USD', paymentMethodId: pm.id };
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id, status: 'completed' });
    await P2PTransaction.create({ ...base, buyerId: b.id, sellerId: a.id, status: 'completed' }); // reversed pair still counts
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id, status: 'cancelled' }); // not counted
    const n = await da.p2pCompletedCountBetween(a.id, b.id, new Date(Date.now() - 7 * 24 * HOUR));
    expect(n).toBe(2);
  });
});
