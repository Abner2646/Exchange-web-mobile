require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { IntercambioExchange, WalletMaestra } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

// BTC/USDT, precio 0.1, commission 1%. Buy 3 BTC:
//   cantidadQuote = 3 * 0.1    = 0.3
//   comision      = 0.3 * 1%   = 0.003
//   required USDT = 0.3 + 0.003 = 0.303
async function seedBuyScenario() {
  const user = await f.seedUser();
  const btc = await f.seedCripto('BTC');
  const usdt = await f.seedCripto('USDT');
  const par = await f.seedPar({ base: btc, quote: usdt, precio: '0.1', comision: '1' });
  const wallet = await f.seedWalletMaestra(usdt);
  await f.seedBalance(user, usdt, '1');   // enough to cover 0.303
  return { user, btc, usdt, par, wallet };
}

describe('POST /api/intercambioExchange (swap) — buy', () => {
  test('debits quote by required, credits base, sends commission to wallet maestra', async () => {
    const { user, btc, usdt, par, wallet } = await seedBuyScenario();

    const res = await request(app)
      .post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'compra', cantidadBase: 3 });

    expect(res.status).toBe(201);

    // Exact canonical strings through the DECIMAL(28,8) round-trip.
    expect((await f.getBalance(user, usdt)).balanceDisponible).toBe('0.69700000'); // 1 - 0.303
    expect((await f.getBalance(user, btc)).balanceDisponible).toBe('3.00000000');  // 0 + 3

    const walletAfter = await WalletMaestra.findByPk(wallet.id);
    expect(walletAfter.balanceTotal).toBe('0.00300000');   // commission

    const row = await IntercambioExchange.findOne({ where: { usuarioId: user.id } });
    expect(row).not.toBeNull();
    expect(row.estado).toBe('completado');
  });

  test('GET /me/balances returns the post-trade balances as canonical strings', async () => {
    const { user, usdt, par } = await seedBuyScenario();
    await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'compra', cantidadBase: 3 });

    const res = await request(app).get('/api/intercambioExchange/me/balances').set(f.authHeader(user));
    expect(res.status).toBe(200);
    const usdtEntry = res.body.find((b) => b.criptomoneda.symbol === 'USDT');
    expect(usdtEntry.balanceDisponible).toBe('0.69700000');
  });
});

describe('POST /api/intercambioExchange (swap) — sell', () => {
  // BTC/USDT, precio 1, commission 1%. Sell 0.29 BTC:
  //   cantidadQuote = 0.29 * 1   = 0.29
  //   comision      = 0.29 * 1%  = 0.0029
  //   net USDT      = 0.29 - 0.0029 = 0.2871
  test('debits base, credits quote by net (value - commission)', async () => {
    const user = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const par = await f.seedPar({ base: btc, quote: usdt, precio: '1', comision: '1' });
    await f.seedWalletMaestra(usdt);
    await f.seedBalance(user, btc, '0.29');

    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'venta', cantidadBase: 0.29 });

    expect(res.status).toBe(201);
    expect((await f.getBalance(user, btc)).balanceDisponible).toBe('0.00000000');
    expect((await f.getBalance(user, usdt)).balanceDisponible).toBe('0.28710000');
  });
});

describe('POST /api/intercambioExchange (swap) — rejections', () => {
  async function seedPairOnly(userOverrides = {}) {
    const user = await f.seedUser(userOverrides);
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const par = await f.seedPar({ base: btc, quote: usdt, precio: '0.1', comision: '1' });
    await f.seedWalletMaestra(usdt);
    return { user, btc, usdt, par };
  }

  test('insufficient balance → 400 EXCHANGE_INSUFFICIENT_BALANCE, balances unchanged', async () => {
    const { user, usdt, par } = await seedPairOnly();
    await f.seedBalance(user, usdt, '0.1');   // < required 0.303

    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'compra', cantidadBase: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXCHANGE_INSUFFICIENT_BALANCE');
    expect((await f.getBalance(user, usdt)).balanceDisponible).toBe('0.10000000'); // rolled back
  });

  test('daily limit exceeded → 400 EXCHANGE_DAILY_LIMIT_EXCEEDED, balances unchanged', async () => {
    const { user, usdt, par } = await seedPairOnly({ limiteDiarioUsd: 0.1 });
    await f.seedBalance(user, usdt, '1');   // enough balance, but over daily limit

    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'compra', cantidadBase: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXCHANGE_DAILY_LIMIT_EXCEEDED');
    expect((await f.getBalance(user, usdt)).balanceDisponible).toBe('1.00000000'); // rolled back
  });

  test('pair not found → 404 EXCHANGE_PAIR_NOT_FOUND', async () => {
    const user = await f.seedUser();
    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: '00000000-0000-4000-8000-000000000000', tipo: 'compra', cantidadBase: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EXCHANGE_PAIR_NOT_FOUND');
  });

  test('no token → 401 (legacy auth shape, not the canonical envelope)', async () => {
    const res = await request(app).post('/api/intercambioExchange/')
      .send({ parId: '00000000-0000-4000-8000-000000000000', tipo: 'compra', cantidadBase: 1 });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);  // authMiddleware returns { success:false, message }
  });
});
