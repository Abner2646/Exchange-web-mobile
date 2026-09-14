# Money-path Domain Events (Fase 6.2.1 slice 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit the core money-path domain events (swap, trade, deposit lifecycle, withdrawal) to the transactional outbox so the generic audit trail records all money movement, not just P2P.

**Architecture:** Same pattern as slice 1's P2P migration — each domain op calls `emitEvent(type, payload, { transaction, aggregateId })` in its own money-path transaction, after the ledger settlement and before commit. No new consumers: the slice-2 audit consumer (subscribed via `eventBus.onAny`) captures every event automatically.

**Tech Stack:** Node.js, Express, Sequelize (Postgres), Jest (unit + integration).

**Spec:** `docs/superpowers/specs/2026-09-13-money-events-design.md`

## Global Constraints

- **Atomic emission:** every `emitEvent` uses the SAME `transaction` the op already holds for its money change; both commit or roll back together. Never emit without the settlement's transaction.
- **Payload = flat JSON-serializable snapshot** built from the op's record; `aggregateId` = the record's id.
- **No new consumers/handlers** — the generic audit consumer captures the events.
- **Affected unit tests mock `emitEvent`** (as `transaccionesP2P.model.test.js` did in slice 1) so no-DB unit tests don't hit the outbox.
- **Conventions:** English identifiers; `emitEvent` from `modules/events/emitEvent`. No new deps. Coverage denominator already includes `modules/**`.
- **Commits:** Conventional, English, direct to `dev`. Integration tests need the test DB up (`npm run test:integration:up`; on Windows use `DB_PORT=15432` if 55432 is blocked).

## File Structure

**Modify:**
- `backend/modules/swap/swap.controller.js` — emit `SwapExecuted` in `createSwap`.
- `backend/modules/trading/tradeExecutor.service.js` — emit `TradeExecuted` in `executeTrade`.
- `backend/modules/wallets/blockchainTransaction.model.js` — emit `DepositRegistered` (createDeposit), `DepositConfirmed` (_creditDeposit), `WithdrawalTransmitted` (updateConfirmations withdrawal branch).
- Affected unit tests: add `jest.mock('.../modules/events/emitEvent', ...)` where these ops run without a DB.

**Create (tests):**
- `backend/tests/integration/swapEvent.integration.test.js`
- `backend/tests/integration/tradeEvent.integration.test.js`
- `backend/tests/integration/blockchainEvents.integration.test.js`

**Event → payload contract** (build from the op's record; verify field names by reading the record in the file):
- `SwapExecuted` `{ swapId, userId, pairId, type, baseAmount, quoteAmount, price, feeAmount }`, aggregateId = swap id.
- `TradeExecuted` `{ tradeId, tradingPairId, buyerId, sellerId, price, quantity, buyerFee, sellerFee }`, aggregateId = trade id.
- `DepositRegistered` / `DepositConfirmed` `{ blockchainTransactionId, userId, cryptoId, amount, txHash }`, aggregateId = blockchain tx id.
- `WithdrawalTransmitted` `{ blockchainTransactionId, userId, cryptoId, amount, destinationAddress, txHash }`, aggregateId = blockchain tx id.

---

### Task 1: SwapExecuted

**Files:**
- Modify: `backend/modules/swap/swap.controller.js`
- Test: `backend/tests/integration/swapEvent.integration.test.js`
- Modify (unit test mock): `backend/tests/createOrder.test.js`

**Interfaces:**
- Consumes: `emitEvent(type, payload, { transaction, aggregateId })` from `modules/events/emitEvent`; `OutboxEvent` from models.
- Produces: a `SwapExecuted` outbox row per executed swap.

- [ ] **Step 1: Add the emit to createSwap**

In `backend/modules/swap/swap.controller.js`, add at the top with the other requires:
```js
const { emitEvent } = require('../events/emitEvent');
```
In `createSwap`, immediately AFTER the `await settleSwap({...}, transaction);` call and BEFORE `await transaction.commit();`, insert (use the `newOrder` Swap record and the same `transaction`):
```js
    await emitEvent('SwapExecuted', {
      swapId: newOrder.id,
      userId: newOrder.userId,
      pairId: newOrder.pairId,
      type: newOrder.type,
      baseAmount: String(newOrder.baseAmount),
      quoteAmount: String(newOrder.quoteAmount),
      price: String(newOrder.price),
      feeAmount: String(newOrder.feeAmount),
    }, { transaction, aggregateId: newOrder.id });
```

- [ ] **Step 2: Fix the swap unit test (mock emitEvent)**

`createOrder.test.js` runs `createOrder`/`createSwap` without a DB. Add near the top mocks (before the controller is required), so the real emitEvent (which lazy-requires models) is not hit:
```js
jest.mock('../modules/events/emitEvent', () => ({ emitEvent: jest.fn().mockResolvedValue({ id: 'evt' }) }));
```

- [ ] **Step 3: Run the swap unit test — expect PASS**

Run: `npm test -- createOrder`
Expected: PASS (existing assertions intact; emitEvent mocked).

- [ ] **Step 4: Write the failing integration test**

`backend/tests/integration/swapEvent.integration.test.js`:
```js
const request = require('supertest');
const app = require('../../app');
const { sequelize, OutboxEvent } = require('../../models');
const f = require('../helpers/factories');

let user, btc, usdt;
beforeAll(async () => {
  await sequelize.sync({ force: true });
  user = await f.seedUser();
  btc = await f.seedCripto('BTC');
  usdt = await f.seedCripto('USDT');
  await f.seedPar({ base: btc, quote: usdt, price: '0.1', comision: '1' });
  await f.seedWalletMaestra(usdt);
  await f.seedBalance(user, usdt, '1');
});
afterAll(async () => { await sequelize.close(); });

describe('SwapExecuted event', () => {
  test('a completed swap writes a SwapExecuted outbox row', async () => {
    const pair = await sequelize.models.SwapPair.findOne();
    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .set('Idempotency-Key', 'swap-evt-1')
      .send({ pairId: pair.id, type: 'buy', baseAmount: 1 });
    expect(res.status).toBe(201);

    const rows = await OutboxEvent.findAll({ where: { type: 'SwapExecuted' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.userId).toBe(user.id);
    expect(rows[0].aggregateId).toBe(rows[0].payload.swapId);
    expect(rows[0].status).toBe('pending');
  });
});
```
> Note: mirror the seed helpers/route usage in `tests/integration/intercambioExchange.integration.test.js` (same swap endpoint). Adjust the request body/headers to match that file if the auth/idempotency helpers differ.

- [ ] **Step 5: Run it — expect PASS**

Run: `npm run test:integration -- swapEvent`
Expected: PASS (one SwapExecuted row, correct payload, in the swap's transaction).

- [ ] **Step 6: Commit**
```bash
git add backend/modules/swap/swap.controller.js backend/tests/integration/swapEvent.integration.test.js backend/tests/createOrder.test.js
git commit -m "feat(swap): emit SwapExecuted domain event to the outbox"
```

---

### Task 2: TradeExecuted

**Files:**
- Modify: `backend/modules/trading/tradeExecutor.service.js`
- Test: `backend/tests/integration/tradeEvent.integration.test.js`
- Modify (unit test mock): `backend/tests/tradeExecutor.test.js`

**Interfaces:**
- Consumes: `emitEvent`; `OutboxEvent`.
- Produces: a `TradeExecuted` outbox row per executed trade.

- [ ] **Step 1: Add the emit to executeTrade**

In `backend/modules/trading/tradeExecutor.service.js`, add the require at the top:
```js
const { emitEvent } = require('../events/emitEvent');
```
In `executeTrade(tradeData, transaction)`, AFTER `await balanceManager.updateBalancesAfterTrade(trade, buyOrder, sellOrder, transaction);` (the settlement) and before the method returns, insert (using the `trade` record + the same `transaction`):
```js
      await emitEvent('TradeExecuted', {
        tradeId: trade.id,
        tradingPairId: trade.tradingPairId,
        buyerId: trade.buyerId,
        sellerId: trade.sellerId,
        price: String(trade.price),
        quantity: String(trade.quantity),
        buyerFee: String(trade.buyerFee),
        sellerFee: String(trade.sellerFee),
      }, { transaction, aggregateId: trade.id });
```

- [ ] **Step 2: Fix the trade unit test (mock emitEvent)**

In `backend/tests/tradeExecutor.test.js`, add before the module under test is required:
```js
jest.mock('../modules/events/emitEvent', () => ({ emitEvent: jest.fn().mockResolvedValue({ id: 'evt' }) }));
```

- [ ] **Step 3: Run the trade unit test — expect PASS**

Run: `npm test -- tradeExecutor`
Expected: PASS (existing assertions intact).

- [ ] **Step 4: Write the failing integration test**

`backend/tests/integration/tradeEvent.integration.test.js`:
```js
const { sequelize, OutboxEvent } = require('../../models');
const orderBookService = require('../../modules/trading/orderBook.service');
const f = require('../helpers/factories');

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

describe('TradeExecuted event', () => {
  test('a matched trade writes a TradeExecuted outbox row', async () => {
    // Reuse the trading-matching harness: seed a pair + two opposing orders with
    // Spot balances so a match executes, mirroring tradingMatching.integration.test.js.
    const scenario = await f.seedMatchableOrders(); // see note
    await orderBookService.matchOrder(scenario.incomingOrder);

    const rows = await OutboxEvent.findAll({ where: { type: 'TradeExecuted' } });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].aggregateId).toBe(rows[0].payload.tradeId);
    expect(rows[0].payload.tradingPairId).toBeTruthy();
    expect(rows[0].status).toBe('pending');
  });
});
```
> Note: `tests/integration/tradingMatching.integration.test.js` already sets up matchable orders + Spot balances and calls `orderBookService.matchOrder(...)`. Copy its exact seeding into this test (or extract the shared setup); there is no `seedMatchableOrders` helper yet — inline the same steps that file uses. The assertion that matters is: a `TradeExecuted` row exists with `aggregateId === payload.tradeId`.

- [ ] **Step 5: Run it — expect PASS**

Run: `npm run test:integration -- tradeEvent`
Expected: PASS (a TradeExecuted row per executed trade).

- [ ] **Step 6: Commit**
```bash
git add backend/modules/trading/tradeExecutor.service.js backend/tests/integration/tradeEvent.integration.test.js backend/tests/tradeExecutor.test.js
git commit -m "feat(trading): emit TradeExecuted domain event to the outbox"
```

---

### Task 3: Deposit + Withdrawal events (+ end-to-end + full verify)

**Files:**
- Modify: `backend/modules/wallets/blockchainTransaction.model.js`
- Test: `backend/tests/integration/blockchainEvents.integration.test.js`
- Modify (unit test mock): `backend/tests/transaccionBlockchain.model.test.js`

**Interfaces:**
- Consumes: `emitEvent`; `OutboxEvent`; `AuditLog`; the outbox publisher job; `registerAllHandlers`.
- Produces: `DepositRegistered`, `DepositConfirmed`, `WithdrawalTransmitted` outbox rows.

- [ ] **Step 1: Add the three emits**

In `backend/modules/wallets/blockchainTransaction.model.js`, add the require at the top:
```js
const { emitEvent } = require('../events/emitEvent');
```
(a) In `createDeposit`, after `await registerPendingDeposit({...}, transaction);` (uses `nuevoDeposito` + `transaction`):
```js
      await emitEvent('DepositRegistered', {
        blockchainTransactionId: nuevoDeposito.id,
        userId: nuevoDeposito.userId,
        cryptoId: nuevoDeposito.cryptoId,
        amount: String(nuevoDeposito.amount),
        txHash: nuevoDeposito.txHash,
      }, { transaction, aggregateId: nuevoDeposito.id });
```
(b) In `_creditDeposit(transaccion, transaction)`, after `await confirmDeposit({...}, transaction);`:
```js
      await emitEvent('DepositConfirmed', {
        blockchainTransactionId: transaccion.id,
        userId: transaccion.userId,
        cryptoId: transaccion.cryptoId,
        amount: String(transaccion.amount),
        txHash: transaccion.txHash,
      }, { transaction, aggregateId: transaccion.id });
```
(c) In `updateConfirmations`, in the withdrawal branch after `await markWithdrawalTransmitted({...}, transaction);`:
```js
        await emitEvent('WithdrawalTransmitted', {
          blockchainTransactionId: transaccion.id,
          userId: transaccion.userId,
          cryptoId: transaccion.cryptoId,
          amount: String(transaccion.amount),
          destinationAddress: transaccion.destinationAddress,
          txHash: transaccion.txHash,
        }, { transaction, aggregateId: transaccion.id });
```
> Read each method first to confirm the in-scope record variable name (`nuevoDeposito`/`transaccion`) and that the `transaction` in scope is the one passed to the ledger op. If any emit site's record uses different field names, use the actual attribute names on that Sequelize instance.

- [ ] **Step 2: Fix the model unit test (mock emitEvent)**

In `backend/tests/transaccionBlockchain.model.test.js`, add before the model is required:
```js
jest.mock('../modules/events/emitEvent', () => ({ emitEvent: jest.fn().mockResolvedValue({ id: 'evt' }) }));
```

- [ ] **Step 3: Run the model unit test — expect PASS**

Run: `npm test -- transaccionBlockchain.model`
Expected: PASS.

- [ ] **Step 4: Write the failing integration test (emits + atomicity + end-to-end audit)**

`backend/tests/integration/blockchainEvents.integration.test.js`:
```js
const { sequelize, OutboxEvent, AuditLog, BlockchainTransaction } = require('../../models');
const { registerAllHandlers } = require('../../modules/events/registerHandlers');
const publisherJob = require('../../jobs/outboxPublisher.job');
const f = require('../helpers/factories');

let user, btc;
beforeAll(async () => {
  await sequelize.sync({ force: true });
  registerAllHandlers();
  user = await f.seedUser();
  btc = await f.seedCripto('BTC');
});
afterAll(async () => { await sequelize.close(); });

describe('blockchain money events', () => {
  test('createDeposit emits DepositRegistered; publisher audits it', async () => {
    await BlockchainTransaction.createDeposit({
      userId: user.id, cryptoId: btc.id, amount: '0.5',
      txHash: '0xdep1', destinationAddress: 'addr1', confirmations: 0,
    });
    const rows = await OutboxEvent.findAll({ where: { type: 'DepositRegistered' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.userId).toBe(user.id);
    expect(rows[0].aggregateId).toBe(rows[0].payload.blockchainTransactionId);

    await publisherJob.run(); // end-to-end: audited
    const audit = await AuditLog.findAll({ where: { eventId: rows[0].id } });
    expect(audit).toHaveLength(1);
    expect(audit[0].eventType).toBe('DepositRegistered');
  });
});
```
> Note: `createDeposit`'s required input shape must match the actual method — read it and adapt the `createDeposit({...})` args and the crypto/user factory calls (mirror `tests/helpers/factories.js` and any existing test that calls `createDeposit`). If `createDeposit` needs a master wallet / deposit address, seed them as the wallet provisioning tests do. The load-bearing assertions are: one `DepositRegistered` row with `aggregateId === payload.blockchainTransactionId`, and after `publisherJob.run()` a matching `audit_log` row.

- [ ] **Step 5: Run it — expect PASS**

Run: `npm run test:integration -- blockchainEvents`
Expected: PASS (DepositRegistered emitted + audited end-to-end).

- [ ] **Step 6: Full verification**

Run `npm test` (full unit, expect green) and `npm run test:integration` (full integration, expect green). Then both coverage floors: `npm run test:coverage` and `npm run test:integration:coverage` — expect exit 0.

- [ ] **Step 7: Commit**
```bash
git add backend/modules/wallets/blockchainTransaction.model.js backend/tests/integration/blockchainEvents.integration.test.js backend/tests/transaccionBlockchain.model.test.js
git commit -m "feat(wallets): emit deposit/withdrawal domain events to the outbox"
```

---

## Self-review notes

- **Spec coverage:** SwapExecuted (T1), TradeExecuted (T2), DepositRegistered/DepositConfirmed/WithdrawalTransmitted (T3). Atomic in-tx emission at each op (all emits use the op's `transaction`). No new consumers — audit captures via the existing generic consumer (T3 end-to-end proves it). Affected unit tests mock emitEvent (T1/T2/T3 steps).
- **Type consistency:** `emitEvent(type, payload, { transaction, aggregateId })` used identically at all five sites (matches slices 1–2). Payload/aggregateId shapes match the spec's contract table.
- **Deferred (per spec):** consumers for these events (deposit/withdrawal notifications, AML), non-money events, websocket push, the slice 1–2 deferrals.
- **Implementer note:** the exact in-scope record variable and its attribute names must be confirmed by reading each op; emission must always reuse the op's settlement `transaction` (flag if an op lacks one).
