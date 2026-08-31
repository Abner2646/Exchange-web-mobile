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

    // Locked = 1*100 = 100. The taker fee is charged from the BASE received at
    // settlement (Binance-style), not reserved in quote — so the lock matches what
    // settlement actually consumes (no stuck reserve). See balanceManager.
    const bal = await f.getBalance(user, usdt);
    expect(bal.balanceDisponible).toBe('100.00000000');   // 200 - 100
    expect(bal.balanceBloqueado).toBe('100.00000000');
  });

  test('insufficient balance → 400 INSUFFICIENT_BALANCE, no order, balance untouched', async () => {
    const { usdt, pair } = await seedPair();
    const user = await f.seedUser();
    await f.seedBalance(user, usdt, '10');   // < required 100

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

const orderBookService = require('../../services/trading/orderBook.service');
const { Trade } = require('../../models');

// Set up a resting maker order that is 'open' and ready to be matched against.
// Its own matchOrder finds no opposite side and just moves it pending -> open.
async function restingOrder(user, args) {
  const res = await placeOrder(user, args);
  expect(res.status).toBe(201);
  await orderBookService.matchOrder(res.body.order.id); // pending -> open, no match
  return res.body.order.id;
}

describe('spot matching — service level (awaited)', () => {
  test('full fill: crossing buy takes a resting sell; Trade created, both settled', async () => {
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const pair = await f.seedTradingPair({ base: btc, quote: usdt });

    const seller = await f.seedUser();
    const buyer = await f.seedUser();
    await f.seedBalance(seller, btc, '1');     // locks 1 BTC on sell
    await f.seedBalance(buyer, usdt, '200');   // locks 100 on buy

    await restingOrder(seller, { pair, side: 'sell', quantity: 1, price: 100 });
    const buyRes = await placeOrder(buyer, { pair, side: 'buy', quantity: 1, price: 100 });
    expect(buyRes.status).toBe(201);

    // Await matching for determinism (barrier against the controller's background fire).
    await orderBookService.matchOrder(buyRes.body.order.id);

    expect(await Trade.count()).toBe(1);

    // Seller: base blocked -> 0, quote available += 100 - maker fee 0.1 = 99.9
    const sellerBtc = await f.getBalance(seller, btc);
    const sellerUsdt = await f.getBalance(seller, usdt);
    expect(sellerBtc.balanceBloqueado).toBe('0.00000000');
    expect(sellerBtc.balanceDisponible).toBe('0.00000000');
    expect(sellerUsdt.balanceDisponible).toBe('99.90000000');

    // Buyer: base available += 1 - taker fee 0.001 = 0.999; quote blocked 100 -> 0
    // fully consumed by the trade (no stuck fee reserve now that the lock matches
    // settlement); quote available stays at 100 (200 - 100 locked).
    const buyerBtc = await f.getBalance(buyer, btc);
    const buyerUsdt = await f.getBalance(buyer, usdt);
    expect(buyerBtc.balanceDisponible).toBe('0.99900000');
    expect(buyerUsdt.balanceDisponible).toBe('100.00000000');
    expect(buyerUsdt.balanceBloqueado).toBe('0.00000000'); // FIXED: no stuck fee reserve
  });

  test('partial fill: buy 0.4 against resting sell 1; sell partially_filled 0.6', async () => {
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const pair = await f.seedTradingPair({ base: btc, quote: usdt });

    const seller = await f.seedUser();
    const buyer = await f.seedUser();
    await f.seedBalance(seller, btc, '1');
    await f.seedBalance(buyer, usdt, '200');

    const sellId = await restingOrder(seller, { pair, side: 'sell', quantity: 1, price: 100 });
    const buyRes = await placeOrder(buyer, { pair, side: 'buy', quantity: 0.4, price: 100 });
    await orderBookService.matchOrder(buyRes.body.order.id);

    expect(await Trade.count()).toBe(1);

    const sellOrder = await Order.findByPk(sellId);
    const buyOrder = await Order.findByPk(buyRes.body.order.id);
    expect(sellOrder.status).toBe('partially_filled');
    // quantityRemaining is DECIMAL(_,18) on Order (vs 8 dp on balances).
    expect(sellOrder.quantityRemaining).toBe('0.600000000000000000');
    expect(buyOrder.status).toBe('filled');

    // Seller: base blocked -> 0.6, quote available += 40 - maker fee 0.04 = 39.96
    expect((await f.getBalance(seller, btc)).balanceBloqueado).toBe('0.60000000');
    expect((await f.getBalance(seller, usdt)).balanceDisponible).toBe('39.96000000');
    // Buyer: base available += 0.4 - taker 0.0004 = 0.3996
    expect((await f.getBalance(buyer, btc)).balanceDisponible).toBe('0.39960000');
  });

  test('self-trade prevention: same user both sides does not match', async () => {
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const pair = await f.seedTradingPair({ base: btc, quote: usdt });

    const user = await f.seedUser();
    await f.seedBalance(user, btc, '1');
    await f.seedBalance(user, usdt, '200');

    await restingOrder(user, { pair, side: 'sell', quantity: 1, price: 100 });
    const buyRes = await placeOrder(user, { pair, side: 'buy', quantity: 1, price: 100 });
    await orderBookService.matchOrder(buyRes.body.order.id);

    expect(await Trade.count()).toBe(0);
    const buyOrder = await Order.findByPk(buyRes.body.order.id);
    expect(buyOrder.status).toBe('open'); // rested, no match
  });
});

describe('DELETE /api/trading/orders/:orderId — cancel releases locked balance', () => {
  test('cancelling a resting buy returns the locked quote to available', async () => {
    const { usdt, pair } = await seedPair();
    const user = await f.seedUser();
    await f.seedBalance(user, usdt, '200');

    const orderId = await restingOrder(user, { pair, side: 'buy', quantity: 1, price: 100 });
    expect((await f.getBalance(user, usdt)).balanceBloqueado).toBe('100.00000000');

    const res = await request(app)
      .delete(`/api/trading/orders/${orderId}`)
      .set(f.authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const bal = await f.getBalance(user, usdt);
    expect(bal.balanceDisponible).toBe('200.00000000'); // fully returned
    expect(bal.balanceBloqueado).toBe('0.00000000');
    expect((await Order.findByPk(orderId)).status).toBe('cancelled');
  });

  test('a different user cannot cancel someone else’s order', async () => {
    const { usdt, pair } = await seedPair();
    const owner = await f.seedUser();
    const stranger = await f.seedUser();
    await f.seedBalance(owner, usdt, '200');

    const orderId = await restingOrder(owner, { pair, side: 'buy', quantity: 1, price: 100 });

    const res = await request(app)
      .delete(`/api/trading/orders/${orderId}`)
      .set(f.authHeader(stranger));

    expect(res.status).toBe(400);
    expect((await Order.findByPk(orderId)).status).not.toBe('cancelled');
    expect((await f.getBalance(owner, usdt)).balanceBloqueado).toBe('100.00000000'); // still locked
  });

  test('a filled order cannot be cancelled', async () => {
    const { btc, usdt, pair } = await seedPair();
    const seller = await f.seedUser();
    const buyer = await f.seedUser();
    await f.seedBalance(seller, btc, '1');
    await f.seedBalance(buyer, usdt, '200');

    await restingOrder(seller, { pair, side: 'sell', quantity: 1, price: 100 });
    const buyRes = await placeOrder(buyer, { pair, side: 'buy', quantity: 1, price: 100 });
    await orderBookService.matchOrder(buyRes.body.order.id);
    expect((await Order.findByPk(buyRes.body.order.id)).status).toBe('filled');

    const res = await request(app)
      .delete(`/api/trading/orders/${buyRes.body.order.id}`)
      .set(f.authHeader(buyer));

    expect(res.status).toBe(400);
  });
});
