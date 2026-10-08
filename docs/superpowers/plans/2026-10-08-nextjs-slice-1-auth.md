# Next.js Migration — Slice 1 (Auth Journey) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port and complete the full authentication journey (register, verify-email, login, two-factor, password recovery, Google sign-in) into the `web/` Next.js App Router app, consuming the existing backend contract, so every server auth state is actionable client-side with errors surfaced by stable code.

**Architecture:** Auth is client-rendered (`web/app/(auth)/*` route group) per the migration design (public = SSG, authenticated app = client). Pages are thin `'use client'` wrappers over feature components in `web/src/features/auth/`. Data flows through the already-ported typed transport (`shared/api`) via TanStack Query v5 mutation hooks. Sensitive multi-step flows (login→2FA, password recovery) keep their short-lived tokens in React state within a single page — never in the URL or `localStorage` — so a temporal token or reset code is never persisted or shareable. Navigation uses `next/navigation` (`useRouter().replace`). A client guard in `web/app/(app)/layout.tsx` gates the authenticated area.

**Tech Stack:** Next.js 14.2.35 (App Router), React 18.3.1, TypeScript 5.6 (strict), TanStack Query v5, `@react-oauth/google`, Vitest 2 + Testing Library, Playwright (final E2E gate).

## Global Constraints

- **Framework pinned:** Next **14.2.35**, React **18.3.1**, react-dom **18.3.1** — do NOT bump to React 19 / Next 16 in this slice (pre-deploy follow-up, out of scope).
- **No react-router.** Routing is Next file-based; navigation via `next/navigation` `useRouter`.
- **Transport only via `shared/api`.** No raw `fetch`/`axios` in feature code. Use `apiClient.post<T>(url, body)`; base URL is relative `/api` (same-origin).
- **Backend mount path:** user/auth routes are under `/api/user/*` (e.g. `/user/register` passed to `apiClient` → `/api/user/register`).
- **Token model:** JWT in `localStorage` via the `session` seam only (`session.setToken/clearToken/hasToken/getToken`). Never read/write `localStorage` directly. Temporal tokens (register→verify-email) ARE stored via `session.setToken` (the transport must attach them to the authed verify/resend calls); 2FA `temporalToken` and password-reset `codigo` are kept in React state only.
- **Errors by code:** catch `ApiError`; display via `useErrorTranslation().tError(err.code, params)`. Never render a raw backend string as the primary message when a code exists.
- **i18n:** user-facing copy comes from `catalog.ui` keys via `useTranslation().t(key)`; error copy from `catalog.errors` via `tError`. Add keys to BOTH `en` and `es` catalogs (the only two wired; fr/it/pt are a separate roadmap item, out of scope here).
- **Components are `'use client'`** (they use hooks/state/context).
- **Accessibility gate (from the audit):** every input via the `Field` primitive (label + `aria-describedby` error wiring); keyboard-only operable; visible focus; errors announced. Submit buttons use `Button` with `loading` (sets `disabled` + `aria-busy`).
- **TDD:** failing test first, minimal impl, green, commit. Run `cd web && npm test` (Vitest) and `npm run typecheck` before each commit.
- **Commits:** Conventional Commits, English, NO Claude attribution. Scope `web`.

---

## File Structure

**Created:**
- `web/src/app/providers.tsx` — client providers (QueryClient + Locale + optional Google).
- `web/src/features/auth/types.ts` — `User`, request/response interfaces.
- `web/src/features/auth/api.ts` — typed auth endpoints.
- `web/src/features/auth/queries.ts` — TanStack Query v5 hooks.
- `web/src/features/auth/components/{RegisterForm,VerifyEmailForm,LoginForm,ForgotPasswordForm,GoogleSignInButton}.tsx`
- `web/src/features/auth/components/*.module.css` — minimal layout for forms (one shared `authForm.module.css`).
- `web/src/features/auth/index.ts` — barrel.
- `web/app/(auth)/layout.tsx` — centered auth card chrome.
- `web/app/(auth)/{register,login,verify-email,forgot-password}/page.tsx` — thin client wrappers.
- `web/app/(app)/layout.tsx` — client auth guard.
- `web/app/(app)/dashboard/page.tsx` — authenticated landing stub (login/verify destination).
- Test files colocated: `*.test.ts(x)` beside each unit.
- `web/e2e/auth.spec.ts` + `web/playwright.config.ts` — final E2E gate.

**Modified:**
- `web/app/layout.tsx` — wrap `{children}` in `<Providers>`.
- `web/package.json` — add `@tanstack/react-query`, `@react-oauth/google`; add Playwright devDep + `e2e` script.
- `web/src/shared/i18n/catalogs/en.ts` and `es.ts` — add auth `ui` + `errors` keys.

**Backend contract reference (verified against `backend/modules/users/`):**

| Endpoint (under `/api`) | Body | Success | Notes |
| --- | --- | --- | --- |
| `POST /user/register` | `{ email, password, username, displayName? }` | `201 { user, token, message }` | `token` is a **temporal** token for verify-email. |
| `POST /user/verify-email` | `{ codigo }` (**not** `code`) | `200 { user, token, message }` | Requires auth (temporal token). `token` is the real session token. |
| `POST /user/resend-verification-email` | `{}` | `200 { message }` | Requires auth (temporal token). |
| `POST /user/login` | `{ email, password }` | `200 { token, user, ... }` **or** `200 { requires2FA: true, twoFactorMethod: 'totp'\|'email', temporalToken }` | For `email` method the backend has already sent the code. |
| `POST /user/verify-2fa` | `{ temporalToken, codigo }` | `200 { user, token }` | Final session token. |
| `POST /user/resend-2fa` | `{ temporalToken }` | `200 { message }` | Email method only. |
| `POST /user/forgot-password` | `{ email }` | `200 { message }` | Anti-enumeration: always 200. |
| `POST /user/verify-reset-code` | `{ email, codigo }` | `200 { ... }` | Validates the code. |
| `POST /user/reset-password` | `{ email, codigo, newPassword, confirmPassword }` | `200 { user, token }` | Auto-login (real session token). |
| `POST /user/login/google` | `{ idToken }` | `200 { token, user }` | 401 on invalid/unverified Google email. |
| `GET /user/me` | — | `200 User` | Requires auth. Hydrates the guard. |

Error envelope: `{ error: { code, message, requestId } }` → decoded by `ApiError` (`.code`, `.status`, `.message`, `.data`).

---

### Task 1: Providers (QueryClient + Locale + Google) wired into root layout

**Files:**
- Create: `web/src/app/providers.tsx`
- Modify: `web/app/layout.tsx`
- Modify: `web/package.json`
- Test: `web/src/app/providers.test.tsx`

**Interfaces:**
- Produces: `Providers` (default export) — `React.FC<{ children: React.ReactNode }>` wrapping `QueryClientProvider`, `LocaleProvider`, and (when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set) `GoogleOAuthProvider`. Exposes a module-level `makeQueryClient()` so tests can reuse config.

- [ ] **Step 1: Add dependencies**

Run (in `web/`):
```bash
npm install @tanstack/react-query@^5.59.0 @react-oauth/google@^0.12.1
```
Expected: `package.json` dependencies now include both; `package-lock.json` updated; install exits 0.

- [ ] **Step 2: Write the failing test**

Create `web/src/app/providers.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import Providers from './providers';
import { useTranslation } from '@/shared/i18n';

function Probe() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  return <div>{qc ? 'has-qc' : 'no-qc'}:{t('common.submit')}</div>;
}

describe('Providers', () => {
  it('provides a QueryClient and the i18n locale to children', () => {
    render(
      <Providers>
        <Probe />
      </Providers>
    );
    expect(screen.getByText('has-qc:Submit')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd web && npx vitest run src/app/providers.test.tsx`
Expected: FAIL — `Cannot find module './providers'`.

- [ ] **Step 4: Write minimal implementation**

Create `web/src/app/providers.tsx`:
```tsx
'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LocaleProvider } from '@/shared/i18n';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  const tree = (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>{children}</LocaleProvider>
    </QueryClientProvider>
  );

  if (GOOGLE_CLIENT_ID) {
    return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{tree}</GoogleOAuthProvider>;
  }
  return tree;
}
```

Modify `web/app/layout.tsx` — import and wrap the body children:
```tsx
import '@/shared/styles/reset.css';
import '@/shared/styles/tokens.css';
import '@/shared/styles/a11y.css';

import type { Metadata } from 'next';
import Providers from '@/app/providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://bitflow.community'),
  title: { default: 'BitFlow', template: '%s · BitFlow' },
  description: 'BitFlow — custodial crypto exchange.',
  robots: process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

> Note: confirm `@/app/*` resolves. `tsconfig.json` maps `@/*` → `src/*`, so `@/app/providers` → `web/src/app/providers.tsx`. (The Next `app/` router dir is separate from `src/app/`; keep providers under `src/app/`.)

- [ ] **Step 5: Run test + typecheck to verify green**

Run: `cd web && npx vitest run src/app/providers.test.tsx && npm run typecheck`
Expected: test PASS; typecheck exit 0.

- [ ] **Step 6: Commit**
```bash
git add web/package.json web/package-lock.json web/src/app/providers.tsx web/src/app/providers.test.tsx web/app/layout.tsx
git commit -m "feat(web): client providers (TanStack Query v5 + Locale + Google) in root layout"
git push origin dev
```

---

### Task 2: Auth types + typed API

**Files:**
- Create: `web/src/features/auth/types.ts`
- Create: `web/src/features/auth/api.ts`
- Test: `web/src/features/auth/api.test.ts`

**Interfaces:**
- Produces (`types.ts`): `User`, `LoginRequest`, `LoginResult` (discriminated: `LoginSuccess | TwoFactorChallenge`), `TwoFactorChallenge`, `RegisterRequest`, `AuthSession` (`{ user: User; token: string }`), `Verify2FARequest`, `ForgotPasswordRequest`, `VerifyResetCodeRequest`, `ResetPasswordRequest`, `GoogleLoginRequest`.
- Produces (`api.ts`): `authApi` object with methods `register, verifyEmail, resendVerification, login, verify2FA, resend2FA, forgotPassword, verifyResetCode, resetPassword, loginWithGoogle, me`.

- [ ] **Step 1: Write the failing test**

Create `web/src/features/auth/api.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
const get = vi.fn();
vi.mock('@/shared/api', () => ({ apiClient: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a) } }));

import { authApi } from './api';

beforeEach(() => { post.mockReset(); get.mockReset(); post.mockResolvedValue({}); get.mockResolvedValue({}); });

describe('authApi', () => {
  it('register posts credentials to /user/register', async () => {
    await authApi.register({ email: 'a@b.co', password: 'pw', username: 'u' });
    expect(post).toHaveBeenCalledWith('/user/register', { email: 'a@b.co', password: 'pw', username: 'u' });
  });

  it('verifyEmail posts the code as `codigo` (backend contract)', async () => {
    await authApi.verifyEmail({ codigo: '123456' });
    expect(post).toHaveBeenCalledWith('/user/verify-email', { codigo: '123456' });
  });

  it('login posts email+password to /user/login', async () => {
    await authApi.login({ email: 'a@b.co', password: 'pw' });
    expect(post).toHaveBeenCalledWith('/user/login', { email: 'a@b.co', password: 'pw' });
  });

  it('verify2FA posts temporalToken + codigo', async () => {
    await authApi.verify2FA({ temporalToken: 'tt', codigo: '999' });
    expect(post).toHaveBeenCalledWith('/user/verify-2fa', { temporalToken: 'tt', codigo: '999' });
  });

  it('resetPassword posts email, codigo and both passwords', async () => {
    await authApi.resetPassword({ email: 'a@b.co', codigo: '1', newPassword: 'x', confirmPassword: 'x' });
    expect(post).toHaveBeenCalledWith('/user/reset-password', { email: 'a@b.co', codigo: '1', newPassword: 'x', confirmPassword: 'x' });
  });

  it('loginWithGoogle posts idToken', async () => {
    await authApi.loginWithGoogle({ idToken: 'g' });
    expect(post).toHaveBeenCalledWith('/user/login/google', { idToken: 'g' });
  });

  it('me GETs /user/me', async () => {
    await authApi.me();
    expect(get).toHaveBeenCalledWith('/user/me');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/auth/api.test.ts`
Expected: FAIL — `Cannot find module './api'`.

- [ ] **Step 3: Write minimal implementation**

Create `web/src/features/auth/types.ts`:
```ts
export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  active: boolean;
  role: string;
  country?: string;
  state?: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  kycVerified: boolean;
  kycLevel: 'none' | 'basic' | 'full';
  dateOfBirth?: string;
  legalName?: string;
}

export interface AuthSession {
  user: User;
  token: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
  displayName?: string;
}

/** Register returns a TEMPORAL token used only to verify the email. */
export interface RegisterResponse {
  message: string;
  user: User;
  token: string;
}

export interface VerifyEmailRequest {
  codigo: string;
}

export interface VerifyEmailResponse {
  message: string;
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TwoFactorChallenge {
  requires2FA: true;
  twoFactorMethod: 'totp' | 'email';
  temporalToken: string;
}

export type LoginResult = AuthSession | TwoFactorChallenge;

export function isTwoFactorChallenge(r: LoginResult): r is TwoFactorChallenge {
  return (r as TwoFactorChallenge).requires2FA === true;
}

export interface Verify2FARequest {
  temporalToken: string;
  codigo: string;
}

export interface Resend2FARequest {
  temporalToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyResetCodeRequest {
  email: string;
  codigo: string;
}

export interface ResetPasswordRequest {
  email: string;
  codigo: string;
  newPassword: string;
  confirmPassword: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}
```

Create `web/src/features/auth/api.ts`:
```ts
import { apiClient } from '@/shared/api';
import type {
  RegisterRequest, RegisterResponse,
  VerifyEmailRequest, VerifyEmailResponse,
  LoginRequest, LoginResult,
  Verify2FARequest, Resend2FARequest,
  ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest,
  GoogleLoginRequest, AuthSession, User,
} from './types';

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<RegisterResponse>('/user/register', data),

  verifyEmail: (data: VerifyEmailRequest) =>
    apiClient.post<VerifyEmailResponse>('/user/verify-email', data),

  resendVerification: () =>
    apiClient.post<{ message: string }>('/user/resend-verification-email', {}),

  login: (data: LoginRequest) =>
    apiClient.post<LoginResult>('/user/login', data),

  verify2FA: (data: Verify2FARequest) =>
    apiClient.post<AuthSession>('/user/verify-2fa', data),

  resend2FA: (data: Resend2FARequest) =>
    apiClient.post<{ message: string }>('/user/resend-2fa', data),

  forgotPassword: (data: ForgotPasswordRequest) =>
    apiClient.post<{ message: string }>('/user/forgot-password', data),

  verifyResetCode: (data: VerifyResetCodeRequest) =>
    apiClient.post<{ message?: string }>('/user/verify-reset-code', data),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.post<AuthSession>('/user/reset-password', data),

  loginWithGoogle: (data: GoogleLoginRequest) =>
    apiClient.post<AuthSession>('/user/login/google', data),

  me: () => apiClient.get<User>('/user/me'),
};
```

- [ ] **Step 4: Run test + typecheck**

Run: `cd web && npx vitest run src/features/auth/api.test.ts && npm run typecheck`
Expected: PASS; typecheck exit 0.

- [ ] **Step 5: Commit**
```bash
git add web/src/features/auth/types.ts web/src/features/auth/api.ts web/src/features/auth/api.test.ts
git commit -m "feat(web): typed auth API + types (verify-email uses codigo per backend contract)"
git push origin dev
```

---

### Task 3: Auth query hooks (TanStack Query v5)

**Files:**
- Create: `web/src/features/auth/queries.ts`
- Test: `web/src/features/auth/queries.test.tsx`

**Interfaces:**
- Consumes: `authApi` (Task 2), `session` + `ApiError` from `@/shared/api`.
- Produces: `useRegister()`, `useVerifyEmail()`, `useResendVerification()`, `useLogin()`, `useVerify2FA()`, `useResend2FA()`, `useForgotPassword()`, `useVerifyResetCode()`, `useResetPassword()`, `useGoogleLogin()`, `useCurrentUser()`, `useLogout()`. Mutation hooks return the v5 `UseMutationResult`. `USER_QUERY_KEY = ['auth','user']`.
- Behavior contract (relied on by forms):
  - `useRegister.onSuccess(data)` → `session.setToken(data.token)` (temporal token so verify-email is authed).
  - `useVerifyEmail`, `useVerify2FA`, `useResetPassword`, `useGoogleLogin` `.onSuccess(data)` → `session.setToken(data.token)` + seed `USER_QUERY_KEY` with `data.user`.
  - `useLogin.onSuccess(result)` → if `isTwoFactorChallenge(result)` do NOT set a token (challenge handled by the form); else set token + seed user.
  - `useLogout()` returns a `() => void` that clears token + user cache.

- [ ] **Step 1: Write the failing test**

Create `web/src/features/auth/queries.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';

const setToken = vi.fn();
const clearToken = vi.fn();
vi.mock('@/shared/api', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, session: { setToken, clearToken, getToken: () => null, hasToken: () => false } };
});

const login = vi.fn();
const register = vi.fn();
vi.mock('./api', () => ({ authApi: {
  login: (...a: unknown[]) => login(...a),
  register: (...a: unknown[]) => register(...a),
} }));

import { useLogin, useRegister, USER_QUERY_KEY } from './queries';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = makeQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => { setToken.mockReset(); login.mockReset(); register.mockReset(); });

describe('auth queries', () => {
  it('useLogin success stores the token for a direct (non-2FA) login', async () => {
    login.mockResolvedValue({ user: { id: '1' }, token: 'jwt' });
    const { result } = renderHook(() => useLogin(), { wrapper });
    result.current.mutate({ email: 'a@b.co', password: 'pw' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setToken).toHaveBeenCalledWith('jwt');
  });

  it('useLogin does NOT store a token on a 2FA challenge', async () => {
    login.mockResolvedValue({ requires2FA: true, twoFactorMethod: 'totp', temporalToken: 'tt' });
    const { result } = renderHook(() => useLogin(), { wrapper });
    result.current.mutate({ email: 'a@b.co', password: 'pw' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setToken).not.toHaveBeenCalled();
  });

  it('useRegister stores the temporal token', async () => {
    register.mockResolvedValue({ user: { id: '1' }, token: 'temp', message: 'ok' });
    const { result } = renderHook(() => useRegister(), { wrapper });
    result.current.mutate({ email: 'a@b.co', password: 'pw', username: 'u' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setToken).toHaveBeenCalledWith('temp');
  });

  it('exports a stable user query key', () => {
    expect(USER_QUERY_KEY).toEqual(['auth', 'user']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/auth/queries.test.tsx`
Expected: FAIL — `Cannot find module './queries'`.

- [ ] **Step 3: Write minimal implementation**

Create `web/src/features/auth/queries.ts`:
```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { session, ApiError } from '@/shared/api';
import { authApi } from './api';
import { isTwoFactorChallenge } from './types';
import type {
  RegisterRequest, RegisterResponse,
  VerifyEmailRequest, VerifyEmailResponse,
  LoginRequest, LoginResult,
  Verify2FARequest, Resend2FARequest,
  ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest,
  GoogleLoginRequest, AuthSession, User,
} from './types';

export const USER_QUERY_KEY = ['auth', 'user'] as const;

export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: USER_QUERY_KEY,
    queryFn: () => authApi.me(),
    enabled: session.hasToken(),
    staleTime: 60_000,
    retry: false,
  });
}

export function useRegister() {
  return useMutation<RegisterResponse, ApiError, RegisterRequest>({
    mutationFn: authApi.register,
    onSuccess: (data) => { session.setToken(data.token); },
  });
}

export function useVerifyEmail() {
  const qc = useQueryClient();
  return useMutation<VerifyEmailResponse, ApiError, VerifyEmailRequest>({
    mutationFn: authApi.verifyEmail,
    onSuccess: (data) => {
      session.setToken(data.token);
      qc.setQueryData(USER_QUERY_KEY, data.user);
    },
  });
}

export function useResendVerification() {
  return useMutation<{ message: string }, ApiError, void>({
    mutationFn: () => authApi.resendVerification(),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation<LoginResult, ApiError, LoginRequest>({
    mutationFn: authApi.login,
    onSuccess: (result) => {
      if (isTwoFactorChallenge(result)) return; // form drives the 2FA step
      session.setToken(result.token);
      qc.setQueryData(USER_QUERY_KEY, result.user);
    },
  });
}

export function useVerify2FA() {
  const qc = useQueryClient();
  return useMutation<AuthSession, ApiError, Verify2FARequest>({
    mutationFn: authApi.verify2FA,
    onSuccess: (data) => {
      session.setToken(data.token);
      qc.setQueryData(USER_QUERY_KEY, data.user);
    },
  });
}

export function useResend2FA() {
  return useMutation<{ message: string }, ApiError, Resend2FARequest>({
    mutationFn: authApi.resend2FA,
  });
}

export function useForgotPassword() {
  return useMutation<{ message: string }, ApiError, ForgotPasswordRequest>({
    mutationFn: authApi.forgotPassword,
  });
}

export function useVerifyResetCode() {
  return useMutation<{ message?: string }, ApiError, VerifyResetCodeRequest>({
    mutationFn: authApi.verifyResetCode,
  });
}

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation<AuthSession, ApiError, ResetPasswordRequest>({
    mutationFn: authApi.resetPassword,
    onSuccess: (data) => {
      session.setToken(data.token);
      qc.setQueryData(USER_QUERY_KEY, data.user);
    },
  });
}

export function useGoogleLogin() {
  const qc = useQueryClient();
  return useMutation<AuthSession, ApiError, GoogleLoginRequest>({
    mutationFn: authApi.loginWithGoogle,
    onSuccess: (data) => {
      session.setToken(data.token);
      qc.setQueryData(USER_QUERY_KEY, data.user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return () => {
    session.clearToken();
    qc.setQueryData(USER_QUERY_KEY, null);
  };
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `cd web && npx vitest run src/features/auth/queries.test.tsx && npm run typecheck`
Expected: PASS; typecheck exit 0.

- [ ] **Step 5: Commit**
```bash
git add web/src/features/auth/queries.ts web/src/features/auth/queries.test.tsx
git commit -m "feat(web): auth mutation hooks on TanStack Query v5 with session wiring"
git push origin dev
```

---

### Task 4: i18n auth copy (en + es)

**Files:**
- Modify: `web/src/shared/i18n/catalogs/en.ts`
- Modify: `web/src/shared/i18n/catalogs/es.ts`
- Test: `web/src/shared/i18n/catalogs/authKeys.test.ts`

**Interfaces:**
- Produces: `ui` keys under `auth.*` and `errors` keys for auth codes, present identically in `en` and `es`.

- [ ] **Step 1: Write the failing test**

Create `web/src/shared/i18n/catalogs/authKeys.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { en } from './en';
import { es } from './es';

const REQUIRED_UI = [
  'auth.register.title', 'auth.register.submit', 'auth.register.haveAccount',
  'auth.login.title', 'auth.login.submit', 'auth.login.forgot', 'auth.login.needAccount',
  'auth.verifyEmail.title', 'auth.verifyEmail.submit', 'auth.verifyEmail.resend', 'auth.verifyEmail.sent',
  'auth.twofa.title.totp', 'auth.twofa.title.email', 'auth.twofa.submit', 'auth.twofa.resend',
  'auth.forgot.title', 'auth.forgot.submit', 'auth.forgot.sent',
  'auth.reset.codeTitle', 'auth.reset.codeSubmit', 'auth.reset.title', 'auth.reset.submit', 'auth.reset.mismatch',
  'auth.field.email', 'auth.field.username', 'auth.field.password', 'auth.field.code', 'auth.field.newPassword', 'auth.field.confirmPassword',
  'auth.google.button',
];
const REQUIRED_ERRORS = ['INVALID_CREDENTIALS', 'EMAIL_NOT_VERIFIED', 'TOO_MANY_REQUESTS', 'NETWORK_ERROR'];

describe('auth catalogs', () => {
  it('en has all required auth ui + error keys', () => {
    REQUIRED_UI.forEach((k) => expect(en.ui[k], `en.ui ${k}`).toBeTypeOf('string'));
    REQUIRED_ERRORS.forEach((k) => expect(en.errors[k], `en.errors ${k}`).toBeTypeOf('string'));
  });
  it('es mirrors every en auth key', () => {
    REQUIRED_UI.forEach((k) => expect(es.ui[k], `es.ui ${k}`).toBeTypeOf('string'));
    REQUIRED_ERRORS.forEach((k) => expect(es.errors[k], `es.errors ${k}`).toBeTypeOf('string'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/shared/i18n/catalogs/authKeys.test.ts`
Expected: FAIL — keys undefined.

- [ ] **Step 3: Add the keys**

In `web/src/shared/i18n/catalogs/en.ts`, extend the `ui` object (merge, keep existing keys) with:
```ts
    'auth.register.title': 'Create your account',
    'auth.register.submit': 'Register',
    'auth.register.haveAccount': 'Already have an account? Sign in',
    'auth.login.title': 'Sign in',
    'auth.login.submit': 'Sign in',
    'auth.login.forgot': 'Forgot your password?',
    'auth.login.needAccount': "Don't have an account? Register",
    'auth.verifyEmail.title': 'Verify your email',
    'auth.verifyEmail.submit': 'Verify',
    'auth.verifyEmail.resend': 'Resend code',
    'auth.verifyEmail.sent': 'A verification code was sent to your email.',
    'auth.twofa.title.totp': 'Enter your authenticator code',
    'auth.twofa.title.email': 'Enter the code sent to your email',
    'auth.twofa.submit': 'Verify',
    'auth.twofa.resend': 'Resend code',
    'auth.forgot.title': 'Reset your password',
    'auth.forgot.submit': 'Send reset code',
    'auth.forgot.sent': 'If that email exists, a reset code has been sent.',
    'auth.reset.codeTitle': 'Enter the reset code',
    'auth.reset.codeSubmit': 'Verify code',
    'auth.reset.title': 'Choose a new password',
    'auth.reset.submit': 'Update password',
    'auth.reset.mismatch': 'Passwords do not match.',
    'auth.field.email': 'Email',
    'auth.field.username': 'Username',
    'auth.field.password': 'Password',
    'auth.field.code': 'Code',
    'auth.field.newPassword': 'New password',
    'auth.field.confirmPassword': 'Confirm password',
    'auth.google.button': 'Continue with Google',
```
and extend the `errors` object with:
```ts
    'INVALID_CREDENTIALS': 'Invalid email or password.',
    'EMAIL_NOT_VERIFIED': 'Please verify your email to continue.',
    'TOO_MANY_REQUESTS': 'Too many attempts. Please wait and try again.',
    'NETWORK_ERROR': 'Could not connect to the server. Check your internet connection.',
```

In `web/src/shared/i18n/catalogs/es.ts`, add the same keys with Spanish copy:
```ts
    'auth.register.title': 'Creá tu cuenta',
    'auth.register.submit': 'Registrarme',
    'auth.register.haveAccount': '¿Ya tenés cuenta? Iniciá sesión',
    'auth.login.title': 'Iniciar sesión',
    'auth.login.submit': 'Iniciar sesión',
    'auth.login.forgot': '¿Olvidaste tu contraseña?',
    'auth.login.needAccount': '¿No tenés cuenta? Registrate',
    'auth.verifyEmail.title': 'Verificá tu email',
    'auth.verifyEmail.submit': 'Verificar',
    'auth.verifyEmail.resend': 'Reenviar código',
    'auth.verifyEmail.sent': 'Enviamos un código de verificación a tu email.',
    'auth.twofa.title.totp': 'Ingresá el código de tu app autenticadora',
    'auth.twofa.title.email': 'Ingresá el código enviado a tu email',
    'auth.twofa.submit': 'Verificar',
    'auth.twofa.resend': 'Reenviar código',
    'auth.forgot.title': 'Recuperá tu contraseña',
    'auth.forgot.submit': 'Enviar código',
    'auth.forgot.sent': 'Si ese email existe, enviamos un código de recuperación.',
    'auth.reset.codeTitle': 'Ingresá el código de recuperación',
    'auth.reset.codeSubmit': 'Verificar código',
    'auth.reset.title': 'Elegí una nueva contraseña',
    'auth.reset.submit': 'Actualizar contraseña',
    'auth.reset.mismatch': 'Las contraseñas no coinciden.',
    'auth.field.email': 'Email',
    'auth.field.username': 'Usuario',
    'auth.field.password': 'Contraseña',
    'auth.field.code': 'Código',
    'auth.field.newPassword': 'Nueva contraseña',
    'auth.field.confirmPassword': 'Confirmar contraseña',
    'auth.google.button': 'Continuar con Google',
```
and the errors:
```ts
    'INVALID_CREDENTIALS': 'Email o contraseña inválidos.',
    'EMAIL_NOT_VERIFIED': 'Verificá tu email para continuar.',
    'TOO_MANY_REQUESTS': 'Demasiados intentos. Esperá un momento e intentá de nuevo.',
    'NETWORK_ERROR': 'No se pudo conectar con el servidor. Revisá tu conexión.',
```

> If `es.ts` does not yet exist in the same shape as `en.ts`, mirror `en.ts`'s structure (`export const es: Catalog = { ui: {...}, errors: {...} }`) including the pre-existing base keys so `useTranslation` resolves common keys in Spanish too.

- [ ] **Step 4: Run test + typecheck**

Run: `cd web && npx vitest run src/shared/i18n/catalogs/authKeys.test.ts && npm run typecheck`
Expected: PASS; typecheck exit 0.

- [ ] **Step 5: Commit**
```bash
git add web/src/shared/i18n/catalogs/en.ts web/src/shared/i18n/catalogs/es.ts web/src/shared/i18n/catalogs/authKeys.test.ts
git commit -m "feat(web): auth i18n copy (en+es) for ui + error codes"
git push origin dev
```

---

### Task 5: Auth guard layout + dashboard stub + auth route-group chrome

**Files:**
- Create: `web/app/(app)/layout.tsx`
- Create: `web/app/(app)/dashboard/page.tsx`
- Create: `web/app/(auth)/layout.tsx`
- Create: `web/src/features/auth/components/authForm.module.css`
- Test: `web/app/(app)/guard.test.tsx`

**Interfaces:**
- Consumes: `session` from `@/shared/api`, `useCurrentUser` (Task 3), `useRouter` from `next/navigation`.
- Produces: `(app)` layout that redirects to `/login` when `!session.hasToken()`, otherwise renders children; `/dashboard` authenticated stub; `(auth)` layout wrapping children in a centered `<main>` card.

- [ ] **Step 1: Write the failing test**

Create `web/app/(app)/guard.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

let hasToken = false;
vi.mock('@/shared/api', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, session: { hasToken: () => hasToken, getToken: () => (hasToken ? 't' : null), clearToken: vi.fn() } };
});

import AppLayout from './layout';

function renderGuard() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AppLayout><div>secret</div></AppLayout>
    </QueryClientProvider>
  );
}

beforeEach(() => { replace.mockReset(); });

describe('(app) guard', () => {
  it('redirects to /login when there is no token', () => {
    hasToken = false;
    renderGuard();
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders children when a token exists', () => {
    hasToken = true;
    renderGuard();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run "app/(app)/guard.test.tsx"`
Expected: FAIL — `Cannot find module './layout'`.

- [ ] **Step 3: Write minimal implementation**

Create `web/app/(app)/layout.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { session } from '@/shared/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authed = session.hasToken();

  useEffect(() => {
    if (!authed) router.replace('/login');
  }, [authed, router]);

  if (!authed) return null;
  return <>{children}</>;
}
```

Create `web/app/(app)/dashboard/page.tsx`:
```tsx
'use client';

import { useCurrentUser, useLogout } from '@/features/auth/queries';

export default function DashboardPage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  return (
    <section>
      <h1>Dashboard</h1>
      <p>You are signed in{user?.username ? ` as ${user.username}` : ''}.</p>
      <button type="button" onClick={logout}>Log out</button>
    </section>
  );
}
```

Create `web/app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--space-6, 24px)' }}>
      {children}
    </main>
  );
}
```

Create `web/src/features/auth/components/authForm.module.css`:
```css
.form { display: flex; flex-direction: column; gap: var(--space-4, 16px); }
.error { color: var(--color-danger, #b00020); }
.actions { display: flex; flex-direction: column; gap: var(--space-3, 12px); }
.links { display: flex; flex-direction: column; gap: var(--space-2, 8px); font-size: 0.9rem; }
.divider { text-align: center; color: var(--color-muted, #666); font-size: 0.85rem; }
```

- [ ] **Step 4: Run test + typecheck**

Run: `cd web && npx vitest run "app/(app)/guard.test.tsx" && npm run typecheck`
Expected: PASS; typecheck exit 0.

- [ ] **Step 5: Commit**
```bash
git add "web/app/(app)" "web/app/(auth)/layout.tsx" web/src/features/auth/components/authForm.module.css "web/app/(app)/guard.test.tsx"
git commit -m "feat(web): (app) client auth guard + dashboard stub + (auth) layout chrome"
git push origin dev
```

---

### Task 6: Register + Verify-email flow

**Files:**
- Create: `web/src/features/auth/components/RegisterForm.tsx`
- Create: `web/src/features/auth/components/VerifyEmailForm.tsx`
- Create: `web/app/(auth)/register/page.tsx`
- Create: `web/app/(auth)/verify-email/page.tsx`
- Create: `web/src/features/auth/index.ts`
- Test: `web/src/features/auth/components/RegisterForm.test.tsx`
- Test: `web/src/features/auth/components/VerifyEmailForm.test.tsx`

**Interfaces:**
- Consumes: `useRegister`, `useVerifyEmail`, `useResendVerification` (Task 3); `Field`, `Button` (`@/shared/ui`); `useTranslation`, `useErrorTranslation` (`@/shared/i18n`); `useRouter` (`next/navigation`).
- Produces: `RegisterForm` → on success routes to `/verify-email`. `VerifyEmailForm` → on success routes to `/dashboard`, with a resend button.

- [ ] **Step 1: Write the failing tests**

Create `web/src/features/auth/components/RegisterForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';
import { ApiError } from '@/shared/api';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const mutateAsync = vi.fn();
vi.mock('../queries', () => ({
  useRegister: () => ({ mutateAsync, isPending: false }),
}));

import { RegisterForm } from './RegisterForm';

function renderForm() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}><LocaleProvider><RegisterForm /></LocaleProvider></QueryClientProvider>
  );
}

beforeEach(() => { replace.mockReset(); mutateAsync.mockReset(); });

describe('RegisterForm', () => {
  it('submits credentials and routes to /verify-email on success', async () => {
    mutateAsync.mockResolvedValue({ user: {}, token: 'temp', message: 'ok' });
    renderForm();
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Username'), 'neo');
    await userEvent.type(screen.getByLabelText('Password'), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ email: 'a@b.co', username: 'neo', password: 'secret12' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/verify-email'));
  });

  it('shows a coded error message when the API rejects', async () => {
    mutateAsync.mockRejectedValue(new ApiError({ code: 'TOO_MANY_REQUESTS', status: 429 }));
    renderForm();
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Username'), 'neo');
    await userEvent.type(screen.getByLabelText('Password'), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByText('Too many attempts. Please wait and try again.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
```

Create `web/src/features/auth/components/VerifyEmailForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const verifyAsync = vi.fn();
const resendAsync = vi.fn();
vi.mock('../queries', () => ({
  useVerifyEmail: () => ({ mutateAsync: verifyAsync, isPending: false }),
  useResendVerification: () => ({ mutateAsync: resendAsync, isPending: false }),
}));

import { VerifyEmailForm } from './VerifyEmailForm';

function renderForm() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}><LocaleProvider><VerifyEmailForm /></LocaleProvider></QueryClientProvider>
  );
}

beforeEach(() => { replace.mockReset(); verifyAsync.mockReset(); resendAsync.mockReset(); });

describe('VerifyEmailForm', () => {
  it('verifies the code (sent as codigo) and routes to /dashboard', async () => {
    verifyAsync.mockResolvedValue({ user: {}, token: 'jwt', message: 'ok' });
    renderForm();
    await userEvent.type(screen.getByLabelText('Code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(verifyAsync).toHaveBeenCalledWith({ codigo: '123456' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('resends the verification code', async () => {
    resendAsync.mockResolvedValue({ message: 'sent' });
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(resendAsync).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/auth/components/RegisterForm.test.tsx src/features/auth/components/VerifyEmailForm.test.tsx`
Expected: FAIL — components not found.

- [ ] **Step 3: Write minimal implementation**

Create `web/src/features/auth/components/RegisterForm.tsx`:
```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Field, Button } from '@/shared/ui';
import { useTranslation, useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useRegister } from '../queries';
import styles from './authForm.module.css';

export const RegisterForm: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const register = useRegister();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register.mutateAsync({ email, username, password });
      router.replace('/verify-email');
    } catch (err) {
      setError(isApiError(err) ? tError(err.code, { requestId: err.requestId ?? '' }) : tError('FALLBACK_UNKNOWN_ERROR'));
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <h1>{t('auth.register.title')}</h1>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Field label={t('auth.field.email')}>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t('auth.field.username')}>
        <input type="text" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
      </Field>
      <Field label={t('auth.field.password')}>
        <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" loading={register.isPending}>{t('auth.register.submit')}</Button>
      </div>
      <div className={styles.links}>
        <Link href="/login">{t('auth.register.haveAccount')}</Link>
      </div>
    </form>
  );
};
```

Create `web/src/features/auth/components/VerifyEmailForm.tsx`:
```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Button } from '@/shared/ui';
import { useTranslation, useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useVerifyEmail, useResendVerification } from '../queries';
import styles from './authForm.module.css';

export const VerifyEmailForm: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verify.mutateAsync({ codigo });
      router.replace('/dashboard');
    } catch (err) {
      setError(isApiError(err) ? tError(err.code, { requestId: err.requestId ?? '' }) : tError('FALLBACK_UNKNOWN_ERROR'));
    }
  };

  const onResend = async () => {
    setError(null); setNotice(null);
    try {
      await resend.mutateAsync();
      setNotice(t('auth.verifyEmail.sent'));
    } catch (err) {
      setError(isApiError(err) ? tError(err.code) : tError('FALLBACK_UNKNOWN_ERROR'));
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <h1>{t('auth.verifyEmail.title')}</h1>
      <p>{t('auth.verifyEmail.sent')}</p>
      {notice && <p role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Field label={t('auth.field.code')}>
        <input type="text" inputMode="numeric" autoComplete="one-time-code" required value={codigo} onChange={(e) => setCodigo(e.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" loading={verify.isPending}>{t('auth.verifyEmail.submit')}</Button>
        <Button type="button" variant="ghost" loading={resend.isPending} onClick={onResend}>{t('auth.verifyEmail.resend')}</Button>
      </div>
    </form>
  );
};
```

Create `web/app/(auth)/register/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { RegisterForm } from '@/features/auth';

export const metadata: Metadata = { title: 'Register', robots: { index: false, follow: false } };

export default function RegisterPage() {
  return <RegisterForm />;
}
```

Create `web/app/(auth)/verify-email/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { VerifyEmailForm } from '@/features/auth';

export const metadata: Metadata = { title: 'Verify email', robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return <VerifyEmailForm />;
}
```

Create `web/src/features/auth/index.ts`:
```ts
export { RegisterForm } from './components/RegisterForm';
export { VerifyEmailForm } from './components/VerifyEmailForm';
export { LoginForm } from './components/LoginForm';
export { ForgotPasswordForm } from './components/ForgotPasswordForm';
export { GoogleSignInButton } from './components/GoogleSignInButton';
```

> The barrel references components created in Tasks 7–8. If executing strictly in order, add the `LoginForm`/`ForgotPasswordForm`/`GoogleSignInButton` lines when those files exist, or create the files as empty stubs now and fill them in their tasks. Simplest: export only `RegisterForm` + `VerifyEmailForm` here and append the rest in Tasks 7 and 8.

- [ ] **Step 4: Run tests + typecheck**

Run: `cd web && npx vitest run src/features/auth/components/RegisterForm.test.tsx src/features/auth/components/VerifyEmailForm.test.tsx && npm run typecheck`
Expected: PASS; typecheck exit 0 (ensure the barrel only exports existing files).

- [ ] **Step 5: Commit**
```bash
git add web/src/features/auth/components/RegisterForm.tsx web/src/features/auth/components/VerifyEmailForm.tsx "web/app/(auth)/register" "web/app/(auth)/verify-email" web/src/features/auth/index.ts web/src/features/auth/components/RegisterForm.test.tsx web/src/features/auth/components/VerifyEmailForm.test.tsx
git commit -m "feat(web): register + verify-email flow (routes, forms, coded errors)"
git push origin dev
```

---

### Task 7: Login + two-factor (email + TOTP) flow

**Files:**
- Create: `web/src/features/auth/components/LoginForm.tsx`
- Create: `web/app/(auth)/login/page.tsx`
- Modify: `web/src/features/auth/index.ts` (add `LoginForm` export)
- Test: `web/src/features/auth/components/LoginForm.test.tsx`

**Interfaces:**
- Consumes: `useLogin`, `useVerify2FA`, `useResend2FA` (Task 3); `isTwoFactorChallenge` (`../types`); `Field`, `Button`; i18n; `useRouter`.
- Produces: `LoginForm` — single component with internal step state `'credentials' | 'twofa'`. The `temporalToken` + `twoFactorMethod` live only in component state. Email method shows a resend button; TOTP does not. Success (direct or post-2FA) routes to `/dashboard`.

- [ ] **Step 1: Write the failing test**

Create `web/src/features/auth/components/LoginForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';
import { ApiError } from '@/shared/api';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const loginAsync = vi.fn();
const verify2faAsync = vi.fn();
const resend2faAsync = vi.fn();
vi.mock('../queries', () => ({
  useLogin: () => ({ mutateAsync: loginAsync, isPending: false }),
  useVerify2FA: () => ({ mutateAsync: verify2faAsync, isPending: false }),
  useResend2FA: () => ({ mutateAsync: resend2faAsync, isPending: false }),
}));

import { LoginForm } from './LoginForm';

function renderForm() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}><LocaleProvider><LoginForm /></LocaleProvider></QueryClientProvider>
  );
}

async function fillCreds() {
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
  await userEvent.type(screen.getByLabelText('Password'), 'secret12');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => { replace.mockReset(); loginAsync.mockReset(); verify2faAsync.mockReset(); resend2faAsync.mockReset(); });

describe('LoginForm', () => {
  it('direct login routes to /dashboard', async () => {
    loginAsync.mockResolvedValue({ user: {}, token: 'jwt' });
    renderForm();
    await fillCreds();
    await waitFor(() => expect(loginAsync).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret12' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('TOTP challenge shows the authenticator step WITHOUT a resend button', async () => {
    loginAsync.mockResolvedValue({ requires2FA: true, twoFactorMethod: 'totp', temporalToken: 'tt' });
    renderForm();
    await fillCreds();
    expect(await screen.findByText('Enter your authenticator code')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend code' })).not.toBeInTheDocument();
  });

  it('email challenge shows a resend button and completes verify-2fa', async () => {
    loginAsync.mockResolvedValue({ requires2FA: true, twoFactorMethod: 'email', temporalToken: 'tt' });
    verify2faAsync.mockResolvedValue({ user: {}, token: 'jwt' });
    renderForm();
    await fillCreds();
    expect(await screen.findByText('Enter the code sent to your email')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(resend2faAsync).toHaveBeenCalledWith({ temporalToken: 'tt' }));
    await userEvent.type(screen.getByLabelText('Code'), '654321');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(verify2faAsync).toHaveBeenCalledWith({ temporalToken: 'tt', codigo: '654321' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows a coded error on invalid credentials', async () => {
    loginAsync.mockRejectedValue(new ApiError({ code: 'INVALID_CREDENTIALS', status: 401 }));
    renderForm();
    await fillCreds();
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/features/auth/components/LoginForm.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Write minimal implementation**

Create `web/src/features/auth/components/LoginForm.tsx`:
```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Field, Button } from '@/shared/ui';
import { useTranslation, useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useLogin, useVerify2FA, useResend2FA } from '../queries';
import { isTwoFactorChallenge } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';
import styles from './authForm.module.css';

type Step =
  | { kind: 'credentials' }
  | { kind: 'twofa'; method: 'totp' | 'email'; temporalToken: string };

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const login = useLogin();
  const verify2fa = useVerify2FA();
  const resend2fa = useResend2FA();

  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const describe = (err: unknown) =>
    setError(isApiError(err) ? tError(err.code, { requestId: err.requestId ?? '' }) : tError('FALLBACK_UNKNOWN_ERROR'));

  const onCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await login.mutateAsync({ email, password });
      if (isTwoFactorChallenge(result)) {
        setStep({ kind: 'twofa', method: result.twoFactorMethod, temporalToken: result.temporalToken });
        return;
      }
      router.replace('/dashboard');
    } catch (err) { describe(err); }
  };

  const onTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'twofa') return;
    setError(null);
    try {
      await verify2fa.mutateAsync({ temporalToken: step.temporalToken, codigo });
      router.replace('/dashboard');
    } catch (err) { describe(err); }
  };

  const onResend = async () => {
    if (step.kind !== 'twofa') return;
    setError(null);
    try { await resend2fa.mutateAsync({ temporalToken: step.temporalToken }); }
    catch (err) { describe(err); }
  };

  if (step.kind === 'twofa') {
    return (
      <form className={styles.form} onSubmit={onTwoFactor} noValidate>
        <h1>{step.method === 'totp' ? t('auth.twofa.title.totp') : t('auth.twofa.title.email')}</h1>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Field label={t('auth.field.code')}>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" required value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" loading={verify2fa.isPending}>{t('auth.twofa.submit')}</Button>
          {step.method === 'email' && (
            <Button type="button" variant="ghost" loading={resend2fa.isPending} onClick={onResend}>{t('auth.twofa.resend')}</Button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={onCredentials} noValidate>
      <h1>{t('auth.login.title')}</h1>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Field label={t('auth.field.email')}>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t('auth.field.password')}>
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" loading={login.isPending}>{t('auth.login.submit')}</Button>
      </div>
      <div className={styles.divider}>—</div>
      <GoogleSignInButton />
      <div className={styles.links}>
        <Link href="/forgot-password">{t('auth.login.forgot')}</Link>
        <Link href="/register">{t('auth.login.needAccount')}</Link>
      </div>
    </form>
  );
};
```

> Depends on `GoogleSignInButton` (Task 8). If executing in strict order, create a temporary stub `GoogleSignInButton` that returns `null` now, then implement it in Task 8. Simplest: do Task 8's `GoogleSignInButton` file first, or stub it.

Create `web/app/(auth)/login/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default function LoginPage() {
  return <LoginForm />;
}
```

Add to `web/src/features/auth/index.ts`: `export { LoginForm } from './components/LoginForm';`

- [ ] **Step 4: Run test + typecheck**

Run: `cd web && npx vitest run src/features/auth/components/LoginForm.test.tsx && npm run typecheck`
Expected: PASS; typecheck exit 0.

- [ ] **Step 5: Commit**
```bash
git add web/src/features/auth/components/LoginForm.tsx "web/app/(auth)/login" web/src/features/auth/index.ts web/src/features/auth/components/LoginForm.test.tsx
git commit -m "feat(web): login with two-factor step (email + TOTP), temporal token kept in memory"
git push origin dev
```

---

### Task 8: Password recovery (3-step) + Google sign-in button

**Files:**
- Create: `web/src/features/auth/components/ForgotPasswordForm.tsx`
- Create: `web/src/features/auth/components/GoogleSignInButton.tsx`
- Create: `web/app/(auth)/forgot-password/page.tsx`
- Modify: `web/src/features/auth/index.ts` (add `ForgotPasswordForm`, `GoogleSignInButton`)
- Test: `web/src/features/auth/components/ForgotPasswordForm.test.tsx`
- Test: `web/src/features/auth/components/GoogleSignInButton.test.tsx`

**Interfaces:**
- Consumes: `useForgotPassword`, `useVerifyResetCode`, `useResetPassword`, `useGoogleLogin` (Task 3); i18n; `useRouter`; `@react-oauth/google` `GoogleLogin`.
- Produces: `ForgotPasswordForm` — single component, internal steps `'request' | 'code' | 'reset'`; `email` + `codigo` kept in component state; on reset success routes to `/dashboard`. `GoogleSignInButton` — renders the Google button only when `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set; on credential calls `useGoogleLogin` then routes to `/dashboard`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/features/auth/components/ForgotPasswordForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const forgotAsync = vi.fn();
const verifyCodeAsync = vi.fn();
const resetAsync = vi.fn();
vi.mock('../queries', () => ({
  useForgotPassword: () => ({ mutateAsync: forgotAsync, isPending: false }),
  useVerifyResetCode: () => ({ mutateAsync: verifyCodeAsync, isPending: false }),
  useResetPassword: () => ({ mutateAsync: resetAsync, isPending: false }),
}));

import { ForgotPasswordForm } from './ForgotPasswordForm';

function renderForm() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}><LocaleProvider><ForgotPasswordForm /></LocaleProvider></QueryClientProvider>
  );
}

beforeEach(() => { replace.mockReset(); forgotAsync.mockReset(); verifyCodeAsync.mockReset(); resetAsync.mockReset(); });

describe('ForgotPasswordForm', () => {
  it('walks request → code → reset and routes to /dashboard', async () => {
    forgotAsync.mockResolvedValue({ message: 'sent' });
    verifyCodeAsync.mockResolvedValue({});
    resetAsync.mockResolvedValue({ user: {}, token: 'jwt' });
    renderForm();

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
    await waitFor(() => expect(forgotAsync).toHaveBeenCalledWith({ email: 'a@b.co' }));

    await userEvent.type(await screen.findByLabelText('Code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await waitFor(() => expect(verifyCodeAsync).toHaveBeenCalledWith({ email: 'a@b.co', codigo: '123456' }));

    await userEvent.type(await screen.findByLabelText('New password'), 'newsecret1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'newsecret1');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(resetAsync).toHaveBeenCalledWith({ email: 'a@b.co', codigo: '123456', newPassword: 'newsecret1', confirmPassword: 'newsecret1' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('blocks the reset step when passwords do not match', async () => {
    forgotAsync.mockResolvedValue({ message: 'sent' });
    verifyCodeAsync.mockResolvedValue({});
    renderForm();
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
    await userEvent.type(await screen.findByLabelText('Code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await userEvent.type(await screen.findByLabelText('New password'), 'aaaa1111');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'bbbb2222');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(resetAsync).not.toHaveBeenCalled();
  });
});
```

Create `web/src/features/auth/components/GoogleSignInButton.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const googleAsync = vi.fn();
vi.mock('../queries', () => ({ useGoogleLogin: () => ({ mutateAsync: googleAsync, isPending: false }) }));

// Stub the Google widget: a button that fires onSuccess with a credential.
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess: (r: { credential: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ credential: 'gcred' })}>google-widget</button>
  ),
}));

import { GoogleSignInButton } from './GoogleSignInButton';

function renderBtn() {
  const qc = makeQueryClient();
  return render(<QueryClientProvider client={qc}><GoogleSignInButton /></QueryClientProvider>);
}

beforeEach(() => { replace.mockReset(); googleAsync.mockReset(); });
afterEach(() => { delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_GOOGLE_CLIENT_ID; });

describe('GoogleSignInButton', () => {
  it('renders nothing when no client id is configured', () => {
    renderBtn();
    expect(screen.queryByText('google-widget')).not.toBeInTheDocument();
  });

  it('logs in with the idToken and routes to /dashboard when configured', async () => {
    (process.env as Record<string, string | undefined>).NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'cid';
    googleAsync.mockResolvedValue({ user: {}, token: 'jwt' });
    renderBtn();
    await userEvent.click(screen.getByText('google-widget'));
    await waitFor(() => expect(googleAsync).toHaveBeenCalledWith({ idToken: 'gcred' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });
});
```

> Note: the component reads `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID` at render time (not module load) so the test can toggle it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run src/features/auth/components/ForgotPasswordForm.test.tsx src/features/auth/components/GoogleSignInButton.test.tsx`
Expected: FAIL — components not found.

- [ ] **Step 3: Write minimal implementation**

Create `web/src/features/auth/components/GoogleSignInButton.tsx`:
```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useGoogleLogin } from '../queries';
import styles from './authForm.module.css';

export const GoogleSignInButton: React.FC = () => {
  const router = useRouter();
  const { tError } = useErrorTranslation();
  const googleLogin = useGoogleLogin();
  const [error, setError] = useState<string | null>(null);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  const onSuccess = async (resp: { credential?: string }) => {
    setError(null);
    if (!resp.credential) { setError(tError('UNAUTHORIZED')); return; }
    try {
      await googleLogin.mutateAsync({ idToken: resp.credential });
      router.replace('/dashboard');
    } catch (err) {
      setError(isApiError(err) ? tError(err.code) : tError('FALLBACK_UNKNOWN_ERROR'));
    }
  };

  return (
    <div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <GoogleLogin onSuccess={onSuccess} onError={() => setError(tError('UNAUTHORIZED'))} />
    </div>
  );
};
```

Create `web/src/features/auth/components/ForgotPasswordForm.tsx`:
```tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Field, Button } from '@/shared/ui';
import { useTranslation, useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useForgotPassword, useVerifyResetCode, useResetPassword } from '../queries';
import styles from './authForm.module.css';

type Step = 'request' | 'code' | 'reset';

export const ForgotPasswordForm: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const forgot = useForgotPassword();
  const verifyCode = useVerifyResetCode();
  const reset = useResetPassword();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const describe = (err: unknown) =>
    setError(isApiError(err) ? tError(err.code, { requestId: err.requestId ?? '' }) : tError('FALLBACK_UNKNOWN_ERROR'));

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await forgot.mutateAsync({ email });
      setNotice(t('auth.forgot.sent'));
      setStep('code');
    } catch (err) { describe(err); }
  };

  const onCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyCode.mutateAsync({ email, codigo });
      setStep('reset');
    } catch (err) { describe(err); }
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) { setError(t('auth.reset.mismatch')); return; }
    try {
      await reset.mutateAsync({ email, codigo, newPassword, confirmPassword });
      router.replace('/dashboard');
    } catch (err) { describe(err); }
  };

  if (step === 'code') {
    return (
      <form className={styles.form} onSubmit={onCode} noValidate>
        <h1>{t('auth.reset.codeTitle')}</h1>
        {notice && <p role="status">{notice}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Field label={t('auth.field.code')}>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" required value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" loading={verifyCode.isPending}>{t('auth.reset.codeSubmit')}</Button>
        </div>
      </form>
    );
  }

  if (step === 'reset') {
    return (
      <form className={styles.form} onSubmit={onReset} noValidate>
        <h1>{t('auth.reset.title')}</h1>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Field label={t('auth.field.newPassword')}>
          <input type="password" autoComplete="new-password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
        <Field label={t('auth.field.confirmPassword')}>
          <input type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" loading={reset.isPending}>{t('auth.reset.submit')}</Button>
        </div>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={onRequest} noValidate>
      <h1>{t('auth.forgot.title')}</h1>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Field label={t('auth.field.email')}>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" loading={forgot.isPending}>{t('auth.forgot.submit')}</Button>
      </div>
      <div className={styles.links}>
        <Link href="/login">{t('auth.login.title')}</Link>
      </div>
    </form>
  );
};
```

Create `web/app/(auth)/forgot-password/page.tsx`:
```tsx
import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/features/auth';

export const metadata: Metadata = { title: 'Reset password', robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
```

Add to `web/src/features/auth/index.ts`:
```ts
export { ForgotPasswordForm } from './components/ForgotPasswordForm';
export { GoogleSignInButton } from './components/GoogleSignInButton';
```

- [ ] **Step 4: Run tests + full suite + typecheck**

Run: `cd web && npx vitest run src/features/auth/components/ForgotPasswordForm.test.tsx src/features/auth/components/GoogleSignInButton.test.tsx && npm test && npm run typecheck`
Expected: targeted PASS; full Vitest suite green; typecheck exit 0.

- [ ] **Step 5: Commit**
```bash
git add web/src/features/auth/components/ForgotPasswordForm.tsx web/src/features/auth/components/GoogleSignInButton.tsx "web/app/(auth)/forgot-password" web/src/features/auth/index.ts web/src/features/auth/components/ForgotPasswordForm.test.tsx web/src/features/auth/components/GoogleSignInButton.test.tsx
git commit -m "feat(web): password recovery (3-step) + Google sign-in button"
git push origin dev
```

---

### Task 9: Build gate + contract-doc + progress-log update

**Files:**
- Modify: `docs/frontend-rebuild/backend-contract-changes.md` (note the `web/` auth consumer; flag the historical `code`→`codigo` fix).
- Modify: `AUTONOMOUS_PROGRESS.md` (Slice 1 session entry).
- Modify: `.superpowers/sdd/progress.md` (ledger entry per task + follow-ups).

**Interfaces:** none (docs + verification gate).

- [ ] **Step 1: Production build + full typecheck + full test as the slice gate**

Run: `cd web && npm run typecheck && npm test && npm run build`
Expected: typecheck exit 0; all Vitest tests green; `next build` succeeds and reports the `(auth)` routes (`/register`, `/login`, `/verify-email`, `/forgot-password`) and `(app)` `/dashboard` as compiled routes.
If the build flags any `(auth)`/`(app)` page as attempting static generation with client-only hooks, confirm each `page.tsx` for those groups renders a `'use client'` feature component (the pages themselves can stay server components that import client components — that is correct and builds fine).

- [ ] **Step 2: Update the living contract doc**

In `docs/frontend-rebuild/backend-contract-changes.md`, add a short subsection under the auth area noting: the `web/` Next app now consumes `/user/{register,verify-email,resend-verification-email,login,verify-2fa,resend-2fa,forgot-password,verify-reset-code,reset-password,login/google,me}`; `verify-email`/`verify-2fa`/`reset-password`/`verify-reset-code` take the code field as `codigo` (the earlier CRA `code` payload was a client bug, fixed in the port); login step-1 returns either a session or `{ requires2FA, twoFactorMethod, temporalToken }`.

- [ ] **Step 3: Update progress logs**

Append a Slice 1 entry to `AUTONOMOUS_PROGRESS.md` (date 2026-10-08, what shipped, follow-ups) and a per-task entry in `.superpowers/sdd/progress.md` with any follow-ups discovered.

- [ ] **Step 4: Commit**
```bash
git add docs/frontend-rebuild/backend-contract-changes.md AUTONOMOUS_PROGRESS.md .superpowers/sdd/progress.md
git commit -m "docs(web): Slice 1 auth — contract-doc + progress-log update"
git push origin dev
```

---

### Task 10: E2E golden auth flow (Playwright) — slice exit gate

**Files:**
- Create: `web/playwright.config.ts`
- Create: `web/e2e/auth.spec.ts`
- Modify: `web/package.json` (add `@playwright/test` devDep + `"e2e": "playwright test"` script)

**Interfaces:** none (black-box E2E with the backend stubbed via `page.route`).

> Rationale: builds/tests run locally (Windows dev box), not the 1GB EC2. Playwright drives a locally-started Next dev server with all `/api/**` calls intercepted and stubbed, so the test needs no backend and no DB. This satisfies the audit's golden-flow gate for auth without external dependencies.

- [ ] **Step 1: Add Playwright**

Run (in `web/`):
```bash
npm install -D @playwright/test@^1.48.0
npx playwright install chromium
```
Expected: devDep added; Chromium downloaded.

- [ ] **Step 2: Write the E2E spec (it will fail until config exists)**

Create `web/playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

Create `web/e2e/auth.spec.ts`:
```ts
import { test, expect, Page } from '@playwright/test';

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function stubAuth(page: Page) {
  await page.route('**/api/user/register', (r) => r.fulfill(json({ user: { username: 'neo' }, token: 'temp', message: 'ok' }, 201)));
  await page.route('**/api/user/verify-email', (r) => r.fulfill(json({ user: { username: 'neo' }, token: 'jwt', message: 'ok' })));
  await page.route('**/api/user/login', (r) => r.fulfill(json({ user: { username: 'neo' }, token: 'jwt' })));
  await page.route('**/api/user/me', (r) => r.fulfill(json({ id: '1', username: 'neo', email: 'a@b.co', active: true, role: 'user', emailVerified: true, twoFactorEnabled: false, kycVerified: false, kycLevel: 'none' })));
}

test('register → verify email → dashboard', async ({ page }) => {
  await stubAuth(page);
  await page.goto('/register');
  await page.getByLabel('Email').fill('a@b.co');
  await page.getByLabel('Username').fill('neo');
  await page.getByLabel('Password').fill('secret12');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.getByLabel('Code').fill('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('direct login → dashboard', async ({ page }) => {
  await stubAuth(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill('a@b.co');
  await page.getByLabel('Password').fill('secret12');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('unauthenticated dashboard redirects to login', async ({ page }) => {
  await stubAuth(page);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 3: Run the E2E suite**

Run: `cd web && npm run e2e`
Expected: 3 tests PASS. If the dev server is slow to boot, Playwright waits up to the `webServer.timeout`.

- [ ] **Step 4: Commit**
```bash
git add web/playwright.config.ts web/e2e/auth.spec.ts web/package.json web/package-lock.json
git commit -m "test(web): Playwright golden auth flows (register/verify/login/guard)"
git push origin dev
```

---

## Self-Review

**Spec coverage (design §6 S1 — "register, verify-email, login/2FA, password recovery, Google; all server auth states actionable; errors by code; no missing routes"):**
- Register → Task 6. Verify-email → Task 6. Login → Task 7. 2FA (email + TOTP) → Task 7. Password recovery (forgot → verify-reset-code → reset) → Task 8. Google → Task 8. Errors by code → every form uses `useErrorTranslation().tError(err.code)` (Tasks 6–8) + catalog keys (Task 4). No missing routes → Tasks 6–8 create every `(auth)` page; guard + destination → Task 5. Render split (client auth) → `'use client'` components + `(app)` guard (Task 5). TanStack v5 upgrade → Task 1/3. Testing gates (typecheck+tests+build, every form state, keyboard/focus via `Field`/`Button`, golden flow) → per-task Vitest + Task 10 Playwright.

**Placeholder scan:** no TBD/TODO/"add validation"/"similar to Task N"; every code step has complete code; every test step has complete assertions.

**Type consistency:** `authApi` method names match between Task 2 (`api.ts`) and Task 3 (`queries.ts`) and the forms (Tasks 6–8). `isTwoFactorChallenge`/`LoginResult`/`TwoFactorChallenge` defined in Task 2 `types.ts`, consumed in Task 3 + Task 7. `USER_QUERY_KEY = ['auth','user']` defined in Task 3, asserted in Task 3 test. `makeQueryClient` defined in Task 1, reused by every test wrapper. `Field`/`Button` props (`label`, `loading`, `variant`) match the real primitives (verified in `shared/ui`). `verify-email` uses `codigo` everywhere (Task 2 test asserts it).

**Known ordering seam (flagged in-plan):** the `web/src/features/auth/index.ts` barrel and `LoginForm`'s import of `GoogleSignInButton` create a forward reference. Resolution is documented inline in Tasks 6–8 (export only existing files from the barrel per task; create a `null`-returning `GoogleSignInButton` stub before Task 7 if running strictly in order, replaced in Task 8).

## Out of scope (tracked elsewhere)
- fr/it/pt locale catalogs (roadmap i18n — only en/es wired).
- HttpOnly-cookie/CSRF migration, Google redirect-token removal (backend/security roadmap).
- Real Google Client ID provisioning + redirect-URI whitelist (deploy step; placeholder env is fine).
- Wallet/swap/trading/p2p/profile/admin screens (Slices S2–S7).
- TOTP enrollment UI in profile/security (Slice S6 — this slice only consumes the TOTP *login* challenge).
