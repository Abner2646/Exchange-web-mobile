require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { Order } = require('../../models');

let idemSeq = 0;
function placeOrder(user, { pair, side, orderType = 'limit', quantity, price }) {
  const body = { tradingPairId: pair.id, orderType, side, quantity };
  if (price !== undefined) body.price = price;
  return request(app)
    .post('/api/trading/orders')
    .set(f.authHeader(user))
    .set('Idempotency-Key', `idem-${Date.now()}-${idemSeq++}`)
    .send(body);
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

async function seedPair() {
  const btc = await f.seedCripto('BTC');
  const usdt = await f.seedCripto('USDT');
  const pair = await f.seedTradingPair({ base: btc, quote: usdt });
  return { btc, usdt, pair };
}

describe('POST /api/trading/orders — create + lock (synchronous)', () => {
  test('buy limit with sufficient quote → 201, order created, quote balance locked', async () => {
    const { usdt, pair } = await seedPair();
    const user = await f.seedUser();
    await f.seedBalance(user, usdt, '200');

    const res = await placeOrder(user, { pair, side: 'buy', quantity: 1, price: 100 });

    expect(res.status).toBe(201);
    expect(res.body.order).toBeDefined();

    // Locked = 1*100 + taker fee 0.1% of 100 = 100.1
    const bal = await f.getBalance(user, usdt);
    expect(bal.balanceDisponible).toBe('99.90000000');   // 200 - 100.1
    expect(bal.balanceBloqueado).toBe('100.10000000');
  });

  test('insufficient balance → 400 INSUFFICIENT_BALANCE, no order, balance untouched', async () => {
    const { usdt, pair } = await seedPair();
    const user = await f.seedUser();
    await f.seedBalance(user, usdt, '10');   // < required 100.1

    const res = await placeOrder(user, { pair, side: 'buy', quantity: 1, price: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(await Order.count()).toBe(0);
    expect((await f.getBalance(user, usdt)).balanceDisponible).toBe('10.00000000');
  });

  test('missing Idempotency-Key → 400', async () => {
    const { usdt, pair } = await seedPair();
    const user = await f.seedUser();
    await f.seedBalance(user, usdt, '200');

    const res = await request(app)
      .post('/api/trading/orders')
      .set(f.authHeader(user))
      .send({ tradingPairId: pair.id, orderType: 'limit', side: 'buy', quantity: 1, price: 100 });

    expect(res.status).toBe(400);
  });

  test('unknown pair (well-formed UUID) → 400 TRADING_PAIR_NOT_FOUND', async () => {
    const user = await f.seedUser();
    const res = await request(app)
      .post('/api/trading/orders')
      .set(f.authHeader(user))
      .set('Idempotency-Key', `idem-${Date.now()}-${idemSeq++}`)
      .send({ tradingPairId: '00000000-0000-4000-8000-000000000000', orderType: 'limit', side: 'buy', quantity: 1, price: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TRADING_PAIR_NOT_FOUND');
  });
});
