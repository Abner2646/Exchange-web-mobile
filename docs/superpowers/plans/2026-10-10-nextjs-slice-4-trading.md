# Next.js Slice 4 — Spot Trading (order book) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `web/` Next.js spot-trading vertical — view a pair's order book + recent trades + last price, place **market/limit buy/sell** orders against the order book (fee charged on the *received* asset, explained), with a Funding→Spot prerequisite, see order lifecycle (active orders) and cancel, all money-safe and idempotent.

**Architecture:** Mirrors the S2 wallet and S3 swap features exactly. Feature code under `web/src/features/trading/` (`types.ts`, `api.ts`, `queries.ts`, `index.ts`, `components/*`), consumed by a client-rendered route `web/app/(app)/trading/page.tsx`. Data flows through the shared transport (`@/shared/api`, same-origin `/api`, auto Idempotency-Key on the order POST), money handled only via `@/shared/money` canonical decimal strings, copy via `@/shared/i18n`, UI via `@/shared/ui`. TanStack Query v5. Trading operates on the **Spot** compartment; the sufficiency gate and the Funding→Spot prompt reuse the wallet's `GET /balances/my/balances` (`compartments.spot.available`).

**Tech Stack:** Next.js 14.2.35 (App Router), React 18, TypeScript, TanStack Query v5, Vitest + Testing Library, decimal.js (inside `@/shared/money`).

## Global Constraints

Every task's requirements implicitly include this section. Values copied verbatim from the handoff/sprint and the real backend contract.

- **Framework:** Next.js **14.2.35** / React **18**, App Router, TypeScript. Do NOT upgrade to React 19 / Next 16 in this slice.
- **Money is sacred:** amounts the user spends/receives are interpreted, computed, compared, and formatted ONLY via `@/shared/money` canonical decimal strings. NEVER `Number()`/`parseFloat`/unary `+`/`.toFixed()`/native math on such a value. The order-book bids/asks and recent-trades figures arrive from the backend as JS **numbers** (pre-existing backend `parseFloat`); they are **market-data display only** — render them, but NEVER feed them into the user's spend/receive computation or the sufficiency gate. The authoritative spend math uses the canonical `quantity`/`price` the user typed.
- **`quantity` and `price` on the wire = canonical decimal STRINGS.** `POST /trading/orders` validates them with express-validator `isFloat({gt:0})`, which accepts numeric strings; sending the validated canonical string is the money-faithful choice.
- **Idempotency:** the shared client auto-attaches an `Idempotency-Key` header on `POST /trading/orders` (it matches `isMoneyEndpoint` via the `/trading/order` pattern). The go-live *per-intent* key is a deferred cross-cutting gate item (HANDOFF go-live gate #1), NOT in scope for S4. S4 relies on: disabled-while-pending button + mutation no-retry + backend per-key dedup.
- **Trading is Spot-only.** The backend reserves from the Spot compartment and rejects with "transferí fondos a Spot" when Spot is short. The order form has NO compartment selector; when Spot is insufficient it shows a Funding→Spot prompt linking to `/wallet`. Never read Funding/blocked/pending as spendable for trading.
- **i18n:** add every new key to BOTH `web/src/shared/i18n/catalogs/en.ts` and `es.ts`. `fr`/`it`/`pt` are a later sprint item.
- **Error rendering:** render API errors via `useErrorTranslation().tError(code, params)`. When a code may be `INTERNAL_ERROR` (any 5xx), pass `{ requestId: err.requestId ?? '' }` so `{{requestId}}` resolves (S2 lesson).
- **TanStack generics:** type every hook `useQuery<T, ApiError>` / `useMutation<T, ApiError, V>` so call sites can read `error.code`.
- **UI primitives:** `Button` (props incl. `variant?`, `size?`, `loading?`, `disabled?`, `type?`) renders disabled while `loading`. `Field` takes `label: string` and clones exactly ONE child element that carries its own `id` (no `htmlFor`). `useTranslation()` → `{ t, locale }`; `useErrorTranslation()` (from `@/shared/i18n/errorCatalog`) → `{ tError }`.
- **Git hygiene:** `git add` EXPLICIT file paths in every commit. NEVER `git add -A`/`.`/`commit -am`. Do not name a test-local helper `describe`.
- **Commits:** Conventional Commits in English, NO Claude attribution.
- **Working directory for commands:** `web/` (e.g. `cd web && npx vitest run ...`).

---

## Backend contract (ground truth — do not re-derive)

**Trading pairs (public), via `GET /trading/pairs`** (array; controller returns `{ success, pairs }` OR a raw array depending on handler — normalize defensively to an array in `api.ts`). Each pair (DECIMAL fields are JSON strings; `symbol` is `BASE/QUOTE`):
```
{ id, symbol: "BTC/USDT", baseAssetId, quoteAssetId, status: "active"|"paused"|"delisted",
  minOrderAmount: string, maxOrderAmount: string|null, pricePrecision: number, quantityPrecision: number,
  makerFeePercent: string, takerFeePercent: string, lastPrice: string, priceChange24h: string,
  volume24h: string, high24h: string, low24h: string }
```
Only `status === 'active'` pairs are tradable.

**Order book (public):** `GET /trading/orderbook/:tradingPairId?depth=20` → `{ success, orderBook: { bids: Entry[], asks: Entry[], timestamp } }` where `Entry = { price: number, quantity: number, total: number, orders: number }`. **Numbers — market display only.** bids high→low, asks low→high. Only `limit`+`open` orders populate the book.

**Recent trades (public):** `GET /trading/trades/:tradingPairId` → recent trades (treat as `{ success, trades: Trade[] }` or array; normalize). Each trade ≈ `{ id, price, quantity, side, createdAt, ... }` (numbers/strings; market display only).

**Place order (auth, `Idempotency-Key` required):** `POST /trading/orders`
Body: `{ tradingPairId: uuid, orderType: "market"|"limit"|"stop_limit"|"stop_market", side: "buy"|"sell", quantity: string, price?: string, stopPrice?: string, timeInForce?: "GTC"|"IOC"|"FOK", clientOrderId?: string }`
- `price` REQUIRED for `limit` (and `stop_limit`); omitted/null for `market`.
- Validation: `quantity` ≥ `minOrderAmount`, ≤ `maxOrderAmount` (if set), ≤ `quantityPrecision` decimals; `price` ≤ `pricePrecision` decimals and within 50% of `lastPrice`.
`201`: `{ success: true, order: { id, userId, tradingPairId, orderType, side, quantity, quantityRemaining, price, status: "pending", feePercent, feeCurrency, timeInForce, clientOrderId, tradingPair: {...} }, message }`.
Errors: `400 TRADING_PAIR_NOT_FOUND | INVALID_ORDER | INSUFFICIENT_BALANCE` (+ generic 400/401/500). Matching runs async after 201 — the order returns `status: "pending"` and fills later.

**Cancel order (auth):** `DELETE /trading/orders/:orderId` → `{ success, order?, message }` on 200; `{ success:false, error }` on 400 (non-cancelable state / not owner).

**My orders (auth):**
- `GET /trading/orders/active` → `{ success, orders: Order[], total }` (status in pending/open/partially_filled).
- `GET /trading/orders?status&tradingPairId&side&limit&offset` → `{ success, orders, total }` (history).
Order status enum: `pending | open | partially_filled | filled | cancelled | expired | rejected`.

**Fee model (for the "received-asset fee" explanation) — from `feeCalculator`:**
- **buy:** fee charged in the **BASE** asset (what you receive), on `quantity`. `feeCurrency = symbol.split('/')[0]`.
- **sell:** fee charged in the **QUOTE** asset (what you receive), on `quantity × price`. `feeCurrency = symbol.split('/')[1]`.
- A new order is quoted at `takerFeePercent` (conservative; the real maker/taker split is decided at execution).

**Sufficiency (Spot compartment) — from `balanceManager.calculateRequiredAmount`:**
- **buy:** needs **QUOTE** asset = `quantity × effectivePrice + takerFee(on quote total)`, where `effectivePrice = price` (limit) or `lastPrice` (market estimate). `assetNeeded = quoteAssetId`.
- **sell:** needs **BASE** asset = `quantity`. `assetNeeded = baseAssetId`.
Client-side gate reads `compartments.spot.available` of the needed asset from `GET /balances/my/balances` (same `BalanceEntry` type as wallet). Server is authoritative (`INSUFFICIENT_BALANCE`).

**Balances (auth), reused from wallet:** `GET /balances/my/balances` → `BalanceEntry[]` (typed in `web/src/features/wallet/types.ts`): `criptomonedaId`, `compartments.spot.available`, `crypto: { id, symbol, ... } | null`.

---

## Product decisions (made during planning; do not re-litigate)

1. **Order types:** support `market` and `limit` only. `stop_limit`/`stop_market` are out of scope for S4 (follow-up).
2. **Spot-only:** no compartment selector; insufficient Spot → inline Funding→Spot prompt with a link to `/wallet`.
3. **Time-in-force:** implicit `GTC` (no selector in the MVP form). `market` orders omit `price`.
4. **Market data:** order book (bids/asks + spread) + recent trades + last price. A candlestick chart is out of scope (follow-up).
5. **Sufficiency gate:** sell → base `available >= quantity`; buy-limit → quote `available >= quantity×price×(1+taker/100)`; buy-market → no fixed price, so a **soft** gate (block only if quote Spot available is `0`/unknown; show a "market cost depends on execution price" disclosure) — the backend remains authoritative. Block submit when the needed balance entry hasn't loaded (no pass-on-unknown).

---

## File structure (all under `web/`)

Create:
- `src/features/trading/types.ts`
- `src/features/trading/api.ts`
- `src/features/trading/queries.ts`
- `src/features/trading/index.ts`
- `src/features/trading/components/trading.module.css`
- `src/features/trading/components/TradingPairSelect.tsx`
- `src/features/trading/components/OrderBookView.tsx`
- `src/features/trading/components/RecentTradesView.tsx`
- `src/features/trading/components/OrderForm.tsx` — money-path orchestrator
- `src/features/trading/components/MyOrdersView.tsx`
- `src/features/trading/components/TradingWidget.tsx`
- `app/(app)/trading/page.tsx`
- colocated `*.test.ts(x)` beside each unit.

Modify:
- `src/shared/i18n/catalogs/en.ts` + `es.ts` — add `trading.*` + `nav.trading` (ui) and `TRADING_PAIR_NOT_FOUND`/`INVALID_ORDER` (errors; `INSUFFICIENT_BALANCE` already exists as `BALANCE_INSUFFICIENT`? — add `INSUFFICIENT_BALANCE` key).
- `app/(app)/layout.tsx` — add the `/trading` nav link.
- `docs/frontend-rebuild/backend-contract-changes.md` — add the "web consumes trading" section.

---

### Task 1: Feature types

**Files:**
- Create: `web/src/features/trading/types.ts`
- Test: `web/src/features/trading/types.test.ts`

**Interfaces:**
- Produces: `TradingPairDTO`, `TradingPair` (normalized), `OrderBookEntry`, `OrderBook`, `OrderSide`, `OrderType`, `OrderStatus`, `PlaceOrderRequest`, `PlaceOrderResponse`, `TradingOrder`, `RecentTrade`.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/features/trading/types.test.ts
import { describe, it, expect } from 'vitest';
import type { TradingPair, PlaceOrderRequest, OrderBook } from './types';

describe('trading types', () => {
  it('compiles with representative values', () => {
    const pair: TradingPair = {
      id: 'p1', symbol: 'BTC/USDT', baseAssetId: 'b1', quoteAssetId: 'q1',
      baseSymbol: 'BTC', quoteSymbol: 'USDT', status: 'active',
      minOrderAmount: '0.0001', maxOrderAmount: null, pricePrecision: 2, quantityPrecision: 8,
      makerFeePercent: '0.1', takerFeePercent: '0.1', lastPrice: '65000',
    };
    const req: PlaceOrderRequest = { tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', price: '64000' };
    const book: OrderBook = { bids: [{ price: 64000, quantity: 1, total: 64000, orders: 2 }], asks: [], timestamp: '' };
    expect(pair.status).toBe('active');
    expect(req.side).toBe('buy');
    expect(book.bids[0].price).toBe(64000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/trading/types.test.ts`
Expected: FAIL — cannot find module `./types`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/features/trading/types.ts

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus =
  | 'pending' | 'open' | 'partially_filled' | 'filled' | 'cancelled' | 'expired' | 'rejected';

/** Raw pair from GET /trading/pairs (DECIMAL fields are JSON strings). */
export interface TradingPairDTO {
  id: string;
  symbol: string; // "BASE/QUOTE"
  baseAssetId: string;
  quoteAssetId: string;
  status: 'active' | 'paused' | 'delisted';
  minOrderAmount: string;
  maxOrderAmount: string | null;
  pricePrecision: number;
  quantityPrecision: number;
  makerFeePercent: string;
  takerFeePercent: string;
  lastPrice: string;
  priceChange24h?: string;
  volume24h?: string;
}

/** Normalized pair the UI consumes (symbols split out). */
export interface TradingPair {
  id: string;
  symbol: string;
  baseAssetId: string;
  quoteAssetId: string;
  baseSymbol: string;
  quoteSymbol: string;
  status: 'active' | 'paused' | 'delisted';
  minOrderAmount: string;
  maxOrderAmount: string | null;
  pricePrecision: number;
  quantityPrecision: number;
  makerFeePercent: string;
  takerFeePercent: string;
  lastPrice: string;
  priceChange24h?: string;
  volume24h?: string;
}

/** Order-book level — NUMBERS from the backend; market display ONLY. */
export interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
  orders: number;
}

export interface OrderBook {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: string;
}

export interface RecentTrade {
  id: string;
  price: number | string;
  quantity: number | string;
  side: OrderSide;
  createdAt?: string;
}

export interface PlaceOrderRequest {
  tradingPairId: string;
  orderType: OrderType;
  side: OrderSide;
  quantity: string; // canonical decimal string
  price?: string; // canonical decimal string; required for limit, omitted for market
  clientOrderId?: string;
}

export interface TradingOrder {
  id: string;
  tradingPairId: string;
  orderType: OrderType | string;
  side: OrderSide;
  quantity: string;
  quantityRemaining: string;
  price: string | null;
  status: OrderStatus;
  feePercent: string;
  feeCurrency: string | null;
  timeInForce?: string;
  createdAt?: string;
}

export interface PlaceOrderResponse {
  success: boolean;
  order: TradingOrder;
  message: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/trading/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/trading/types.ts web/src/features/trading/types.test.ts
git commit -m "feat(web): trading feature types (S4)"
```

---

### Task 2: i18n keys (trading copy + error codes), both locales

**Files:**
- Modify: `web/src/shared/i18n/catalogs/en.ts`, `web/src/shared/i18n/catalogs/es.ts`
- Test: `web/src/features/trading/i18nTradingKeys.test.ts`

**Interfaces:**
- Produces: the `trading.*`/`nav.trading` ui keys and `TRADING_PAIR_NOT_FOUND`/`INVALID_ORDER`/`INSUFFICIENT_BALANCE` error keys every component references.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/features/trading/i18nTradingKeys.test.ts
import { describe, it, expect } from 'vitest';
import { en } from '@/shared/i18n/catalogs/en';
import { es } from '@/shared/i18n/catalogs/es';

const UI_KEYS = [
  'nav.trading',
  'trading.title', 'trading.pair', 'trading.selectPair',
  'trading.book.title', 'trading.book.price', 'trading.book.amount', 'trading.book.total',
  'trading.book.bids', 'trading.book.asks', 'trading.book.spread', 'trading.book.empty',
  'trading.trades.title', 'trading.trades.empty', 'trading.trades.price', 'trading.trades.amount', 'trading.trades.side',
  'trading.form.title', 'trading.form.type', 'trading.form.market', 'trading.form.limit',
  'trading.form.buy', 'trading.form.sell', 'trading.form.quantity', 'trading.form.price',
  'trading.form.submitBuy', 'trading.form.submitSell', 'trading.form.feeNoteBuy', 'trading.form.feeNoteSell',
  'trading.form.marketCostNote', 'trading.form.insufficient', 'trading.form.fundSpot',
  'trading.form.minAmount', 'trading.form.success',
  'trading.orders.title', 'trading.orders.empty', 'trading.orders.pair', 'trading.orders.type',
  'trading.orders.side', 'trading.orders.amount', 'trading.orders.price', 'trading.orders.status', 'trading.orders.cancel',
];
const ERROR_KEYS = ['TRADING_PAIR_NOT_FOUND', 'INVALID_ORDER', 'INSUFFICIENT_BALANCE'];

describe('trading i18n keys', () => {
  it('every ui key exists in en and es', () => {
    for (const k of UI_KEYS) {
      expect(en.ui[k], `en.ui ${k}`).toBeDefined();
      expect(es.ui[k], `es.ui ${k}`).toBeDefined();
    }
  });
  it('every error code exists in en and es', () => {
    for (const k of ERROR_KEYS) {
      expect(en.errors[k], `en.errors ${k}`).toBeDefined();
      expect(es.errors[k], `es.errors ${k}`).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/trading/i18nTradingKeys.test.ts`
Expected: FAIL — keys undefined.

- [ ] **Step 3: Add the keys**

In `en.ts` `ui` object add:
```ts
    'nav.trading': 'Trading',
    'trading.title': 'Spot trading',
    'trading.pair': 'Pair',
    'trading.selectPair': 'Select a pair',
    'trading.book.title': 'Order book',
    'trading.book.price': 'Price',
    'trading.book.amount': 'Amount',
    'trading.book.total': 'Total',
    'trading.book.bids': 'Bids',
    'trading.book.asks': 'Asks',
    'trading.book.spread': 'Spread',
    'trading.book.empty': 'No open orders.',
    'trading.trades.title': 'Recent trades',
    'trading.trades.empty': 'No trades yet.',
    'trading.trades.price': 'Price',
    'trading.trades.amount': 'Amount',
    'trading.trades.side': 'Side',
    'trading.form.title': 'Place order',
    'trading.form.type': 'Order type',
    'trading.form.market': 'Market',
    'trading.form.limit': 'Limit',
    'trading.form.buy': 'Buy',
    'trading.form.sell': 'Sell',
    'trading.form.quantity': 'Amount (base asset)',
    'trading.form.price': 'Price (quote asset)',
    'trading.form.submitBuy': 'Buy',
    'trading.form.submitSell': 'Sell',
    'trading.form.feeNoteBuy': 'Fee is charged in {{asset}} (the asset you receive), at {{pct}}%.',
    'trading.form.feeNoteSell': 'Fee is charged in {{asset}} (the asset you receive), at {{pct}}%.',
    'trading.form.marketCostNote': 'Market order — the final cost depends on the execution price.',
    'trading.form.insufficient': 'Insufficient Spot balance for this order.',
    'trading.form.fundSpot': 'Trading uses your Spot balance. Transfer funds from Funding to Spot in your Wallet.',
    'trading.form.minAmount': 'Minimum amount: {{min}} {{asset}}.',
    'trading.form.success': 'Order placed. It will fill as the book matches.',
    'trading.orders.title': 'My open orders',
    'trading.orders.empty': 'You have no open orders.',
    'trading.orders.pair': 'Pair',
    'trading.orders.type': 'Type',
    'trading.orders.side': 'Side',
    'trading.orders.amount': 'Amount',
    'trading.orders.price': 'Price',
    'trading.orders.status': 'Status',
    'trading.orders.cancel': 'Cancel',
```
In `en.ts` `errors` object add:
```ts
    'TRADING_PAIR_NOT_FOUND': 'That trading pair is unavailable.',
    'INVALID_ORDER': 'The order is invalid. Check the amount, price, and limits.',
    'INSUFFICIENT_BALANCE': 'Insufficient Spot balance to place this order.',
```
In `es.ts`, same keys, Spanish:
```ts
    // ui
    'nav.trading': 'Trading',
    'trading.title': 'Trading spot',
    'trading.pair': 'Par',
    'trading.selectPair': 'Elegí un par',
    'trading.book.title': 'Libro de órdenes',
    'trading.book.price': 'Precio',
    'trading.book.amount': 'Cantidad',
    'trading.book.total': 'Total',
    'trading.book.bids': 'Compras',
    'trading.book.asks': 'Ventas',
    'trading.book.spread': 'Spread',
    'trading.book.empty': 'No hay órdenes abiertas.',
    'trading.trades.title': 'Operaciones recientes',
    'trading.trades.empty': 'Todavía no hay operaciones.',
    'trading.trades.price': 'Precio',
    'trading.trades.amount': 'Cantidad',
    'trading.trades.side': 'Lado',
    'trading.form.title': 'Colocar orden',
    'trading.form.type': 'Tipo de orden',
    'trading.form.market': 'Mercado',
    'trading.form.limit': 'Límite',
    'trading.form.buy': 'Comprar',
    'trading.form.sell': 'Vender',
    'trading.form.quantity': 'Cantidad (activo base)',
    'trading.form.price': 'Precio (activo quote)',
    'trading.form.submitBuy': 'Comprar',
    'trading.form.submitSell': 'Vender',
    'trading.form.feeNoteBuy': 'La comisión se cobra en {{asset}} (el activo que recibís), al {{pct}}%.',
    'trading.form.feeNoteSell': 'La comisión se cobra en {{asset}} (el activo que recibís), al {{pct}}%.',
    'trading.form.marketCostNote': 'Orden a mercado — el costo final depende del precio de ejecución.',
    'trading.form.insufficient': 'Saldo Spot insuficiente para esta orden.',
    'trading.form.fundSpot': 'El trading usa tu saldo Spot. Transferí fondos de Funding a Spot en tu Billetera.',
    'trading.form.minAmount': 'Cantidad mínima: {{min}} {{asset}}.',
    'trading.form.success': 'Orden colocada. Se completará a medida que el libro cruce.',
    'trading.orders.title': 'Mis órdenes abiertas',
    'trading.orders.empty': 'No tenés órdenes abiertas.',
    'trading.orders.pair': 'Par',
    'trading.orders.type': 'Tipo',
    'trading.orders.side': 'Lado',
    'trading.orders.amount': 'Cantidad',
    'trading.orders.price': 'Precio',
    'trading.orders.status': 'Estado',
    'trading.orders.cancel': 'Cancelar',
    // errors
    'TRADING_PAIR_NOT_FOUND': 'Ese par no está disponible.',
    'INVALID_ORDER': 'La orden es inválida. Revisá la cantidad, el precio y los límites.',
    'INSUFFICIENT_BALANCE': 'Saldo Spot insuficiente para colocar esta orden.',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/trading/i18nTradingKeys.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/i18n/catalogs/en.ts web/src/shared/i18n/catalogs/es.ts web/src/features/trading/i18nTradingKeys.test.ts
git commit -m "feat(web): trading i18n keys (en/es) + parity test (S4)"
```

---

### Task 3: Pairs + market-data reads (api + queries)

**Files:**
- Create: `web/src/features/trading/api.ts` (`getPairs`, `getOrderBook`, `getRecentTrades`)
- Create: `web/src/features/trading/queries.ts` (`TRADING_PAIRS_KEY`, `usePairs`, `useOrderBook`, `useRecentTrades`)
- Test: `web/src/features/trading/api.reads.test.ts`, `web/src/features/trading/queries.reads.test.tsx`

**Interfaces:**
- Consumes: `TradingPair`, `TradingPairDTO`, `OrderBook`, `RecentTrade` from `./types`; `apiClient` from `@/shared/api`.
- Produces: `tradingApi.getPairs()`, `tradingApi.getOrderBook(id)`, `tradingApi.getRecentTrades(id)`; `usePairs()`, `useOrderBook(id, enabled)`, `useRecentTrades(id, enabled)`; `TRADING_PAIRS_KEY`.

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/features/trading/api.reads.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { tradingApi } from './api';

describe('tradingApi reads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getPairs normalizes symbol + drops non-active', async () => {
    (apiClient.get as any).mockResolvedValue({ success: true, pairs: [
      { id: 'p1', symbol: 'BTC/USDT', baseAssetId: 'b1', quoteAssetId: 'q1', status: 'active',
        minOrderAmount: '0.0001', maxOrderAmount: null, pricePrecision: 2, quantityPrecision: 8,
        makerFeePercent: '0.1', takerFeePercent: '0.1', lastPrice: '65000' },
      { id: 'p2', symbol: 'ETH/USDT', baseAssetId: 'b2', quoteAssetId: 'q2', status: 'paused',
        minOrderAmount: '0.001', maxOrderAmount: null, pricePrecision: 2, quantityPrecision: 8,
        makerFeePercent: '0.1', takerFeePercent: '0.1', lastPrice: '3200' },
    ]});
    const pairs = await tradingApi.getPairs();
    expect(apiClient.get).toHaveBeenCalledWith('/trading/pairs');
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ id: 'p1', baseSymbol: 'BTC', quoteSymbol: 'USDT' });
  });

  it('getOrderBook unwraps the envelope', async () => {
    (apiClient.get as any).mockResolvedValue({ success: true, orderBook: { bids: [], asks: [], timestamp: 't' } });
    const book = await tradingApi.getOrderBook('p1');
    expect(apiClient.get).toHaveBeenCalledWith('/trading/orderbook/p1');
    expect(book).toEqual({ bids: [], asks: [], timestamp: 't' });
  });

  it('getRecentTrades normalizes to an array', async () => {
    (apiClient.get as any).mockResolvedValue({ success: true, trades: [{ id: 't1', price: 1, quantity: 2, side: 'buy' }] });
    const trades = await tradingApi.getRecentTrades('p1');
    expect(apiClient.get).toHaveBeenCalledWith('/trading/trades/p1');
    expect(trades).toHaveLength(1);
  });
});
```

```tsx
// web/src/features/trading/queries.reads.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ tradingApi: { getPairs: vi.fn(), getOrderBook: vi.fn(), getRecentTrades: vi.fn() } }));
import { tradingApi } from './api';
import { usePairs, useOrderBook } from './queries';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('trading read hooks', () => {
  beforeEach(() => vi.clearAllMocks());
  it('usePairs returns pairs', async () => {
    (tradingApi.getPairs as any).mockResolvedValue([{ id: 'p1', baseSymbol: 'BTC', quoteSymbol: 'USDT' }]);
    const { result } = renderHook(() => usePairs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].baseSymbol).toBe('BTC');
  });
  it('useOrderBook is disabled without a pair id', () => {
    const { result } = renderHook(() => useOrderBook('', false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(tradingApi.getOrderBook).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/trading/api.reads.test.ts src/features/trading/queries.reads.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/features/trading/api.ts
import { apiClient } from '@/shared/api';
import type { TradingPair, TradingPairDTO, OrderBook, RecentTrade } from './types';

interface PairsEnvelope { success?: boolean; pairs?: TradingPairDTO[] }
interface OrderBookEnvelope { success?: boolean; orderBook?: OrderBook }
interface TradesEnvelope { success?: boolean; trades?: RecentTrade[] }

function normalizePair(dto: TradingPairDTO): TradingPair | null {
  const parts = (dto.symbol ?? '').split('/');
  if (parts.length !== 2) return null;
  return {
    id: dto.id,
    symbol: dto.symbol,
    baseAssetId: dto.baseAssetId,
    quoteAssetId: dto.quoteAssetId,
    baseSymbol: parts[0],
    quoteSymbol: parts[1],
    status: dto.status,
    minOrderAmount: dto.minOrderAmount,
    maxOrderAmount: dto.maxOrderAmount,
    pricePrecision: dto.pricePrecision,
    quantityPrecision: dto.quantityPrecision,
    makerFeePercent: dto.makerFeePercent,
    takerFeePercent: dto.takerFeePercent,
    lastPrice: dto.lastPrice,
    priceChange24h: dto.priceChange24h,
    volume24h: dto.volume24h,
  };
}

export const tradingApi = {
  getPairs: () =>
    apiClient.get<PairsEnvelope | TradingPairDTO[]>('/trading/pairs').then((r) => {
      const rows = Array.isArray(r) ? r : (r.pairs ?? []);
      return rows.map(normalizePair).filter((p): p is TradingPair => p !== null && p.status === 'active');
    }),

  getOrderBook: (tradingPairId: string) =>
    apiClient.get<OrderBookEnvelope | OrderBook>(`/trading/orderbook/${tradingPairId}`).then((r) =>
      'orderBook' in r && r.orderBook ? r.orderBook : (r as OrderBook),
    ),

  getRecentTrades: (tradingPairId: string) =>
    apiClient.get<TradesEnvelope | RecentTrade[]>(`/trading/trades/${tradingPairId}`).then((r) =>
      Array.isArray(r) ? r : (r.trades ?? []),
    ),
};
```

```ts
// web/src/features/trading/queries.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { tradingApi } from './api';
import type { TradingPair, OrderBook, RecentTrade } from './types';

export const TRADING_PAIRS_KEY = ['trading', 'pairs'] as const;
export const tradingBookKey = (id: string) => ['trading', 'orderbook', id] as const;
export const tradingTradesKey = (id: string) => ['trading', 'recent-trades', id] as const;

export function usePairs() {
  return useQuery<TradingPair[], ApiError>({
    queryKey: TRADING_PAIRS_KEY,
    queryFn: () => tradingApi.getPairs(),
    staleTime: 60_000,
  });
}

export function useOrderBook(tradingPairId: string, enabled: boolean) {
  return useQuery<OrderBook, ApiError>({
    queryKey: tradingBookKey(tradingPairId),
    queryFn: () => tradingApi.getOrderBook(tradingPairId),
    enabled: enabled && Boolean(tradingPairId),
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
}

export function useRecentTrades(tradingPairId: string, enabled: boolean) {
  return useQuery<RecentTrade[], ApiError>({
    queryKey: tradingTradesKey(tradingPairId),
    queryFn: () => tradingApi.getRecentTrades(tradingPairId),
    enabled: enabled && Boolean(tradingPairId),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/features/trading/api.reads.test.ts src/features/trading/queries.reads.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/trading/api.ts web/src/features/trading/queries.ts web/src/features/trading/api.reads.test.ts web/src/features/trading/queries.reads.test.tsx
git commit -m "feat(web): trading pairs + order-book + recent-trades reads (S4)"
```

---

### Task 4: My orders read + cancel (api + queries)

**Files:**
- Modify: `web/src/features/trading/api.ts` (add `getActiveOrders`, `cancelOrder`)
- Modify: `web/src/features/trading/queries.ts` (add `TRADING_ORDERS_KEY`, `useActiveOrders`, `useCancelOrder`)
- Test: `web/src/features/trading/api.orders.test.ts`, `web/src/features/trading/queries.orders.test.tsx`

**Interfaces:**
- Consumes: `TradingOrder` from `./types`.
- Produces: `tradingApi.getActiveOrders(): Promise<TradingOrder[]>`, `tradingApi.cancelOrder(orderId): Promise<{success:boolean;message?:string}>`; `useActiveOrders()`, `useCancelOrder()`; `TRADING_ORDERS_KEY`.

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/features/trading/api.orders.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { tradingApi } from './api';

describe('tradingApi orders', () => {
  beforeEach(() => vi.clearAllMocks());
  it('getActiveOrders unwraps { orders }', async () => {
    (apiClient.get as any).mockResolvedValue({ success: true, orders: [{ id: 'o1', status: 'open' }], total: 1 });
    const orders = await tradingApi.getActiveOrders();
    expect(apiClient.get).toHaveBeenCalledWith('/trading/orders/active');
    expect(orders).toHaveLength(1);
  });
  it('cancelOrder DELETEs by id', async () => {
    (apiClient.delete as any).mockResolvedValue({ success: true, message: 'ok' });
    await tradingApi.cancelOrder('o1');
    expect(apiClient.delete).toHaveBeenCalledWith('/trading/orders/o1');
  });
});
```

```tsx
// web/src/features/trading/queries.orders.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ tradingApi: { getActiveOrders: vi.fn(), cancelOrder: vi.fn() } }));
import { tradingApi } from './api';
import { useActiveOrders, useCancelOrder } from './queries';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, spy };
}

describe('trading order hooks', () => {
  beforeEach(() => vi.clearAllMocks());
  it('useActiveOrders returns orders', async () => {
    (tradingApi.getActiveOrders as any).mockResolvedValue([{ id: 'o1', status: 'open' }]);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useActiveOrders(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe('o1');
  });
  it('useCancelOrder invalidates orders on success', async () => {
    (tradingApi.cancelOrder as any).mockResolvedValue({ success: true });
    const { wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useCancelOrder(), { wrapper });
    await result.current.mutateAsync('o1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated.some((k) => k?.includes('orders'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/trading/api.orders.test.ts src/features/trading/queries.orders.test.tsx`
Expected: FAIL — `getActiveOrders`/`useCancelOrder` undefined.

- [ ] **Step 3: Write minimal implementation**

Append to `api.ts` (inside `tradingApi`):
```ts
import type { TradingOrder } from './types';

interface OrdersEnvelope { success?: boolean; orders?: TradingOrder[]; total?: number }

// ...add properties:
  getActiveOrders: () =>
    apiClient.get<OrdersEnvelope | TradingOrder[]>('/trading/orders/active').then((r) =>
      Array.isArray(r) ? r : (r.orders ?? []),
    ),

  cancelOrder: (orderId: string) =>
    apiClient.delete<{ success: boolean; message?: string; error?: string }>(`/trading/orders/${orderId}`),
```

Append to `queries.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TradingOrder } from './types';

export const TRADING_ORDERS_KEY = ['trading', 'orders'] as const;

export function useActiveOrders() {
  return useQuery<TradingOrder[], ApiError>({
    queryKey: TRADING_ORDERS_KEY,
    queryFn: () => tradingApi.getActiveOrders(),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation<{ success: boolean; message?: string; error?: string }, ApiError, string>({
    mutationFn: (orderId: string) => tradingApi.cancelOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRADING_ORDERS_KEY });
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/features/trading/api.orders.test.ts src/features/trading/queries.orders.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/trading/api.ts web/src/features/trading/queries.ts web/src/features/trading/api.orders.test.ts web/src/features/trading/queries.orders.test.tsx
git commit -m "feat(web): trading my-orders read + cancel (S4)"
```

---

### Task 5: Place order (api + mutation) — MONEY-PATH

**Files:**
- Modify: `web/src/features/trading/api.ts` (add `placeOrder`)
- Modify: `web/src/features/trading/queries.ts` (add `usePlaceOrder`)
- Test: `web/src/features/trading/api.place.test.ts`, `web/src/features/trading/queries.place.test.tsx`

**Interfaces:**
- Consumes: `PlaceOrderRequest`, `PlaceOrderResponse` from `./types`.
- Produces: `tradingApi.placeOrder(req): Promise<PlaceOrderResponse>`; `usePlaceOrder()` mutation invalidating balances + active orders + the book.

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/features/trading/api.place.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { tradingApi } from './api';

describe('tradingApi.placeOrder', () => {
  beforeEach(() => vi.clearAllMocks());
  it('POSTs /trading/orders with quantity+price as STRINGS (limit buy)', async () => {
    (apiClient.post as any).mockResolvedValue({ success: true, order: { id: 'o1' }, message: 'ok' });
    await tradingApi.placeOrder({ tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', price: '64000' });
    expect(apiClient.post).toHaveBeenCalledWith('/trading/orders', {
      tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', price: '64000',
    });
    const body = (apiClient.post as any).mock.calls[0][1];
    expect(typeof body.quantity).toBe('string');
    expect(typeof body.price).toBe('string');
  });
  it('omits price for a market order', async () => {
    (apiClient.post as any).mockResolvedValue({ success: true, order: { id: 'o2' }, message: 'ok' });
    await tradingApi.placeOrder({ tradingPairId: 'p1', orderType: 'market', side: 'sell', quantity: '1' });
    const body = (apiClient.post as any).mock.calls[0][1];
    expect('price' in body).toBe(false);
  });
});
```

```tsx
// web/src/features/trading/queries.place.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ tradingApi: { placeOrder: vi.fn() } }));
import { tradingApi } from './api';
import { usePlaceOrder } from './queries';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, spy };
}

describe('usePlaceOrder', () => {
  beforeEach(() => vi.clearAllMocks());
  it('invalidates balances + active orders on success', async () => {
    (tradingApi.placeOrder as any).mockResolvedValue({ success: true, order: { id: 'o1' }, message: 'ok' });
    const { wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => usePlaceOrder(), { wrapper });
    await result.current.mutateAsync({ tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', price: '64000' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated.some((k) => k?.includes('balances'))).toBe(true);
    expect(invalidated.some((k) => k?.includes('orders'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/trading/api.place.test.ts src/features/trading/queries.place.test.tsx`
Expected: FAIL — `placeOrder`/`usePlaceOrder` undefined.

- [ ] **Step 3: Write minimal implementation**

Append to `api.ts` (inside `tradingApi`):
```ts
import type { PlaceOrderRequest, PlaceOrderResponse } from './types';

// Money POST. The shared client auto-attaches an Idempotency-Key (isMoneyEndpoint
// matches /trading/order). quantity/price stay STRINGS; price is omitted for market.
  placeOrder: (req: PlaceOrderRequest) => {
    const body: Record<string, unknown> = {
      tradingPairId: req.tradingPairId,
      orderType: req.orderType,
      side: req.side,
      quantity: req.quantity,
    };
    if (req.orderType === 'limit' && req.price != null) body.price = req.price;
    if (req.clientOrderId) body.clientOrderId = req.clientOrderId;
    return apiClient.post<PlaceOrderResponse>('/trading/orders', body);
  },
```

Append to `queries.ts`:
```ts
import type { PlaceOrderRequest, PlaceOrderResponse } from './types';
import { WALLET_BALANCES_KEY } from '@/features/wallet/queries';

export function usePlaceOrder() {
  const qc = useQueryClient();
  // Mutations don't retry by default — with disabled-while-pending this is the S4
  // double-submit guard (per-intent idempotency key is a deferred go-live item).
  return useMutation<PlaceOrderResponse, ApiError, PlaceOrderRequest>({
    mutationFn: tradingApi.placeOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WALLET_BALANCES_KEY });
      qc.invalidateQueries({ queryKey: TRADING_ORDERS_KEY });
      qc.invalidateQueries({ queryKey: ['trading', 'orderbook'] });
    },
  });
}
```
(`WALLET_BALANCES_KEY` is exported from `web/src/features/wallet/queries.ts` — verify it exists.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/features/trading/api.place.test.ts src/features/trading/queries.place.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/trading/api.ts web/src/features/trading/queries.ts web/src/features/trading/api.place.test.ts web/src/features/trading/queries.place.test.tsx
git commit -m "feat(web): trading place-order (api + usePlaceOrder) (S4)"
```

---

### Task 6: TradingPairSelect + trading.module.css

**Files:**
- Create: `web/src/features/trading/components/TradingPairSelect.tsx`, `web/src/features/trading/components/trading.module.css`
- Test: `web/src/features/trading/components/TradingPairSelect.test.tsx`

**Interfaces:**
- Consumes: `usePairs`; `Field` from `@/shared/ui`; `useTranslation`.
- Produces: `TradingPairSelect` (named): `{ value: string; onChange: (id: string) => void }`. Renders `<select id="trading-pair">` of active pairs (label `BASE/QUOTE`).

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/trading/components/TradingPairSelect.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
vi.mock('../queries', () => ({ usePairs: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { usePairs } from '../queries';
import { TradingPairSelect } from './TradingPairSelect';

describe('TradingPairSelect', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lists pairs and calls onChange with the id', async () => {
    (usePairs as any).mockReturnValue({ data: [{ id: 'p1', symbol: 'BTC/USDT', baseSymbol: 'BTC', quoteSymbol: 'USDT' }], isLoading: false });
    const onChange = vi.fn();
    render(<TradingPairSelect value="" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'p1');
    expect(onChange).toHaveBeenCalledWith('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/trading/components/TradingPairSelect.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/features/trading/components/TradingPairSelect.tsx
'use client';

import { Field } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { usePairs } from '../queries';

export function TradingPairSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const { data: pairs, isLoading } = usePairs();
  return (
    <Field label={t('trading.pair')}>
      <select id="trading-pair" value={value} onChange={(e) => onChange(e.target.value)} disabled={isLoading}>
        <option value="">{t('trading.selectPair')}</option>
        {(pairs ?? []).map((p) => (
          <option key={p.id} value={p.id}>{p.symbol}</option>
        ))}
      </select>
    </Field>
  );
}
```

```css
/* web/src/features/trading/components/trading.module.css */
.form { display: flex; flex-direction: column; gap: var(--space-3, 0.75rem); max-width: 28rem; }
.row { display: flex; justify-content: space-between; gap: var(--space-2, 0.5rem); }
.label { color: var(--color-text-muted, #666); font-size: 0.875rem; }
.actions { margin-top: var(--space-3, 0.75rem); display: flex; gap: var(--space-2, 0.5rem); }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { text-align: right; padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--color-border, #eee); font-variant-numeric: tabular-nums; }
.table th:first-child, .table td:first-child { text-align: left; }
.bid { color: var(--color-success, #0a0); }
.ask { color: var(--color-danger, #b00); }
.spread { color: var(--color-text-muted, #666); font-size: 0.8125rem; padding: 0.25rem 0; }
.fundPrompt { border: 1px solid var(--color-border, #ddd); border-radius: 8px; padding: var(--space-2, 0.5rem); }
```
(The CSS file ends after the `.fundPrompt` rule.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/trading/components/TradingPairSelect.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/trading/components/TradingPairSelect.tsx web/src/features/trading/components/trading.module.css web/src/features/trading/components/TradingPairSelect.test.tsx
git commit -m "feat(web): trading pair select + module styles (S4)"
```

---

### Task 7: OrderBookView + RecentTradesView (market data)

**Files:**
- Create: `web/src/features/trading/components/OrderBookView.tsx`, `web/src/features/trading/components/RecentTradesView.tsx`
- Test: `web/src/features/trading/components/OrderBookView.test.tsx`, `web/src/features/trading/components/RecentTradesView.test.tsx`

**Interfaces:**
- Consumes: `useOrderBook`, `useRecentTrades`; `useTranslation`.
- Produces: `OrderBookView` and `RecentTradesView` (named exports), each `{ tradingPairId: string }`.

**Market-display rule:** bids/asks/trades are backend NUMBERS — render them with `Intl.NumberFormat(locale)` for readability; do NOT route them through `@/shared/money` (they are not the user's spend) and do NOT compute the user's order from them.

- [ ] **Step 1: Write the failing tests**

```tsx
// web/src/features/trading/components/OrderBookView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
vi.mock('../queries', () => ({ useOrderBook: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { useOrderBook } from '../queries';
import { OrderBookView } from './OrderBookView';

describe('OrderBookView', () => {
  beforeEach(() => vi.clearAllMocks());
  it('renders bids and asks', () => {
    (useOrderBook as any).mockReturnValue({ data: { bids: [{ price: 64000, quantity: 1, total: 64000, orders: 2 }], asks: [{ price: 65000, quantity: 2, total: 130000, orders: 1 }], timestamp: '' }, isLoading: false, isError: false });
    render(<OrderBookView tradingPairId="p1" />);
    expect(screen.getByText('trading.book.bids')).toBeInTheDocument();
    expect(screen.getByText('trading.book.asks')).toBeInTheDocument();
  });
  it('renders empty state', () => {
    (useOrderBook as any).mockReturnValue({ data: { bids: [], asks: [], timestamp: '' }, isLoading: false, isError: false });
    render(<OrderBookView tradingPairId="p1" />);
    expect(screen.getByText('trading.book.empty')).toBeInTheDocument();
  });
});
```

```tsx
// web/src/features/trading/components/RecentTradesView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
vi.mock('../queries', () => ({ useRecentTrades: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { useRecentTrades } from '../queries';
import { RecentTradesView } from './RecentTradesView';

describe('RecentTradesView', () => {
  beforeEach(() => vi.clearAllMocks());
  it('renders a trade row', () => {
    (useRecentTrades as any).mockReturnValue({ data: [{ id: 't1', price: 64500, quantity: 0.5, side: 'buy' }], isLoading: false, isError: false });
    render(<RecentTradesView tradingPairId="p1" />);
    expect(screen.getByText('trading.trades.title')).toBeInTheDocument();
  });
  it('renders empty state', () => {
    (useRecentTrades as any).mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<RecentTradesView tradingPairId="p1" />);
    expect(screen.getByText('trading.trades.empty')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/trading/components/OrderBookView.test.tsx src/features/trading/components/RecentTradesView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/features/trading/components/OrderBookView.tsx
'use client';

import { useTranslation } from '@/shared/i18n';
import { useOrderBook } from '../queries';
import type { OrderBookEntry } from '../types';
import styles from './trading.module.css';

export function OrderBookView({ tradingPairId }: { tradingPairId: string }) {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useOrderBook(tradingPairId, Boolean(tradingPairId));
  // Market-data display only: these are backend numbers, never the user's spend.
  const num = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(n);

  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;
  if (isError || !data) return <p className={styles.label}>{t('trading.book.empty')}</p>;

  const bestBid = data.bids[0]?.price;
  const bestAsk = data.asks[0]?.price;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;

  const rows = (entries: OrderBookEntry[], cls: string) =>
    entries.map((e, i) => (
      <tr key={`${cls}-${i}`}>
        <td className={cls}>{num(e.price)}</td>
        <td>{num(e.quantity)}</td>
        <td>{num(e.total)}</td>
      </tr>
    ));

  return (
    <section>
      <h2>{t('trading.book.title')}</h2>
      {data.bids.length === 0 && data.asks.length === 0 ? (
        <p className={styles.label}>{t('trading.book.empty')}</p>
      ) : (
        <>
          <h3>{t('trading.book.asks')}</h3>
          <table className={styles.table}>
            <thead><tr><th>{t('trading.book.price')}</th><th>{t('trading.book.amount')}</th><th>{t('trading.book.total')}</th></tr></thead>
            <tbody>{rows(data.asks, styles.ask)}</tbody>
          </table>
          {spread != null && <p className={styles.spread}>{t('trading.book.spread')}: {num(spread)}</p>}
          <h3>{t('trading.book.bids')}</h3>
          <table className={styles.table}>
            <thead><tr><th>{t('trading.book.price')}</th><th>{t('trading.book.amount')}</th><th>{t('trading.book.total')}</th></tr></thead>
            <tbody>{rows(data.bids, styles.bid)}</tbody>
          </table>
        </>
      )}
    </section>
  );
}
```

```tsx
// web/src/features/trading/components/RecentTradesView.tsx
'use client';

import { useTranslation } from '@/shared/i18n';
import { useRecentTrades } from '../queries';
import styles from './trading.module.css';

export function RecentTradesView({ tradingPairId }: { tradingPairId: string }) {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useRecentTrades(tradingPairId, Boolean(tradingPairId));
  const num = (n: number | string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(Number(n));

  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;
  const rows = isError ? [] : (data ?? []);

  return (
    <section>
      <h2>{t('trading.trades.title')}</h2>
      {rows.length === 0 ? (
        <p className={styles.label}>{t('trading.trades.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead><tr><th>{t('trading.trades.price')}</th><th>{t('trading.trades.amount')}</th><th>{t('trading.trades.side')}</th></tr></thead>
          <tbody>
            {rows.map((tr) => (
              <tr key={tr.id}>
                <td className={tr.side === 'buy' ? styles.bid : styles.ask}>{num(tr.price)}</td>
                <td>{num(tr.quantity)}</td>
                <td>{t(tr.side === 'buy' ? 'trading.form.buy' : 'trading.form.sell')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
```
(`Number(n)` here is DELIBERATE and allowed: this is market-data display of a backend-provided number, NOT the user's spend/receive amount. The money-string rule governs the order the user places, not the read-only market ticker.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/features/trading/components/OrderBookView.test.tsx src/features/trading/components/RecentTradesView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/trading/components/OrderBookView.tsx web/src/features/trading/components/RecentTradesView.tsx web/src/features/trading/components/OrderBookView.test.tsx web/src/features/trading/components/RecentTradesView.test.tsx
git commit -m "feat(web): trading order-book + recent-trades market views (S4)"
```

---

### Task 8: MyOrdersView (lifecycle + cancel)

**Files:**
- Create: `web/src/features/trading/components/MyOrdersView.tsx`
- Test: `web/src/features/trading/components/MyOrdersView.test.tsx`

**Interfaces:**
- Consumes: `useActiveOrders`, `useCancelOrder`, `usePairs` (to label pairs); `formatDisplay` from `@/shared/money`; `Button` from `@/shared/ui`; `useTranslation`, `useErrorTranslation`.
- Produces: default-exported `MyOrdersView`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/trading/components/MyOrdersView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const cancelMutate = vi.fn();
vi.mock('../queries', () => ({
  useActiveOrders: vi.fn(),
  useCancelOrder: vi.fn(() => ({ mutate: cancelMutate, isPending: false })),
  usePairs: vi.fn(() => ({ data: [{ id: 'p1', symbol: 'BTC/USDT' }] })),
}));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));
import { useActiveOrders } from '../queries';
import MyOrdersView from './MyOrdersView';

describe('MyOrdersView', () => {
  beforeEach(() => vi.clearAllMocks());
  it('shows empty state', () => {
    (useActiveOrders as any).mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<MyOrdersView />);
    expect(screen.getByText('trading.orders.empty')).toBeInTheDocument();
  });
  it('renders an order row and cancels', async () => {
    (useActiveOrders as any).mockReturnValue({
      data: [{ id: 'o1', tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', quantityRemaining: '0.5', price: '64000', status: 'open', feePercent: '0.1', feeCurrency: 'BTC' }],
      isLoading: false, isError: false,
    });
    render(<MyOrdersView />);
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'trading.orders.cancel' }));
    expect(cancelMutate).toHaveBeenCalledWith('o1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/trading/components/MyOrdersView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/features/trading/components/MyOrdersView.tsx
'use client';

import { useMemo } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { useActiveOrders, useCancelOrder, usePairs } from '../queries';
import type { TradingOrder } from '../types';
import styles from './trading.module.css';

export default function MyOrdersView() {
  const { t, locale } = useTranslation();
  const { data: orders, isLoading, isError } = useActiveOrders();
  const { data: pairs } = usePairs();
  const cancel = useCancelOrder();

  const label = useMemo(() => {
    const map = new Map((pairs ?? []).map((p) => [p.id, p.symbol]));
    return (id: string) => map.get(id) ?? id;
  }, [pairs]);

  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;

  const rows: TradingOrder[] = isError ? [] : (orders ?? []);
  return (
    <section>
      <h2>{t('trading.orders.title')}</h2>
      {rows.length === 0 ? (
        <p className={styles.label}>{t('trading.orders.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('trading.orders.pair')}</th>
              <th>{t('trading.orders.side')}</th>
              <th>{t('trading.orders.amount')}</th>
              <th>{t('trading.orders.price')}</th>
              <th>{t('trading.orders.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>{label(o.tradingPairId)}</td>
                <td>{t(o.side === 'buy' ? 'trading.form.buy' : 'trading.form.sell')}</td>
                <td>{formatDisplay(o.quantityRemaining, { locale, maxDecimals: 8, stripTrailingZeros: true })}</td>
                <td>{o.price ? formatDisplay(o.price, { locale, maxDecimals: 8, stripTrailingZeros: true }) : t('trading.form.market')}</td>
                <td>{o.status}</td>
                <td>
                  <Button type="button" variant="secondary" size="small" onClick={() => cancel.mutate(o.id)} disabled={cancel.isPending}>
                    {t('trading.orders.cancel')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/trading/components/MyOrdersView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/trading/components/MyOrdersView.tsx web/src/features/trading/components/MyOrdersView.test.tsx
git commit -m "feat(web): trading my-orders view with cancel (S4)"
```

---

### Task 9: OrderForm orchestrator — MONEY-PATH (reviewed carefully by the coordinator)

**Files:**
- Create: `web/src/features/trading/components/OrderForm.tsx`
- Test: `web/src/features/trading/components/OrderForm.test.tsx`

**Interfaces:**
- Consumes: `TradingPairSelect`, `usePairs`, `usePlaceOrder`, `useMyBalances` (from `@/features/wallet/queries`), `parseInput`/`compare`/`multiply`/`add` (from `@/shared/money`), `useTranslation`, `useErrorTranslation`, `Button`, `Field`.
- Produces: default-exported `OrderForm`. State: `pairId`, `orderType` (`market`|`limit`), `side` (`buy`|`sell`), `quantity`, `price` (raw strings). Derives the selected `TradingPair`, parsed quantity/price, the fee note, the Spot sufficiency gate.

**Money-path requirements (the reviewer verifies all of these):**
1. `quantity` (and `price` for limit) sent to `placeOrder` are canonical strings (`parseInput(...).value`) — never a Number. `market` omits `price`.
2. Fee note (received-asset): **buy** → fee in BASE (`pair.baseSymbol`) at `takerFeePercent`; **sell** → fee in QUOTE (`pair.quoteSymbol`) at `takerFeePercent`. Use `trading.form.feeNoteBuy`/`feeNoteSell` with `{ asset, pct }`.
3. Sufficiency gate (Spot compartment, exact):
   - **sell:** base-asset `compartments.spot.available >= quantity`.
   - **buy + limit:** quote-asset `compartments.spot.available >= add(multiply(quantity, price), multiply(multiply(quantity, price), takerFeePercent/100))`. Compute with `@/shared/money` only.
   - **buy + market:** no fixed price → cannot compute exactly. Gate is SOFT: block only if the quote Spot available is `0`/unknown; show `trading.form.marketCostNote`. Server authoritative.
   - If the needed balance entry hasn't loaded, BLOCK submit (no pass-on-unknown).
4. `canSubmit` is false while: no pair / pair not active / quantity invalid or below `minOrderAmount` / (limit) price invalid / sufficiency fails / balance unknown / `place.isPending`.
5. Submit disabled-while-pending (no double submit); mutation does not retry.
6. Insufficient Spot shows `trading.form.insufficient` + the `trading.form.fundSpot` prompt (link to `/wallet`).
7. Success shows `trading.form.success` and resets quantity/price. Errors via `tError(code, { requestId })`.

- [ ] **Step 1: Write the failing tests** (behavioral, money-path)

```tsx
// web/src/features/trading/components/OrderForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mutateAsync = vi.fn();
vi.mock('../queries', () => ({
  usePairs: vi.fn(),
  usePlaceOrder: vi.fn(() => ({ mutateAsync, isPending: false, isError: false, isSuccess: false, error: null, data: undefined })),
}));
vi.mock('@/features/wallet/queries', () => ({ useMyBalances: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));
vi.mock('./TradingPairSelect', () => ({ TradingPairSelect: ({ value, onChange }: any) => (
  <select aria-label="pair" value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">--</option><option value="p1">BTC/USDT</option>
  </select>
) }));

import { usePairs, usePlaceOrder } from '../queries';
import { useMyBalances } from '@/features/wallet/queries';
import OrderForm from './OrderForm';

const PAIR = { id: 'p1', symbol: 'BTC/USDT', baseAssetId: 'b1', quoteAssetId: 'q1', baseSymbol: 'BTC', quoteSymbol: 'USDT', status: 'active', minOrderAmount: '0.0001', maxOrderAmount: null, pricePrecision: 2, quantityPrecision: 8, makerFeePercent: '0.1', takerFeePercent: '0.1', lastPrice: '65000' };

function spot(available: string, which: 'q1' | 'b1') {
  return [{ criptomonedaId: which, compartments: { funding: { available: '0', blocked: '0', pending: '0' }, spot: { available, blocked: '0' } }, crypto: { id: which, symbol: which === 'q1' ? 'USDT' : 'BTC' } }];
}

beforeEach(() => {
  vi.clearAllMocks();
  (usePairs as any).mockReturnValue({ data: [PAIR], isLoading: false });
});

describe('OrderForm (money-path)', () => {
  it('blocks a limit buy when quote Spot is insufficient and shows the fund-Spot prompt', async () => {
    (useMyBalances as any).mockReturnValue({ data: spot('10', 'q1') }); // need 0.5*64000*(1.001)=32032
    render(<OrderForm />);
    await userEvent.selectOptions(screen.getByLabelText('pair'), 'p1');
    await userEvent.type(screen.getByLabelText('trading.form.quantity'), '0.5');
    await userEvent.type(screen.getByLabelText('trading.form.price'), '64000');
    expect(screen.getByRole('button', { name: 'trading.form.submitBuy' })).toBeDisabled();
    expect(screen.getByText('trading.form.fundSpot')).toBeInTheDocument();
  });

  it('enables + submits a limit buy with canonical strings when quote Spot covers cost+fee', async () => {
    (useMyBalances as any).mockReturnValue({ data: spot('50000', 'q1') });
    mutateAsync.mockResolvedValue({ success: true, order: { id: 'o1' }, message: 'ok' });
    render(<OrderForm />);
    await userEvent.selectOptions(screen.getByLabelText('pair'), 'p1');
    await userEvent.type(screen.getByLabelText('trading.form.quantity'), '0.5');
    await userEvent.type(screen.getByLabelText('trading.form.price'), '64000');
    const btn = screen.getByRole('button', { name: 'trading.form.submitBuy' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(mutateAsync).toHaveBeenCalledWith({ tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', price: '64000' });
  });

  it('sell gate reads the BASE asset Spot balance', async () => {
    (useMyBalances as any).mockReturnValue({ data: spot('0.1', 'b1') }); // have 0.1 BTC, want to sell 0.5
    render(<OrderForm />);
    await userEvent.selectOptions(screen.getByLabelText('pair'), 'p1');
    await userEvent.click(screen.getByRole('radio', { name: 'trading.form.sell' }));
    await userEvent.type(screen.getByLabelText('trading.form.quantity'), '0.5');
    await userEvent.type(screen.getByLabelText('trading.form.price'), '64000');
    expect(screen.getByRole('button', { name: 'trading.form.submitSell' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/trading/components/OrderForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// web/src/features/trading/components/OrderForm.tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { parseInput, compare, multiply, add, divide } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useMyBalances } from '@/features/wallet/queries';
import { TradingPairSelect } from './TradingPairSelect';
import { usePairs, usePlaceOrder } from '../queries';
import type { OrderSide, OrderType } from '../types';
import styles from './trading.module.css';

export default function OrderForm() {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { data: pairs } = usePairs();
  const { data: balances } = useMyBalances();
  const place = usePlaceOrder();

  const [pairId, setPairId] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [side, setSide] = useState<OrderSide>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  const pair = useMemo(() => (pairs ?? []).find((p) => p.id === pairId), [pairs, pairId]);
  const parsedQty = useMemo(() => parseInput(quantity, { locale }), [quantity, locale]);
  const parsedPrice = useMemo(() => parseInput(price, { locale }), [price, locale]);

  const qtyOk = parsedQty.ok && compare(parsedQty.value, '0') > 0;
  const priceNeeded = orderType === 'limit';
  const priceOk = !priceNeeded || (parsedPrice.ok && compare(parsedPrice.value, '0') > 0);
  const aboveMin = qtyOk && pair ? compare(parsedQty.value, pair.minOrderAmount) >= 0 : false;

  // Needed asset per side: buy spends quote, sell spends base.
  const needAsset = pair ? (side === 'buy' ? pair.quoteAssetId : pair.baseAssetId) : null;
  const spotAvailable = useMemo(() => {
    if (!needAsset) return null;
    const entry = (balances ?? []).find((b) => b.criptomonedaId === needAsset);
    if (!entry) return null;
    return entry.compartments.spot?.available ?? null;
  }, [balances, needAsset]);

  // Required spend (canonical money only).
  const requiredSpend = useMemo(() => {
    if (!pair || !qtyOk) return null;
    if (side === 'sell') return parsedQty.value; // base amount
    // buy
    if (orderType === 'limit') {
      if (!priceOk || !parsedPrice.ok) return null;
      const notional = multiply(parsedQty.value, parsedPrice.value);
      const fee = multiply(notional, divide(pair.takerFeePercent, '100'));
      return add(notional, fee); // quote needed
    }
    return null; // market buy: cannot compute exactly
  }, [pair, qtyOk, side, orderType, priceOk, parsedPrice, parsedQty]);

  const isMarketBuy = side === 'buy' && orderType === 'market';
  const insufficient = (() => {
    if (spotAvailable == null) return false; // unknown handled by canSubmit
    if (isMarketBuy) return compare(spotAvailable, '0') <= 0; // soft: only block on zero
    if (requiredSpend == null) return false;
    return compare(requiredSpend, spotAvailable) > 0;
  })();

  const canSubmit =
    Boolean(pairId) &&
    !!pair &&
    pair.status === 'active' &&
    qtyOk &&
    aboveMin &&
    priceOk &&
    spotAvailable != null &&
    !insufficient &&
    !place.isPending;

  const feeAsset = pair ? (side === 'buy' ? pair.baseSymbol : pair.quoteSymbol) : '';
  const feeNoteKey = side === 'buy' ? 'trading.form.feeNoteBuy' : 'trading.form.feeNoteSell';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsedQty.ok) return;
    const req: { tradingPairId: string; orderType: OrderType; side: OrderSide; quantity: string; price?: string } = {
      tradingPairId: pairId,
      orderType,
      side,
      quantity: parsedQty.value,
    };
    if (orderType === 'limit' && parsedPrice.ok) req.price = parsedPrice.value;
    try {
      await place.mutateAsync(req);
      setQuantity('');
      setPrice('');
    } catch {
      // surfaced via place.error below
    }
  }

  const submitLabel = side === 'buy' ? 'trading.form.submitBuy' : 'trading.form.submitSell';

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2>{t('trading.form.title')}</h2>

      <TradingPairSelect value={pairId} onChange={setPairId} />

      <fieldset>
        <legend>{t('trading.form.type')}</legend>
        <label><input type="radio" name="otype" checked={orderType === 'limit'} onChange={() => setOrderType('limit')} /> {t('trading.form.limit')}</label>
        <label><input type="radio" name="otype" checked={orderType === 'market'} onChange={() => setOrderType('market')} /> {t('trading.form.market')}</label>
      </fieldset>

      <fieldset>
        <legend>{t('trading.form.type')}</legend>
        <label><input type="radio" name="side" aria-label={t('trading.form.buy')} checked={side === 'buy'} onChange={() => setSide('buy')} /> {t('trading.form.buy')}</label>
        <label><input type="radio" name="side" aria-label={t('trading.form.sell')} checked={side === 'sell'} onChange={() => setSide('sell')} /> {t('trading.form.sell')}</label>
      </fieldset>

      <Field label={t('trading.form.quantity')}>
        <input id="order-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoComplete="off" />
      </Field>

      {orderType === 'limit' && (
        <Field label={t('trading.form.price')}>
          <input id="order-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} autoComplete="off" />
        </Field>
      )}

      {pair && (
        <p className={styles.label}>{t(feeNoteKey, { asset: feeAsset, pct: pair.takerFeePercent })}</p>
      )}
      {isMarketBuy && <p className={styles.label}>{t('trading.form.marketCostNote')}</p>}
      {pair && qtyOk && !aboveMin && (
        <p role="alert" className={styles.label}>{t('trading.form.minAmount', { min: pair.minOrderAmount, asset: pair.baseSymbol })}</p>
      )}

      {insufficient && (
        <div role="alert" className={styles.fundPrompt}>
          <p className={styles.label}>{t('trading.form.insufficient')}</p>
          <p className={styles.label}>{t('trading.form.fundSpot')} <Link href="/wallet">/wallet</Link></p>
        </div>
      )}
      {place.isError && place.error && (
        <p role="alert" className={styles.label}>{tError(place.error.code, { requestId: place.error.requestId ?? '' })}</p>
      )}
      {place.isSuccess && <p role="status" className={styles.label}>{t('trading.form.success')}</p>}

      <div className={styles.actions}>
        <Button type="submit" variant={side === 'buy' ? 'primary' : 'danger'} disabled={!canSubmit} loading={place.isPending}>
          {t(submitLabel)}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/features/trading/components/OrderForm.test.tsx`
Expected: PASS. (If a radio query is brittle, the tests select `side` radios by `aria-label`; keep those labels.)

- [ ] **Step 5: Commit**

```bash
git add web/src/features/trading/components/OrderForm.tsx web/src/features/trading/components/OrderForm.test.tsx
git commit -m "feat(web): trading OrderForm with Spot sufficiency + received-asset fee note (S4)"
```

---

### Task 10: Wire the page + nav + barrel + contract doc + full gate

**Files:**
- Create: `web/src/features/trading/components/TradingWidget.tsx`, `web/src/features/trading/index.ts`, `web/app/(app)/trading/page.tsx`
- Modify: `web/app/(app)/layout.tsx` (add the `/trading` nav link), `docs/frontend-rebuild/backend-contract-changes.md`
- Test: `web/src/features/trading/components/TradingWidget.test.tsx`

**Interfaces:**
- Consumes: `OrderForm`, `OrderBookView`, `RecentTradesView`, `MyOrdersView`, `TradingPairSelect`, `usePairs`.
- Produces: `TradingWidget` (default + named from `index.ts`); the route page.

**TradingWidget design:** owns the selected `pairId` state at the top so the book/trades/form share it. A single `TradingPairSelect` at the top sets `pairId`; `OrderBookView`/`RecentTradesView` take that `pairId`; `OrderForm` manages its OWN pair internally (it already renders a `TradingPairSelect`) — to avoid two selectors, pass the shared `pairId` down. **Decision:** keep it simple — `TradingWidget` renders the shared `TradingPairSelect` + `OrderBookView` + `RecentTradesView` + `MyOrdersView`, and `OrderForm` (which has its own pair selector). Yes, two selectors exist (widget-level for market data, form-level for the order); that is acceptable for the MVP and avoids prop-drilling a controlled pair into the form this slice. Document this as a known follow-up (unify to one selector).

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/trading/components/TradingWidget.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
vi.mock('./OrderForm', () => ({ default: () => <div>form-stub</div> }));
vi.mock('./MyOrdersView', () => ({ default: () => <div>orders-stub</div> }));
vi.mock('./OrderBookView', () => ({ OrderBookView: () => <div>book-stub</div> }));
vi.mock('./RecentTradesView', () => ({ RecentTradesView: () => <div>trades-stub</div> }));
vi.mock('./TradingPairSelect', () => ({ TradingPairSelect: () => <div>pairselect-stub</div> }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import TradingWidget from './TradingWidget';

describe('TradingWidget', () => {
  it('renders heading, market data, form and orders', () => {
    render(<TradingWidget />);
    expect(screen.getByRole('heading', { name: 'trading.title' })).toBeInTheDocument();
    expect(screen.getByText('form-stub')).toBeInTheDocument();
    expect(screen.getByText('book-stub')).toBeInTheDocument();
    expect(screen.getByText('orders-stub')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/trading/components/TradingWidget.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/features/trading/components/TradingWidget.tsx
'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { TradingPairSelect } from './TradingPairSelect';
import { OrderBookView } from './OrderBookView';
import { RecentTradesView } from './RecentTradesView';
import OrderForm from './OrderForm';
import MyOrdersView from './MyOrdersView';

export default function TradingWidget() {
  const { t } = useTranslation();
  const [marketPairId, setMarketPairId] = useState('');
  return (
    <section>
      <h1>{t('trading.title')}</h1>
      <TradingPairSelect value={marketPairId} onChange={setMarketPairId} />
      {marketPairId && (
        <>
          <OrderBookView tradingPairId={marketPairId} />
          <RecentTradesView tradingPairId={marketPairId} />
        </>
      )}
      <OrderForm />
      <MyOrdersView />
    </section>
  );
}
```

```ts
// web/src/features/trading/index.ts
export { default as TradingWidget } from './components/TradingWidget';
```

```tsx
// web/app/(app)/trading/page.tsx
import { TradingWidget } from '@/features/trading';

export default function TradingPage() {
  return <TradingWidget />;
}
```

In `web/app/(app)/layout.tsx`, add inside `<nav>` after the swap link:
```tsx
        <Link href="/trading">{t('nav.trading')}</Link>
```

In `docs/frontend-rebuild/backend-contract-changes.md`, append:
```markdown
### 20. Next.js `web/` app — trading (order book) endpoints consumed (Slice 4, 2026-10-10)

The rebuilt frontend (`web/`) consumes the spot-trading vertical:
- `GET /trading/pairs` — active pairs (normalized to `{ id, symbol, baseSymbol, quoteSymbol, lastPrice, fees, min/max, precision }`).
- `GET /trading/orderbook/:id`, `GET /trading/trades/:id` — market data (numbers; read-only display, never the user's spend).
- `POST /trading/orders` — place order (money POST, Idempotency-Key auto-attached). `quantity`/`price` sent as canonical decimal STRINGS; `price` omitted for market. Fee is charged on the received asset (buy→base, sell→quote), explained in the form. Trading uses the Spot compartment; insufficient Spot shows a Funding→Spot prompt.
- `GET /trading/orders/active` + `DELETE /trading/orders/:id` — open-order lifecycle + cancel.
- Scope: market + limit orders only (stop orders deferred); no candlestick chart (deferred).
```

- [ ] **Step 4: Run the test + the FULL slice gate**

```bash
cd web && npx vitest run src/features/trading/components/TradingWidget.test.tsx
cd web && npx tsc --noEmit
cd web && npx vitest run
cd web && npm run build
```
Expected: TradingWidget test PASS; `tsc` exit 0; full Vitest green; `next build` succeeds and lists `/trading` among the routes.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/trading/components/TradingWidget.tsx web/src/features/trading/components/TradingWidget.test.tsx web/src/features/trading/index.ts "web/app/(app)/trading/page.tsx" "web/app/(app)/layout.tsx" docs/frontend-rebuild/backend-contract-changes.md
git commit -m "feat(web): mount trading route + nav + contract doc (S4)"
```

---

## Self-Review

**1. Spec coverage (design spec S4 exit criteria):**
- *Funding→Spot prerequisite* → Task 9 Spot-only gate + `fundSpot` prompt linking to `/wallet`. ✓
- *Received-asset fee explanation* → Task 9 fee note (buy→base, sell→quote, at takerFeePercent). ✓
- *Order lifecycle* → Task 8 (active orders + status + cancel), Task 5 (201 pending → matches async). ✓
- *Accessible market data* → Task 7 order book (bids/asks/spread) + recent trades; `<table>` semantics, tabular-nums. ✓
- Per-slice gate (typecheck + tests + build; contract test per request shape / typed error / money field; keyboard/focus via Field/Button/radios; no double-submit; Spot-only, no Funding/blocked as spendable) → Tasks 3/4/5 request-shape tests, Task 9 money-path tests, Task 10 build gate. ✓

**2. Placeholder scan:** every code step carries complete code; no TBD/placeholder patterns.

**3. Type consistency:** `tradingApi` methods, `TradingPair.baseAssetId/quoteAssetId/baseSymbol/quoteSymbol/takerFeePercent/minOrderAmount`, query keys (`TRADING_PAIRS_KEY`, `TRADING_ORDERS_KEY`, `tradingBookKey`), `PlaceOrderRequest` shape, and `WALLET_BALANCES_KEY` import are consistent across tasks. The sufficiency gate uses `BalanceEntry.compartments.spot.available` (real wallet type). ✓

**Note for the executor (money-path):** Tasks 5 and 9 are the money-path tasks — the coordinator reviews these personally. Confirm: (a) no Number/parseFloat on quantity/price/spend anywhere (market-data display numbers are the allowed exception, read-only); (b) the sufficiency gate uses Spot, is exact for sell/limit-buy and soft+documented for market-buy, and blocks on unknown balance; (c) submit disabled while pending; (d) `price` omitted for market orders; (e) fee note names the received asset per side.
