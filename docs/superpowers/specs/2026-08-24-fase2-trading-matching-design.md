# Fase 2 — Spot Trading Matching (integration) — Design Spec

- **Date:** 2026-08-24
- **Phase:** Roadmap Fase 2 (Testing) — integration layer, trading/matching slice
- **Status:** Approved (design), pending implementation plan

## Problem

The spot trading engine (`/api/trading`) is a real, wired, functional order-book
exchange — distinct from the instant swap (`intercambioExchange`) already covered.
It has: limit/market orders, price-time-priority matching against other users'
orders, self-trade prevention, maker/taker fees, partial fills, and two-sided
balance settlement on `BalanceUsuario`. Its money-movement services were migrated
to money.js in Fase 1 and unit-tested in isolation, but there is **no integration
coverage** of the full flow against a real database: create order → lock balance →
match → execute trade → settle both users' balances. This is the highest-value
untested money-path now that the swap is covered.

The audit flagged "two parallel trading engines" (Altos #13). Having explored:
they are two **different products** (instant swap vs order-book spot), both
functional. Testing the spot engine does **not** require resolving the Fase 0
"choose one engine" consolidation — that is a separate product decision, flagged
but not blocking.

### The fire-and-forget wrinkle

`tradingController.createOrder` returns `201` with the created order **before**
matching runs: it calls `orderBookService.matchOrder(order.id).then(...)` without
`await` (controller ~line 114). So an HTTP-only test ("POST order → assert a
trade") is racy. This is characterized, not fixed, in this pass (per the Fase 2
philosophy: pin current behavior with tests first; fixing trading logic is a
separate, roadmap-flagged concern — Radar #12).

## Goal

Integration coverage of the spot matching core, reusing the existing harness
(test Postgres + mountable app + factories). Prove the full order-book flow end
to end against real Postgres, with exact canonical-string balance assertions.

### Non-goals (deferred)

- **Market orders, order cancellation, stop orders** — next trading spec.
- **WebSocket emission** (`req.io`) — not exercised (no socket in the test app).
- **Fixing the fire-and-forget matching** — characterized, not changed.
- **Resolving the two-engines consolidation** (Fase 0) — flagged, not decided.
- **HTTP-driven end-to-end matching assertion** — matching is asserted at the
  service level (awaited `matchOrder`) because the HTTP path is fire-and-forget.

## Test approach

Two layers, each asserted where it is deterministic:

1. **HTTP `POST /api/trading/orders` (synchronous part):** the order is created,
   the balance is locked, validation/rejection paths return the canonical error
   envelope. Matching is NOT asserted here. Requires an `Idempotency-Key` header
   (the endpoint returns 400 without it).
2. **Matching engine (service level, awaited):** drive order creation through the
   real HTTP path (so balances lock through the real code), then explicitly
   `await orderBookService.matchOrder(id)` for determinism. The controller's
   background fire is harmless: `matchOrder` takes a `FOR UPDATE` lock and checks
   `canBeMatched`, so the trade executes exactly once regardless of which
   invocation wins. Assert the resulting DB state (Trade row, order statuses,
   both users' balances).

### Worked settlement (exact values the tests assert)

Pair BTC/USDT, maker fee 0.1%, taker fee 0.1%, `lastPrice` 0 (avoids the
validator's 50%-deviation gate, which only applies when `lastPrice > 0`).

**Full fill.** Seller (maker) rests sell 1 BTC @ 100. Buyer (taker) buys 1 BTC @ 100.
- Seller lock: 1 BTC blocked. Buyer lock: `1*100 + feeOf(100, 0.1%) = 100.1` USDT blocked.
- Execution price = maker's price = 100. Buyer is taker, seller is maker.
- Buyer fee (taker, buy → base): `1 * 0.1% = 0.001` BTC. Seller fee (maker, quote): `100 * 0.1% = 0.1` USDT.
- Settlement:
  - Buyer: blocked quote `-= 100` → from 100.1 to **0.1 left blocked**; available base `+= 1 - 0.001 = 0.999` BTC.
  - Seller: blocked base `-= 1` → 0; available quote `+= 100 - 0.1 = 99.9` USDT.
- **Finding (characterized, not fixed):** the buyer over-locks `0.1` USDT to cover
  the taker fee, but settlement only releases `quantity*price` from blocked, so
  `0.1` USDT stays stuck in the buyer's blocked balance. The test asserts this
  actual behavior and documents it as a finding.

**Partial fill.** Seller rests sell 1 BTC @ 100. Buyer buys 0.4 BTC @ 100.
- Trade 0.4 @ 100. Buyer order `filled`; seller order `partially_filled`, 0.6 remaining.
- Buyer available base `+= 0.4 - 0.0004 = 0.3996` BTC; seller available quote `+= 40 - 0.04 = 39.96` USDT; seller base still 0.6 blocked.

## Scenarios

1. **HTTP create (buy):** POST buy limit with sufficient quote → 201, order row
   `pending`, quote balance locked (available down, blocked up). No opposite side
   seeded, so the background match is a no-op.
2. **HTTP reject — insufficient balance:** POST buy with too little quote → 400
   `INSUFFICIENT_BALANCE`, no order created, balances unchanged.
3. **HTTP reject — missing Idempotency-Key:** POST without the header → 400.
4. **HTTP reject — inactive/unknown pair:** POST for a non-existent pair → 400
   `TRADING_PAIR_NOT_FOUND`.
5. **Match — full fill:** resting sell + crossing buy → one Trade row, both orders
   `filled`, both balances settled to the exact strings above.
6. **Match — partial fill:** resting sell 1 + buy 0.4 → Trade 0.4, buyer `filled`,
   seller `partially_filled` (0.6 remaining), balances settled.
7. **Match — self-trade prevention:** same user on both sides → no trade, incoming
   order rests `open` (findMatchingOrders excludes `userId === order.userId`).

## Components

- **`factories.js` additions:** `seedTradingPair({ base, quote, makerFee, takerFee,
  minOrderAmount, lastPrice, status })` → TradingPair; a `placeOrder(user, { pair,
  side, orderType, quantity, price })` helper that POSTs `/api/trading/orders` with
  `authHeader(user)` + a unique `Idempotency-Key`, returning the parsed response.
- **`tradingMatching.integration.test.js`** (new, under `tests/integration/`):
  the HTTP-create scenarios (1–4) and the service-level matching scenarios (5–7),
  importing `orderBookService` to await `matchOrder`.

Reuses the harness unchanged (testEnv, db lifecycle `resetDb`, `maxWorkers:1`).

## Risks / open decisions

- **Idempotency-Key required:** `placeOrder` must send a unique key per call, else
  every POST is 400. Pinned by scenario 3.
- **Error-envelope vs legacy shape:** `trading.controller.createOrder` throws
  `AppError` (canonical envelope), but `cancelOrder` and others still respond with
  legacy shapes. Only `createOrder` is in scope; assertions target its envelope.
- **Background match idempotency:** relying on the `FOR UPDATE` + `canBeMatched`
  guard to make the explicit awaited `matchOrder` safe against the controller's
  background fire. If that guard were weaker, a double-execution could occur — the
  full-fill assertion (exactly one Trade row) also acts as a guard against that.
- **The stuck fee-reserve finding** is asserted as current behavior; it is logged
  as a follow-up, not fixed here.
