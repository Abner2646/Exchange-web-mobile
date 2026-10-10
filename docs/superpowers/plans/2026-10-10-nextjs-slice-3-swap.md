# Next.js Slice 3 — Swap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `web/` Next.js swap vertical — pick a pair, see an *indicative* quote with fee/total disclosure and daily-limit feedback, and execute an idempotent instant swap against the house, with the oracle-paused (503 `PRICE_ORACLE_DIVERGENCE`) state handled as a first-class UI state.

**Architecture:** Mirrors the S2 wallet feature exactly. Feature code under `web/src/features/swap/` (`types.ts`, `api.ts`, `queries.ts`, `index.ts`, `components/*`), consumed by a client-rendered route `web/app/(app)/swap/page.tsx`. Data flows through the shared transport (`@/shared/api`, same-origin `/api`, auto Idempotency-Key on the money POST), money is handled only via `@/shared/money` canonical decimal strings, copy via `@/shared/i18n`, and UI via `@/shared/ui` primitives. TanStack Query v5 for server state.

**Tech Stack:** Next.js 14.2.35 (App Router), React 18, TypeScript, TanStack Query v5, Vitest + Testing Library, decimal.js (inside `@/shared/money`).

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the sprint/handoff and the real backend contract.

- **Framework:** Next.js **14.2.35** / React **18**, App Router, TypeScript. Do NOT upgrade to React 19 / Next 16 in this slice.
- **Money is sacred:** money values are interpreted, computed, compared, and formatted ONLY via `@/shared/money` canonical decimal strings. NEVER `Number()`/`parseFloat`/unary `+`/`.toFixed()`/native math on a money value. **ONE documented exception** (Task 5): a single `Number(...)` at the wire boundary for the *advisory* `check-limit` POST, because that backend endpoint rejects anything whose `typeof !== 'number'`. Its result is advisory only — the authoritative daily-limit enforcement is server-side at execution (`EXCHANGE_DAILY_LIMIT_EXCEEDED`). This exception must be commented in the code and must never gate a submit on its own.
- **`baseAmount` on the wire = canonical decimal STRING.** Both `POST /intercambioExchange/calculate` (preview) and `POST /intercambioExchange` (execute) accept a string for `baseAmount` and `parseFloat` it server-side; sending the validated canonical string is the money-faithful choice and keeps the frontend free of float coercion. (Backend-side float handling is a documented pre-existing contract limitation, contract doc §5.)
- **Idempotency:** the shared client auto-attaches an `Idempotency-Key` header on `POST /intercambioExchange` (it matches `isMoneyEndpoint`). The go-live *per-intent* idempotency key is a deferred cross-cutting gate item (HANDOFF go-live gate #1) and is **NOT** in scope for S3. In S3 we rely on: disabled-while-pending button + TanStack mutations not retrying by default + backend per-key dedup. Do not add per-intent keying here.
- **i18n:** add every new key to BOTH `web/src/shared/i18n/catalogs/en.ts` and `es.ts`. `fr`/`it`/`pt` catalogs are a later sprint item, not S3.
- **Error rendering:** render API errors via `useErrorTranslation().tError(code, params)`. When a code may be `INTERNAL_ERROR` (any 5xx), pass `{ requestId: err.requestId ?? '' }` so the `{{requestId}}` placeholder resolves (S2 bug lesson).
- **TanStack generics:** type every hook `useQuery<T, ApiError>` / `useMutation<T, ApiError, V>` so call sites can read `error.code` / `error.status`.
- **UI primitives:** `Button` (props incl. `variant?`, `size?`, `loading?`, `disabled?`, `type?`) renders disabled while `loading`. `Field` takes `label: string` and clones exactly ONE child element that **carries its own `id`** (no `htmlFor` prop). `useTranslation()` returns `{ t, locale }`; `useErrorTranslation()` (from `@/shared/i18n/errorCatalog`) returns `{ tError }`.
- **Git hygiene:** `git add` EXPLICIT file paths in every commit. NEVER `git add -A` / `git add .` / `git commit -am`. Do not name any test-local helper `describe` (clashes with the Vitest global — S1 lesson).
- **Commits:** Conventional Commits in English, NO Claude attribution.
- **Working directory for all commands:** `web/` (e.g. `cd web && npx vitest run ...`).

---

## Backend contract (ground truth — do not re-derive, do not trust the OpenAPI `number` typing over this)

**Swap pairs (public, no auth), raw array (no envelope):** `GET /parExchange`
Each item (DECIMAL fields arrive as JSON **strings**):
```
{
  id, baseCryptoId, quoteCryptoId,
  currentPrice: string, previousPrice: string|null,
  volume24h: string, changePercent24h: string,
  feePercent: string, active: boolean,
  priceSource: string, externalSymbol: string|null,
  oraclePaused: boolean, oraclePauseReason: string|null, oracleCheckedAt: string|null,
  lastUpdated: string,
  baseCrypto: { id, symbol, name, network },
  quoteCrypto: { id, symbol, name, network }
}
```
Ordered by `volume24h` DESC, then `currentPrice` DESC.

**Preview (auth + email verified):** `POST /intercambioExchange/calculate`
Body: `{ pairId: uuid, baseAmount: string, type: 'buy'|'sell' }`
`200`:
```
{
  par: { id, base: string (symbol), quote: string (symbol), price: string, volume24h, lastUpdated },
  calculo: {
    baseAmount, quoteAmount: string, feePercent: string, feeAmount: string,
    impactoSlippage: 0, finalAmount: string, direccion: 'buy'|'sell', precioEfectivo: string
  },
  advertencias: []
}
```
`finalAmount` = `requiredQuote` (quote the buyer spends) when `buy`; = `netQuote` (quote the seller receives) when `sell`.
Errors: `400 EXCHANGE_INVALID_INPUT`, `400 EXCHANGE_PAIR_NO_PRICE`, `404 EXCHANGE_PAIR_NOT_FOUND`, **`503 PRICE_ORACLE_DIVERGENCE`**.

**Daily-limit advisory (auth):** `POST /intercambioExchange/check-limit`
Body: `{ quoteAmount: number }` ← **strict `typeof === 'number'`** (the documented `Number()` boundary).
`200`: `{ canTransact: true, dailyVolume, limit, remainingLimit, requestedAmount }`
Errors: `400 EXCHANGE_DAILY_LIMIT_EXCEEDED`, `400 EXCHANGE_INVALID_INPUT`.

**Execute (auth + email verified, `Idempotency-Key` header required):** `POST /intercambioExchange`
Body: `{ pairId: uuid, type: 'buy'|'sell', baseAmount: string, compartimento?: 'funding'|'spot' (default 'funding') }`
`201`:
```
{ message, data: { id, userId, pairId, type, baseAmount, quoteAmount, price, feeAmount, feePercent,
                   status: 'completed', completedAt, precioUsado: string, comisionCalculada: string, netAmount: string } }
```
Errors: `400 EXCHANGE_INVALID_INPUT | EXCHANGE_DAILY_LIMIT_EXCEEDED | EXCHANGE_INSUFFICIENT_BALANCE | EXCHANGE_PAIR_NO_PRICE`, `404 EXCHANGE_PAIR_NOT_FOUND`, **`503 PRICE_ORACLE_DIVERGENCE`**.

**My swaps (auth):** `GET /intercambioExchange/me?type&status&limit&offset&pairId` → list of swaps (`Swap.getByUserId`). Treat the response defensively as either an array or `{ rows, count }`; the implementer verifies the exact shape against the running list shape used by `getMyIntercambios` and normalizes to an array in `api.ts`.

**Balances (auth), reused from wallet:** `GET /balances/my/balances` → `BalanceEntry[]` (already typed in `web/src/features/wallet/types.ts`): each has `criptomonedaId`, `compartments.funding.available`, `compartments.spot.available`, `crypto: { id, symbol, ... } | null`. Used for the client-side sufficiency gate.

**Client-side sufficiency gate (money-path, exact):**
- **buy** in compartment `C`: the user spends the *quote* asset. Require `compartments[C].available` of `quoteCryptoId` `>= calculo.finalAmount` (= requiredQuote).
- **sell** in compartment `C`: the user spends the *base* asset. Require `compartments[C].available` of `baseCryptoId` `>= enteredBaseAmount`.
The server is authoritative (`EXCHANGE_INSUFFICIENT_BALANCE`); this gate is the pre-submit guard required by the audit (no spending pending/blocked, no Funding/Spot confusion).

---

## File structure

Create (all under `web/`):
- `src/features/swap/types.ts` — feature types.
- `src/features/swap/api.ts` — typed endpoint wrappers over `apiClient`.
- `src/features/swap/queries.ts` — TanStack hooks + query keys.
- `src/features/swap/index.ts` — public barrel (exports the page widget).
- `src/features/swap/components/swap.module.css` — scoped styles (copy the shape of `wallet.module.css`).
- `src/features/swap/components/PairSelect.tsx` — pair picker.
- `src/features/swap/components/QuoteDisplay.tsx` — indicative quote + fee/total + oracle-paused state.
- `src/features/swap/components/SwapForm.tsx` — money-path orchestrator (the screen).
- `src/features/swap/components/SwapHistory.tsx` — recent swaps read view.
- `src/features/swap/components/SwapWidget.tsx` — composes form + history under a heading (what the page renders).
- `app/(app)/swap/page.tsx` — route.
- Test files colocated: `*.test.ts(x)` beside each unit.

Modify:
- `src/shared/i18n/catalogs/en.ts` and `es.ts` — add `swap.*` + `nav.swap` (ui) and `EXCHANGE_*` + `PRICE_ORACLE_DIVERGENCE` (errors).
- `app/(app)/layout.tsx` — add the `/swap` nav link.
- `docs/frontend-rebuild/backend-contract-changes.md` — add the "web consumes swap" section.

---

### Task 1: Feature types

**Files:**
- Create: `web/src/features/swap/types.ts`
- Test: `web/src/features/swap/types.test.ts`

**Interfaces:**
- Produces: `SwapPairDTO`, `SwapPair` (normalized), `QuoteRequest`, `QuoteResponse`, `CheckLimitResponse`, `ExecuteSwapRequest`, `ExecuteSwapResponse`, `MySwap`, `SwapType`, `SwapCompartment`. Later tasks import these.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/features/swap/types.test.ts
import { describe, it, expect } from 'vitest';
import type { SwapPair, QuoteResponse, ExecuteSwapRequest } from './types';

describe('swap types', () => {
  it('compiles with representative values', () => {
    const pair: SwapPair = {
      id: 'p1', baseCryptoId: 'b1', quoteCryptoId: 'q1',
      currentPrice: '65000.00000000', feePercent: '0.1', active: true,
      oraclePaused: false, baseSymbol: 'BTC', quoteSymbol: 'USDT',
    };
    const req: ExecuteSwapRequest = { pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'funding' };
    const q: QuoteResponse['calculo'] = {
      baseAmount: '0.5', quoteAmount: '32500', feePercent: '0.1', feeAmount: '32.5',
      impactoSlippage: 0, finalAmount: '32532.5', direccion: 'buy', precioEfectivo: '65000',
    };
    expect(pair.oraclePaused).toBe(false);
    expect(req.type).toBe('buy');
    expect(q.direccion).toBe('buy');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/swap/types.test.ts`
Expected: FAIL — cannot find module `./types`.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/features/swap/types.ts

export type SwapType = 'buy' | 'sell';
export type SwapCompartment = 'funding' | 'spot';

/** Raw item from GET /parExchange (DECIMAL fields are JSON strings). */
export interface SwapPairDTO {
  id: string;
  baseCryptoId: string;
  quoteCryptoId: string;
  currentPrice: string;
  feePercent: string;
  active: boolean;
  oraclePaused: boolean;
  oraclePauseReason?: string | null;
  volume24h?: string;
  changePercent24h?: string;
  lastUpdated?: string;
  baseCrypto?: { id: string; symbol: string; name: string; network: string } | null;
  quoteCrypto?: { id: string; symbol: string; name: string; network: string } | null;
}

/** Normalized pair the UI consumes (symbols flattened, never null). */
export interface SwapPair {
  id: string;
  baseCryptoId: string;
  quoteCryptoId: string;
  currentPrice: string;
  feePercent: string;
  active: boolean;
  oraclePaused: boolean;
  baseSymbol: string;
  quoteSymbol: string;
}

export interface QuoteRequest {
  pairId: string;
  baseAmount: string; // canonical decimal string
  type: SwapType;
}

export interface QuoteResponse {
  par: { id: string; base: string; quote: string; price: string; volume24h?: string; lastUpdated?: string };
  calculo: {
    baseAmount: string | number;
    quoteAmount: string;
    feePercent: string;
    feeAmount: string;
    impactoSlippage: number;
    finalAmount: string;
    direccion: SwapType;
    precioEfectivo: string;
  };
  advertencias: string[];
}

export interface CheckLimitResponse {
  canTransact: boolean;
  dailyVolume: number;
  limit: number;
  remainingLimit: number;
  requestedAmount: number;
}

export interface ExecuteSwapRequest {
  pairId: string;
  type: SwapType;
  baseAmount: string; // canonical decimal string
  compartimento: SwapCompartment;
}

export interface ExecuteSwapResponse {
  message: string;
  data: {
    id: string;
    pairId: string;
    type: SwapType;
    baseAmount: string;
    quoteAmount: string;
    price: string;
    feeAmount: string;
    feePercent: string;
    status: string;
    completedAt?: string;
    precioUsado: string;
    comisionCalculada: string;
    netAmount: string;
  };
}

export interface MySwap {
  id: string;
  pairId: string;
  type: SwapType;
  baseAmount: string;
  quoteAmount: string;
  price: string;
  feeAmount: string;
  status: string;
  completedAt?: string;
  createdAt?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/swap/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/swap/types.ts web/src/features/swap/types.test.ts
git commit -m "feat(web): swap feature types (S3)"
```

---

### Task 2: i18n keys (swap copy + swap error codes), both locales

**Files:**
- Modify: `web/src/shared/i18n/catalogs/en.ts`, `web/src/shared/i18n/catalogs/es.ts`
- Test: `web/src/features/swap/i18nSwapKeys.test.ts`

**Interfaces:**
- Produces: the `swap.*`/`nav.swap` ui keys and `EXCHANGE_*`/`PRICE_ORACLE_DIVERGENCE` error keys that every component/hook references.

- [ ] **Step 1: Write the failing test** (mirrors `i18nWalletKeys.test.ts`)

```ts
// web/src/features/swap/i18nSwapKeys.test.ts
import { describe, it, expect } from 'vitest';
import { en } from '@/shared/i18n/catalogs/en';
import { es } from '@/shared/i18n/catalogs/es';

const UI_KEYS = [
  'nav.swap',
  'swap.title', 'swap.form.title', 'swap.form.pair', 'swap.form.selectPair',
  'swap.form.type', 'swap.form.buy', 'swap.form.sell', 'swap.form.compartment',
  'swap.form.amount', 'swap.form.submit', 'swap.form.paused', 'swap.form.pausedRetry',
  'swap.form.insufficient', 'swap.form.limitExceeded', 'swap.form.limitRemaining',
  'swap.quote.title', 'swap.quote.indicative', 'swap.quote.youPay', 'swap.quote.youReceive',
  'swap.quote.fee', 'swap.quote.price', 'swap.quote.loading', 'swap.quote.empty',
  'swap.success.title', 'swap.success.priceUsed', 'swap.success.fee',
  'swap.history.title', 'swap.history.empty', 'swap.history.error',
  'swap.history.pair', 'swap.history.type', 'swap.history.amount', 'swap.history.date',
];
const ERROR_KEYS = [
  'PRICE_ORACLE_DIVERGENCE', 'EXCHANGE_INVALID_INPUT', 'EXCHANGE_PAIR_NOT_FOUND',
  'EXCHANGE_PAIR_NO_PRICE', 'EXCHANGE_DAILY_LIMIT_EXCEEDED', 'EXCHANGE_INSUFFICIENT_BALANCE',
  'EXCHANGE_USER_NOT_FOUND',
];

describe('swap i18n keys', () => {
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

Run: `cd web && npx vitest run src/features/swap/i18nSwapKeys.test.ts`
Expected: FAIL — keys undefined.

- [ ] **Step 3: Add the keys**

In `en.ts`, inside the `ui` object add:
```ts
    'nav.swap': 'Swap',
    'swap.title': 'Swap',
    'swap.form.title': 'Instant swap',
    'swap.form.pair': 'Pair',
    'swap.form.selectPair': 'Select a pair',
    'swap.form.type': 'Direction',
    'swap.form.buy': 'Buy',
    'swap.form.sell': 'Sell',
    'swap.form.compartment': 'Pay from',
    'swap.form.amount': 'Amount (base asset)',
    'swap.form.submit': 'Review & swap',
    'swap.form.paused': 'Quotes paused for this pair due to a market price discrepancy.',
    'swap.form.pausedRetry': 'Retry',
    'swap.form.insufficient': 'Insufficient available balance in the selected compartment.',
    'swap.form.limitExceeded': 'This amount exceeds your remaining daily limit.',
    'swap.form.limitRemaining': 'Remaining daily limit: {{remaining}}',
    'swap.quote.title': 'Quote',
    'swap.quote.indicative': 'Indicative only — the executed price may differ (no quote lock yet).',
    'swap.quote.youPay': 'You pay',
    'swap.quote.youReceive': 'You receive',
    'swap.quote.fee': 'Fee',
    'swap.quote.price': 'Price',
    'swap.quote.loading': 'Fetching quote…',
    'swap.quote.empty': 'Enter an amount to see a quote.',
    'swap.success.title': 'Swap completed.',
    'swap.success.priceUsed': 'Executed price: {{price}}',
    'swap.success.fee': 'Fee charged: {{fee}}',
    'swap.history.title': 'Recent swaps',
    'swap.history.empty': 'No swaps yet.',
    'swap.history.error': 'We could not load your swaps. Please try again.',
    'swap.history.pair': 'Pair',
    'swap.history.type': 'Direction',
    'swap.history.amount': 'Amount',
    'swap.history.date': 'Date',
```
In `en.ts`, inside the `errors` object add:
```ts
    'PRICE_ORACLE_DIVERGENCE': 'Quotes are paused for this pair due to a market price discrepancy. Please retry shortly.',
    'EXCHANGE_INVALID_INPUT': 'Please check the swap details and try again.',
    'EXCHANGE_PAIR_NOT_FOUND': 'That trading pair is unavailable.',
    'EXCHANGE_PAIR_NO_PRICE': 'This pair has no valid price right now. Please try again later.',
    'EXCHANGE_DAILY_LIMIT_EXCEEDED': 'This swap would exceed your daily limit.',
    'EXCHANGE_INSUFFICIENT_BALANCE': 'Insufficient balance to complete this swap.',
    'EXCHANGE_USER_NOT_FOUND': 'Your account could not be verified. Please sign in again.',
```
In `es.ts`, add the SAME keys with Spanish copy:
```ts
    // ui
    'nav.swap': 'Intercambiar',
    'swap.title': 'Intercambiar',
    'swap.form.title': 'Intercambio instantáneo',
    'swap.form.pair': 'Par',
    'swap.form.selectPair': 'Elegí un par',
    'swap.form.type': 'Dirección',
    'swap.form.buy': 'Comprar',
    'swap.form.sell': 'Vender',
    'swap.form.compartment': 'Pagar desde',
    'swap.form.amount': 'Cantidad (activo base)',
    'swap.form.submit': 'Revisar e intercambiar',
    'swap.form.paused': 'Cotizaciones pausadas para este par por una discrepancia de precio de mercado.',
    'swap.form.pausedRetry': 'Reintentar',
    'swap.form.insufficient': 'Saldo disponible insuficiente en el compartimento seleccionado.',
    'swap.form.limitExceeded': 'Este monto excede tu límite diario restante.',
    'swap.form.limitRemaining': 'Límite diario restante: {{remaining}}',
    'swap.quote.title': 'Cotización',
    'swap.quote.indicative': 'Solo indicativa — el precio ejecutado puede diferir (todavía no hay bloqueo de cotización).',
    'swap.quote.youPay': 'Pagás',
    'swap.quote.youReceive': 'Recibís',
    'swap.quote.fee': 'Comisión',
    'swap.quote.price': 'Precio',
    'swap.quote.loading': 'Obteniendo cotización…',
    'swap.quote.empty': 'Ingresá un monto para ver la cotización.',
    'swap.success.title': 'Intercambio completado.',
    'swap.success.priceUsed': 'Precio ejecutado: {{price}}',
    'swap.success.fee': 'Comisión cobrada: {{fee}}',
    'swap.history.title': 'Intercambios recientes',
    'swap.history.empty': 'Todavía no hay intercambios.',
    'swap.history.error': 'No pudimos cargar tus intercambios. Intentá de nuevo.',
    'swap.history.pair': 'Par',
    'swap.history.type': 'Dirección',
    'swap.history.amount': 'Cantidad',
    'swap.history.date': 'Fecha',
    // errors
    'PRICE_ORACLE_DIVERGENCE': 'Las cotizaciones de este par están pausadas por una discrepancia de precio de mercado. Reintentá en unos instantes.',
    'EXCHANGE_INVALID_INPUT': 'Revisá los datos del intercambio e intentá de nuevo.',
    'EXCHANGE_PAIR_NOT_FOUND': 'Ese par no está disponible.',
    'EXCHANGE_PAIR_NO_PRICE': 'Este par no tiene un precio válido ahora. Intentá más tarde.',
    'EXCHANGE_DAILY_LIMIT_EXCEEDED': 'Este intercambio superaría tu límite diario.',
    'EXCHANGE_INSUFFICIENT_BALANCE': 'Saldo insuficiente para completar este intercambio.',
    'EXCHANGE_USER_NOT_FOUND': 'No se pudo verificar tu cuenta. Iniciá sesión de nuevo.',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/swap/i18nSwapKeys.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/i18n/catalogs/en.ts web/src/shared/i18n/catalogs/es.ts web/src/features/swap/i18nSwapKeys.test.ts
git commit -m "feat(web): swap i18n keys (en/es) + parity test (S3)"
```

---

### Task 3: Pairs read (api + query)

**Files:**
- Create: `web/src/features/swap/api.ts` (first slice: `getPairs`)
- Create: `web/src/features/swap/queries.ts` (first slice: `SWAP_PAIRS_KEY`, `usePairs`)
- Test: `web/src/features/swap/api.pairs.test.ts`, `web/src/features/swap/queries.pairs.test.tsx`

**Interfaces:**
- Consumes: `SwapPair`, `SwapPairDTO` from `./types`; `apiClient` from `@/shared/api`.
- Produces: `swapApi.getPairs(): Promise<SwapPair[]>`; `usePairs()` query; `SWAP_PAIRS_KEY`.

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/features/swap/api.pairs.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { swapApi } from './api';

describe('swapApi.getPairs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GETs /parExchange and normalizes symbols + drops null-crypto pairs', async () => {
    (apiClient.get as any).mockResolvedValue([
      { id: 'p1', baseCryptoId: 'b1', quoteCryptoId: 'q1', currentPrice: '65000', feePercent: '0.1',
        active: true, oraclePaused: false,
        baseCrypto: { id: 'b1', symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin' },
        quoteCrypto: { id: 'q1', symbol: 'USDT', name: 'Tether', network: 'ethereum' } },
      { id: 'p2', baseCryptoId: 'b2', quoteCryptoId: 'q2', currentPrice: '0', feePercent: '0.1',
        active: true, oraclePaused: false, baseCrypto: null, quoteCrypto: null },
    ]);
    const pairs = await swapApi.getPairs();
    expect(apiClient.get).toHaveBeenCalledWith('/parExchange');
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ id: 'p1', baseSymbol: 'BTC', quoteSymbol: 'USDT' });
  });
});
```

```tsx
// web/src/features/swap/queries.pairs.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

vi.mock('./api', () => ({ swapApi: { getPairs: vi.fn() } }));
import { swapApi } from './api';
import { usePairs } from './queries';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('usePairs', () => {
  beforeEach(() => vi.clearAllMocks());
  it('returns normalized pairs', async () => {
    (swapApi.getPairs as any).mockResolvedValue([{ id: 'p1', baseSymbol: 'BTC', quoteSymbol: 'USDT' }]);
    const { result } = renderHook(() => usePairs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].baseSymbol).toBe('BTC');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/swap/api.pairs.test.ts src/features/swap/queries.pairs.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// web/src/features/swap/api.ts
import { apiClient } from '@/shared/api';
import type { SwapPair, SwapPairDTO } from './types';

function normalizePair(dto: SwapPairDTO): SwapPair | null {
  if (!dto.baseCrypto || !dto.quoteCrypto) return null; // can't trade a pair we can't label
  return {
    id: dto.id,
    baseCryptoId: dto.baseCryptoId,
    quoteCryptoId: dto.quoteCryptoId,
    currentPrice: dto.currentPrice,
    feePercent: dto.feePercent,
    active: dto.active,
    oraclePaused: dto.oraclePaused,
    baseSymbol: dto.baseCrypto.symbol,
    quoteSymbol: dto.quoteCrypto.symbol,
  };
}

export const swapApi = {
  getPairs: () =>
    apiClient.get<SwapPairDTO[]>('/parExchange').then((rows) =>
      (rows ?? []).map(normalizePair).filter((p): p is SwapPair => p !== null && p.active),
    ),
};
```

```ts
// web/src/features/swap/queries.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { swapApi } from './api';
import type { SwapPair } from './types';

export const SWAP_PAIRS_KEY = ['swap', 'pairs'] as const;

export function usePairs() {
  return useQuery<SwapPair[], ApiError>({
    queryKey: SWAP_PAIRS_KEY,
    queryFn: () => swapApi.getPairs(),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/features/swap/api.pairs.test.ts src/features/swap/queries.pairs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/swap/api.ts web/src/features/swap/queries.ts web/src/features/swap/api.pairs.test.ts web/src/features/swap/queries.pairs.test.tsx
git commit -m "feat(web): swap pairs read (api + usePairs) (S3)"
```

---

### Task 4: Quote / preview (api + hook)

**Files:**
- Modify: `web/src/features/swap/api.ts` (add `getQuote`)
- Modify: `web/src/features/swap/queries.ts` (add `SWAP_QUOTE_KEY`, `useSwapQuote`)
- Test: `web/src/features/swap/api.quote.test.ts`, `web/src/features/swap/queries.quote.test.tsx`

**Interfaces:**
- Consumes: `QuoteRequest`, `QuoteResponse` from `./types`.
- Produces: `swapApi.getQuote(req: QuoteRequest): Promise<QuoteResponse>`; `useSwapQuote(req, enabled)` query; `SWAP_QUOTE_KEY(req)`.

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/features/swap/api.quote.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { swapApi } from './api';

describe('swapApi.getQuote', () => {
  beforeEach(() => vi.clearAllMocks());
  it('POSTs /intercambioExchange/calculate with baseAmount as a STRING', async () => {
    (apiClient.post as any).mockResolvedValue({ par: {}, calculo: {}, advertencias: [] });
    await swapApi.getQuote({ pairId: 'p1', baseAmount: '0.5', type: 'buy' });
    expect(apiClient.post).toHaveBeenCalledWith('/intercambioExchange/calculate', {
      pairId: 'p1', baseAmount: '0.5', type: 'buy',
    });
    const body = (apiClient.post as any).mock.calls[0][1];
    expect(typeof body.baseAmount).toBe('string');
  });
});
```

```tsx
// web/src/features/swap/queries.quote.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ swapApi: { getQuote: vi.fn() } }));
import { swapApi } from './api';
import { useSwapQuote } from './queries';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useSwapQuote', () => {
  beforeEach(() => vi.clearAllMocks());
  it('is disabled when enabled=false (no fetch)', async () => {
    const { result } = renderHook(
      () => useSwapQuote({ pairId: 'p1', baseAmount: '0', type: 'buy' }, false),
      { wrapper },
    );
    expect(result.current.fetchStatus).toBe('idle');
    expect(swapApi.getQuote).not.toHaveBeenCalled();
  });
  it('fetches when enabled', async () => {
    (swapApi.getQuote as any).mockResolvedValue({ par: {}, calculo: { finalAmount: '1' }, advertencias: [] });
    const { result } = renderHook(
      () => useSwapQuote({ pairId: 'p1', baseAmount: '0.5', type: 'buy' }, true),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.calculo.finalAmount).toBe('1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/swap/api.quote.test.ts src/features/swap/queries.quote.test.tsx`
Expected: FAIL — `getQuote`/`useSwapQuote` undefined.

- [ ] **Step 3: Write minimal implementation**

Append to `api.ts`:
```ts
import type { QuoteRequest, QuoteResponse } from './types';

// ...inside the swapApi object (add property):
  getQuote: (req: QuoteRequest) =>
    apiClient.post<QuoteResponse>('/intercambioExchange/calculate', {
      pairId: req.pairId,
      baseAmount: req.baseAmount, // STRING — backend parseFloats; never Number() here
      type: req.type,
    }),
```
(Keep a single `swapApi` object; add `getQuote` as a property alongside `getPairs`, and import the types at the top with the existing import.)

Append to `queries.ts`:
```ts
import type { QuoteRequest, QuoteResponse } from './types';

export const SWAP_QUOTE_KEY = (req: QuoteRequest) =>
  ['swap', 'quote', req.pairId, req.type, req.baseAmount] as const;

export function useSwapQuote(req: QuoteRequest, enabled: boolean) {
  return useQuery<QuoteResponse, ApiError>({
    queryKey: SWAP_QUOTE_KEY(req),
    queryFn: () => swapApi.getQuote(req),
    enabled,
    retry: false, // a 503 PRICE_ORACLE_DIVERGENCE / 4xx must surface immediately
    staleTime: 10_000,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/features/swap/api.quote.test.ts src/features/swap/queries.quote.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/swap/api.ts web/src/features/swap/queries.ts web/src/features/swap/api.quote.test.ts web/src/features/swap/queries.quote.test.tsx
git commit -m "feat(web): swap quote/preview (api + useSwapQuote) (S3)"
```

---

### Task 5: Check-limit advisory (api + hook) — the single `Number()` boundary

**Files:**
- Modify: `web/src/features/swap/api.ts` (add `checkLimit`)
- Modify: `web/src/features/swap/queries.ts` (add `useCheckLimit`)
- Test: `web/src/features/swap/api.checkLimit.test.ts`

**Interfaces:**
- Consumes: `CheckLimitResponse` from `./types`.
- Produces: `swapApi.checkLimit(quoteAmount: string): Promise<CheckLimitResponse>` (accepts the canonical string, converts at the boundary); `useCheckLimit(quoteAmount, enabled)` query.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/features/swap/api.checkLimit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { swapApi } from './api';

describe('swapApi.checkLimit', () => {
  beforeEach(() => vi.clearAllMocks());
  it('POSTs /check-limit with quoteAmount as a NUMBER (advisory boundary)', async () => {
    (apiClient.post as any).mockResolvedValue({ canTransact: true, remainingLimit: 900, limit: 1000, dailyVolume: 100, requestedAmount: 50 });
    await swapApi.checkLimit('50.5');
    const [url, body] = (apiClient.post as any).mock.calls[0];
    expect(url).toBe('/intercambioExchange/check-limit');
    expect(body).toEqual({ quoteAmount: 50.5 });
    expect(typeof body.quoteAmount).toBe('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/swap/api.checkLimit.test.ts`
Expected: FAIL — `checkLimit` undefined.

- [ ] **Step 3: Write minimal implementation**

Append to `api.ts` (inside `swapApi`):
```ts
import type { CheckLimitResponse } from './types';

// Advisory ONLY. The check-limit endpoint rejects anything whose typeof !== 'number',
// so we convert the canonical amount to a Number at THIS wire boundary — the one
// sanctioned exception to the money-string rule (see plan Global Constraints). The
// authoritative daily-limit enforcement is server-side at execution
// (EXCHANGE_DAILY_LIMIT_EXCEEDED); this result must never be the sole submit gate.
  checkLimit: (quoteAmount: string) =>
    apiClient.post<CheckLimitResponse>('/intercambioExchange/check-limit', {
      quoteAmount: Number(quoteAmount),
    }),
```

Append to `queries.ts`:
```ts
import type { CheckLimitResponse } from './types';

export function useCheckLimit(quoteAmount: string, enabled: boolean) {
  return useQuery<CheckLimitResponse, ApiError>({
    queryKey: ['swap', 'check-limit', quoteAmount] as const,
    queryFn: () => swapApi.checkLimit(quoteAmount),
    enabled,
    retry: false,
    staleTime: 10_000,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/swap/api.checkLimit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/swap/api.ts web/src/features/swap/queries.ts web/src/features/swap/api.checkLimit.test.ts
git commit -m "feat(web): swap daily-limit advisory (check-limit) (S3)"
```

---

### Task 6: Execute swap (api + mutation) — MONEY-PATH

**Files:**
- Modify: `web/src/features/swap/api.ts` (add `executeSwap`)
- Modify: `web/src/features/swap/queries.ts` (add `useExecuteSwap`)
- Test: `web/src/features/swap/api.execute.test.ts`, `web/src/features/swap/queries.execute.test.tsx`

**Interfaces:**
- Consumes: `ExecuteSwapRequest`, `ExecuteSwapResponse` from `./types`.
- Produces: `swapApi.executeSwap(req): Promise<ExecuteSwapResponse>`; `useExecuteSwap()` mutation that invalidates balances + swap history + daily-volume.

- [ ] **Step 1: Write the failing tests**

```ts
// web/src/features/swap/api.execute.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/shared/api', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));
import { apiClient } from '@/shared/api';
import { swapApi } from './api';

describe('swapApi.executeSwap', () => {
  beforeEach(() => vi.clearAllMocks());
  it('POSTs /intercambioExchange with baseAmount STRING + compartimento', async () => {
    (apiClient.post as any).mockResolvedValue({ message: 'ok', data: { precioUsado: '65000' } });
    await swapApi.executeSwap({ pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'spot' });
    expect(apiClient.post).toHaveBeenCalledWith('/intercambioExchange', {
      pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'spot',
    });
    expect(typeof (apiClient.post as any).mock.calls[0][1].baseAmount).toBe('string');
  });
});
```

```tsx
// web/src/features/swap/queries.execute.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
vi.mock('./api', () => ({ swapApi: { executeSwap: vi.fn() } }));
import { swapApi } from './api';
import { useExecuteSwap } from './queries';

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, spy };
}

describe('useExecuteSwap', () => {
  beforeEach(() => vi.clearAllMocks());
  it('invalidates balances + swap history on success', async () => {
    (swapApi.executeSwap as any).mockResolvedValue({ message: 'ok', data: { precioUsado: '1' } });
    const { wrapper, spy } = makeWrapper();
    const { result } = renderHook(() => useExecuteSwap(), { wrapper });
    await result.current.mutateAsync({ pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'funding' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidated = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(invalidated.some((k) => k?.includes('balances'))).toBe(true);
    expect(invalidated.some((k) => k?.includes('my-swaps'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/swap/api.execute.test.ts src/features/swap/queries.execute.test.tsx`
Expected: FAIL — `executeSwap`/`useExecuteSwap` undefined.

- [ ] **Step 3: Write minimal implementation**

Append to `api.ts` (inside `swapApi`):
```ts
import type { ExecuteSwapRequest, ExecuteSwapResponse } from './types';

// Money POST. The shared client auto-attaches an Idempotency-Key for this path
// (isMoneyEndpoint matches /intercambioExchange). baseAmount stays a STRING.
  executeSwap: (req: ExecuteSwapRequest) =>
    apiClient.post<ExecuteSwapResponse>('/intercambioExchange', {
      pairId: req.pairId,
      type: req.type,
      baseAmount: req.baseAmount,
      compartimento: req.compartimento,
    }),
```

Append to `queries.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ExecuteSwapRequest, ExecuteSwapResponse } from './types';
import { WALLET_BALANCES_KEY } from '@/features/wallet/queries';

export const SWAP_MY_SWAPS_KEY = ['swap', 'my-swaps'] as const;
export const SWAP_DAILY_VOLUME_KEY = ['swap', 'daily-volume'] as const;

export function useExecuteSwap() {
  const qc = useQueryClient();
  // Mutations do not retry by default — combined with disabled-while-pending this
  // is the S3 double-submit guard (per-intent idempotency key is a deferred go-live item).
  return useMutation<ExecuteSwapResponse, ApiError, ExecuteSwapRequest>({
    mutationFn: swapApi.executeSwap,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WALLET_BALANCES_KEY });
      qc.invalidateQueries({ queryKey: SWAP_MY_SWAPS_KEY });
      qc.invalidateQueries({ queryKey: SWAP_DAILY_VOLUME_KEY });
    },
  });
}
```
(If `@/features/wallet/queries` export of `WALLET_BALANCES_KEY` is not reachable from here, import the literal tuple — verify the export exists; it does in `web/src/features/wallet/queries.ts`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/features/swap/api.execute.test.ts src/features/swap/queries.execute.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/swap/api.ts web/src/features/swap/queries.ts web/src/features/swap/api.execute.test.ts web/src/features/swap/queries.execute.test.tsx
git commit -m "feat(web): swap execute (api + useExecuteSwap) (S3)"
```

---

### Task 7: My-swaps read + SwapHistory component

**Files:**
- Modify: `web/src/features/swap/api.ts` (add `getMySwaps`)
- Modify: `web/src/features/swap/queries.ts` (add `useMySwaps`)
- Create: `web/src/features/swap/components/SwapHistory.tsx`
- Create: `web/src/features/swap/components/swap.module.css`
- Test: `web/src/features/swap/components/SwapHistory.test.tsx`

**Interfaces:**
- Consumes: `MySwap` from `./types`; `usePairs` (to label pairs); `useTranslation`, `useErrorTranslation`.
- Produces: `swapApi.getMySwaps(): Promise<MySwap[]>`; `useMySwaps()`; default-exported `SwapHistory`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/swap/components/SwapHistory.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../queries', () => ({
  useMySwaps: vi.fn(),
  usePairs: vi.fn(() => ({ data: [] })),
}));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));

import { useMySwaps } from '../queries';
import SwapHistory from './SwapHistory';

describe('SwapHistory', () => {
  beforeEach(() => vi.clearAllMocks());
  it('shows empty state', () => {
    (useMySwaps as any).mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<SwapHistory />);
    expect(screen.getByText('swap.history.empty')).toBeInTheDocument();
  });
  it('renders a swap row', () => {
    (useMySwaps as any).mockReturnValue({
      data: [{ id: 's1', pairId: 'p1', type: 'buy', baseAmount: '0.5', quoteAmount: '32500', price: '65000', feeAmount: '32.5', status: 'completed' }],
      isLoading: false, isError: false,
    });
    render(<SwapHistory />);
    expect(screen.getByText('swap.form.buy')).toBeInTheDocument();
  });
  it('shows error state', () => {
    (useMySwaps as any).mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<SwapHistory />);
    expect(screen.getByText('swap.history.error')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/swap/components/SwapHistory.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Append to `api.ts` (inside `swapApi`):
```ts
import type { MySwap } from './types';

  getMySwaps: () =>
    apiClient.get<MySwap[] | { rows: MySwap[] }>('/intercambioExchange/me?limit=25').then((r) =>
      Array.isArray(r) ? r : (r?.rows ?? []),
    ),
```

Append to `queries.ts`:
```ts
import type { MySwap } from './types';

export function useMySwaps() {
  return useQuery<MySwap[], ApiError>({
    queryKey: SWAP_MY_SWAPS_KEY,
    queryFn: () => swapApi.getMySwaps(),
    staleTime: 15_000,
  });
}
```

Create `swap.module.css` (mirror `wallet.module.css` — minimal, reuse the same class names it exposes):
```css
.form { display: flex; flex-direction: column; gap: var(--space-3, 0.75rem); max-width: 28rem; }
.row { display: flex; justify-content: space-between; gap: var(--space-2, 0.5rem); }
.label { color: var(--color-text-muted, #666); font-size: 0.875rem; }
.actions { margin-top: var(--space-3, 0.75rem); }
.quote { border: 1px solid var(--color-border, #ddd); border-radius: 8px; padding: var(--space-3, 0.75rem); }
.paused { color: var(--color-danger, #b00); }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--color-border, #eee); }
```

Create `SwapHistory.tsx`:
```tsx
'use client';

import { useMemo } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { useMySwaps, usePairs } from '../queries';
import type { MySwap } from '../types';
import styles from './swap.module.css';

export default function SwapHistory() {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { data: swaps, isLoading, isError } = useMySwaps();
  const { data: pairs } = usePairs();

  const label = useMemo(() => {
    const map = new Map((pairs ?? []).map((p) => [p.id, `${p.baseSymbol}/${p.quoteSymbol}`]));
    return (pairId: string) => map.get(pairId) ?? pairId;
  }, [pairs]);

  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;
  if (isError) return <p role="alert" className={styles.label}>{t('swap.history.error')}</p>;

  const rows: MySwap[] = swaps ?? [];
  return (
    <section>
      <h2>{t('swap.history.title')}</h2>
      {rows.length === 0 ? (
        <p className={styles.label}>{t('swap.history.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('swap.history.pair')}</th>
              <th>{t('swap.history.type')}</th>
              <th>{t('swap.history.amount')}</th>
              <th>{t('swap.history.date')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{label(s.pairId)}</td>
                <td>{t(s.type === 'buy' ? 'swap.form.buy' : 'swap.form.sell')}</td>
                <td>{formatDisplay(s.baseAmount, { locale, maxDecimals: 8, stripTrailingZeros: true })}</td>
                <td>{s.completedAt ?? s.createdAt ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
```
(`tError` is imported for parity with sibling components and may be unused here; if the linter/build flags an unused binding, remove the `useErrorTranslation` import and call. Prefer removing it if unused — keep the build clean.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/swap/components/SwapHistory.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/swap/api.ts web/src/features/swap/queries.ts web/src/features/swap/components/SwapHistory.tsx web/src/features/swap/components/swap.module.css web/src/features/swap/components/SwapHistory.test.tsx
git commit -m "feat(web): swap history read + SwapHistory view (S3)"
```

---

### Task 8: PairSelect component

**Files:**
- Create: `web/src/features/swap/components/PairSelect.tsx`
- Test: `web/src/features/swap/components/PairSelect.test.tsx`

**Interfaces:**
- Consumes: `usePairs`; `SwapPair` from `./types`; `Field` from `@/shared/ui`; `useTranslation`.
- Produces: `PairSelect` (named export): `{ value: string; onChange: (id: string) => void }`. Renders a `<select id="swap-pair">` of active pairs; a paused pair's option is labeled but still selectable (the form handles the paused state).

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/swap/components/PairSelect.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('../queries', () => ({ usePairs: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { usePairs } from '../queries';
import { PairSelect } from './PairSelect';

describe('PairSelect', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lists pairs and calls onChange with the pair id', async () => {
    (usePairs as any).mockReturnValue({
      data: [
        { id: 'p1', baseSymbol: 'BTC', quoteSymbol: 'USDT', oraclePaused: false },
        { id: 'p2', baseSymbol: 'ETH', quoteSymbol: 'USDT', oraclePaused: true },
      ],
      isLoading: false,
    });
    const onChange = vi.fn();
    render(<PairSelect value="" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'p1');
    expect(onChange).toHaveBeenCalledWith('p1');
    // the paused pair is present as an option
    expect(screen.getByRole('option', { name: /ETH\/USDT/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/swap/components/PairSelect.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/features/swap/components/PairSelect.tsx
'use client';

import { Field } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import { usePairs } from '../queries';

export function PairSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const { data: pairs, isLoading } = usePairs();

  return (
    <Field label={t('swap.form.pair')}>
      <select
        id="swap-pair"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      >
        <option value="">{t('swap.form.selectPair')}</option>
        {(pairs ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.baseSymbol}/{p.quoteSymbol}{p.oraclePaused ? ' ⏸' : ''}
          </option>
        ))}
      </select>
    </Field>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/swap/components/PairSelect.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/swap/components/PairSelect.tsx web/src/features/swap/components/PairSelect.test.tsx
git commit -m "feat(web): swap PairSelect component (S3)"
```

---

### Task 9: QuoteDisplay component (indicative disclosure + oracle-paused)

**Files:**
- Create: `web/src/features/swap/components/QuoteDisplay.tsx`
- Test: `web/src/features/swap/components/QuoteDisplay.test.tsx`

**Interfaces:**
- Consumes: `QuoteResponse` from `./types`; `ApiError` from `@/shared/api`; `formatDisplay` from `@/shared/money`; `useTranslation`, `useErrorTranslation`.
- Produces: `QuoteDisplay` (named export) with props:
  ```ts
  { quote?: QuoteResponse; error?: ApiError | null; isFetching: boolean; type: 'buy'|'sell';
    baseAmount: string; baseSymbol: string; quoteSymbol: string; onRetry: () => void; }
  ```
  `baseAmount` is the **canonical entered amount** (the form's `parseInput` result) — the money-safe source of truth for the base display. **Never** format `quote.calculo.baseAmount` (the backend echo, possibly a JS number — `String(1e-8)` would break `formatDisplay`).
  Renders: loading text; a `PRICE_ORACLE_DIVERGENCE` paused panel with a retry button (when `error?.code === 'PRICE_ORACLE_DIVERGENCE'`); otherwise the indicative quote (youPay/youReceive + fee + price + the `swap.quote.indicative` disclosure). `youPay`/`youReceive` are derived: for **buy**, youPay = `quote.calculo.finalAmount` (quote), youReceive = `baseAmount` prop (base); for **sell**, youPay = `baseAmount` prop (base), youReceive = `quote.calculo.finalAmount` (quote).

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/swap/components/QuoteDisplay.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));
import { QuoteDisplay } from './QuoteDisplay';
import type { QuoteResponse } from '../types';

const quote: QuoteResponse = {
  par: { id: 'p1', base: 'BTC', quote: 'USDT', price: '65000' },
  calculo: { baseAmount: '0.5', quoteAmount: '32500', feePercent: '0.1', feeAmount: '32.5',
    impactoSlippage: 0, finalAmount: '32532.5', direccion: 'buy', precioEfectivo: '65000' },
  advertencias: [],
};

describe('QuoteDisplay', () => {
  it('shows the indicative disclosure and amounts for a buy', () => {
    render(<QuoteDisplay quote={quote} error={null} isFetching={false} type="buy" baseAmount="0.5" baseSymbol="BTC" quoteSymbol="USDT" onRetry={() => {}} />);
    expect(screen.getByText('swap.quote.indicative')).toBeInTheDocument();
    expect(screen.getByText('swap.quote.fee')).toBeInTheDocument();
  });
  it('shows the paused panel + retry on PRICE_ORACLE_DIVERGENCE', async () => {
    const onRetry = vi.fn();
    render(<QuoteDisplay quote={undefined} error={{ code: 'PRICE_ORACLE_DIVERGENCE', status: 503 } as any} isFetching={false} type="buy" baseAmount="0.5" baseSymbol="BTC" quoteSymbol="USDT" onRetry={onRetry} />);
    expect(screen.getByText('PRICE_ORACLE_DIVERGENCE')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'swap.form.pausedRetry' }));
    expect(onRetry).toHaveBeenCalled();
  });
  it('shows loading while fetching', () => {
    render(<QuoteDisplay quote={undefined} error={null} isFetching={true} type="buy" baseAmount="0.5" baseSymbol="BTC" quoteSymbol="USDT" onRetry={() => {}} />);
    expect(screen.getByText('swap.quote.loading')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/swap/components/QuoteDisplay.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/features/swap/components/QuoteDisplay.tsx
'use client';

import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button } from '@/shared/ui';
import type { ApiError } from '@/shared/api';
import type { QuoteResponse, SwapType } from '../types';
import styles from './swap.module.css';

interface Props {
  quote?: QuoteResponse;
  error?: ApiError | null;
  isFetching: boolean;
  type: SwapType;
  baseAmount: string; // canonical entered amount (money-safe source of truth for base display)
  baseSymbol: string;
  quoteSymbol: string;
  onRetry: () => void;
}

export function QuoteDisplay({ quote, error, isFetching, type, baseAmount, baseSymbol, quoteSymbol, onRetry }: Props) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();

  const fmt = (v: string) => formatDisplay(v, { locale, maxDecimals: 8, stripTrailingZeros: true });

  if (error?.code === 'PRICE_ORACLE_DIVERGENCE') {
    return (
      <div className={`${styles.quote} ${styles.paused}`} role="alert">
        <p>{tError('PRICE_ORACLE_DIVERGENCE')}</p>
        <Button type="button" variant="secondary" onClick={onRetry}>{t('swap.form.pausedRetry')}</Button>
      </div>
    );
  }
  if (isFetching) return <p className={styles.label}>{t('swap.quote.loading')}</p>;
  if (error) return <p role="alert" className={styles.label}>{tError(error.code, { requestId: error.requestId ?? '' })}</p>;
  if (!quote) return <p className={styles.label}>{t('swap.quote.empty')}</p>;

  const c = quote.calculo;
  // Use the canonical entered amount for the base display — NEVER String(c.baseAmount)
  // (backend echo may be a JS number; String(1e-8) would break formatDisplay).
  const base = baseAmount;
  // buy: pay finalAmount (quote), receive base; sell: pay base, receive finalAmount (quote)
  const youPay = type === 'buy' ? `${fmt(c.finalAmount)} ${quoteSymbol}` : `${fmt(base)} ${baseSymbol}`;
  const youReceive = type === 'buy' ? `${fmt(base)} ${baseSymbol}` : `${fmt(c.finalAmount)} ${quoteSymbol}`;

  return (
    <div className={styles.quote}>
      <h2>{t('swap.quote.title')}</h2>
      <div className={styles.row}><span>{t('swap.quote.youPay')}</span><strong>{youPay}</strong></div>
      <div className={styles.row}><span>{t('swap.quote.youReceive')}</span><strong>{youReceive}</strong></div>
      <div className={styles.row}><span>{t('swap.quote.fee')}</span><span>{fmt(c.feeAmount)} {quoteSymbol}</span></div>
      <div className={styles.row}><span>{t('swap.quote.price')}</span><span>{fmt(c.precioEfectivo)} {quoteSymbol}</span></div>
      <p className={styles.label}>{t('swap.quote.indicative')}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/swap/components/QuoteDisplay.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/swap/components/QuoteDisplay.tsx web/src/features/swap/components/QuoteDisplay.test.tsx
git commit -m "feat(web): swap QuoteDisplay (indicative + oracle-paused) (S3)"
```

---

### Task 10: SwapForm orchestrator — MONEY-PATH (reviewed carefully by the coordinator)

**Files:**
- Create: `web/src/features/swap/components/SwapForm.tsx`
- Test: `web/src/features/swap/components/SwapForm.test.tsx`

**Interfaces:**
- Consumes: `PairSelect`, `QuoteDisplay`, `usePairs`, `useSwapQuote`, `useCheckLimit`, `useExecuteSwap`, `useMyBalances` (from `@/features/wallet/queries`), `parseInput`/`compare` (from `@/shared/money`), `useTranslation`, `useErrorTranslation`, `Button`, `Field`.
- Produces: default-exported `SwapForm`. State: `pairId`, `type` (`buy`|`sell`), `compartment` (`funding`|`spot`), `amount` (raw string). Derives: `parsed = parseInput(amount, { locale })`; `amountOk = parsed.ok && compare(parsed.value, '0') > 0`; the selected `SwapPair`; the quote (via `useSwapQuote({pairId, baseAmount: parsed.value, type}, enabled = amountOk && !!pairId && !selectedPair.oraclePaused)`); the sufficiency gate and limit advisory per the contract section.

**Money-path requirements (the reviewer verifies all of these):**
1. `baseAmount` sent to quote and execute is `parsed.value` (canonical string) — never a Number.
2. Sufficiency gate (exact): **buy** → quote-asset `compartments[compartment].available >= quote.calculo.finalAmount`; **sell** → base-asset `compartments[compartment].available >= parsed.value`. If the relevant balance entry hasn't loaded, block submit (no pass-on-unknown — WithdrawForm lesson).
3. `canSubmit` is false while `oraclePaused`, while the quote is loading/errored, while `execute.isPending`, and while the sufficiency gate fails.
4. On `PRICE_ORACLE_DIVERGENCE` (503 from quote OR execute), show the paused state (via `QuoteDisplay`) and disable the submit button; the retry re-runs the quote.
5. Submit button is disabled while pending (no double submit); mutation does not retry.
6. Daily-limit advisory: when `amountOk` and a quote exists, the form may surface `swap.form.limitExceeded` if `useCheckLimit` errors with `EXCHANGE_DAILY_LIMIT_EXCEEDED`; this is advisory and must NOT be the sole gate (execute remains authoritative).
7. Success: show `swap.success.title` + executed price (`data.precioUsado`) + fee (`data.comisionCalculada`), and reset the amount.

- [ ] **Step 1: Write the failing tests** (behavioral, money-path)

```tsx
// web/src/features/swap/components/SwapForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mutateAsync = vi.fn();
vi.mock('../queries', () => ({
  usePairs: vi.fn(),
  useSwapQuote: vi.fn(),
  useCheckLimit: vi.fn(() => ({ data: undefined, isError: false, error: null })),
  useExecuteSwap: vi.fn(() => ({ mutateAsync, isPending: false, isError: false, isSuccess: false, error: null, data: undefined })),
}));
vi.mock('@/features/wallet/queries', () => ({ useMyBalances: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));

import { usePairs, useSwapQuote, useExecuteSwap } from '../queries';
import { useMyBalances } from '@/features/wallet/queries';
import SwapForm from './SwapForm';

const PAIR = { id: 'p1', baseCryptoId: 'b1', quoteCryptoId: 'q1', currentPrice: '65000', feePercent: '0.1', active: true, oraclePaused: false, baseSymbol: 'BTC', quoteSymbol: 'USDT' };
const QUOTE = { par: { id: 'p1', base: 'BTC', quote: 'USDT', price: '65000' }, calculo: { baseAmount: '0.5', quoteAmount: '32500', feePercent: '0.1', feeAmount: '32.5', impactoSlippage: 0, finalAmount: '32532.5', direccion: 'buy', precioEfectivo: '65000' }, advertencias: [] };

function balances(available: string, which: 'q1' | 'b1') {
  return [{ criptomonedaId: which, compartments: { funding: { available, blocked: '0', pending: '0' }, spot: { available: '0', blocked: '0' } }, crypto: { id: which, symbol: which === 'q1' ? 'USDT' : 'BTC' } }];
}

beforeEach(() => {
  vi.clearAllMocks();
  (usePairs as any).mockReturnValue({ data: [PAIR], isLoading: false });
  (useSwapQuote as any).mockReturnValue({ data: QUOTE, error: null, isFetching: false });
});

describe('SwapForm (money-path)', () => {
  it('blocks submit when the quote-asset Funding balance is insufficient for a buy', async () => {
    (useMyBalances as any).mockReturnValue({ data: balances('100', 'q1') }); // need 32532.5
    render(<SwapForm />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /swap.form.pair/i }).closest('select') ?? screen.getAllByRole('combobox')[0], 'p1');
    await userEvent.type(screen.getByLabelText('swap.form.amount'), '0.5');
    expect(screen.getByRole('button', { name: 'swap.form.submit' })).toBeDisabled();
    expect(screen.getByText('swap.form.insufficient')).toBeInTheDocument();
  });

  it('enables submit and executes when the quote-asset balance covers finalAmount', async () => {
    (useMyBalances as any).mockReturnValue({ data: balances('50000', 'q1') });
    mutateAsync.mockResolvedValue({ message: 'ok', data: { precioUsado: '65000', comisionCalculada: '32.5' } });
    render(<SwapForm />);
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'p1');
    await userEvent.type(screen.getByLabelText('swap.form.amount'), '0.5');
    const btn = screen.getByRole('button', { name: 'swap.form.submit' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(mutateAsync).toHaveBeenCalledWith({ pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'funding' });
  });

  it('disables submit while the pair is oracle-paused', async () => {
    (usePairs as any).mockReturnValue({ data: [{ ...PAIR, oraclePaused: true }], isLoading: false });
    (useSwapQuote as any).mockReturnValue({ data: undefined, error: null, isFetching: false });
    (useMyBalances as any).mockReturnValue({ data: balances('50000', 'q1') });
    render(<SwapForm />);
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'p1');
    await userEvent.type(screen.getByLabelText('swap.form.amount'), '0.5');
    expect(screen.getByRole('button', { name: 'swap.form.submit' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/swap/components/SwapForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// web/src/features/swap/components/SwapForm.tsx
'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useMyBalances } from '@/features/wallet/queries';
import { PairSelect } from './PairSelect';
import { QuoteDisplay } from './QuoteDisplay';
import { usePairs, useSwapQuote, useCheckLimit, useExecuteSwap } from '../queries';
import type { SwapType, SwapCompartment } from '../types';
import styles from './swap.module.css';

export default function SwapForm() {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { data: pairs } = usePairs();
  const { data: balances } = useMyBalances();
  const execute = useExecuteSwap();

  const [pairId, setPairId] = useState('');
  const [type, setType] = useState<SwapType>('buy');
  const [compartment, setCompartment] = useState<SwapCompartment>('funding');
  const [amount, setAmount] = useState('');

  const pair = useMemo(() => (pairs ?? []).find((p) => p.id === pairId), [pairs, pairId]);
  const parsed = useMemo(() => parseInput(amount, { locale }), [amount, locale]);
  const amountOk = parsed.ok && compare(parsed.value, '0') > 0;

  const quoteEnabled = Boolean(pairId) && amountOk && !!pair && !pair.oraclePaused;
  const quoteReq = { pairId, baseAmount: parsed.ok ? parsed.value : '0', type };
  const quote = useSwapQuote(quoteReq, quoteEnabled);

  // Exact sufficiency gate. buy → spend quote (finalAmount); sell → spend base (entered amount).
  const needAsset = pair ? (type === 'buy' ? pair.quoteCryptoId : pair.baseCryptoId) : null;
  const availableInCompartment = useMemo(() => {
    if (!needAsset) return null;
    const entry = (balances ?? []).find((b) => b.criptomonedaId === needAsset);
    if (!entry) return null;
    return entry.compartments[compartment]?.available ?? null;
  }, [balances, needAsset, compartment]);

  const requiredSpend =
    type === 'buy' ? quote.data?.calculo.finalAmount ?? null : parsed.ok ? parsed.value : null;

  const insufficient =
    availableInCompartment != null && requiredSpend != null && compare(requiredSpend, availableInCompartment) > 0;

  // Advisory daily-limit check on the quote's quoteAmount (quote asset ≈ USD magnitude the backend limits).
  const checkLimit = useCheckLimit(quote.data?.calculo.quoteAmount ?? '0', Boolean(quote.data));
  const limitExceeded = checkLimit.isError && checkLimit.error?.code === 'EXCHANGE_DAILY_LIMIT_EXCEEDED';

  const canSubmit =
    Boolean(pairId) &&
    amountOk &&
    !!pair &&
    !pair.oraclePaused &&
    !!quote.data &&
    quote.error == null &&
    availableInCompartment != null &&
    !insufficient &&
    !execute.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsed.ok) return;
    try {
      await execute.mutateAsync({ pairId, type, baseAmount: parsed.value, compartimento: compartment });
      setAmount('');
    } catch {
      // surfaced via execute.error below
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2>{t('swap.form.title')}</h2>

      <PairSelect value={pairId} onChange={setPairId} />

      <Field label={t('swap.form.type')}>
        <select id="swap-type" value={type} onChange={(e) => setType(e.target.value as SwapType)}>
          <option value="buy">{t('swap.form.buy')}</option>
          <option value="sell">{t('swap.form.sell')}</option>
        </select>
      </Field>

      <Field label={t('swap.form.compartment')}>
        <select id="swap-compartment" value={compartment} onChange={(e) => setCompartment(e.target.value as SwapCompartment)}>
          <option value="funding">{t('wallet.balances.funding')}</option>
          <option value="spot">{t('wallet.balances.spot')}</option>
        </select>
      </Field>

      <Field label={t('swap.form.amount')}>
        <input id="swap-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
      </Field>

      {pair && (
        <QuoteDisplay
          quote={quote.data}
          error={quote.error}
          isFetching={quote.isFetching}
          type={type}
          baseAmount={parsed.ok ? parsed.value : '0'}
          baseSymbol={pair.baseSymbol}
          quoteSymbol={pair.quoteSymbol}
          onRetry={() => quote.refetch()}
        />
      )}

      {insufficient && <p role="alert" className={styles.label}>{t('swap.form.insufficient')}</p>}
      {limitExceeded && <p role="alert" className={styles.label}>{t('swap.form.limitExceeded')}</p>}
      {execute.isError && execute.error && (
        <p role="alert" className={styles.label}>
          {tError(execute.error.code, { requestId: execute.error.requestId ?? '' })}
        </p>
      )}
      {execute.isSuccess && execute.data && (
        <div role="status" className={styles.label}>
          <p>{t('swap.success.title')}</p>
          <p>{t('swap.success.priceUsed', { price: execute.data.data.precioUsado })}</p>
          <p>{t('swap.success.fee', { fee: execute.data.data.comisionCalculada })}</p>
        </div>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={!canSubmit} loading={execute.isPending}>
          {t('swap.form.submit')}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run src/features/swap/components/SwapForm.test.tsx`
Expected: PASS. (If the `selectOptions` label query is brittle, select by `screen.getAllByRole('combobox')[0]` for the pair select as shown in tests 2/3.)

- [ ] **Step 5: Commit**

```bash
git add web/src/features/swap/components/SwapForm.tsx web/src/features/swap/components/SwapForm.test.tsx
git commit -m "feat(web): swap SwapForm orchestrator with sufficiency + paused gates (S3)"
```

---

### Task 11: Wire the page + nav + barrel + contract doc + full gate

**Files:**
- Create: `web/src/features/swap/components/SwapWidget.tsx`
- Create: `web/src/features/swap/index.ts`
- Create: `web/app/(app)/swap/page.tsx`
- Modify: `web/app/(app)/layout.tsx` (add the `/swap` nav link)
- Modify: `docs/frontend-rebuild/backend-contract-changes.md` (add the "web consumes swap" section)
- Test: `web/src/features/swap/components/SwapWidget.test.tsx`

**Interfaces:**
- Consumes: `SwapForm`, `SwapHistory`.
- Produces: `SwapWidget` (default + named from `index.ts`); the route page.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/swap/components/SwapWidget.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('./SwapForm', () => ({ default: () => <div>form-stub</div> }));
vi.mock('./SwapHistory', () => ({ default: () => <div>history-stub</div> }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import SwapWidget from './SwapWidget';

describe('SwapWidget', () => {
  it('renders the heading, form and history', () => {
    render(<SwapWidget />);
    expect(screen.getByRole('heading', { name: 'swap.title' })).toBeInTheDocument();
    expect(screen.getByText('form-stub')).toBeInTheDocument();
    expect(screen.getByText('history-stub')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/swap/components/SwapWidget.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/features/swap/components/SwapWidget.tsx
'use client';

import { useTranslation } from '@/shared/i18n';
import SwapForm from './SwapForm';
import SwapHistory from './SwapHistory';

export default function SwapWidget() {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t('swap.title')}</h1>
      <SwapForm />
      <SwapHistory />
    </section>
  );
}
```

```ts
// web/src/features/swap/index.ts
export { default as SwapWidget } from './components/SwapWidget';
```

```tsx
// web/app/(app)/swap/page.tsx
import { SwapWidget } from '@/features/swap';

export default function SwapPage() {
  return <SwapWidget />;
}
```

In `web/app/(app)/layout.tsx`, add inside `<nav>` after the wallet link:
```tsx
        <Link href="/swap">{t('nav.swap')}</Link>
```

In `docs/frontend-rebuild/backend-contract-changes.md`, append a new section (mirror the style of §17/§18):
```markdown
### 19. Next.js `web/` app — swap endpoints consumed (Slice 3, 2026-10-10)

The rebuilt frontend (`web/`) consumes the swap vertical:
- `GET /parExchange` — list active swap pairs (normalized to `{ id, baseSymbol, quoteSymbol, currentPrice, feePercent, oraclePaused }`; pairs with a missing base/quote crypto are dropped).
- `POST /intercambioExchange/calculate` — indicative quote. `baseAmount` is sent as a canonical decimal STRING (backend parseFloats). The UI labels the quote as indicative (no quote-lock, contract §5) and shows youPay/youReceive/fee/price.
- `POST /intercambioExchange/check-limit` — advisory daily-limit feedback only. `quoteAmount` is sent as a Number at this wire boundary (the endpoint rejects non-numbers); the authoritative limit is enforced at execution.
- `POST /intercambioExchange` — execute (money POST, Idempotency-Key auto-attached). Body `{ pairId, type, baseAmount: string, compartimento }`. Success shows the executed price (`data.precioUsado`) and fee (`data.comisionCalculada`).
- `GET /intercambioExchange/me` — recent swaps list.
- **503 `PRICE_ORACLE_DIVERGENCE`** on quote or execute renders a dedicated paused panel with a retry, not a generic error.
```

- [ ] **Step 4: Run the test + the FULL slice gate**

```bash
cd web && npx vitest run src/features/swap/components/SwapWidget.test.tsx
cd web && npx tsc --noEmit
cd web && npx vitest run
cd web && npm run build
```
Expected: SwapWidget test PASS; `tsc` exit 0; full Vitest green (all prior + swap suites); `next build` succeeds and lists `/swap` among the routes.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/swap/components/SwapWidget.tsx web/src/features/swap/components/SwapWidget.test.tsx web/src/features/swap/index.ts "web/app/(app)/swap/page.tsx" "web/app/(app)/layout.tsx" docs/frontend-rebuild/backend-contract-changes.md
git commit -m "feat(web): mount swap route + nav + contract doc (S3)"
```

---

## Self-Review

**1. Spec coverage (design spec S3 exit criteria):**
- *Indicative-quote disclosure* → Task 9 (`swap.quote.indicative` + executed-price confirmation in Task 10). ✓
- *Daily-limit feedback* → Task 5 (`check-limit`) + Task 10 surfacing `limitExceeded`, with execute as authoritative. ✓
- *Canonical amounts* → money handled only via `@/shared/money`; `baseAmount` string on the wire; the single `Number()` exception is documented and advisory-only. ✓
- *Idempotent execution* → Task 6 (auto Idempotency-Key, no-retry mutation, disabled-while-pending). ✓
- *503 `PRICE_ORACLE_DIVERGENCE` paused state* → Task 9 panel + Task 10 gate. ✓
- Per-slice gate (typecheck + tests + build; contract test per request shape / typed error / money field; keyboard/focus via `Field`/`Button`; no double-submit; no Funding/Spot confusion; pending never spendable) → Tasks 4/5/6 request-shape tests, Task 10 money-path tests, Task 11 build gate. ✓

**2. Placeholder scan:** every code step carries complete code; no TBD/"add validation"/"similar to Task N". ✓

**3. Type consistency:** `swapApi` methods, `QuoteResponse.calculo.finalAmount`, `ExecuteSwapResponse.data.precioUsado/comisionCalculada`, query keys (`SWAP_PAIRS_KEY`, `SWAP_MY_SWAPS_KEY`, `SWAP_DAILY_VOLUME_KEY`), and the `WALLET_BALANCES_KEY` import are consistent across tasks. The sufficiency gate uses `pair.quoteCryptoId`/`pair.baseCryptoId` (present on normalized `SwapPair`) against `BalanceEntry.compartments[compartment].available` (the real wallet type). ✓

**Note for the executor (money-path):** Tasks 6 and 10 are the money-path tasks — the coordinator reviews these personally (not "close enough"). Confirm in review: (a) no Number/parseFloat on any money value except the sanctioned `check-limit` boundary; (b) the sufficiency gate blocks on unknown balance; (c) submit is disabled while pending, while paused, and while the quote is loading/errored; (d) the quote/execute 503 path renders the paused state, not a generic error.
