# Fase 2 Spot Trading Matching (integration) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integration coverage of the spot order-book matching flow (create → lock → match → execute → settle both sides) against real Postgres, reusing the existing harness.

**Architecture:** Drive order creation through the real HTTP endpoint `POST /api/trading/orders` (exercises validation + balance lock + order create). Because the controller's matching is fire-and-forget, assert matching at the service level by awaiting `orderBookService.matchOrder(id)` — a reliable barrier (its `FOR UPDATE` lock blocks until any background match commits, so the trade executes exactly once).

**Tech Stack:** Node/CommonJS, Express 4, Sequelize 6 (Postgres), jest 29, supertest 6, money.js (decimal.js). No new dependencies.

## Global Constraints

- Code and comments in **English**; commits **Conventional Commits** in English.
- **No new npm dependencies.**
- Integration tests only, under `backend/tests/integration/`, run via `npm run test:integration` (needs the test DB up: `npm run test:integration:up`). `maxWorkers:1` already set.
- Balance assertions are **exact canonical decimal strings** (DECIMAL(28,8) → 8 dp).
- `POST /api/trading/orders` **requires** a unique `Idempotency-Key` header (400 without it).
- Pair uses `lastPrice: 0` so the validator's 50%-deviation gate (only active when `lastPrice > 0`) does not interfere; maker/taker fees 0.1% (defaults).
- Characterize current behavior — do NOT fix the fire-and-forget matching or the stuck taker-fee reserve; assert them as-is.

---

### Task 1: `seedTradingPair` factory + HTTP create/reject tests

**Files:**
- Modify: `backend/tests/helpers/factories.js`
- Create: `backend/tests/integration/tradingMatching.integration.test.js`

**Interfaces:**
- Produces: `seedTradingPair({ base, quote, makerFee = '0.1', takerFee = '0.1', minOrderAmount = '0', lastPrice = '0', status = 'active' })` → `Promise<TradingPair>`.
- Produces (local to the test file): `placeOrder(user, { pair, side, orderType = 'limit', quantity, price })` → supertest response of `POST /api/trading/orders` with `authHeader(user)` + a unique `Idempotency-Key`.

- [ ] **Step 1: Add the `seedTradingPair` factory**

In `backend/tests/helpers/factories.js`, add `TradingPair` to the destructured models and this function, and export it:
```javascript
async function seedTradingPair({ base, quote, makerFee = '0.1', takerFee = '0.1', minOrderAmount = '0', lastPrice = '0', status = 'active' }) {
  return TradingPair.create({
    symbol: `${base.symbol}/${quote.symbol}`,
    baseAssetId: base.id,
    quoteAssetId: quote.id,
    status,
    minOrderAmount,
    makerFeePercent: makerFee,
    takerFeePercent: takerFee,
    lastPrice,
  });
}
```
Add `TradingPair` to `require('../../models')` destructuring and to `module.exports`.

- [ ] **Step 2: Write the HTTP create/reject tests**

`backend/tests/integration/tradingMatching.integration.test.js`:
```javascript
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
```

- [ ] **Step 3: Run the tests to verify they fail, then pass**

Run: `cd backend && npm run test:integration:up && npm run test:integration -- tradingMatching`
Expected: RED first if `seedTradingPair` missing; after Step 1 in place, all four PASS. If a required column surfaces (Sequelize validation error), read the entity and add it minimally.

- [ ] **Step 4: Confirm the lock assertion can fail**

Temporarily change `'99.90000000'` to `'99.80000000'`, run, confirm FAIL, restore.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/helpers/factories.js backend/tests/integration/tradingMatching.integration.test.js
git commit -m "test(integration): trading order create + lock + reject paths (HTTP)"
```

---

### Task 2: Matching engine integration tests

**Files:**
- Modify: `backend/tests/integration/tradingMatching.integration.test.js`

**Interfaces:**
- Consumes: `placeOrder`, `seedTradingPair`, factories, `orderBookService`.

- [ ] **Step 1: Add the matching tests**

Append to the file:
```javascript
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
    await f.seedBalance(buyer, usdt, '200');   // locks 100.1 on buy

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

    // Buyer: base available += 1 - taker fee 0.001 = 0.999; quote available 99.9;
    // quote blocked 0.1 STAYS (over-reserved taker fee — characterized finding).
    const buyerBtc = await f.getBalance(buyer, btc);
    const buyerUsdt = await f.getBalance(buyer, usdt);
    expect(buyerBtc.balanceDisponible).toBe('0.99900000');
    expect(buyerUsdt.balanceDisponible).toBe('99.90000000');
    expect(buyerUsdt.balanceBloqueado).toBe('0.10000000'); // FINDING: stuck fee reserve
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
    expect(sellOrder.quantityRemaining).toBe('0.60000000');
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
```

- [ ] **Step 2: Run the matching tests to verify they pass**

Run: `cd backend && npm run test:integration -- tradingMatching`
Expected: all seven tests PASS (four from Task 1 + three matching). If the quantityRemaining scale differs from `'0.60000000'`, adjust to the exact round-tripped string the first run reports — keep it an exact string assertion.

- [ ] **Step 3: Confirm a settlement assertion can fail**

Temporarily change `sellerUsdt.balanceDisponible` expected `'99.90000000'` to `'99.80000000'`, run, confirm FAIL, restore.

- [ ] **Step 4: Run the whole integration suite + the unit suite**

Run: `cd backend && npm run test:integration && npm test`
Expected: integration green (harness smoke + factories + swap + usuarioAssociations + balanceLockRace + tradingMatching); unit green (~277).

- [ ] **Step 5: Commit**

```bash
git add backend/tests/integration/tradingMatching.integration.test.js
git commit -m "test(integration): spot matching full/partial fill + self-trade prevention"
```

---

## Notes / findings to record

- **Stuck taker-fee reserve:** the buyer over-locks the taker fee in quote, but
  settlement only releases `quantity*price` from blocked, leaving the fee reserve
  stuck in `balanceBloqueado`. Asserted as current behavior; log as a follow-up
  bug (not fixed here).
- **Fire-and-forget matching** in `createOrder` is characterized (matching awaited
  at the service level), not fixed.
- **Follow-ups:** market orders, cancellation (releases locked balance), stop
  orders; and the two-engines consolidation decision (Fase 0).

## Self-Review

- **Spec coverage:** scenarios 1–4 (HTTP create/reject) → Task 1; scenarios 5–7
  (full/partial fill, self-trade) → Task 2. Settlement strings match the spec's
  worked example. seedTradingPair + placeOrder → Task 1. ✓
- **Placeholder scan:** the "adjust scale if it differs" notes are explicit
  verify-against-DB steps, not deferred work; no TBD/TODO deliverables.
- **Type consistency:** `seedTradingPair` signature matches its uses; `placeOrder`
  returns a supertest response (`res.body.order.id`, `res.status`) consistent
  across tasks; `orderBookService.matchOrder(id)` awaited consistently.
