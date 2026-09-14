// tests/integration/tradeEvent.integration.test.js
// Fase 6.2.1 slice 3 — TradeExecuted event
// Mirrors tradingMatching.integration.test.js: seed a BTC/USDT pair with two
// opposing users, place + rest a sell, place a crossing buy, call matchOrder,
// then assert that a TradeExecuted outbox row was written in the same DB txn.
require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const { OutboxEvent, Trade } = require('../../models');
const f = require('../helpers/factories');
const orderBookService = require('../../modules/trading/orderBook.service');

let idemSeq = 0;
const idemKey = () => `trade-evt-${Date.now()}-${idemSeq++}`;

function placeOrder(user, { pair, side, orderType = 'limit', quantity, price }) {
  const body = { tradingPairId: pair.id, orderType, side, quantity };
  if (price !== undefined) body.price = price;
  return request(app)
    .post('/api/trading/orders')
    .set(f.authHeader(user))
    .set('Idempotency-Key', idemKey())
    .send(body);
}

// Place and rest a maker order (pending → open, no match).
async function restingOrder(user, args) {
  const res = await placeOrder(user, args);
  expect(res.status).toBe(201);
  await orderBookService.matchOrder(res.body.order.id); // pending → open, no match
  return res.body.order.id;
}

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('TradeExecuted event', () => {
  test('a matched trade writes a TradeExecuted outbox row with correct payload', async () => {
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const pair = await f.seedTradingPair({ base: btc, quote: usdt });

    const seller = await f.seedUser();
    const buyer = await f.seedUser();
    await f.seedSpotBalance(seller, btc, '1');    // locks 1 BTC on sell
    await f.seedSpotBalance(buyer, usdt, '200');  // locks 100 on buy

    // Rest a sell order so it's waiting in the book.
    await restingOrder(seller, { pair, side: 'sell', quantity: 1, price: 100 });

    // Place the crossing buy and drive the match.
    const buyRes = await placeOrder(buyer, { pair, side: 'buy', quantity: 1, price: 100 });
    expect(buyRes.status).toBe(201);
    await orderBookService.matchOrder(buyRes.body.order.id);

    // A trade must have been created.
    expect(await Trade.count()).toBe(1);
    const trade = await Trade.findOne();

    // Assert the outbox row.
    const rows = await OutboxEvent.findAll({ where: { type: 'TradeExecuted' } });
    expect(rows).toHaveLength(1);

    const evt = rows[0];
    expect(evt.status).toBe('pending');
    // aggregateId must equal the Trade PK (also stored in payload.tradeId).
    expect(evt.aggregateId).toBe(trade.id);
    expect(evt.payload.tradeId).toBe(trade.id);
    expect(evt.aggregateId).toBe(evt.payload.tradeId);

    // Required payload fields.
    expect(evt.payload.tradingPairId).toBe(pair.id);
    expect(evt.payload.buyerId).toBe(buyer.id);
    expect(evt.payload.sellerId).toBe(seller.id);

    // Numeric fields stored as strings.
    expect(typeof evt.payload.price).toBe('string');
    expect(typeof evt.payload.quantity).toBe('string');
    expect(typeof evt.payload.buyerFee).toBe('string');
    expect(typeof evt.payload.sellerFee).toBe('string');

    // Spot-check values align with the trade record.
    expect(evt.payload.price).toBe(String(trade.price));
    expect(evt.payload.quantity).toBe(String(trade.quantity));
  });
});
