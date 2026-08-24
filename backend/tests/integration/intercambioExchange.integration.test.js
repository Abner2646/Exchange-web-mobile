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
