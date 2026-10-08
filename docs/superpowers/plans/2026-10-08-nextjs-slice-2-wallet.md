# Next.js Migration — Slice 2 (Wallet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated wallet vertical in `web/` — compartmented balances (Funding/Spot, available/blocked/pending), Funding↔Spot transfer, deposit address + history, and on-chain withdrawal — consuming the REAL backend contract, so the first `dev→main` web merge delivers `login → real balances`.

**Architecture:** A `features/wallet` module mirroring `features/auth`: a typed `api.ts` over the existing `shared/api` client, TanStack Query v5 hooks in `queries.ts`, presentational components under `components/`, composed into client-rendered routes under `web/app/(app)/wallet/` behind the existing `(app)` auth guard. All money is the branded `CanonicalAmount` string from `shared/money`; the `shared/api` client already auto-attaches `Idempotency-Key` to the two money POSTs in this slice.

**Tech Stack:** Next 14.2.35 App Router (React 18), TypeScript, TanStack Query v5, Vitest + Testing Library, CSS modules.

## Global Constraints

- **Next 14.2.35 / React 18**, App Router, `output: standalone`. No React 19, no Next 16.
- **Money is `CanonicalAmount` (decimal string)** from `@/shared/money`. NEVER `Number`, `parseFloat`, or float math on money. Parse user input with `parseInput`/`parseInputToCanonical` (locale-aware, required `locale` option); display with `formatDisplay`; compare/add/subtract with the money helpers.
- **Backend contract = the real route files, NOT the stale contract-doc §9.** Authoritative shapes (verified in `backend/modules/balances/*` + `backend/modules/wallets/blockchainTransaction.*`):
  - `GET /balances/my/balances` → `BalanceEntry[]` with keys `userId`, `criptomonedaId`, `availableBalance`, `blockedBalance`, `pendingBalance`, `compartments.{funding:{available,blocked,pending}, spot:{available,blocked}}`, `crypto:{id,symbol,name,network,decimals}`. Raw array, NO `{success,data}` wrapper.
  - `POST /balances/my/transfer` body `{ cryptoId, amount, from:'funding'|'spot', to:'funding'|'spot' }` → `200 { message, data:{ from, to } }`.
  - `GET /transaccionBlockchain/deposit-address/:cryptoId` → `{ success, data:{ address, crypto, qrCode, derivationIndex, metadata:{ createdAt, network, confirmationsRequired }, mensaje } }`.
  - `POST /transaccionBlockchain/withdraw` body `{ cryptoId, amount, destinationAddress }` → `201 { success, message, data: <BlockchainTransaction> }`.
  - `GET /transaccionBlockchain/my` (query `type?`, `status?`, `cryptoId?`, `limit`, `offset`) → `{ success, data: <BlockchainTransaction[]> }`.
  - `BlockchainTransaction`: `{ id, userId, cryptoId, type:'deposit'|'withdrawal', amount:string, destinationAddress?:string, txHash?:string, confirmations:number, requiredConfirmations:number, status:'pending'|'processing'|'confirmed'|'completed'|'failed', createdAt:string }`.
- **Idempotency is automatic.** `shared/api/idempotency.ts` already matches `/balances/my/transfer` and `/transaccionBlockchain/withdraw` as money POSTs → the client attaches a UUID `Idempotency-Key`. DO NOT add client idempotency code or headers for these.
- **Errors**: canonical envelope `{ error:{ code, message, requestId } }` is decoded to `ApiError` by the client. Display user-facing errors via `tError(code)` from `useErrorTranslation()`. The form error helper is named **`showError`** (NOT `describe` — collides with the Vitest global).
- **i18n**: add keys under the flat `ui` map and codes under `errors` in BOTH `en.ts` and `es.ts`; keep byte-parity (same key set, same order). Accents are literal UTF-8.
- **Audit guards (money-path, non-negotiable):** (1) a money operation's submit control MUST be disabled while the mutation is pending (no double-submit); (2) NEVER conflate Funding and Spot — the transfer `from`/`to` must be distinct and the UI must label which compartment it reads/writes; (3) NEVER present `pending` balance as spendable — it is display-only; spendable = compartment `available`; (4) withdrawal reads **Funding** only.
- **Git**: explicit `git add <files>` per commit (never `git add -A`/`.`/`commit -am`). Conventional Commits in English, no Claude attribution.

---

### Task 1: Wallet types + typed API module

**Files:**
- Create: `web/src/features/wallet/types.ts`
- Create: `web/src/features/wallet/api.ts`
- Test: `web/src/features/wallet/api.test.ts`

**Interfaces:**
- Consumes: `apiClient` from `@/shared/api`; `CanonicalAmount` from `@/shared/money`.
- Produces:
  - Types: `Compartment = 'funding' | 'spot'`; `CryptoRef`; `BalanceEntry`; `CompartmentTransferRequest`; `CompartmentTransferResponse`; `DepositAddressResponse`; `WithdrawRequest`; `WithdrawResponse`; `WalletTxType`; `WalletTxStatus`; `BlockchainTransaction`; `TransactionHistoryResponse`; `TransactionHistoryParams`.
  - `walletApi` with: `getBalances(): Promise<BalanceEntry[]>`, `transferCompartments(data: CompartmentTransferRequest): Promise<CompartmentTransferResponse>`, `getDepositAddress(cryptoId: string): Promise<DepositAddressResponse>`, `withdraw(data: WithdrawRequest): Promise<WithdrawResponse>`, `getTransactions(params?: TransactionHistoryParams): Promise<BlockchainTransaction[]>`.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/features/wallet/api.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { walletApi } from './api';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );
}

describe('walletApi contract', () => {
  it('getBalances GETs /balances/my/balances and returns the raw array', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse([{ criptomonedaId: 'c1', availableBalance: '1' }]));
    const out = await walletApi.getBalances();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/balances/my/balances');
    expect(opts.method).toBe('GET');
    expect(Array.isArray(out)).toBe(true);
    expect(out[0].criptomonedaId).toBe('c1');
  });

  it('transferCompartments POSTs the English body {cryptoId,amount,from,to} with an Idempotency-Key', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ message: 'ok', data: { from: 'funding', to: 'spot' } }));
    await walletApi.transferCompartments({ cryptoId: 'c1', amount: '10', from: 'funding', to: 'spot' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/balances/my/transfer');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ cryptoId: 'c1', amount: '10', from: 'funding', to: 'spot' });
    expect(new Headers(opts.headers).get('Idempotency-Key')).toBeTruthy();
  });

  it('getDepositAddress GETs the per-crypto path and unwraps data', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ success: true, data: { address: 'bc1xyz', qrCode: 'BTC:bc1xyz', crypto: { symbol: 'BTC' } } }),
    );
    const out = await walletApi.getDepositAddress('c1');
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/transaccionBlockchain/deposit-address/c1');
    expect(out.address).toBe('bc1xyz');
    expect(out.qrCode).toBe('BTC:bc1xyz');
  });

  it('withdraw POSTs {cryptoId,amount,destinationAddress} with an Idempotency-Key and unwraps data', async () => {
    fetchMock.mockReturnValueOnce(
      jsonResponse({ success: true, message: 'ok', data: { id: 't1', status: 'pending', type: 'withdrawal' } }, 201),
    );
    const out = await walletApi.withdraw({ cryptoId: 'c1', amount: '0.5', destinationAddress: 'bc1dest' });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/transaccionBlockchain/withdraw');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ cryptoId: 'c1', amount: '0.5', destinationAddress: 'bc1dest' });
    expect(new Headers(opts.headers).get('Idempotency-Key')).toBeTruthy();
    expect(out.id).toBe('t1');
    expect(out.status).toBe('pending');
  });

  it('getTransactions GETs /transaccionBlockchain/my and unwraps the data array', async () => {
    fetchMock.mockReturnValueOnce(jsonResponse({ success: true, data: [{ id: 't1', type: 'deposit' }] }));
    const out = await walletApi.getTransactions();
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/transaccionBlockchain/my');
    expect(out[0].id).toBe('t1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/wallet/api.test.ts`
Expected: FAIL — `Cannot find module './api'`.

- [ ] **Step 3: Write the types module**

```ts
// web/src/features/wallet/types.ts
import type { CanonicalAmount } from '@/shared/money';

export type Compartment = 'funding' | 'spot';

export interface CryptoRef {
  id: string;
  symbol: string;
  name: string;
  network: string;
  decimals: number;
}

/** Shape of GET /balances/my/balances items (real backend keys, English). */
export interface BalanceEntry {
  userId: string;
  criptomonedaId: string;
  availableBalance: string; // funding.available + spot.available (format8)
  blockedBalance: string;
  pendingBalance: string; // Funding-only, DISPLAY-ONLY (never spendable)
  compartments: {
    funding: { available: string; blocked: string; pending: string };
    spot: { available: string; blocked: string };
  };
  crypto: CryptoRef | null;
}

export interface CompartmentTransferRequest {
  cryptoId: string;
  amount: string; // canonical decimal string
  from: Compartment;
  to: Compartment;
}

export interface CompartmentTransferResponse {
  message: string;
  data: { from: Compartment; to: Compartment };
}

export interface DepositAddressResponse {
  address: string;
  crypto: CryptoRef | Record<string, unknown>;
  qrCode: string;
  derivationIndex?: number;
  metadata: {
    createdAt?: string;
    network: string;
    confirmationsRequired: number;
  };
  mensaje: string;
}

export interface WithdrawRequest {
  cryptoId: string;
  amount: string;
  destinationAddress: string;
}

export type WalletTxType = 'deposit' | 'withdrawal';
export type WalletTxStatus = 'pending' | 'processing' | 'confirmed' | 'completed' | 'failed';

export interface BlockchainTransaction {
  id: string;
  userId: string;
  cryptoId: string;
  type: WalletTxType;
  amount: string;
  destinationAddress?: string;
  txHash?: string;
  confirmations: number;
  requiredConfirmations: number;
  status: WalletTxStatus;
  createdAt: string;
}

export type WithdrawResponse = BlockchainTransaction;

export interface TransactionHistoryParams {
  type?: WalletTxType;
  status?: WalletTxStatus;
  cryptoId?: string;
  limit?: number;
  offset?: number;
}

// Re-export for component call sites that build amounts.
export type { CanonicalAmount };
```

- [ ] **Step 4: Write the API module**

```ts
// web/src/features/wallet/api.ts
import { apiClient } from '@/shared/api';
import type {
  BalanceEntry,
  CompartmentTransferRequest,
  CompartmentTransferResponse,
  DepositAddressResponse,
  WithdrawRequest,
  WithdrawResponse,
  BlockchainTransaction,
  TransactionHistoryParams,
} from './types';

/** Backend envelope for the on-chain endpoints: { success, data, ... }. */
interface SuccessEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function buildQuery(params?: TransactionHistoryParams): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.status) q.set('status', params.status);
  if (params.cryptoId) q.set('cryptoId', params.cryptoId);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const walletApi = {
  // Raw array response (no envelope).
  getBalances: () => apiClient.get<BalanceEntry[]>('/balances/my/balances'),

  transferCompartments: (data: CompartmentTransferRequest) =>
    apiClient.post<CompartmentTransferResponse>('/balances/my/transfer', data),

  getDepositAddress: (cryptoId: string) =>
    apiClient
      .get<SuccessEnvelope<DepositAddressResponse>>(`/transaccionBlockchain/deposit-address/${cryptoId}`)
      .then((r) => r.data),

  withdraw: (data: WithdrawRequest) =>
    apiClient
      .post<SuccessEnvelope<WithdrawResponse>>('/transaccionBlockchain/withdraw', data)
      .then((r) => r.data),

  getTransactions: (params?: TransactionHistoryParams) =>
    apiClient
      .get<SuccessEnvelope<BlockchainTransaction[]>>(`/transaccionBlockchain/my${buildQuery(params)}`)
      .then((r) => r.data),
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/wallet/api.test.ts`
Expected: PASS (5/5).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/wallet/types.ts web/src/features/wallet/api.ts web/src/features/wallet/api.test.ts
git commit -m "feat(web): wallet typed API module + contract tests (Slice 2)"
```

---

### Task 2: Query hooks (TanStack Query v5)

**Files:**
- Create: `web/src/features/wallet/queries.ts`
- Test: `web/src/features/wallet/queries.test.tsx`

**Interfaces:**
- Consumes: `walletApi` (Task 1); `ApiError` from `@/shared/api`; TanStack Query.
- Produces: `WALLET_BALANCES_KEY`, `WALLET_TX_KEY`, `walletDepositKey(cryptoId)`; hooks `useMyBalances()`, `useCompartmentTransfer()`, `useDepositAddress(cryptoId, enabled)`, `useWithdraw()`, `useTransactionHistory(params)`. Both mutations invalidate `WALLET_BALANCES_KEY`; `useWithdraw` also invalidates `WALLET_TX_KEY`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/wallet/queries.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const getBalances = vi.fn();
const transferCompartments = vi.fn();
const withdraw = vi.fn();
const getTransactions = vi.fn();
const getDepositAddress = vi.fn();

vi.mock('./api', () => ({
  walletApi: { getBalances, transferCompartments, withdraw, getTransactions, getDepositAddress },
}));

import {
  useMyBalances,
  useCompartmentTransfer,
  useWithdraw,
  WALLET_BALANCES_KEY,
  WALLET_TX_KEY,
} from './queries';

function wrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  getBalances.mockReset();
  transferCompartments.mockReset();
  withdraw.mockReset();
  getTransactions.mockReset();
});

describe('wallet queries', () => {
  it('useMyBalances fetches balances', async () => {
    getBalances.mockResolvedValueOnce([{ criptomonedaId: 'c1' }]);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useMyBalances(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].criptomonedaId).toBe('c1');
  });

  it('useCompartmentTransfer invalidates the balances key on success', async () => {
    transferCompartments.mockResolvedValueOnce({ message: 'ok', data: { from: 'funding', to: 'spot' } });
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCompartmentTransfer(), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({ cryptoId: 'c1', amount: '10', from: 'funding', to: 'spot' });
    expect(spy).toHaveBeenCalledWith({ queryKey: WALLET_BALANCES_KEY });
  });

  it('useWithdraw invalidates both balances and tx keys on success', async () => {
    withdraw.mockResolvedValueOnce({ id: 't1', status: 'pending', type: 'withdrawal' });
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useWithdraw(), { wrapper: wrapper(qc) });
    await result.current.mutateAsync({ cryptoId: 'c1', amount: '0.5', destinationAddress: 'bc1dest' });
    expect(spy).toHaveBeenCalledWith({ queryKey: WALLET_BALANCES_KEY });
    expect(spy).toHaveBeenCalledWith({ queryKey: WALLET_TX_KEY });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/wallet/queries.test.tsx`
Expected: FAIL — `Cannot find module './queries'`.

- [ ] **Step 3: Write the hooks**

```ts
// web/src/features/wallet/queries.ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { walletApi } from './api';
import type {
  BalanceEntry,
  CompartmentTransferRequest,
  CompartmentTransferResponse,
  DepositAddressResponse,
  WithdrawRequest,
  WithdrawResponse,
  BlockchainTransaction,
  TransactionHistoryParams,
} from './types';

export const WALLET_BALANCES_KEY = ['wallet', 'balances'] as const;
export const WALLET_TX_KEY = ['wallet', 'transactions'] as const;
export const walletDepositKey = (cryptoId: string) => ['wallet', 'deposit-address', cryptoId] as const;

export function useMyBalances() {
  return useQuery<BalanceEntry[]>({
    queryKey: WALLET_BALANCES_KEY,
    queryFn: () => walletApi.getBalances(),
    staleTime: 15_000,
  });
}

export function useCompartmentTransfer() {
  const qc = useQueryClient();
  return useMutation<CompartmentTransferResponse, ApiError, CompartmentTransferRequest>({
    mutationFn: walletApi.transferCompartments,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WALLET_BALANCES_KEY });
    },
  });
}

export function useDepositAddress(cryptoId: string, enabled: boolean) {
  return useQuery<DepositAddressResponse>({
    queryKey: walletDepositKey(cryptoId),
    queryFn: () => walletApi.getDepositAddress(cryptoId),
    enabled: enabled && Boolean(cryptoId),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation<WithdrawResponse, ApiError, WithdrawRequest>({
    mutationFn: walletApi.withdraw,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WALLET_BALANCES_KEY });
      qc.invalidateQueries({ queryKey: WALLET_TX_KEY });
    },
  });
}

export function useTransactionHistory(params?: TransactionHistoryParams) {
  return useQuery<BlockchainTransaction[]>({
    queryKey: [...WALLET_TX_KEY, params ?? {}],
    queryFn: () => walletApi.getTransactions(params),
    staleTime: 15_000,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/wallet/queries.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add web/src/features/wallet/queries.ts web/src/features/wallet/queries.test.tsx
git commit -m "feat(web): wallet query hooks with money-mutation cache invalidation (Slice 2)"
```

---

### Task 3: i18n wallet keys + error codes

**Files:**
- Modify: `web/src/shared/i18n/catalogs/en.ts`
- Modify: `web/src/shared/i18n/catalogs/es.ts`
- Test: `web/src/features/wallet/i18nWalletKeys.test.ts` (create)

**Interfaces:**
- Produces: `ui` keys under the `wallet.*` namespace and 4 new `errors` codes, present and byte-parity in both catalogs.

**New `ui` keys (identical key set, both catalogs):**
`wallet.title`, `wallet.tab.balances`, `wallet.tab.deposit`, `wallet.tab.withdraw`, `wallet.tab.history`, `wallet.balances.crypto`, `wallet.balances.available`, `wallet.balances.blocked`, `wallet.balances.pending`, `wallet.balances.funding`, `wallet.balances.spot`, `wallet.balances.empty`, `wallet.balances.pendingHint`, `wallet.transfer.title`, `wallet.transfer.from`, `wallet.transfer.to`, `wallet.transfer.amount`, `wallet.transfer.submit`, `wallet.transfer.success`, `wallet.transfer.sameCompartment`, `wallet.transfer.insufficient`, `wallet.deposit.title`, `wallet.deposit.selectCrypto`, `wallet.deposit.address`, `wallet.deposit.copy`, `wallet.deposit.copied`, `wallet.deposit.confirmations`, `wallet.deposit.network`, `wallet.withdraw.title`, `wallet.withdraw.crypto`, `wallet.withdraw.amount`, `wallet.withdraw.address`, `wallet.withdraw.submit`, `wallet.withdraw.fundingOnly`, `wallet.withdraw.queued`, `wallet.history.title`, `wallet.history.empty`, `wallet.history.type`, `wallet.history.status`, `wallet.history.amount`, `wallet.history.date`, `wallet.history.confirmations`, `wallet.history.filterAll`, `wallet.history.filterDeposit`, `wallet.history.filterWithdrawal`.

**New `errors` codes (both catalogs):** `WITHDRAWAL_VALIDATION_FAILED`, `WITHDRAWAL_INVALID_ADDRESS`, `DEPOSIT_CRYPTO_NOT_FOUND`, `DEPOSIT_ADDRESS_GENERATION_FAILED`.

- [ ] **Step 1: Write the failing test**

```ts
// web/src/features/wallet/i18nWalletKeys.test.ts
import { describe, it, expect } from 'vitest';
import { en } from '@/shared/i18n/catalogs/en';
import { es } from '@/shared/i18n/catalogs/es';

const UI_KEYS = [
  'wallet.title', 'wallet.tab.balances', 'wallet.tab.deposit', 'wallet.tab.withdraw', 'wallet.tab.history',
  'wallet.balances.crypto', 'wallet.balances.available', 'wallet.balances.blocked', 'wallet.balances.pending',
  'wallet.balances.funding', 'wallet.balances.spot', 'wallet.balances.empty', 'wallet.balances.pendingHint',
  'wallet.transfer.title', 'wallet.transfer.from', 'wallet.transfer.to', 'wallet.transfer.amount',
  'wallet.transfer.submit', 'wallet.transfer.success', 'wallet.transfer.sameCompartment', 'wallet.transfer.insufficient',
  'wallet.deposit.title', 'wallet.deposit.selectCrypto', 'wallet.deposit.address', 'wallet.deposit.copy',
  'wallet.deposit.copied', 'wallet.deposit.confirmations', 'wallet.deposit.network',
  'wallet.withdraw.title', 'wallet.withdraw.crypto', 'wallet.withdraw.amount', 'wallet.withdraw.address',
  'wallet.withdraw.submit', 'wallet.withdraw.fundingOnly', 'wallet.withdraw.queued',
  'wallet.history.title', 'wallet.history.empty', 'wallet.history.type', 'wallet.history.status',
  'wallet.history.amount', 'wallet.history.date', 'wallet.history.confirmations',
  'wallet.history.filterAll', 'wallet.history.filterDeposit', 'wallet.history.filterWithdrawal',
];
const ERROR_CODES = [
  'WITHDRAWAL_VALIDATION_FAILED', 'WITHDRAWAL_INVALID_ADDRESS',
  'DEPOSIT_CRYPTO_NOT_FOUND', 'DEPOSIT_ADDRESS_GENERATION_FAILED',
];

describe('wallet i18n coverage', () => {
  it.each(UI_KEYS)('en+es define ui key %s non-empty', (k) => {
    expect(en.ui[k]).toBeTruthy();
    expect(es.ui[k]).toBeTruthy();
  });
  it.each(ERROR_CODES)('en+es define error code %s non-empty', (c) => {
    expect(en.errors[c]).toBeTruthy();
    expect(es.errors[c]).toBeTruthy();
  });
  it('en and es ui key sets are identical', () => {
    expect(Object.keys(en.ui).sort()).toEqual(Object.keys(es.ui).sort());
  });
  it('en and es error code sets are identical', () => {
    expect(Object.keys(en.errors).sort()).toEqual(Object.keys(es.errors).sort());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/wallet/i18nWalletKeys.test.ts`
Expected: FAIL — wallet keys undefined.

- [ ] **Step 3: Add the keys to `en.ts`**

In `web/src/shared/i18n/catalogs/en.ts`, append these entries inside the `ui: { ... }` object (after the existing auth keys, before the closing brace of `ui`):

```ts
    'wallet.title': 'Wallet',
    'wallet.tab.balances': 'Balances',
    'wallet.tab.deposit': 'Deposit',
    'wallet.tab.withdraw': 'Withdraw',
    'wallet.tab.history': 'History',
    'wallet.balances.crypto': 'Asset',
    'wallet.balances.available': 'Available',
    'wallet.balances.blocked': 'Blocked',
    'wallet.balances.pending': 'Pending',
    'wallet.balances.funding': 'Funding',
    'wallet.balances.spot': 'Spot',
    'wallet.balances.empty': 'You have no balances yet.',
    'wallet.balances.pendingHint': 'Pending funds are detected deposits awaiting confirmations. They are not spendable yet.',
    'wallet.transfer.title': 'Transfer between compartments',
    'wallet.transfer.from': 'From',
    'wallet.transfer.to': 'To',
    'wallet.transfer.amount': 'Amount',
    'wallet.transfer.submit': 'Transfer',
    'wallet.transfer.success': 'Transfer completed.',
    'wallet.transfer.sameCompartment': 'Choose two different compartments.',
    'wallet.transfer.insufficient': 'Insufficient available balance in the source compartment.',
    'wallet.deposit.title': 'Deposit',
    'wallet.deposit.selectCrypto': 'Select an asset',
    'wallet.deposit.address': 'Your deposit address',
    'wallet.deposit.copy': 'Copy',
    'wallet.deposit.copied': 'Copied',
    'wallet.deposit.confirmations': 'Confirmations required',
    'wallet.deposit.network': 'Network',
    'wallet.withdraw.title': 'Withdraw',
    'wallet.withdraw.crypto': 'Asset',
    'wallet.withdraw.amount': 'Amount',
    'wallet.withdraw.address': 'Destination address',
    'wallet.withdraw.submit': 'Withdraw',
    'wallet.withdraw.fundingOnly': 'Withdrawals use your Funding balance.',
    'wallet.withdraw.queued': 'Withdrawal requested. It will be processed after review.',
    'wallet.history.title': 'Transaction history',
    'wallet.history.empty': 'No transactions yet.',
    'wallet.history.type': 'Type',
    'wallet.history.status': 'Status',
    'wallet.history.amount': 'Amount',
    'wallet.history.date': 'Date',
    'wallet.history.confirmations': 'Confirmations',
    'wallet.history.filterAll': 'All',
    'wallet.history.filterDeposit': 'Deposits',
    'wallet.history.filterWithdrawal': 'Withdrawals',
```

And inside `errors: { ... }` (before its closing brace):

```ts
    'WITHDRAWAL_VALIDATION_FAILED': 'The withdrawal could not be validated. Check the amount and try again.',
    'WITHDRAWAL_INVALID_ADDRESS': 'The destination address is not valid for this network.',
    'DEPOSIT_CRYPTO_NOT_FOUND': 'That asset is unavailable for deposits.',
    'DEPOSIT_ADDRESS_GENERATION_FAILED': 'We could not generate a deposit address. Please try again later.',
```

- [ ] **Step 4: Add the matching keys to `es.ts`**

In `web/src/shared/i18n/catalogs/es.ts`, append the SAME `ui` keys with Spanish values, in the same order:

```ts
    'wallet.title': 'Billetera',
    'wallet.tab.balances': 'Balances',
    'wallet.tab.deposit': 'Depositar',
    'wallet.tab.withdraw': 'Retirar',
    'wallet.tab.history': 'Historial',
    'wallet.balances.crypto': 'Activo',
    'wallet.balances.available': 'Disponible',
    'wallet.balances.blocked': 'Bloqueado',
    'wallet.balances.pending': 'Pendiente',
    'wallet.balances.funding': 'Funding',
    'wallet.balances.spot': 'Spot',
    'wallet.balances.empty': 'Todavía no tenés balances.',
    'wallet.balances.pendingHint': 'Los fondos pendientes son depósitos detectados a la espera de confirmaciones. Todavía no se pueden gastar.',
    'wallet.transfer.title': 'Transferir entre compartimentos',
    'wallet.transfer.from': 'Desde',
    'wallet.transfer.to': 'Hacia',
    'wallet.transfer.amount': 'Monto',
    'wallet.transfer.submit': 'Transferir',
    'wallet.transfer.success': 'Transferencia completada.',
    'wallet.transfer.sameCompartment': 'Elegí dos compartimentos distintos.',
    'wallet.transfer.insufficient': 'Saldo disponible insuficiente en el compartimento de origen.',
    'wallet.deposit.title': 'Depositar',
    'wallet.deposit.selectCrypto': 'Elegí un activo',
    'wallet.deposit.address': 'Tu dirección de depósito',
    'wallet.deposit.copy': 'Copiar',
    'wallet.deposit.copied': 'Copiado',
    'wallet.deposit.confirmations': 'Confirmaciones requeridas',
    'wallet.deposit.network': 'Red',
    'wallet.withdraw.title': 'Retirar',
    'wallet.withdraw.crypto': 'Activo',
    'wallet.withdraw.amount': 'Monto',
    'wallet.withdraw.address': 'Dirección de destino',
    'wallet.withdraw.submit': 'Retirar',
    'wallet.withdraw.fundingOnly': 'Los retiros usan tu saldo de Funding.',
    'wallet.withdraw.queued': 'Retiro solicitado. Se procesará luego de la revisión.',
    'wallet.history.title': 'Historial de transacciones',
    'wallet.history.empty': 'Todavía no hay transacciones.',
    'wallet.history.type': 'Tipo',
    'wallet.history.status': 'Estado',
    'wallet.history.amount': 'Monto',
    'wallet.history.date': 'Fecha',
    'wallet.history.confirmations': 'Confirmaciones',
    'wallet.history.filterAll': 'Todas',
    'wallet.history.filterDeposit': 'Depósitos',
    'wallet.history.filterWithdrawal': 'Retiros',
```

And the SAME `errors` codes with Spanish values:

```ts
    'WITHDRAWAL_VALIDATION_FAILED': 'No se pudo validar el retiro. Revisá el monto e intentá de nuevo.',
    'WITHDRAWAL_INVALID_ADDRESS': 'La dirección de destino no es válida para esta red.',
    'DEPOSIT_CRYPTO_NOT_FOUND': 'Ese activo no está disponible para depósitos.',
    'DEPOSIT_ADDRESS_GENERATION_FAILED': 'No pudimos generar una dirección de depósito. Intentá más tarde.',
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/wallet/i18nWalletKeys.test.ts`
Expected: PASS. Then run the existing i18n parity test to confirm no regression: `cd web && npx vitest run src/shared/i18n`.

- [ ] **Step 6: Commit**

```bash
git add web/src/shared/i18n/catalogs/en.ts web/src/shared/i18n/catalogs/es.ts web/src/features/wallet/i18nWalletKeys.test.ts
git commit -m "feat(web): wallet i18n keys + error codes (en+es parity, Slice 2)"
```

---

### Task 4: Balances / compartments view

**Files:**
- Create: `web/src/features/wallet/components/BalancesView.tsx`
- Create: `web/src/features/wallet/components/wallet.module.css`
- Test: `web/src/features/wallet/components/BalancesView.test.tsx`

**Interfaces:**
- Consumes: `useMyBalances` (Task 2); `formatDisplay` from `@/shared/money`; `useTranslation` from `@/shared/i18n`.
- Produces: default-exported `BalancesView` React component. Renders one row per `BalanceEntry` with the Funding/Spot breakdown; shows the `pendingHint` and labels `pending` as non-spendable.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/wallet/components/BalancesView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import BalancesView from './BalancesView';

const useMyBalances = vi.fn();
vi.mock('../queries', () => ({ useMyBalances: () => useMyBalances() }));

function renderView() {
  return render(
    <LocaleProvider>
      <BalancesView />
    </LocaleProvider>,
  );
}

describe('BalancesView', () => {
  it('renders the per-compartment breakdown for each asset', () => {
    useMyBalances.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          userId: 'u1', criptomonedaId: 'c1',
          availableBalance: '500', blockedBalance: '0', pendingBalance: '10',
          compartments: {
            funding: { available: '300', blocked: '0', pending: '10' },
            spot: { available: '200', blocked: '0' },
          },
          crypto: { id: 'c1', symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 },
        },
      ],
    });
    renderView();
    expect(screen.getByText('BTC')).toBeInTheDocument();
    // Funding available 300 and Spot available 200 both shown.
    expect(screen.getByText(/300/)).toBeInTheDocument();
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no balances', () => {
    useMyBalances.mockReturnValue({ isLoading: false, isError: false, data: [] });
    renderView();
    expect(screen.getByText('You have no balances yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/wallet/components/BalancesView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the CSS module**

```css
/* web/src/features/wallet/components/wallet.module.css */
.panel { display: flex; flex-direction: column; gap: 1rem; }
.row {
  border: 1px solid var(--color-border, #2a2a2a);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.symbol { font-weight: 600; font-size: 1.1rem; }
.compartments { display: flex; gap: 2rem; flex-wrap: wrap; }
.compartment { display: flex; flex-direction: column; gap: 0.25rem; }
.label { font-size: 0.8rem; opacity: 0.7; }
.amount { font-variant-numeric: tabular-nums; }
.pending { opacity: 0.8; }
.hint { font-size: 0.8rem; opacity: 0.7; }
.empty { opacity: 0.7; padding: 2rem 0; text-align: center; }
.form { display: flex; flex-direction: column; gap: 1rem; max-width: 420px; }
.actions { display: flex; gap: 0.75rem; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--color-border, #2a2a2a); }
.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.tab { padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; background: transparent; border: 1px solid var(--color-border, #2a2a2a); color: inherit; }
.tabActive { background: var(--color-accent, #3b82f6); color: #fff; }
.code { font-family: monospace; word-break: break-all; }
```

- [ ] **Step 4: Write the component**

```tsx
// web/src/features/wallet/components/BalancesView.tsx
'use client';

import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useMyBalances } from '../queries';
import type { BalanceEntry } from '../types';
import styles from './wallet.module.css';

function fmt(amount: string, locale: string): string {
  return formatDisplay(amount, { locale, maxDecimals: 8, minDecimals: 2 });
}

export default function BalancesView() {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useMyBalances();

  if (isLoading) return <p>{t('common.loading')}</p>;
  if (isError) return <p role="alert">{t('wallet.balances.empty')}</p>;

  const entries: BalanceEntry[] = data ?? [];
  if (entries.length === 0) return <p className={styles.empty}>{t('wallet.balances.empty')}</p>;

  return (
    <div className={styles.panel}>
      {entries.map((e) => {
        const symbol = e.crypto?.symbol ?? e.criptomonedaId;
        return (
          <div className={styles.row} key={e.criptomonedaId}>
            <span className={styles.symbol}>{symbol}</span>
            <div className={styles.compartments}>
              <div className={styles.compartment}>
                <span className={styles.label}>{t('wallet.balances.funding')} · {t('wallet.balances.available')}</span>
                <span className={styles.amount}>{fmt(e.compartments.funding.available, locale)}</span>
                <span className={styles.label}>{t('wallet.balances.blocked')}</span>
                <span className={styles.amount}>{fmt(e.compartments.funding.blocked, locale)}</span>
                <span className={`${styles.label} ${styles.pending}`}>{t('wallet.balances.pending')}</span>
                <span className={`${styles.amount} ${styles.pending}`}>{fmt(e.compartments.funding.pending, locale)}</span>
              </div>
              <div className={styles.compartment}>
                <span className={styles.label}>{t('wallet.balances.spot')} · {t('wallet.balances.available')}</span>
                <span className={styles.amount}>{fmt(e.compartments.spot.available, locale)}</span>
                <span className={styles.label}>{t('wallet.balances.blocked')}</span>
                <span className={styles.amount}>{fmt(e.compartments.spot.blocked, locale)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <p className={styles.hint}>{t('wallet.balances.pendingHint')}</p>
    </div>
  );
}
```

> **Note on `useTranslation`:** confirm the hook exposes `t` and `locale`. If the existing `useTranslation` returns only `t`, read `locale` via `useLocale()` from `@/shared/i18n` instead and adjust imports. Verify against `web/src/shared/i18n/useTranslation.ts` before writing (do not assume).

> **Note on `formatDisplay` options:** confirm the `DisplayOptions` field names (`minDecimals`/`maxDecimals` vs other names) against `web/src/shared/money/money.ts:247` before writing; use the real field names.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/wallet/components/BalancesView.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add web/src/features/wallet/components/BalancesView.tsx web/src/features/wallet/components/wallet.module.css web/src/features/wallet/components/BalancesView.test.tsx
git commit -m "feat(web): wallet balances/compartments view (Slice 2)"
```

---

### Task 5: Funding↔Spot transfer form (MONEY MUTATION — reviewer: human/careful)

**Files:**
- Create: `web/src/features/wallet/components/CompartmentTransferForm.tsx`
- Test: `web/src/features/wallet/components/CompartmentTransferForm.test.tsx`

**Interfaces:**
- Consumes: `useCompartmentTransfer` (Task 2); `useMyBalances` (to read source `available`); `parseInput`, `compare`, `lte`, `gt` from `@/shared/money`; `useErrorTranslation` + `useTranslation`; `Button`, `Field` from `@/shared/ui`.
- Produces: default-exported `CompartmentTransferForm`. Props: `{ onSuccess?: () => void }`.

**Behavior (audit-critical):**
- `from` and `to` each one of `funding`/`spot`; selecting the same for both → inline `wallet.transfer.sameCompartment`, submit disabled.
- Amount parsed with `parseInput({ locale })`; invalid or `<= 0` → disable submit.
- Client pre-check: amount must be `<=` the source compartment's `available` for the selected crypto; otherwise inline `wallet.transfer.insufficient` (the real guard is the server ledger `FOR UPDATE` — this is UX only).
- Submit control disabled while `isPending` (no double-submit).
- Backend error → `showError` region via `tError(err.code)`.
- Success → reset + call `onSuccess`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/wallet/components/CompartmentTransferForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import CompartmentTransferForm from './CompartmentTransferForm';

const mutateAsync = vi.fn();
const useCompartmentTransfer = vi.fn();
const useMyBalances = vi.fn();

vi.mock('../queries', () => ({
  useCompartmentTransfer: () => useCompartmentTransfer(),
  useMyBalances: () => useMyBalances(),
}));

const BALANCE = [{
  criptomonedaId: 'c1',
  compartments: { funding: { available: '300', blocked: '0', pending: '0' }, spot: { available: '200', blocked: '0' } },
  crypto: { id: 'c1', symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 },
}];

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue({ message: 'ok', data: { from: 'funding', to: 'spot' } });
  useCompartmentTransfer.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null });
  useMyBalances.mockReturnValue({ data: BALANCE });
});

function setup() {
  return render(<LocaleProvider><CompartmentTransferForm /></LocaleProvider>);
}

describe('CompartmentTransferForm', () => {
  it('submits {cryptoId,amount,from,to} with distinct compartments', async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Asset|Activo/i), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/^From$|^Desde$/i), { target: { value: 'funding' } });
    fireEvent.change(screen.getByLabelText(/^To$|^Hacia$/i), { target: { value: 'spot' } });
    fireEvent.change(screen.getByLabelText(/Amount|Monto/i), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /Transfer|Transferir/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ cryptoId: 'c1', amount: '100', from: 'funding', to: 'spot' }));
  });

  it('blocks submit when amount exceeds source available', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Asset|Activo/i), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/^From$|^Desde$/i), { target: { value: 'funding' } });
    fireEvent.change(screen.getByLabelText(/^To$|^Hacia$/i), { target: { value: 'spot' } });
    fireEvent.change(screen.getByLabelText(/Amount|Monto/i), { target: { value: '9999' } });
    expect(screen.getByText(/Insufficient|insuficiente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transfer|Transferir/i })).toBeDisabled();
  });

  it('does not submit twice while pending', () => {
    useCompartmentTransfer.mockReturnValue({ mutateAsync, isPending: true, isError: false, error: null });
    setup();
    expect(screen.getByRole('button', { name: /Transfer|Transferir/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/wallet/components/CompartmentTransferForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// web/src/features/wallet/components/CompartmentTransferForm.tsx
'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useCompartmentTransfer, useMyBalances } from '../queries';
import type { BalanceEntry, Compartment } from '../types';
import styles from './wallet.module.css';

export default function CompartmentTransferForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const transfer = useCompartmentTransfer();
  const { data } = useMyBalances();
  const balances: BalanceEntry[] = data ?? [];

  const [cryptoId, setCryptoId] = useState('');
  const [from, setFrom] = useState<Compartment>('funding');
  const [to, setTo] = useState<Compartment>('spot');
  const [amount, setAmount] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const parsed = useMemo(() => parseInput(amount, { locale }), [amount, locale]);
  const amountOk = parsed.ok && compare(parsed.value, '0') > 0;
  const sameCompartment = from === to;

  const sourceAvailable = useMemo(() => {
    const entry = balances.find((b) => b.criptomonedaId === cryptoId);
    if (!entry) return null;
    return from === 'funding' ? entry.compartments.funding.available : entry.compartments.spot.available;
  }, [balances, cryptoId, from]);

  const exceedsAvailable = amountOk && sourceAvailable != null && compare(parsed.value, sourceAvailable) > 0;

  const canSubmit =
    Boolean(cryptoId) && amountOk && !sameCompartment && !exceedsAvailable && !transfer.isPending;

  const showError = (msg: string) => (
    <p role="alert" className={styles.label}>{msg}</p>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!canSubmit || !parsed.ok) return;
    try {
      await transfer.mutateAsync({ cryptoId, amount: parsed.value, from, to });
      setAmount('');
      onSuccess?.();
    } catch {
      // error surfaced via transfer.error below
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2>{t('wallet.transfer.title')}</h2>

      <Field label={t('wallet.balances.crypto')} htmlFor="transfer-crypto">
        <select id="transfer-crypto" value={cryptoId} onChange={(e) => setCryptoId(e.target.value)}>
          <option value="">{t('wallet.deposit.selectCrypto')}</option>
          {balances.map((b) => (
            <option key={b.criptomonedaId} value={b.criptomonedaId}>
              {b.crypto?.symbol ?? b.criptomonedaId}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('wallet.transfer.from')} htmlFor="transfer-from">
        <select id="transfer-from" value={from} onChange={(e) => setFrom(e.target.value as Compartment)}>
          <option value="funding">{t('wallet.balances.funding')}</option>
          <option value="spot">{t('wallet.balances.spot')}</option>
        </select>
      </Field>

      <Field label={t('wallet.transfer.to')} htmlFor="transfer-to">
        <select id="transfer-to" value={to} onChange={(e) => setTo(e.target.value as Compartment)}>
          <option value="funding">{t('wallet.balances.funding')}</option>
          <option value="spot">{t('wallet.balances.spot')}</option>
        </select>
      </Field>

      <Field label={t('wallet.transfer.amount')} htmlFor="transfer-amount">
        <input
          id="transfer-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoComplete="off"
        />
      </Field>

      {sameCompartment && showError(t('wallet.transfer.sameCompartment'))}
      {exceedsAvailable && showError(t('wallet.transfer.insufficient'))}
      {transfer.isError && transfer.error && showError(tError(transfer.error.code))}
      {localError && showError(localError)}

      <div className={styles.actions}>
        <Button type="submit" disabled={!canSubmit} loading={transfer.isPending}>
          {t('wallet.transfer.submit')}
        </Button>
      </div>
    </form>
  );
}
```

> **Note:** Verify the `Field` and `Button` prop contracts against `web/src/shared/ui/Field/Field.tsx` and `Button/Button.tsx` before writing (label/htmlFor for Field; `loading`/`disabled` for Button). Match the exact props used by the auth forms (see `LoginForm.tsx`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/wallet/components/CompartmentTransferForm.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add web/src/features/wallet/components/CompartmentTransferForm.tsx web/src/features/wallet/components/CompartmentTransferForm.test.tsx
git commit -m "feat(web): Funding<->Spot transfer form with double-submit + compartment guards (Slice 2)"
```

---

### Task 6: Deposit address view

**Files:**
- Create: `web/src/features/wallet/components/DepositView.tsx`
- Test: `web/src/features/wallet/components/DepositView.test.tsx`

**Interfaces:**
- Consumes: `useMyBalances` (asset list), `useDepositAddress` (Task 2); `useTranslation`, `useErrorTranslation`; `Button`.
- Produces: default-exported `DepositView`. User selects an asset → fetch + display address, `confirmationsRequired`, network, and a copy button.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/wallet/components/DepositView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import DepositView from './DepositView';

const useMyBalances = vi.fn();
const useDepositAddress = vi.fn();
vi.mock('../queries', () => ({
  useMyBalances: () => useMyBalances(),
  useDepositAddress: (id: string, enabled: boolean) => useDepositAddress(id, enabled),
}));

beforeEach(() => {
  useMyBalances.mockReturnValue({ data: [{ criptomonedaId: 'c1', crypto: { id: 'c1', symbol: 'BTC', network: 'bitcoin' } }] });
  useDepositAddress.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null });
});

function setup() {
  return render(<LocaleProvider><DepositView /></LocaleProvider>);
}

describe('DepositView', () => {
  it('shows the address once an asset is selected and the query resolves', () => {
    useDepositAddress.mockReturnValue({
      data: { address: 'bc1qexample', qrCode: 'BTC:bc1qexample', metadata: { network: 'bitcoin', confirmationsRequired: 3 }, crypto: {}, mensaje: '' },
      isLoading: false, isError: false, error: null,
    });
    setup();
    fireEvent.change(screen.getByLabelText(/Asset|Activo/i), { target: { value: 'c1' } });
    expect(screen.getByText('bc1qexample')).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/wallet/components/DepositView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// web/src/features/wallet/components/DepositView.tsx
'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useMyBalances, useDepositAddress } from '../queries';
import type { BalanceEntry } from '../types';
import styles from './wallet.module.css';

export default function DepositView() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const { data } = useMyBalances();
  const balances: BalanceEntry[] = data ?? [];

  const [cryptoId, setCryptoId] = useState('');
  const [copied, setCopied] = useState(false);
  const deposit = useDepositAddress(cryptoId, Boolean(cryptoId));

  async function copy(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className={styles.form}>
      <h2>{t('wallet.deposit.title')}</h2>

      <Field label={t('wallet.balances.crypto')} htmlFor="deposit-crypto">
        <select id="deposit-crypto" value={cryptoId} onChange={(e) => { setCryptoId(e.target.value); setCopied(false); }}>
          <option value="">{t('wallet.deposit.selectCrypto')}</option>
          {balances.map((b) => (
            <option key={b.criptomonedaId} value={b.criptomonedaId}>{b.crypto?.symbol ?? b.criptomonedaId}</option>
          ))}
        </select>
      </Field>

      {deposit.isLoading && <p>{t('common.loading')}</p>}
      {deposit.isError && deposit.error && <p role="alert">{tError(deposit.error.code)}</p>}

      {deposit.data && (
        <div className={styles.row}>
          <span className={styles.label}>{t('wallet.deposit.address')}</span>
          <span className={styles.code}>{deposit.data.address}</span>
          <span className={styles.label}>{t('wallet.deposit.network')}: {deposit.data.metadata.network}</span>
          <span className={styles.label}>
            {t('wallet.deposit.confirmations')}: {deposit.data.metadata.confirmationsRequired}
          </span>
          <div className={styles.actions}>
            <Button type="button" onClick={() => copy(deposit.data!.address)}>
              {copied ? t('wallet.deposit.copied') : t('wallet.deposit.copy')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/wallet/components/DepositView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/wallet/components/DepositView.tsx web/src/features/wallet/components/DepositView.test.tsx
git commit -m "feat(web): deposit address view with copy + confirmations (Slice 2)"
```

---

### Task 7: Withdrawal form (MONEY MUTATION — reviewer: human/careful)

**Files:**
- Create: `web/src/features/wallet/components/WithdrawForm.tsx`
- Test: `web/src/features/wallet/components/WithdrawForm.test.tsx`

**Interfaces:**
- Consumes: `useWithdraw` (Task 2); `useMyBalances` (Funding available); `parseInput`, `compare`; `useTranslation`, `useErrorTranslation`; `Button`, `Field`.
- Produces: default-exported `WithdrawForm`. Props `{ onSuccess?: () => void }`.

**Behavior (audit-critical):**
- Reads **Funding** `available` only for the client-side sufficiency hint (withdrawals are Funding-only — render `wallet.withdraw.fundingOnly`).
- Amount via `parseInput`; `destinationAddress` non-empty; submit disabled when invalid, exceeds Funding available, or `isPending` (no double-submit).
- On success → show `wallet.withdraw.queued`, reset, `onSuccess`.
- Errors by code via `tError`: `WITHDRAWAL_COOLDOWN` (403), `WITHDRAWAL_INVALID_ADDRESS`, `WITHDRAWAL_VALIDATION_FAILED`, `BALANCE_INSUFFICIENT`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/wallet/components/WithdrawForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import WithdrawForm from './WithdrawForm';

const mutateAsync = vi.fn();
const useWithdraw = vi.fn();
const useMyBalances = vi.fn();
vi.mock('../queries', () => ({
  useWithdraw: () => useWithdraw(),
  useMyBalances: () => useMyBalances(),
}));

const BALANCE = [{
  criptomonedaId: 'c1',
  compartments: { funding: { available: '5', blocked: '0', pending: '0' }, spot: { available: '0', blocked: '0' } },
  crypto: { id: 'c1', symbol: 'BTC', network: 'bitcoin' },
}];

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue({ id: 't1', status: 'pending', type: 'withdrawal' });
  useWithdraw.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null, isSuccess: false });
  useMyBalances.mockReturnValue({ data: BALANCE });
});

function setup() {
  return render(<LocaleProvider><WithdrawForm /></LocaleProvider>);
}

describe('WithdrawForm', () => {
  it('submits {cryptoId,amount,destinationAddress}', async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Asset|Activo/i), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/Amount|Monto/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/address|Dirección/i), { target: { value: 'bc1dest' } });
    fireEvent.click(screen.getByRole('button', { name: /Withdraw|Retirar/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ cryptoId: 'c1', amount: '1', destinationAddress: 'bc1dest' }));
  });

  it('disables submit while pending (no double-submit)', () => {
    useWithdraw.mockReturnValue({ mutateAsync, isPending: true, isError: false, error: null, isSuccess: false });
    setup();
    expect(screen.getByRole('button', { name: /Withdraw|Retirar/i })).toBeDisabled();
  });

  it('shows the coded cooldown error', () => {
    useWithdraw.mockReturnValue({
      mutateAsync, isPending: false, isSuccess: false,
      isError: true, error: { code: 'WITHDRAWAL_COOLDOWN' },
    });
    setup();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/wallet/components/WithdrawForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// web/src/features/wallet/components/WithdrawForm.tsx
'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useWithdraw, useMyBalances } from '../queries';
import type { BalanceEntry } from '../types';
import styles from './wallet.module.css';

export default function WithdrawForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const withdraw = useWithdraw();
  const { data } = useMyBalances();
  const balances: BalanceEntry[] = data ?? [];

  const [cryptoId, setCryptoId] = useState('');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');

  const parsed = useMemo(() => parseInput(amount, { locale }), [amount, locale]);
  const amountOk = parsed.ok && compare(parsed.value, '0') > 0;
  const addressOk = address.trim().length > 0;

  const fundingAvailable = useMemo(() => {
    const entry = balances.find((b) => b.criptomonedaId === cryptoId);
    return entry ? entry.compartments.funding.available : null;
  }, [balances, cryptoId]);

  const exceeds = amountOk && fundingAvailable != null && compare(parsed.value, fundingAvailable) > 0;
  const canSubmit = Boolean(cryptoId) && amountOk && addressOk && !exceeds && !withdraw.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsed.ok) return;
    try {
      await withdraw.mutateAsync({ cryptoId, amount: parsed.value, destinationAddress: address.trim() });
      setAmount('');
      setAddress('');
      onSuccess?.();
    } catch {
      // surfaced below
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2>{t('wallet.withdraw.title')}</h2>
      <p className={styles.label}>{t('wallet.withdraw.fundingOnly')}</p>

      <Field label={t('wallet.withdraw.crypto')} htmlFor="wd-crypto">
        <select id="wd-crypto" value={cryptoId} onChange={(e) => setCryptoId(e.target.value)}>
          <option value="">{t('wallet.deposit.selectCrypto')}</option>
          {balances.map((b) => (
            <option key={b.criptomonedaId} value={b.criptomonedaId}>{b.crypto?.symbol ?? b.criptomonedaId}</option>
          ))}
        </select>
      </Field>

      <Field label={t('wallet.withdraw.amount')} htmlFor="wd-amount">
        <input id="wd-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" />
      </Field>

      <Field label={t('wallet.withdraw.address')} htmlFor="wd-address">
        <input id="wd-address" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="off" />
      </Field>

      {exceeds && <p role="alert" className={styles.label}>{t('wallet.transfer.insufficient')}</p>}
      {withdraw.isError && withdraw.error && <p role="alert" className={styles.label}>{tError(withdraw.error.code)}</p>}
      {withdraw.isSuccess && <p role="status" className={styles.label}>{t('wallet.withdraw.queued')}</p>}

      <div className={styles.actions}>
        <Button type="submit" disabled={!canSubmit} loading={withdraw.isPending}>
          {t('wallet.withdraw.submit')}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/wallet/components/WithdrawForm.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add web/src/features/wallet/components/WithdrawForm.tsx web/src/features/wallet/components/WithdrawForm.test.tsx
git commit -m "feat(web): on-chain withdrawal form (Funding-only, guard states, no double-submit) (Slice 2)"
```

---

### Task 8: Transaction history view

**Files:**
- Create: `web/src/features/wallet/components/HistoryView.tsx`
- Test: `web/src/features/wallet/components/HistoryView.test.tsx`

**Interfaces:**
- Consumes: `useTransactionHistory` (Task 2); `formatDisplay`; `useTranslation`.
- Produces: default-exported `HistoryView`. Renders a table of transactions with a type filter (all/deposit/withdrawal); shows status and confirmations.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/wallet/components/HistoryView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import HistoryView from './HistoryView';

const useTransactionHistory = vi.fn();
vi.mock('../queries', () => ({ useTransactionHistory: (p: unknown) => useTransactionHistory(p) }));

beforeEach(() => {
  useTransactionHistory.mockReturnValue({
    data: [
      { id: 't1', type: 'withdrawal', status: 'pending', amount: '0.5', confirmations: 0, requiredConfirmations: 6, createdAt: '2026-10-08T00:00:00Z', cryptoId: 'c1', userId: 'u1' },
    ],
    isLoading: false, isError: false,
  });
});

function setup() {
  return render(<LocaleProvider><HistoryView /></LocaleProvider>);
}

describe('HistoryView', () => {
  it('renders a transaction row with its status', () => {
    setup();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    expect(screen.getByText(/withdrawal/i)).toBeInTheDocument();
  });

  it('changing the filter re-queries with a type param', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Type|Tipo/i), { target: { value: 'deposit' } });
    expect(useTransactionHistory).toHaveBeenLastCalledWith({ type: 'deposit' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/wallet/components/HistoryView.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// web/src/features/wallet/components/HistoryView.tsx
'use client';

import { useState } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useTransactionHistory } from '../queries';
import type { WalletTxType, TransactionHistoryParams } from '../types';
import styles from './wallet.module.css';

export default function HistoryView() {
  const { t, locale } = useTranslation();
  const [filter, setFilter] = useState<'' | WalletTxType>('');
  const params: TransactionHistoryParams | undefined = filter ? { type: filter } : undefined;
  const { data, isLoading, isError } = useTransactionHistory(params);

  const rows = data ?? [];

  return (
    <div className={styles.panel}>
      <h2>{t('wallet.history.title')}</h2>

      <label htmlFor="history-filter" className={styles.label}>{t('wallet.history.type')}</label>
      <select id="history-filter" value={filter} onChange={(e) => setFilter(e.target.value as '' | WalletTxType)}>
        <option value="">{t('wallet.history.filterAll')}</option>
        <option value="deposit">{t('wallet.history.filterDeposit')}</option>
        <option value="withdrawal">{t('wallet.history.filterWithdrawal')}</option>
      </select>

      {isLoading && <p>{t('common.loading')}</p>}
      {isError && <p role="alert">{t('wallet.history.empty')}</p>}
      {!isLoading && !isError && rows.length === 0 && <p className={styles.empty}>{t('wallet.history.empty')}</p>}

      {rows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('wallet.history.type')}</th>
              <th>{t('wallet.history.status')}</th>
              <th>{t('wallet.history.amount')}</th>
              <th>{t('wallet.history.confirmations')}</th>
              <th>{t('wallet.history.date')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.type}</td>
                <td>{tx.status}</td>
                <td className={styles.amount}>{formatDisplay(tx.amount, { locale, maxDecimals: 8, minDecimals: 2 })}</td>
                <td>{tx.confirmations}/{tx.requiredConfirmations}</td>
                <td>{new Date(tx.createdAt).toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/wallet/components/HistoryView.test.tsx`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add web/src/features/wallet/components/HistoryView.tsx web/src/features/wallet/components/HistoryView.test.tsx
git commit -m "feat(web): wallet transaction history view with type filter (Slice 2)"
```

---

### Task 9: Wallet barrel + page composition under the (app) guard

**Files:**
- Create: `web/src/features/wallet/index.ts`
- Create: `web/src/features/wallet/components/WalletTabs.tsx`
- Create: `web/app/(app)/wallet/page.tsx`
- Test: `web/src/features/wallet/components/WalletTabs.test.tsx`

**Interfaces:**
- Consumes: the five views (Tasks 4–8); `useTranslation`.
- Produces: `WalletTabs` (client component switching between Balances/Deposit/Withdraw/History); the barrel re-exports the hooks, `walletApi`, types, and `WalletTabs`; the route renders `WalletTabs`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/features/wallet/components/WalletTabs.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';

vi.mock('../queries', () => ({
  useMyBalances: () => ({ data: [], isLoading: false, isError: false }),
  useTransactionHistory: () => ({ data: [], isLoading: false, isError: false }),
  useDepositAddress: () => ({ data: undefined, isLoading: false, isError: false, error: null }),
  useCompartmentTransfer: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
  useWithdraw: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null, isSuccess: false }),
}));

import WalletTabs from './WalletTabs';

function setup() {
  return render(<LocaleProvider><WalletTabs /></LocaleProvider>);
}

describe('WalletTabs', () => {
  it('shows balances by default and switches to withdraw', () => {
    setup();
    expect(screen.getByText('You have no balances yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Withdraw|Retirar/i }));
    expect(screen.getByRole('heading', { name: /Withdraw|Retirar/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/wallet/components/WalletTabs.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `WalletTabs`**

```tsx
// web/src/features/wallet/components/WalletTabs.tsx
'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import BalancesView from './BalancesView';
import DepositView from './DepositView';
import WithdrawForm from './WithdrawForm';
import HistoryView from './HistoryView';
import CompartmentTransferForm from './CompartmentTransferForm';
import styles from './wallet.module.css';

type Tab = 'balances' | 'deposit' | 'withdraw' | 'history';

export default function WalletTabs() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('balances');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'balances', label: t('wallet.tab.balances') },
    { id: 'deposit', label: t('wallet.tab.deposit') },
    { id: 'withdraw', label: t('wallet.tab.withdraw') },
    { id: 'history', label: t('wallet.tab.history') },
  ];

  return (
    <section>
      <h1>{t('wallet.title')}</h1>
      <div className={styles.tabs} role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            role="tab"
            aria-selected={tab === tb.id}
            className={`${styles.tab} ${tab === tb.id ? styles.tabActive : ''}`}
            onClick={() => setTab(tb.id)}
            type="button"
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'balances' && (
        <>
          <BalancesView />
          <CompartmentTransferForm />
        </>
      )}
      {tab === 'deposit' && <DepositView />}
      {tab === 'withdraw' && <WithdrawForm />}
      {tab === 'history' && <HistoryView />}
    </section>
  );
}
```

- [ ] **Step 4: Write the barrel and the route**

```ts
// web/src/features/wallet/index.ts
export { walletApi } from './api';
export * from './types';
export {
  useMyBalances,
  useCompartmentTransfer,
  useDepositAddress,
  useWithdraw,
  useTransactionHistory,
  WALLET_BALANCES_KEY,
  WALLET_TX_KEY,
} from './queries';
export { default as WalletTabs } from './components/WalletTabs';
```

```tsx
// web/app/(app)/wallet/page.tsx
import { WalletTabs } from '@/features/wallet';

export default function WalletPage() {
  return <WalletTabs />;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/features/wallet/components/WalletTabs.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/features/wallet/index.ts web/src/features/wallet/components/WalletTabs.tsx web/app/(app)/wallet/page.tsx web/src/features/wallet/components/WalletTabs.test.tsx
git commit -m "feat(web): wallet page composition under (app) guard with tabs (Slice 2)"
```

---

### Task 10: Add a wallet link to the (app) chrome

**Files:**
- Modify: `web/app/(app)/layout.tsx` (add a nav link to `/wallet`; keep the existing guard intact)
- Test: extend/confirm `web/app/(app)/guard.test.tsx` still passes.

**Interfaces:**
- Consumes: the existing `(app)` layout + client guard.
- Produces: a navigable link to `/wallet` from the authenticated chrome. Do NOT change the guard logic.

- [ ] **Step 1: Read the current layout**

Run: review `web/app/(app)/layout.tsx` to find where chrome/nav renders and confirm the guard seam (`session.hasToken()` / `useCurrentUser`). Match the existing structure; do not alter the SSR-safe guard.

- [ ] **Step 2: Add the link**

Add a `<Link href="/wallet">` (using `next/link`) to the authenticated nav area. Use the i18n key `wallet.title` for the label via the existing translation hook in that file (or a plain string if the layout is a server component — match whatever the file already does for nav labels).

- [ ] **Step 3: Run the guard test + typecheck**

Run: `cd web && npx vitest run "app/(app)/guard.test.tsx" && npx tsc --noEmit`
Expected: PASS, 0 type errors.

- [ ] **Step 4: Commit**

```bash
git add "web/app/(app)/layout.tsx"
git commit -m "feat(web): link wallet from the authenticated chrome (Slice 2)"
```

---

### Task 11: Build gate + contract-doc fix (gate task)

**Files:**
- Modify: `docs/frontend-rebuild/backend-contract-changes.md` (fix the stale §9 shapes; add a §18 wallet consumer note)
- No source changes beyond what earlier tasks produced.

**Interfaces:**
- Consumes: the whole slice.
- Produces: a green gate (typecheck + full Vitest + `next build`) and a corrected contract doc.

- [ ] **Step 1: Correct the stale contract doc**

In `docs/frontend-rebuild/backend-contract-changes.md`, update the Funding↔Spot transfer section (currently documenting `{ criptomonedaId, cantidad, origen, destino }` and `compartimentos/disponible/bloqueado/pendiente`) to the REAL English shapes verified in the route/controller:
- `GET /balances/my/balances` item keys: `availableBalance`, `blockedBalance`, `pendingBalance`, `compartments.{funding:{available,blocked,pending}, spot:{available,blocked}}`, `crypto`, and the id field `criptomonedaId`.
- `POST /balances/my/transfer` body: `{ cryptoId, amount, from, to }` with `from`/`to` ∈ `funding`/`spot`, distinct; response `{ message, data:{ from, to } }`.
Add a short note that the previous Spanish field names in this doc were stale relative to the post-rename code, and that the client (Slice 2) consumes the English shapes.

- [ ] **Step 2: Add a §18 wallet consumer note**

Append a section documenting that `web/` Slice 2 consumes: `GET /balances/my/balances`, `POST /balances/my/transfer`, `GET /transaccionBlockchain/deposit-address/:cryptoId`, `POST /transaccionBlockchain/withdraw`, `GET /transaccionBlockchain/my`; that the on-chain endpoints use the `{ success, data }` envelope while balances return raw arrays; and that idempotency is auto-attached for the two money POSTs.

- [ ] **Step 3: Run the full gate**

Run (from `web/`):
```bash
cd web && npx tsc --noEmit && npx vitest run && npx next build
```
Expected: 0 type errors; all Vitest files pass (Slice 1's 103 + the new wallet tests); `next build` succeeds and lists `/wallet` among the routes.

- [ ] **Step 4: Commit**

```bash
git add docs/frontend-rebuild/backend-contract-changes.md
git commit -m "docs(web): correct stale balances/transfer contract + Slice 2 wallet consumer note"
```

---

### Task 12: Playwright E2E — wallet golden flows (optional if disk-constrained)

**Files:**
- Modify: `web/e2e/wallet.spec.ts` (create)

**Interfaces:**
- Consumes: the running Next dev/build server; `page.route` stubs for `/api/*`.
- Produces: 2 golden flows — (1) view balances → open transfer → submit a Funding→Spot transfer (stubbed 200); (2) withdraw form submit (stubbed 201 queued). Assert the UI reflects success and that the stubbed request body matches the English contract.

> **⚠️ Disk precondition:** C: had ~1.3 GB free at plan time. Chromium for Playwright was installed in Slice 1 (`chromium-1140`). If `npx playwright test` reports a missing browser or ENOSPC, STOP and flag to Abner — do NOT silently retry; free space first. This task is deferrable: the slice can merge on Vitest + build if E2E is blocked by disk.

- [ ] **Step 1: Write the spec** mirroring `web/e2e/auth.spec.ts` (stub `/api/balances/my/balances`, `/api/balances/my/transfer`, `/api/transaccionBlockchain/withdraw` via `page.route`; seed a token so the `(app)` guard admits the page).

- [ ] **Step 2: Run**

Run: `cd web && npx playwright test wallet.spec.ts`
Expected: PASS (2/2). If the browser is missing/ENOSPC → stop and flag.

- [ ] **Step 3: Commit**

```bash
git add web/e2e/wallet.spec.ts
git commit -m "test(web): Playwright golden wallet flows (transfer + withdraw) (Slice 2)"
```

---

## Self-Review

**Spec coverage (design spec S2 = "Wallet: balances/compartments, Funding↔Spot transfer, deposit address/history, withdrawal | Correct compartments + pending; money mutation/idempotency tests; withdrawal guard states"):**
- Balances/compartments + pending → Task 4 (display-only pending, hint). ✅
- Funding↔Spot transfer → Task 5 (distinct-compartment guard, double-submit guard, idempotency auto via client). ✅
- Deposit address → Task 6; history → Task 8. ✅
- Withdrawal + guard states → Task 7 (cooldown/invalid-address/validation/insufficient coded errors; Funding-only; no double-submit). ✅
- Money mutation/idempotency tests → Tasks 1, 2, 5, 7 assert request shape, idempotency header presence, and no-double-submit. ✅
- Composition + routing + nav → Tasks 9, 10. ✅
- Gate + contract doc → Task 11; E2E → Task 12. ✅

**Placeholder scan:** No "TBD"/"handle edge cases"/vague steps. The three "Note:" blocks (useTranslation shape, formatDisplay options, Field/Button props) are explicit verification instructions against named files/lines, not placeholders — included because those exact signatures were not re-read while drafting and the implementer must match the real ones rather than guess.

**Type consistency:** `BalanceEntry`, `Compartment`, `CompartmentTransferRequest/Response`, `WithdrawRequest`, `WithdrawResponse = BlockchainTransaction`, `DepositAddressResponse`, and the query keys (`WALLET_BALANCES_KEY`, `WALLET_TX_KEY`, `walletDepositKey`) are defined in Tasks 1–2 and used consistently in Tasks 4–9. The hooks' names (`useMyBalances`, `useCompartmentTransfer`, `useDepositAddress`, `useWithdraw`, `useTransactionHistory`) match across tasks.

**Open verification items for the implementer (must confirm against real files, not assume):**
1. `useTranslation` returns both `t` and `locale` (else use `useLocale`).
2. `formatDisplay` `DisplayOptions` field names.
3. `Field`/`Button` prop contracts (copy from `LoginForm.tsx`).
4. `@/` path alias resolves to `web/src/` (confirm `tsconfig` paths — Slice 1 used `@/shared/...` and `@/features/...`).
