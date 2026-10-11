# Next.js Slice 5 (P2P) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the P2P vertical in the Next.js `web/` app — browse/create offers, accept an offer (opens a transaction that locks the seller's crypto), and drive the full offer→accept→pay→complete/cancel state machine with role-gated actions and typed 4xx recovery.

**Architecture:** Mirrors the S2 wallet / S3 swap / S4 trading features: `web/src/features/p2p/{types.ts,api.ts,queries.ts,components/*,index.ts}` + a client-rendered `/p2p` route under `web/src/app/(app)/`. API talks to the **legacy Spanish mount paths** (`/ofertaP2P`, `/transaccionP2P`, `/metodoPago`, `/crypto`) through the shared `apiClient`. Money fields travel as canonical decimal strings via `@/shared/money`; display-only fiat figures use `formatDisplay`. Server is the authority for the state machine and fund-locking — the client mirrors the rules for UX and surfaces the backend's typed 4xx verbatim.

**Tech Stack:** Next.js 14.2.35 App Router (React 18), TanStack Query v5, Vitest + Testing Library, the shared `@/shared/{api,money,i18n,ui}` modules.

## Global Constraints

- **React 18 / Next 14.2.35.** No React 19 APIs. All interactive components start with `'use client'`.
- **Money is a canonical decimal string** (`.` separator, no thousands) end-to-end. Never `Number`/`parseFloat`/float on a spend/compare path. Parsing user input: `parseInput(raw, { locale })` from `@/shared/money` (locale-aware); comparisons: `compare`/`gte`/`gt`/`lte`/`lt`; products: `multiply`; display: `formatDisplay(value, { locale, ... })`. This mirrors `web/src/features/swap/components/SwapForm.tsx`.
- **Wire contract — amounts are STRINGS.** `amount`, `unitPrice`, `minAmount`, `maxAmount` go on the wire as strings. The backend does `String(x)` + `money.compare`/`money.multiply`, so strings are accepted and are the safe choice. Do NOT send JS numbers for money.
- **Backend mount paths are the legacy Spanish ones** and are passed to `apiClient` WITHOUT an `/api` prefix (the client prepends the base, exactly as swap uses `/parExchange` and `/intercambioExchange`): `/ofertaP2P`, `/transaccionP2P`, `/metodoPago`, `/crypto`.
- **No backend idempotency on P2P.** The idempotency middleware is NOT applied to any P2P route (verified: `POST /transaccionP2P` is not guarded, and it is NOT in the client's `isMoneyEndpoint` patterns, so no `Idempotency-Key` is attached). The double-submit guard for accept/create is therefore **disabled-while-pending button + `retry: false` mutation** only. This is a known gap — backend-side idempotency on `POST /transaccionP2P` is a backend follow-up to flag in the progress log, NOT something to paper over on the client.
- **i18n:** add keys under a `p2p.*` namespace to BOTH `en` and `es` catalogs (the two locales that exist today). Every new key must exist in both — a parity test enforces it. fr/it/pt are out of scope for this slice.
- **Error copy comes from the error catalog**, not hardcoded strings: render failures via `useErrorTranslation().tError(code, params)`.
- **Shared component signatures (confirmed — pass these to implementers verbatim):**
  - `useTranslation()` → `{ t, locale }` (`t(key, params?)`).
  - `useErrorTranslation()` → `{ tError }`; `tError(code, params?)`. When an error may surface `code === 'INTERNAL_ERROR'`, pass `{ requestId: err.requestId }` so the support id renders.
  - `Field` (`@/shared/ui`): props `{ label, helpText?, error?, children }`. It does NOT take `htmlFor`. It clones **exactly one** child and injects `id`/`aria-invalid`/`aria-describedby`; the child must be a single form control. If the child already has an `id`, Field uses it.
  - `Button` (`@/shared/ui`): props include `variant` (`primary|secondary|danger|ghost`), `size`, `loading`, `disabled`. `loading` implies disabled + `aria-busy`.
  - `apiClient` (`@/shared/api`): `get<T>(path)`, `post<T>(path, body)`, `patch<T>(path, body?)`, `put<T>(path, body)`, `del<T>(path)` — confirm the exact verb helpers in `web/src/shared/api/client.ts` during Task 1 and use what exists (swap uses `get`/`post`).
  - `ApiError` (`@/shared/api`): `{ code: string, message: string, status: number, requestId?: string }`. Type queries/mutations as `useQuery<T, ApiError>` / `useMutation<T, ApiError, V>` so `.code` is readable.

---

## Backend Contract (grounded reference — read before coding)

Source of truth read for this plan: `backend/modules/p2p/{p2pOffer,p2pTransaction,paymentMethod}.{routes,controller,model,entity}.js`, `backend/utils/errorCodes.js`, `backend/routes/index.js`, `backend/modules/balances/userBalance.model.js`. **If a route file and this block ever disagree, the route file wins** (and fix this block).

### Offers — `/ofertaP2P`
- `GET /ofertaP2P/activas` → active offers. Returns `{ data: Offer[], pagination: {...} }` (list methods wrap in `{ data, pagination }`).
- `GET /ofertaP2P?type=&cryptoId=&fiatCurrency=&page=&limit=` → filtered list, same envelope.
- `GET /ofertaP2P/:id` → a single `Offer` (bare object). **Note:** offers auto-deactivate after 12h (server flips `active=false` on read).
- `GET /ofertaP2P/me/ofertas?page=&limit=` → my offers (history), `{ data, pagination }`-ish (uses `getUserOfferHistory`).
- `GET /ofertaP2P/:id/can-accept` → `{ ... }` acceptability result (advisory).
- `POST /ofertaP2P` (requireEmailVerified) → body `{ type: 'buy'|'sell', cryptoId, minAmount, maxAmount, unitPrice, fiatCurrency, additionalTerms?, metodosPagoIds: string[] (≥1), direccionFiat? (REQUIRED when type==='sell') }` → `201`.
- `PUT /ofertaP2P/:id` (requireEmailVerified) → update (owner only).
- `DELETE /ofertaP2P/:id` (requireEmailVerified) → deactivate (owner only).
- `PATCH /ofertaP2P/:id/toggle` (requireEmailVerified) → toggle active, body `{ active: boolean }`.

**Offer shape** (entity + `paymentMethods` include; NO crypto/user association is returned):
```
{ id, userId, type: 'buy'|'sell', cryptoId, minAmount, maxAmount, unitPrice,
  fiatCurrency, additionalTerms: string|null, active: boolean,
  direccionFiat: string|null,                    // seller's fiat-receive address; set for sell offers
  paymentMethods: [{ id, name, description, active }],
  created_at, updated_at }
```
The offer carries `cryptoId` (UUID) only — **no symbol**. Resolve `cryptoId → symbol` via the `/crypto` catalog (Task 1 adds a catalog fetch; `GET /crypto` returns `[{ id, symbol, name, ... }]`). Show a short id fallback if a symbol is missing.

### Transactions (state machine) — `/transaccionP2P`
- `POST /transaccionP2P` (requireEmailVerified) → body `{ offerId, amount, paymentMethodId }` → `201 { message, data: Transaction }`. **Locks the SELLER's Funding crypto.** The accepting user is the buyer if the offer is `sell`, the seller if the offer is `buy`.
- `PATCH /transaccionP2P/:id/confirm-payment` (requireEmailVerified) → buyer marks fiat paid. `200 { message, data }`. Only `initiated → payment_confirmed`; only the buyer.
- `PATCH /transaccionP2P/:id/complete` (requireEmailVerified) → seller releases crypto. `200 { message, data }`. Only `payment_confirmed → completed`; only the seller.
- `PATCH /transaccionP2P/:id/cancel` (requireEmailVerified) → buyer OR seller cancels; unlocks seller funds. `200 { message, data }`. Allowed from `initiated` or `payment_confirmed`; rejected once `completed`/`cancelled`.
- `GET /transaccionP2P/me/transacciones?page=&limit=&status=` → `{ transacciones: Transaction[] (each + esComprador: boolean), total, page, limit }`.
- `GET /transaccionP2P/me/pending` → pending transactions for the user.
- `GET /transaccionP2P/:id` → a single `Transaction` (403 if not a participant/admin).

**Transaction shape:**
```
{ id, offerId, buyerId, sellerId, cryptoId, amount, unitPrice,
  fiatAmount, fiatCurrency, paymentMethodId,
  status: 'initiated'|'payment_confirmed'|'completed'|'cancelled',  // 'crypto_locked' exists in the DB enum but is NOT part of the active transition table — do not model it as reachable
  paymentConfirmedAt: string|null, completedAt: string|null,
  created_at, updated_at,
  crypto?: { id, symbol, name, iconUrl },     // included on /me/transacciones
  buyer?: { id, username, averageRating },     // included on /me/transacciones
  seller?: { id, username, averageRating },    // included on /me/transacciones
  esComprador?: boolean }                       // only on /me/transacciones
```

**State machine (real):**
```
initiated ──confirm-payment(buyer)──▶ payment_confirmed ──complete(seller)──▶ completed
    │                                        │
    └────────────── cancel (buyer|seller) ───┴──▶ cancelled
completed / cancelled = terminal
```

### Payment methods — `/metodoPago`
- `GET /metodoPago/status/active` → `[{ id, name, description, active }]` (global catalog; users read only).
- `GET /metodoPago` → all methods.

### Typed error codes (map ALL of these in the error catalog, en+es)
`P2P_TX_NOT_FOUND`, `P2P_TX_FORBIDDEN`, `P2P_TX_OFFER_NOT_FOUND`, `P2P_TX_OWN_OFFER`, `P2P_TX_INVALID_STATE`, `P2P_TX_OFFER_INACTIVE`, `P2P_TX_AMOUNT_OUT_OF_RANGE`, `P2P_TX_INSUFFICIENT_FUNDS`, `P2P_TX_ADMIN_REQUIRED`. Plus the generic `EMAIL_NOT_VERIFIED`, `UNAUTHORIZED`, `NETWORK_ERROR`, `INTERNAL_ERROR` already in the catalog.

### Money-path rules (THE important part)
- `amount` = crypto quantity (DECIMAL 18,8). `unitPrice` = fiat per 1 crypto (DECIMAL 10,4). `fiatAmount = amount × unitPrice` (compute with `multiply` for display; the server computes the authoritative value).
- The acceptor picks `amount ∈ [minAmount, maxAmount]` (inclusive; backend uses `compare < 0 || > 0`).
- **Fund-lock is always the SELLER's Funding balance.** Therefore the client sufficiency pre-check applies **only when the acting user becomes the seller** — i.e. accepting a **`buy`** offer (acceptor = seller). Accepting a **`sell`** offer makes the acceptor the **buyer**: no on-platform crypto spend by them (they pay fiat off-platform), so NO crypto sufficiency gate — instead disclose the `fiatAmount` they will owe and the seller's `direccionFiat`/accepted `paymentMethods`.
- Sufficiency is **advisory** on the client (server is authoritative, raises `P2P_TX_INSUFFICIENT_FUNDS`). When the acceptor is the seller, compare `amount` against their **Funding `available`** balance for `cryptoId` (reuse the wallet balances query, §9 compartmented shape). **Block submit on unknown balance** (can't prove sufficiency) — same posture as swap/trading.
- Double-submit guard = disabled-while-pending + `retry: false`. No idempotency key (see Global Constraints).

---

## File Structure

```
web/src/features/p2p/
  types.ts                      # Offer, Transaction, PaymentMethod, CryptoRef, enums, request/response types
  api.ts                        # p2pApi: offers, transactions, payment methods, crypto catalog
  api.test.ts                   # path + request-shape contract tests (string money, legacy paths)
  queries.ts                    # TanStack hooks + mutations (keys exported for invalidation)
  queries.test.tsx              # hook wiring + invalidation tests
  i18nP2pKeys.test.ts           # en/es parity for p2p.* keys
  index.ts                      # barrel (components + the P2PPage shell)
  components/
    p2p.module.css
    OffersList.tsx / .test.tsx          # browse active offers, buy/sell tabs, crypto filter
    OfferDetail.tsx / .test.tsx         # one offer: price/range/methods/terms/direccionFiat
    AcceptOfferForm.tsx / .test.tsx     # MONEY-PATH: amount-in-range + method + sufficiency + fiat disclosure
    MyTransactionsView.tsx / .test.tsx  # my transactions (active + history), status + role
    TransactionDetail.tsx / .test.tsx   # state machine + role-gated confirm/complete/cancel + typed 4xx
    CreateOfferForm.tsx / .test.tsx     # maker: create a buy/sell offer
    MyOffersView.tsx / .test.tsx        # my offers: toggle active / deactivate
    P2PTabs.tsx / .test.tsx             # tab shell (Browse | My transactions | My offers | Create)
web/src/app/(app)/p2p/page.tsx          # client route rendering <P2PPage/>
docs/frontend-rebuild/backend-contract-changes.md  # add §21
```

**Error catalog + i18n catalogs** (modified): `web/src/shared/i18n/errorCatalog.ts` (or its data file — confirm in Task 3) for P2P codes; `web/src/shared/i18n/catalogs/{en,es}.ts` for `p2p.*` keys.

---

### Task 1: Types + API client

**Files:**
- Create: `web/src/features/p2p/types.ts`
- Create: `web/src/features/p2p/api.ts`
- Test: `web/src/features/p2p/api.test.ts`

**Interfaces:**
- Consumes: `apiClient` from `@/shared/api`.
- Produces:
  - Types: `OfferType = 'buy' | 'sell'`; `TxStatus = 'initiated' | 'payment_confirmed' | 'completed' | 'cancelled'`;
    `PaymentMethod = { id: string; name: string; description: string | null; active: boolean }`;
    `CryptoRef = { id: string; symbol: string; name: string }`;
    `Offer = { id; userId; type: OfferType; cryptoId; minAmount: string; maxAmount: string; unitPrice: string; fiatCurrency: string; additionalTerms: string | null; active: boolean; direccionFiat: string | null; paymentMethods: PaymentMethod[]; created_at: string; updated_at: string }`;
    `Transaction = { id; offerId; buyerId; sellerId; cryptoId; amount: string; unitPrice: string; fiatAmount: string; fiatCurrency: string; paymentMethodId: string; status: TxStatus; paymentConfirmedAt: string | null; completedAt: string | null; created_at: string; updated_at: string; crypto?: { id; symbol; name; iconUrl?: string }; buyer?: { id; username; averageRating: number | null }; seller?: { id; username; averageRating: number | null }; esComprador?: boolean }`;
    `CreateOfferRequest = { type: OfferType; cryptoId: string; minAmount: string; maxAmount: string; unitPrice: string; fiatCurrency: string; additionalTerms?: string; metodosPagoIds: string[]; direccionFiat?: string }`;
    `AcceptOfferRequest = { offerId: string; amount: string; paymentMethodId: string }`;
    `MyTxResponse = { transacciones: Transaction[]; total: number; page: number; limit: number }`;
    `ListEnvelope<T> = { data: T[]; pagination?: { total: number; page: number; limit: number; totalPages: number } }`.
  - `p2pApi` object (see Step 3).

- [ ] **Step 1: Write the failing test**

Create `web/src/features/p2p/api.test.ts`. Mock `apiClient` and assert the exact legacy paths, string money on the wire, and list-envelope unwrapping.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/shared/api';
import { p2pApi } from './api';

vi.mock('@/shared/api', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>;
const mockPatch = apiClient.patch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

describe('p2pApi paths + shapes', () => {
  it('getActiveOffers unwraps the { data } envelope and hits the legacy path', async () => {
    mockGet.mockResolvedValue({ data: [{ id: 'o1' }], pagination: { total: 1 } });
    const offers = await p2pApi.getActiveOffers();
    expect(mockGet).toHaveBeenCalledWith('/ofertaP2P/activas');
    expect(offers).toEqual([{ id: 'o1' }]);
  });

  it('getActiveOffers tolerates a bare array', async () => {
    mockGet.mockResolvedValue([{ id: 'o2' }]);
    expect(await p2pApi.getActiveOffers()).toEqual([{ id: 'o2' }]);
  });

  it('acceptOffer sends amount as a STRING to /transaccionP2P and returns data', async () => {
    mockPost.mockResolvedValue({ message: 'ok', data: { id: 't1', status: 'initiated' } });
    const tx = await p2pApi.acceptOffer({ offerId: 'o1', amount: '1.5', paymentMethodId: 'pm1' });
    expect(mockPost).toHaveBeenCalledWith('/transaccionP2P', {
      offerId: 'o1', amount: '1.5', paymentMethodId: 'pm1',
    });
    const body = mockPost.mock.calls[0][1];
    expect(typeof body.amount).toBe('string');
    expect(tx).toEqual({ id: 't1', status: 'initiated' });
  });

  it('createOffer sends canonical string money fields', async () => {
    mockPost.mockResolvedValue({ id: 'o9' });
    await p2pApi.createOffer({
      type: 'sell', cryptoId: 'c1', minAmount: '0.01', maxAmount: '2', unitPrice: '65000.0000',
      fiatCurrency: 'USD', metodosPagoIds: ['pm1'], direccionFiat: 'acct-123',
    });
    const body = mockPost.mock.calls[0][1];
    expect(mockPost.mock.calls[0][0]).toBe('/ofertaP2P');
    for (const k of ['minAmount', 'maxAmount', 'unitPrice']) expect(typeof body[k]).toBe('string');
  });

  it('state-machine actions PATCH the right paths', async () => {
    mockPatch.mockResolvedValue({ message: 'ok', data: { id: 't1' } });
    await p2pApi.confirmPayment('t1');
    await p2pApi.completeTransaction('t1');
    await p2pApi.cancelTransaction('t1');
    expect(mockPatch).toHaveBeenNthCalledWith(1, '/transaccionP2P/t1/confirm-payment');
    expect(mockPatch).toHaveBeenNthCalledWith(2, '/transaccionP2P/t1/complete');
    expect(mockPatch).toHaveBeenNthCalledWith(3, '/transaccionP2P/t1/cancel');
  });

  it('getMyTransactions returns the { transacciones } envelope', async () => {
    mockGet.mockResolvedValue({ transacciones: [{ id: 't1', esComprador: true }], total: 1, page: 1, limit: 10 });
    const r = await p2pApi.getMyTransactions();
    expect(mockGet).toHaveBeenCalledWith('/transaccionP2P/me/transacciones');
    expect(r.transacciones[0].esComprador).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/p2p/api.test.ts`
Expected: FAIL — `./api` / `p2pApi` not found.

- [ ] **Step 3: Implement `types.ts` then `api.ts`**

`types.ts`: export every type listed in **Interfaces → Produces**.

`api.ts`: first open `web/src/shared/api/client.ts` and confirm the verb helpers (`get`/`post`/`patch`/`put`/`del`). Use the real ones. If `patch` does not exist, add a thin `patch` to the client mirroring `post` (empty body allowed) — the state machine needs it; confirm during implementation and keep the change minimal and tested.

```ts
import { apiClient } from '@/shared/api';
import type {
  Offer, Transaction, PaymentMethod, CryptoRef,
  CreateOfferRequest, AcceptOfferRequest, MyTxResponse, ListEnvelope,
} from './types';

function unwrapList<T>(r: ListEnvelope<T> | T[]): T[] {
  return Array.isArray(r) ? r : (r?.data ?? []);
}

export const p2pApi = {
  // --- offers ---
  getActiveOffers: () =>
    apiClient.get<ListEnvelope<Offer> | Offer[]>('/ofertaP2P/activas').then(unwrapList),
  getOffers: (params?: { type?: string; cryptoId?: string; fiatCurrency?: string }) => {
    const qs = params
      ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString()
      : '';
    return apiClient.get<ListEnvelope<Offer> | Offer[]>(`/ofertaP2P${qs}`).then(unwrapList);
  },
  getOffer: (id: string) => apiClient.get<Offer>(`/ofertaP2P/${id}`),
  getMyOffers: () =>
    apiClient.get<ListEnvelope<Offer> | Offer[]>('/ofertaP2P/me/ofertas').then(unwrapList),
  createOffer: (req: CreateOfferRequest) => apiClient.post<Offer>('/ofertaP2P', req),
  toggleOffer: (id: string, active: boolean) =>
    apiClient.patch<Offer>(`/ofertaP2P/${id}/toggle`, { active }),
  deleteOffer: (id: string) => apiClient.del<{ message: string }>(`/ofertaP2P/${id}`),

  // --- transactions (state machine) ---
  acceptOffer: (req: AcceptOfferRequest) =>
    apiClient.post<{ message: string; data: Transaction }>('/transaccionP2P', {
      offerId: req.offerId,
      amount: req.amount,            // STRING on the wire
      paymentMethodId: req.paymentMethodId,
    }).then((r) => r.data),
  getMyTransactions: () => apiClient.get<MyTxResponse>('/transaccionP2P/me/transacciones'),
  getTransaction: (id: string) => apiClient.get<Transaction>(`/transaccionP2P/${id}`),
  confirmPayment: (id: string) =>
    apiClient.patch<{ message: string; data: Transaction }>(`/transaccionP2P/${id}/confirm-payment`).then((r) => r.data),
  completeTransaction: (id: string) =>
    apiClient.patch<{ message: string; data: Transaction }>(`/transaccionP2P/${id}/complete`).then((r) => r.data),
  cancelTransaction: (id: string) =>
    apiClient.patch<{ message: string; data: Transaction }>(`/transaccionP2P/${id}/cancel`).then((r) => r.data),

  // --- payment methods + crypto catalog ---
  getPaymentMethods: () => apiClient.get<PaymentMethod[]>('/metodoPago/status/active'),
  getCryptoCatalog: () => apiClient.get<CryptoRef[]>('/crypto'),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/p2p/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/p2p/types.ts web/src/features/p2p/api.ts web/src/features/p2p/api.test.ts
git commit -m "feat(web): P2P api client + types (Slice 5 Task 1)"
```

---

### Task 2: Query hooks + mutations

**Files:**
- Create: `web/src/features/p2p/queries.ts`
- Test: `web/src/features/p2p/queries.test.tsx`

**Interfaces:**
- Consumes: `p2pApi` (Task 1); `WALLET_BALANCES_KEY` from `@/features/wallet/queries`.
- Produces (query keys + hooks):
  - Keys: `P2P_OFFERS_KEY = ['p2p','offers']`, `P2P_OFFER_KEY(id)`, `P2P_MY_OFFERS_KEY = ['p2p','my-offers']`, `P2P_MY_TX_KEY = ['p2p','my-tx']`, `P2P_TX_KEY(id)`, `P2P_METHODS_KEY = ['p2p','methods']`, `P2P_CRYPTO_KEY = ['p2p','crypto']`.
  - Queries: `useActiveOffers()`, `useOffer(id, enabled)`, `useMyOffers()`, `useMyTransactions()`, `useTransaction(id, enabled)`, `usePaymentMethods()`, `useCryptoCatalog()`.
  - Mutations: `useAcceptOffer()`, `useConfirmPayment()`, `useCompleteTransaction()`, `useCancelTransaction()`, `useCreateOffer()`, `useToggleOffer()`, `useDeleteOffer()`. All `useMutation<_, ApiError, _>` with `retry: false` (default) and `onSuccess` invalidation.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { p2pApi } from './api';
import { useActiveOffers, useAcceptOffer, useConfirmPayment } from './queries';

vi.mock('./api', () => ({
  p2pApi: {
    getActiveOffers: vi.fn(),
    acceptOffer: vi.fn(),
    confirmPayment: vi.fn(),
  },
}));

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => vi.clearAllMocks());

describe('p2p queries', () => {
  it('useActiveOffers fetches via p2pApi', async () => {
    (p2pApi.getActiveOffers as any).mockResolvedValue([{ id: 'o1' }]);
    const { result } = renderHook(() => useActiveOffers(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'o1' }]);
  });

  it('useAcceptOffer calls acceptOffer and does not retry', async () => {
    (p2pApi.acceptOffer as any).mockResolvedValue({ id: 't1', status: 'initiated' });
    const { result } = renderHook(() => useAcceptOffer(), { wrapper: wrapper() });
    result.current.mutate({ offerId: 'o1', amount: '1', paymentMethodId: 'pm1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(p2pApi.acceptOffer).toHaveBeenCalledWith({ offerId: 'o1', amount: '1', paymentMethodId: 'pm1' });
  });

  it('useConfirmPayment calls confirmPayment', async () => {
    (p2pApi.confirmPayment as any).mockResolvedValue({ id: 't1', status: 'payment_confirmed' });
    const { result } = renderHook(() => useConfirmPayment(), { wrapper: wrapper() });
    result.current.mutate('t1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(p2pApi.confirmPayment).toHaveBeenCalledWith('t1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/p2p/queries.test.tsx`
Expected: FAIL — `./queries` not found.

- [ ] **Step 3: Implement `queries.ts`**

Mirror `web/src/features/swap/queries.ts`. `'use client'` at the top. Example mutation + the two invalidation targets (`P2P_MY_TX_KEY`, `WALLET_BALANCES_KEY` — accept/complete/cancel all move the seller's locked balance):

```ts
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { p2pApi } from './api';
import type { Offer, Transaction, PaymentMethod, CryptoRef, AcceptOfferRequest, CreateOfferRequest, MyTxResponse } from './types';
import { WALLET_BALANCES_KEY } from '@/features/wallet/queries';

export const P2P_OFFERS_KEY = ['p2p', 'offers'] as const;
export const P2P_OFFER_KEY = (id: string) => ['p2p', 'offer', id] as const;
export const P2P_MY_OFFERS_KEY = ['p2p', 'my-offers'] as const;
export const P2P_MY_TX_KEY = ['p2p', 'my-tx'] as const;
export const P2P_TX_KEY = (id: string) => ['p2p', 'tx', id] as const;
export const P2P_METHODS_KEY = ['p2p', 'methods'] as const;
export const P2P_CRYPTO_KEY = ['p2p', 'crypto'] as const;

export function useActiveOffers() {
  return useQuery<Offer[], ApiError>({ queryKey: P2P_OFFERS_KEY, queryFn: () => p2pApi.getActiveOffers(), staleTime: 30_000 });
}
export function useOffer(id: string, enabled: boolean) {
  return useQuery<Offer, ApiError>({ queryKey: P2P_OFFER_KEY(id), queryFn: () => p2pApi.getOffer(id), enabled, staleTime: 15_000 });
}
export function useMyOffers() {
  return useQuery<Offer[], ApiError>({ queryKey: P2P_MY_OFFERS_KEY, queryFn: () => p2pApi.getMyOffers(), staleTime: 15_000 });
}
export function useMyTransactions() {
  return useQuery<MyTxResponse, ApiError>({ queryKey: P2P_MY_TX_KEY, queryFn: () => p2pApi.getMyTransactions(), staleTime: 10_000 });
}
export function useTransaction(id: string, enabled: boolean) {
  return useQuery<Transaction, ApiError>({ queryKey: P2P_TX_KEY(id), queryFn: () => p2pApi.getTransaction(id), enabled, staleTime: 5_000 });
}
export function usePaymentMethods() {
  return useQuery<PaymentMethod[], ApiError>({ queryKey: P2P_METHODS_KEY, queryFn: () => p2pApi.getPaymentMethods(), staleTime: 300_000 });
}
export function useCryptoCatalog() {
  return useQuery<CryptoRef[], ApiError>({ queryKey: P2P_CRYPTO_KEY, queryFn: () => p2pApi.getCryptoCatalog(), staleTime: 300_000 });
}

function useTxMutation<V>(fn: (v: V) => Promise<Transaction>) {
  const qc = useQueryClient();
  return useMutation<Transaction, ApiError, V>({
    mutationFn: fn,
    onSuccess: (tx) => {
      qc.invalidateQueries({ queryKey: P2P_MY_TX_KEY });
      qc.invalidateQueries({ queryKey: WALLET_BALANCES_KEY });
      if (tx?.id) qc.invalidateQueries({ queryKey: P2P_TX_KEY(tx.id) });
    },
  });
}

export function useAcceptOffer() { return useTxMutation((req: AcceptOfferRequest) => p2pApi.acceptOffer(req)); }
export function useConfirmPayment() { return useTxMutation((id: string) => p2pApi.confirmPayment(id)); }
export function useCompleteTransaction() { return useTxMutation((id: string) => p2pApi.completeTransaction(id)); }
export function useCancelTransaction() { return useTxMutation((id: string) => p2pApi.cancelTransaction(id)); }

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation<Offer, ApiError, CreateOfferRequest>({
    mutationFn: (req) => p2pApi.createOffer(req),
    onSuccess: () => { qc.invalidateQueries({ queryKey: P2P_MY_OFFERS_KEY }); qc.invalidateQueries({ queryKey: P2P_OFFERS_KEY }); },
  });
}
export function useToggleOffer() {
  const qc = useQueryClient();
  return useMutation<Offer, ApiError, { id: string; active: boolean }>({
    mutationFn: ({ id, active }) => p2pApi.toggleOffer(id, active),
    onSuccess: () => { qc.invalidateQueries({ queryKey: P2P_MY_OFFERS_KEY }); qc.invalidateQueries({ queryKey: P2P_OFFERS_KEY }); },
  });
}
export function useDeleteOffer() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) => p2pApi.deleteOffer(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: P2P_MY_OFFERS_KEY }); qc.invalidateQueries({ queryKey: P2P_OFFERS_KEY }); },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/p2p/queries.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/p2p/queries.ts web/src/features/p2p/queries.test.tsx
git commit -m "feat(web): P2P query hooks + mutations (Slice 5 Task 2)"
```

---

### Task 3: i18n keys (en/es) + P2P error-catalog codes + parity tests

**Files:**
- Modify: `web/src/shared/i18n/catalogs/en.ts`, `web/src/shared/i18n/catalogs/es.ts` (add a `p2p` namespace)
- Modify: the error-catalog data (open `web/src/shared/i18n/errorCatalog.ts` and follow its structure — add the P2P codes to the en + es maps it reads; if the strings live in the locale catalogs, add them there instead)
- Create: `web/src/features/p2p/i18nP2pKeys.test.ts`
- Test: extend the existing error-catalog test if there is one; otherwise assert via `i18nP2pKeys.test.ts`

**Interfaces:**
- Consumes: existing catalog shape.
- Produces: a `p2p.*` key set used by all components; P2P error codes resolvable by `tError`.

- [ ] **Step 1: Write the failing parity test**

```ts
import { describe, it, expect } from 'vitest';
import { en } from '@/shared/i18n/catalogs/en';
import { es } from '@/shared/i18n/catalogs/es';

function keysUnder(obj: Record<string, unknown>, prefix: string): string[] {
  // flatten keys that start with `${prefix}.` — adapt to the catalog's actual nesting
  const out: string[] = [];
  const walk = (o: any, path: string) => {
    for (const k of Object.keys(o)) {
      const p = path ? `${path}.${k}` : k;
      if (o[k] && typeof o[k] === 'object') walk(o[k], p);
      else out.push(p);
    }
  };
  walk(obj, '');
  return out.filter((k) => k.startsWith(prefix));
}

describe('p2p i18n parity', () => {
  it('every p2p.* key exists in both en and es', () => {
    const enKeys = keysUnder(en as any, 'p2p').sort();
    const esKeys = keysUnder(es as any, 'p2p').sort();
    expect(enKeys).toEqual(esKeys);
    expect(enKeys.length).toBeGreaterThan(0);
  });
});
```
(Adapt `keysUnder`/imports to the catalog's real export shape — inspect `catalogs/en.ts` first; it may export a flat object or a nested one, matching how swap/trading keys were added in S3/S4.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/p2p/i18nP2pKeys.test.ts`
Expected: FAIL — no `p2p.*` keys yet.

- [ ] **Step 3: Add the keys**

Add a `p2p` namespace to both catalogs with keys for: tab labels (`browse`, `myTransactions`, `myOffers`, `create`), offer list (type buy/sell, price, range, payment methods, terms, empty state, filter-by-crypto), accept form (amount label + in-range help, pick payment method, you-pay/you-receive, fiat-owed disclosure, seller address, submit, insufficient-funds advisory, out-of-range advisory), transaction statuses (`status.initiated|payment_confirmed|completed|cancelled`), state-machine action labels (`confirmPayment`, `complete`, `cancel`) + their confirm prompts + role hints (buyer/seller), create-offer form (all fields incl. direccionFiat help), my-offers (toggle/deactivate). Keep copy consistent with S4 trading wording. Add the P2P error codes to the error catalog (en+es):
```
P2P_TX_INVALID_STATE, P2P_TX_OWN_OFFER, P2P_TX_AMOUNT_OUT_OF_RANGE,
P2P_TX_INSUFFICIENT_FUNDS, P2P_TX_OFFER_INACTIVE, P2P_TX_FORBIDDEN,
P2P_TX_NOT_FOUND, P2P_TX_OFFER_NOT_FOUND, P2P_TX_ADMIN_REQUIRED
```
with friendly, actionable messages in each language.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/p2p/i18nP2pKeys.test.ts` → PASS. Also run any existing error-catalog test.

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/i18n/catalogs/en.ts web/src/shared/i18n/catalogs/es.ts web/src/shared/i18n/errorCatalog.ts web/src/features/p2p/i18nP2pKeys.test.ts
git commit -m "feat(web): P2P i18n keys + error catalog codes (Slice 5 Task 3)"
```

---

### Task 4: OffersList (browse active offers, buy/sell tabs, crypto filter)

**Files:**
- Create: `web/src/features/p2p/components/OffersList.tsx`
- Create: `web/src/features/p2p/components/p2p.module.css`
- Test: `web/src/features/p2p/components/OffersList.test.tsx`

**Interfaces:**
- Consumes: `useActiveOffers`, `useCryptoCatalog`, `usePaymentMethods` (Task 2); `useTranslation`.
- Produces: `<OffersList onSelectOffer={(offer: Offer) => void} />`. Renders a buy/sell tab toggle, an optional crypto filter (built from the catalog), and a row per offer showing: type, crypto symbol (resolved via catalog, short-id fallback), unit price + fiat currency, amount range, payment-method names. Each row has an "accept"/"view" button calling `onSelectOffer`. Loading/empty/error states (error via `tError`).

- [ ] **Step 1: Write the failing test** — render with mocked hooks; assert a sell offer's symbol/price/range render and clicking the row fires `onSelectOffer`. Assert the buy/sell toggle filters the visible rows. (Mock `./queries` and `@/shared/i18n`.)
- [ ] **Step 2: Run** `cd web && npx vitest run src/features/p2p/components/OffersList.test.tsx` → FAIL.
- [ ] **Step 3: Implement** mirroring `web/src/features/trading/components/*` list patterns. Build a `Map<cryptoId, symbol>` from `useCryptoCatalog`. Display money with `formatDisplay(value, { locale })` — these are display figures, not a spend path.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**
```bash
git add web/src/features/p2p/components/OffersList.tsx web/src/features/p2p/components/OffersList.test.tsx web/src/features/p2p/components/p2p.module.css
git commit -m "feat(web): P2P offers list + crypto filter (Slice 5 Task 4)"
```

---

### Task 5: OfferDetail (one offer: price / range / methods / terms / seller address)

**Files:**
- Create: `web/src/features/p2p/components/OfferDetail.tsx`
- Test: `web/src/features/p2p/components/OfferDetail.test.tsx`

**Interfaces:**
- Consumes: `useCryptoCatalog`, `useTranslation`; receives `offer: Offer` as a prop (parent already has it from the list) plus optional `onAccept: () => void`.
- Produces: `<OfferDetail offer={offer} onAccept={...} />`. Shows the offer meta, the accepted `paymentMethods`, `additionalTerms`, and — **only for `type === 'sell'`** — the seller's `direccionFiat` (the address a buyer pays fiat to). An "Accept" button (hidden/disabled when `!offer.active`) calls `onAccept`.

- [ ] **Step 1: Write the failing test** — a sell offer renders `direccionFiat`; a buy offer does NOT; inactive offer disables Accept.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Display-only money via `formatDisplay`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**
```bash
git add web/src/features/p2p/components/OfferDetail.tsx web/src/features/p2p/components/OfferDetail.test.tsx
git commit -m "feat(web): P2P offer detail view (Slice 5 Task 5)"
```

---

### Task 6: AcceptOfferForm — MONEY-PATH (amount-in-range + method + sufficiency + fiat disclosure)

> **This task is the money-path. Reviewed line-by-line by the coordinator. TDD, no "close enough".**

**Files:**
- Create: `web/src/features/p2p/components/AcceptOfferForm.tsx`
- Test: `web/src/features/p2p/components/AcceptOfferForm.test.tsx`

**Interfaces:**
- Consumes: `useAcceptOffer` (Task 2), `usePaymentMethods`, the wallet balances query (`useBalances`/`WALLET_BALANCES_KEY` — confirm the hook name in `web/src/features/wallet/queries.ts`), `useTranslation`, `useErrorTranslation`, `parseInput`/`compare`/`multiply`/`formatDisplay` from `@/shared/money`, `Field`, `Button`.
- Produces: `<AcceptOfferForm offer={offer} onDone={(tx: Transaction) => void} />`.

**Behavior (exact):**
1. Amount input, parsed locale-aware: `const parsed = parseInput(raw, { locale })`. `amountOk = parsed.ok && compare(parsed.value, '0') > 0`.
2. **In-range gate (always):** `inRange = amountOk && gte(parsed.value, offer.minAmount) && lte(parsed.value, offer.maxAmount)`. Out of range → advisory message (`p2p.accept.outOfRange` with min/max), submit disabled.
3. **Role + sufficiency:** acceptor is **buyer** if `offer.type === 'sell'`, **seller** if `offer.type === 'buy'`.
   - If **seller** (`offer.type === 'buy'`): look up Funding `available` for `offer.cryptoId` from balances. `requiredSpend = parsed.value`. If balances unknown/not-yet-loaded → **block submit** (cannot prove sufficiency) with a neutral "loading balance" note. If `compare(requiredSpend, available) > 0` → advisory `P2P_TX_INSUFFICIENT_FUNDS`-style message, submit disabled.
   - If **buyer** (`offer.type === 'sell'`): NO crypto gate. Disclose `fiatOwed = multiply(parsed.value, offer.unitPrice)` + `offer.fiatCurrency`, show the seller's `direccionFiat` and the chosen payment method as how they'll pay off-platform.
4. Payment-method `<select>` built from `offer.paymentMethods` (intersected with active `usePaymentMethods` if desired); required; `paymentMethodId` must be set to enable submit.
5. `youPay`/`youReceive` disclosure: seller pays `amount` crypto + receives `fiatOwed`; buyer pays `fiatOwed` fiat + receives `amount` crypto. Label with `formatDisplay`.
6. Submit → `useAcceptOffer().mutate({ offerId: offer.id, amount: parsed.value, paymentMethodId })`. **Button disabled while pending** (`loading={mutation.isPending}`) and whenever any gate fails. `retry:false` is set in the hook. On success → `onDone(tx)`. On error → render `tError(err.code, { requestId: err.requestId })`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AcceptOfferForm } from './AcceptOfferForm';

// mock queries: useAcceptOffer, usePaymentMethods, wallet balances; mock i18n to identity
// (follow the mocking style used in SwapForm.test.tsx / OrderForm.test.tsx)

const buyOffer = { id: 'o1', type: 'buy', cryptoId: 'c-btc', minAmount: '0.01', maxAmount: '2',
  unitPrice: '65000.0000', fiatCurrency: 'USD', direccionFiat: null, active: true,
  paymentMethods: [{ id: 'pm1', name: 'Bank', description: null, active: true }] } as any;
const sellOffer = { ...buyOffer, id: 'o2', type: 'sell', direccionFiat: 'acct-xyz' } as any;

beforeEach(() => vi.clearAllMocks());

describe('AcceptOfferForm money-path', () => {
  it('blocks submit when amount is below the offer minimum', () => {
    render(<AcceptOfferForm offer={buyOffer} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '0.001' } });
    fireEvent.change(screen.getByLabelText(/payment method/i), { target: { value: 'pm1' } });
    expect(screen.getByRole('button', { name: /accept/i })).toBeDisabled();
  });

  it('as seller (buy offer), blocks submit when Funding balance is insufficient', () => {
    // mock balances: Funding available for c-btc = '0.5'
    render(<AcceptOfferForm offer={buyOffer} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/payment method/i), { target: { value: 'pm1' } });
    expect(screen.getByRole('button', { name: /accept/i })).toBeDisabled();
    expect(screen.getByText(/insufficient|insuficient/i)).toBeInTheDocument();
  });

  it('as seller, blocks submit while the balance is still unknown', () => {
    // mock balances query: isLoading / data undefined
    render(<AcceptOfferForm offer={buyOffer} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/payment method/i), { target: { value: 'pm1' } });
    expect(screen.getByRole('button', { name: /accept/i })).toBeDisabled();
  });

  it('as buyer (sell offer), no crypto gate — discloses fiat owed and seller address, submit enabled', () => {
    render(<AcceptOfferForm offer={sellOffer} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/payment method/i), { target: { value: 'pm1' } });
    expect(screen.getByText(/65,?000|65000/)).toBeInTheDocument();   // fiat owed = 1 × 65000
    expect(screen.getByText(/acct-xyz/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept/i })).toBeEnabled();
  });

  it('submits amount as the canonical string and disables while pending', async () => {
    const mutate = vi.fn();
    // mock useAcceptOffer → { mutate, isPending:false }
    render(<AcceptOfferForm offer={sellOffer} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/amount/i), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText(/payment method/i), { target: { value: 'pm1' } });
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(mutate).toHaveBeenCalledWith({ offerId: 'o2', amount: '1.5', paymentMethodId: 'pm1' });
  });
});
```

- [ ] **Step 2: Run** `cd web && npx vitest run src/features/p2p/components/AcceptOfferForm.test.tsx` → FAIL.
- [ ] **Step 3: Implement** per the exact behavior above. Mirror `SwapForm.tsx` for the parse/compare/disabled wiring and the balances lookup. Never coerce money to `Number`. The submit disabled predicate: `!inRange || !paymentMethodId || (isSeller && (balanceUnknown || compare(requiredSpend, available) > 0)) || mutation.isPending`.
- [ ] **Step 4: Run** → PASS. Then full typecheck `cd web && npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add web/src/features/p2p/components/AcceptOfferForm.tsx web/src/features/p2p/components/AcceptOfferForm.test.tsx
git commit -m "feat(web): P2P accept-offer form with money-path gates (Slice 5 Task 6)"
```

---

### Task 7: MyTransactionsView (active + history, status + role)

**Files:**
- Create: `web/src/features/p2p/components/MyTransactionsView.tsx`
- Test: `web/src/features/p2p/components/MyTransactionsView.test.tsx`

**Interfaces:**
- Consumes: `useMyTransactions`, `useTranslation`.
- Produces: `<MyTransactionsView onSelect={(tx: Transaction) => void} />`. Lists `transacciones` with: crypto symbol (from `tx.crypto?.symbol`), `amount`, `fiatAmount` + `fiatCurrency`, a **status badge** (`p2p.status.*`), a **role chip** (`esComprador ? buyer : seller`), counterparty username, and created date. Pending ones highlighted. Row click → `onSelect(tx)`. Loading/empty/error states.

- [ ] **Step 1: Write the failing test** — two txs (one buyer initiated, one seller completed) render their status + role; click fires `onSelect`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** Display money via `formatDisplay`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**
```bash
git add web/src/features/p2p/components/MyTransactionsView.tsx web/src/features/p2p/components/MyTransactionsView.test.tsx
git commit -m "feat(web): P2P my-transactions list (Slice 5 Task 7)"
```

---

### Task 8: TransactionDetail — state machine + role-gated actions + typed 4xx

> **Money-path-adjacent (confirm/complete/cancel move locked funds). Reviewed carefully by the coordinator.**

**Files:**
- Create: `web/src/features/p2p/components/TransactionDetail.tsx`
- Test: `web/src/features/p2p/components/TransactionDetail.test.tsx`

**Interfaces:**
- Consumes: `useConfirmPayment`, `useCompleteTransaction`, `useCancelTransaction` (Task 2); `useTranslation`, `useErrorTranslation`; `Button`, `Dialog` (for the confirm prompt). Receives `tx: Transaction` and `currentUserId: string` (confirm how the app exposes the current user id — the `(app)` session/auth context; use that).
- Produces: `<TransactionDetail tx={tx} currentUserId={uid} onChanged={(tx: Transaction) => void} />`.

**Behavior (exact — derive gating from status + role, mirroring the backend):**
- `isBuyer = tx.buyerId === currentUserId`; `isSeller = tx.sellerId === currentUserId`.
- Show the state-machine progress (initiated → payment_confirmed → completed, or cancelled) and the money summary (`amount` crypto, `fiatAmount` fiat).
- **Actions available:**
  - `confirm-payment`: visible+enabled only when `isBuyer && tx.status === 'initiated'`.
  - `complete`: visible+enabled only when `isSeller && tx.status === 'payment_confirmed'`.
  - `cancel`: visible+enabled when `(isBuyer || isSeller) && (tx.status === 'initiated' || tx.status === 'payment_confirmed')`.
  - Terminal (`completed`/`cancelled`): no actions.
- Each action opens a confirm `Dialog` (irreversible money movement → confirm first), then fires the mutation. Button `loading` while pending; all action buttons disabled while any mutation is pending (no double-fire). On success → `onChanged(updatedTx)`. On error → render `tError(err.code, { requestId: err.requestId })` inline (the backend returns the typed 4xx, e.g. `P2P_TX_INVALID_STATE` on a stale state — surface it verbatim; this is the "typed 4xx recovery" requirement).

- [ ] **Step 1: Write the failing tests**

Cover the gating matrix and error surfacing:
```tsx
// buyer + initiated → confirm-payment shown, complete NOT shown, cancel shown
// seller + payment_confirmed → complete shown, confirm-payment NOT shown
// completed → no action buttons
// clicking complete opens Dialog, confirming fires useCompleteTransaction().mutate(tx.id)
// a mutation error with code P2P_TX_INVALID_STATE renders the mapped message
```
(Mock the three mutation hooks + i18n; follow `WithdrawForm.test.tsx` for the Dialog-confirm pattern.)

- [ ] **Step 2: Run** `cd web && npx vitest run src/features/p2p/components/TransactionDetail.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the gating exactly as above. Do NOT allow an action the status/role forbids even if a stale prop arrives — compute visibility from the current `tx`.
- [ ] **Step 4: Run** → PASS. Typecheck.
- [ ] **Step 5: Commit**
```bash
git add web/src/features/p2p/components/TransactionDetail.tsx web/src/features/p2p/components/TransactionDetail.test.tsx
git commit -m "feat(web): P2P transaction state-machine actions + typed 4xx (Slice 5 Task 8)"
```

---

### Task 9: CreateOfferForm (maker)

**Files:**
- Create: `web/src/features/p2p/components/CreateOfferForm.tsx`
- Test: `web/src/features/p2p/components/CreateOfferForm.test.tsx`

**Interfaces:**
- Consumes: `useCreateOffer`, `useCryptoCatalog`, `usePaymentMethods`, `useTranslation`, `useErrorTranslation`, `parseInput`/`compare` from `@/shared/money`, `Field`, `Button`.
- Produces: `<CreateOfferForm onCreated={(offer: Offer) => void} />`.

**Behavior:**
- Fields: `type` (buy/sell radio), `cryptoId` (select from catalog), `minAmount`, `maxAmount`, `unitPrice` (all parsed canonical strings), `fiatCurrency` (text, 3-letter), `metodosPagoIds` (multi-select from active payment methods, ≥1), `additionalTerms` (optional textarea), and `direccionFiat` (text; **required and shown only when `type === 'sell'`**, matching the backend rule).
- Client validation (advisory; server authoritative): each money field parses ok and `> 0`; `compare(minAmount, maxAmount) <= 0`; ≥1 payment method; sell ⇒ `direccionFiat` non-empty. Submit disabled until valid; disabled while pending.
- Submit → `useCreateOffer().mutate({...})` with money as strings. On success → `onCreated(offer)`. On error → `tError(err.code, { requestId })`.

- [ ] **Step 1: Write the failing tests** — sell shows+requires `direccionFiat`; buy hides it; `minAmount > maxAmount` disables submit; valid sell submits string money + `metodosPagoIds`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS. Typecheck.
- [ ] **Step 5: Commit**
```bash
git add web/src/features/p2p/components/CreateOfferForm.tsx web/src/features/p2p/components/CreateOfferForm.test.tsx
git commit -m "feat(web): P2P create-offer form (Slice 5 Task 9)"
```

---

### Task 10: MyOffersView (toggle active / deactivate)

**Files:**
- Create: `web/src/features/p2p/components/MyOffersView.tsx`
- Test: `web/src/features/p2p/components/MyOffersView.test.tsx`

**Interfaces:**
- Consumes: `useMyOffers`, `useToggleOffer`, `useDeleteOffer`, `useCryptoCatalog`, `useTranslation`, `useErrorTranslation`, `Button`, `Dialog`.
- Produces: `<MyOffersView />`. Lists my offers (active + inactive) with meta; a toggle to activate/deactivate (`useToggleOffer`) and a deactivate/delete action (`useDeleteOffer`) behind a confirm `Dialog`. Buttons disabled while pending; errors via `tError`.

- [ ] **Step 1: Write the failing test** — renders my offers; toggling an active offer calls `useToggleOffer().mutate({ id, active:false })`; deactivate opens Dialog then calls `useDeleteOffer().mutate(id)`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit**
```bash
git add web/src/features/p2p/components/MyOffersView.tsx web/src/features/p2p/components/MyOffersView.test.tsx
git commit -m "feat(web): P2P my-offers management (Slice 5 Task 10)"
```

---

### Task 11: P2P page shell + tabs + route + nav + barrel

**Files:**
- Create: `web/src/features/p2p/components/P2PTabs.tsx`
- Test: `web/src/features/p2p/components/P2PTabs.test.tsx`
- Create: `web/src/features/p2p/index.ts`
- Create: `web/src/app/(app)/p2p/page.tsx`
- Modify: the `(app)` nav/layout to add a `/p2p` link (find how `/swap` and `/trading` links were added in S3/S4 and mirror it)

**Interfaces:**
- Consumes: all components above; `useTranslation`.
- Produces: `<P2PPage />` (default export from `index.ts` or a named `P2PPage`) that holds a tab state over: **Browse** (`OffersList` → on select, show `OfferDetail` + `AcceptOfferForm` in a panel/Dialog; on accept-done, jump to the new transaction), **My transactions** (`MyTransactionsView` → on select, `TransactionDetail`), **My offers** (`MyOffersView`), **Create** (`CreateOfferForm` → on created, switch to My offers). Wire `currentUserId` from the `(app)` session context into `TransactionDetail`.

- [ ] **Step 1: Write the failing test** — `P2PTabs` renders four tab labels and switches panels on click (mock child components to simple stubs).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `P2PTabs`, `index.ts` barrel, and `page.tsx`:
```tsx
// web/src/app/(app)/p2p/page.tsx
'use client';
import { P2PPage } from '@/features/p2p';
export default function Page() { return <P2PPage />; }
```
Add the nav link (label key `p2p.nav` or reuse an existing nav pattern).
- [ ] **Step 4: Run** `cd web && npx vitest run src/features/p2p` (whole feature) → PASS. Then `cd web && npx tsc --noEmit` and `cd web && npm run build` — confirm the `/p2p` route builds.
- [ ] **Step 5: Commit**
```bash
git add web/src/features/p2p/components/P2PTabs.tsx web/src/features/p2p/components/P2PTabs.test.tsx web/src/features/p2p/index.ts "web/src/app/(app)/p2p/page.tsx" <the nav/layout file>
git commit -m "feat(web): P2P page shell, tabs, route + nav link (Slice 5 Task 11)"
```

---

### Task 12: Contract doc §21 + final slice gate

**Files:**
- Modify: `docs/frontend-rebuild/backend-contract-changes.md` (add §21)

- [ ] **Step 1:** Add **§21 — Next.js `web/` app — P2P endpoints consumed (Slice 5, 2026-10-11)** documenting: the legacy mount paths consumed (`/ofertaP2P*`, `/transaccionP2P*`, `/metodoPago/status/active`, `/crypto`); the offer + transaction shapes and the state machine; that `amount`/`unitPrice`/`minAmount`/`maxAmount` are sent as canonical strings; the fund-lock = seller's Funding; and the **known gap**: `POST /transaccionP2P` is NOT idempotency-guarded on the backend (client mitigates via disabled-while-pending + no-retry) — flag backend idempotency on P2P accept as a follow-up.
- [ ] **Step 2: Full gate** (run and paste output — no "looks done" without evidence):
```bash
cd web && npx tsc --noEmit && npx vitest run && npm run build
```
Expected: tsc 0 errors; all Vitest green (prior 231 + the new P2P tests); `next build` lists the `/p2p` route.
- [ ] **Step 3: Commit**
```bash
git add docs/frontend-rebuild/backend-contract-changes.md
git commit -m "docs: P2P contract §21 + Slice 5 gate (Slice 5 Task 12)"
```

---

## Self-Review

**Spec coverage** (sprint line "Offer/accept/payment/complete/cancel state machine; typed 4xx recovery"):
- Offer browse/detail → Tasks 4, 5. Offer create/manage (maker side) → Tasks 9, 10.
- Accept (opens tx, locks seller crypto) → Task 6 (money-path).
- Payment/complete/cancel state machine, role-gated → Task 8.
- Typed 4xx recovery → error catalog (Task 3) + surfacing in Tasks 6, 8, 9, 10.
- Route/nav/wiring → Task 11. Contract doc → Task 12.
- **Explicitly out of scope** (documented decisions, not gaps): ratings (`/valoracion`) — post-completion nicety, not in the sprint line; P2P admin ops (stats/force-status/check-timeouts) — belong to S7 (Admin); offer search/compatible endpoints — browse+filter covers the core; fr/it/pt locales — a separate sprint item. `can-accept` is advisory and folded into the client-side gates in Task 6 rather than called.

**Placeholder scan:** money-path tasks (6, 8) carry full test + behavior specs; display/transcription tasks (4,5,7,9,10,11) give exact shapes + interfaces + representative tests and point at the concrete existing files to mirror (SwapForm, WithdrawForm, trading list views) — consistent with how S3/S4 plans were written and executed.

**Type consistency:** `Offer`/`Transaction`/`PaymentMethod`/`CryptoRef` defined in Task 1 and consumed unchanged in 2–11. Query keys (`P2P_*`) defined in Task 2, referenced for invalidation. Mutation variable types: `AcceptOfferRequest`, `CreateOfferRequest`, `string` (tx id), `{id,active}` (toggle) — matched between `queries.ts` and the component call sites. Status/type unions (`TxStatus`, `OfferType`) are the single source for badges and gating.

**Money-path check:** every spend/compare uses `@/shared/money` strings; `amount`/`unitPrice`/`minAmount`/`maxAmount` are strings on the wire; sufficiency gate applies only when acceptor = seller (accept a `buy` offer) vs Funding available, blocks on unknown balance; double-submit guarded by disabled-while-pending + `retry:false`; no false idempotency (P2P isn't backend-guarded — documented, not hidden).
