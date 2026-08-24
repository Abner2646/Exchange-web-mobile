require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('factories + auth helper', () => {
  test('authTokenFor mints a token the auth middleware accepts', async () => {
    const user = await f.seedUser();               // emailVerificado: true by default
    const res = await request(app)
      .get('/api/intercambioExchange/me/balances')
      .set(f.authHeader(user));
    expect(res.status).toBe(200);
  });

  test('seedBalance persists and getBalance reads it back as a canonical string', async () => {
    const user = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    await f.seedBalance(user, btc, '1.5');
    const bal = await f.getBalance(user, btc);
    expect(bal.balanceDisponible).toBe('1.50000000');
  });
});
