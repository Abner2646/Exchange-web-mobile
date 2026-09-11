require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { Swap, MasterWallet } = require('../../models');
const posting = require('../../modules/balances/ledger/postingService');
const recon = require('../../modules/balances/ledger/reconciliation');
const { PURPOSES } = require('../../modules/balances/ledger/ledgerAccounts');

// El swap es money-path → exige Idempotency-Key. Cada request usa una key única.
let idem = 0;
const idemKey = () => `idem-${Date.now()}-${idem++}`;

const casa = (purpose, cryptoId) =>
  posting.getAccountBalance({ ownerId: null, purpose, cryptoId });

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

// BTC/USDT, price 0.1, commission 1%. Buy 3 BTC:
//   quoteAmount = 3 * 0.1    = 0.3
//   comision      = 0.3 * 1%   = 0.003
//   required USDT = 0.3 + 0.003 = 0.303
async function seedBuyScenario() {
  const user = await f.seedUser();
  const btc = await f.seedCripto('BTC');
  const usdt = await f.seedCripto('USDT');
  const par = await f.seedPar({ base: btc, quote: usdt, price: '0.1', comision: '1' });
  const wallet = await f.seedWalletMaestra(usdt);
  await f.seedBalance(user, usdt, '1');   // enough to cover 0.303
  return { user, btc, usdt, par, wallet };
}

describe('POST /api/intercambioExchange (swap) — buy', () => {
  test('debits quote, credits base, fee to fee_revenue, house counterparty is treasury', async () => {
    const { user, btc, usdt, par, wallet } = await seedBuyScenario();

    const res = await request(app)
      .post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .set('Idempotency-Key', idemKey())
      .send({ pairId: par.id, type: 'buy', baseAmount: 3 });

    expect(res.status).toBe(201);

    // Exact canonical strings through the DECIMAL(28,8) round-trip.
    expect((await f.getBalance(user, usdt)).availableBalance).toBe('0.69700000'); // 1 - 0.303
    expect((await f.getBalance(user, btc)).availableBalance).toBe('3.00000000');  // 0 + 3

    // Paso D enrichment: the commission goes to the ledger fee_revenue account
    // (in quote), and the house inventory (treasury) is the explicit counterparty.
    expect(await casa(PURPOSES.FEE_REVENUE, usdt.id)).toBe('0.00300000'); // commission
    expect(await casa(PURPOSES.TREASURY, usdt.id)).toBe('0.30000000');    // house receives value
    expect(await casa(PURPOSES.TREASURY, btc.id)).toBe('-3.00000000');    // house hands out base

    // The master wallet is NO LONGER credited with the commission.
    const walletAfter = await MasterWallet.findByPk(wallet.id);
    expect(walletAfter.totalBalance).toBe('0.00000000');

    const row = await Swap.findOne({ where: { userId: user.id } });
    expect(row).not.toBeNull();
    expect(row.status).toBe('completed');

    // El libro cierra: interno (proyección==SUM) y externo (net-zero por cripto).
    expect((await recon.reconcileInternal()).ok).toBe(true);
    expect((await recon.reconcileExternal()).ok).toBe(true);
  });

  test('GET /me/balances returns the post-trade balances as canonical strings', async () => {
    const { user, usdt, par } = await seedBuyScenario();
    await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .set('Idempotency-Key', idemKey())
      .send({ pairId: par.id, type: 'buy', baseAmount: 3 });

    const res = await request(app).get('/api/intercambioExchange/me/balances').set(f.authHeader(user));
    expect(res.status).toBe(200);
    const usdtEntry = res.body.find((b) => b.crypto.symbol === 'USDT');
    expect(usdtEntry.availableBalance).toBe('0.69700000');
    // Forma unificada (2026-09-03): este endpoint ahora expone el desglose por
    // compartimento, igual que /balances/my/balances. Sin balance Spot → funding
    // == total.
    expect(usdtEntry.compartments.funding.available).toBe('0.69700000');
    expect(usdtEntry.compartments.spot.available).toBe('0.00000000');
  });

  // Paso C: /me/balances lee la proyección del ledger (balances_users ya no
  // existe). Sólo aparecen las criptos con balance real en el ledger.
  test('GET /me/balances lists only cryptos with a real ledger balance', async () => {
    const user = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    await f.seedBalance(user, btc, '2');
    await f.seedCripto('USDT'); // sin saldo → no debe aparecer

    const res = await request(app).get('/api/intercambioExchange/me/balances').set(f.authHeader(user));
    expect(res.status).toBe(200);
    const symbols = res.body.map((b) => b.crypto.symbol);
    expect(symbols).toContain('BTC');
    expect(symbols).not.toContain('USDT'); // sin movimiento en el ledger
    const btcEntry = res.body.find((b) => b.crypto.symbol === 'BTC');
    expect(btcEntry.availableBalance).toBe('2.00000000');
  });
});

describe('POST /api/intercambioExchange (swap) — sell', () => {
  // BTC/USDT, price 1, commission 1%. Sell 0.29 BTC:
  //   quoteAmount = 0.29 * 1   = 0.29
  //   comision      = 0.29 * 1%  = 0.0029
  //   net USDT      = 0.29 - 0.0029 = 0.2871
  test('debits base, credits quote by net (value - commission)', async () => {
    const user = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const par = await f.seedPar({ base: btc, quote: usdt, price: '1', comision: '1' });
    await f.seedWalletMaestra(usdt);
    await f.seedBalance(user, btc, '0.29');

    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .set('Idempotency-Key', idemKey())
      .send({ pairId: par.id, type: 'sell', baseAmount: 0.29 });

    expect(res.status).toBe(201);
    expect((await f.getBalance(user, btc)).availableBalance).toBe('0.00000000');
    expect((await f.getBalance(user, usdt)).availableBalance).toBe('0.28710000');

    // Fee (in quote) to fee_revenue; treasury is the counterparty on both sides.
    expect(await casa(PURPOSES.FEE_REVENUE, usdt.id)).toBe('0.00290000'); // 0.29 * 1%
    expect(await casa(PURPOSES.TREASURY, btc.id)).toBe('0.29000000');     // house receives base
    expect(await casa(PURPOSES.TREASURY, usdt.id)).toBe('-0.29000000');   // house hands out quote value
  });
});

describe('POST /api/intercambioExchange (swap) — rejections', () => {
  async function seedPairOnly(userOverrides = {}) {
    const user = await f.seedUser(userOverrides);
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const par = await f.seedPar({ base: btc, quote: usdt, price: '0.1', comision: '1' });
    await f.seedWalletMaestra(usdt);
    return { user, btc, usdt, par };
  }

  test('insufficient balance → 400 EXCHANGE_INSUFFICIENT_BALANCE, balances unchanged', async () => {
    const { user, usdt, par } = await seedPairOnly();
    await f.seedBalance(user, usdt, '0.1');   // < required 0.303

    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .set('Idempotency-Key', idemKey())
      .send({ pairId: par.id, type: 'buy', baseAmount: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXCHANGE_INSUFFICIENT_BALANCE');
    expect((await f.getBalance(user, usdt)).availableBalance).toBe('0.10000000'); // rolled back
  });

  test('daily limit exceeded → 400 EXCHANGE_DAILY_LIMIT_EXCEEDED, balances unchanged', async () => {
    const { user, usdt, par } = await seedPairOnly({ dailyLimitUsd: 0.1 });
    await f.seedBalance(user, usdt, '1');   // enough balance, but over daily limit

    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .set('Idempotency-Key', idemKey())
      .send({ pairId: par.id, type: 'buy', baseAmount: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXCHANGE_DAILY_LIMIT_EXCEEDED');
    expect((await f.getBalance(user, usdt)).availableBalance).toBe('1.00000000'); // rolled back
  });

  test('pair not found → 404 EXCHANGE_PAIR_NOT_FOUND', async () => {
    const user = await f.seedUser();
    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .set('Idempotency-Key', idemKey())
      .send({ pairId: '00000000-0000-4000-8000-000000000000', type: 'buy', baseAmount: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EXCHANGE_PAIR_NOT_FOUND');
  });

  test('no token → 401 (legacy auth shape, not the canonical envelope)', async () => {
    const res = await request(app).post('/api/intercambioExchange/')
      .send({ pairId: '00000000-0000-4000-8000-000000000000', type: 'buy', baseAmount: 1 });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);  // authMiddleware returns { success:false, message }
  });
});
