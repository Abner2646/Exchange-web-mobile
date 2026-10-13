# Next.js Slice 6 (Profile & Security) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Profile & Security vertical in the Next.js `web/` app — view/edit profile (displayName/country/state/locale), change password, change email (two-step, with the withdrawal-cooldown disclosure), manage 2FA (email toggle + TOTP enrollment), read notifications, and view/initiate KYC.

**Architecture:** Mirrors the S1 auth / S2–S5 feature pattern: `web/src/features/profile/{types.ts,api.ts,queries.ts,components/*,index.ts}` + a client-rendered `/profile` route under `web/app/(app)/`. Reading the profile reuses the existing `useCurrentUser()` (auth feature); mutations invalidate it. API talks to the **legacy Spanish mount paths** (`/user/me*`, `/notificaciones/me*`, `/kyc/status`) through the shared `apiClient`. No money spend path here, but email-change / password / 2FA are **security-sensitive** — those tasks are coordinator-reviewed.

**Tech Stack:** Next.js 14.2.35 App Router (React 18), TanStack Query v5, Vitest + Testing Library, the shared `@/shared/{api,i18n,ui}` modules.

## Global Constraints

- **React 18 / Next 14.2.35.** No React 19 APIs. All interactive components start with `'use client'`.
- **Backend mount paths are the legacy ones**, passed to `apiClient` WITHOUT an `/api` prefix (same as the auth feature's `/user/register`, `/user/me`): `/user/me`, `/user/me/change-password`, `/user/me/email-change`, `/user/me/email-change/confirm`, `/user/me/2fa-toggle`, `/user/me/totp/{setup,enable,disable}`, `/user/me/kyc-request`, `/notificaciones/me` (+ sub-paths), `/kyc/status`.
- **Request body field names are the backend's EXACT names** (some Spanish): email-change sends `{ nuevoEmail, passwordActual }`; its confirm sends `{ codigo }`; TOTP enable/disable send `{ codigo }`; change-password sends `{ currentPassword, newPassword }`. Do NOT rename these on the wire.
- **`username` is immutable** (login handle) — show it read-only; the profile update whitelist is server-side `['displayName','country','state','locale']`. Only send those four.
- **Error copy comes from the error catalog** via `useErrorTranslation().tError(code, params)`. When a code may be `INTERNAL_ERROR`, pass `{ requestId: err.requestId }`.
- **i18n:** add keys under a `profile.*` namespace to BOTH `en` and `es` catalogs (flat dotted keys under `ui`, e.g. `'profile.tab.account'`; this is the real catalog shape). A parity test enforces en==es. Add `nav.profile`. fr/it/pt out of scope.
- **Shared signatures (confirmed, pass verbatim):**
  - `useTranslation()` → `{ t, locale }`; `t(key, params?)`.
  - `useErrorTranslation()` (from `@/shared/i18n/errorCatalog`) → `{ tError }`; `tError(code, params?)`.
  - `useLocale()` (from `@/shared/i18n`) → `{ locale, setLocale }` — used to sync the app locale when the user changes their `locale` preference.
  - `Field` (`@/shared/ui`): `{ label, helpText?, error?, children }`, no `htmlFor`, clones ONE child carrying its own `id`.
  - `Button` (`@/shared/ui`): `variant`, `size`, `loading`, `disabled`.
  - `Dialog` (`@/shared/ui`): `{ isOpen, onClose, title, children, closeOnClickOutside? }`.
  - `apiClient` (`@/shared/api`): `get/post/put/patch/delete<T>(url, body?, options?)`. `ApiError`: `{ code, message, status, requestId? }`. Type queries/mutations `<T, ApiError>`.
  - Current user: `useCurrentUser()` (from `@/features/auth/queries`) → `{ data: User | null }`; `CURRENT_USER_KEY` — **confirm the exported query-key name in `web/src/features/auth/queries.ts` during Task 2** and invalidate it after profile/security mutations so the UI reflects changes.

---

## Backend Contract (grounded reference — read before coding)

Source: `backend/modules/users/{user.routes,user.controller,user.model,user.entity}.js`, `backend/modules/notifications/notification.{routes,controller,entity}.js`, `backend/modules/kyc/kyc.{routes,controller,service}.js`, `backend/routes/index.js`. **Route file wins on any conflict.**

### Profile — `/user`
- `GET /user/me` → the full `User` (already consumed by `useCurrentUser()`).
- `PUT /user/me` → update profile. Body may include `displayName`, `country`, `state`, `locale` (server whitelist; `username`/email ignored). Returns `{ user, token }` (a fresh token may be reissued — if a `token` is returned, store it via `session.setToken`).
- `PATCH /user/me/change-password` → `{ currentPassword, newPassword }` → `{ message }` (rate-limited).
- `POST /user/me/email-change` → `{ nuevoEmail, passwordActual }` → sends a code to the NEW email; `{ message }`.
- `POST /user/me/email-change/confirm` → `{ codigo }` → updates the email and **sets a temporary withdrawal cooldown**; `{ message }`.
- `PATCH /user/me/2fa-toggle` → **no body**; flips email-2FA server-side; returns `{ message, twoFactorEnabled }`.
- `POST /user/me/totp/setup` → `{ otpauthUri, secret, qr }` (qr = PNG data URL; secret shown once). `409` if TOTP already enabled.
- `POST /user/me/totp/enable` → `{ codigo }` → `{ message }` (`401` on bad code).
- `POST /user/me/totp/disable` → `{ codigo }` → `{ message }` (`401` on bad code).
- `POST /user/me/kyc-request` → submits KYC request (body = kycData, may be `{}` for a plain request) → `{ message, user, token }`.

### User shape (`web` `User` type — in `web/src/features/auth/types.ts`)
Currently: `{ id, username, email, displayName?, active, role, country?, state?, emailVerified, twoFactorEnabled, kycVerified, kycLevel: 'none'|'basic'|'full', dateOfBirth?, legalName? }`. **Extend additively** in Task 1 with `locale?: string` and `totpEnabled?: boolean` (both exist on the backend user and are needed by the profile/security UI).

### Notifications — `/notificaciones`
- `GET /notificaciones/me` → `{ ...pagination, notificaciones: Notification[] }`. Each notification has BOTH English and Spanish fields; **use the English ones**: `{ id, type: 'security'|'transaction'|'kyc'|'system'|'p2p'|'exchange', title, message, read: boolean, important: boolean, created_at /* or sentAt */ }` (Spanish aliases `titulo/mensaje/leida/tipo/importante` also present — ignore).
- `GET /notificaciones/me/unread-count` → unread count.
- `PATCH /notificaciones/me/mark-all-read` → mark all read.
- `PATCH /notificaciones/me/:id/mark-read` / `PATCH /notificaciones/me/:id/mark-unread` → per-notification.
- `DELETE /notificaciones/me/read` → delete all read notifications.

### KYC — `/kyc` + `/user/me/kyc-request`
- `GET /kyc/status` → `{ kycVerified: boolean, kycLevel: 'none'|'basic'|'full' }`.
- Initiate = `POST /user/me/kyc-request` (above). Persona is config-driven/stubbed (no inquiry-URL endpoint exposed) — the frontend shows status + a CTA that submits the request and explains the external verification will follow.

### No money spend path
This slice moves no funds. **Security-sensitive** flows (change-password, email-change + withdrawal cooldown, 2FA/TOTP) are coordinator-reviewed. No `@/shared/money` usage is expected anywhere in this slice.

---

## File Structure

```
web/src/features/profile/
  types.ts                         # ProfileUpdateRequest, Notification, KycStatus, TotpSetup, email-change/password/totp request types
  api.ts  / api.test.ts            # profileApi: profile, security, notifications, kyc
  queries.ts / queries.test.tsx    # hooks + mutations (invalidate the current-user key)
  i18nProfileKeys.test.ts          # en/es parity for profile.* keys
  index.ts                         # barrel exporting ProfilePage
  components/
    profile.module.css
    ProfileForm.tsx / .test.tsx           # edit displayName/country/state/locale (username read-only) + locale sync
    ChangePasswordForm.tsx / .test.tsx    # security
    EmailChangeForm.tsx / .test.tsx       # security — 2-step + withdrawal-cooldown disclosure
    TwoFactorSettings.tsx / .test.tsx     # security — email-2FA toggle + TOTP enroll (setup QR → enable → disable)
    NotificationsView.tsx / .test.tsx     # list + unread + mark/delete
    KycStatusCard.tsx / .test.tsx         # status + handoff CTA
    ProfileTabs.tsx / .test.tsx           # tab shell (Account | Security | Notifications | KYC)
web/src/features/auth/types.ts            # EXTEND User with locale?, totpEnabled?
web/app/(app)/profile/page.tsx            # client route rendering <ProfilePage/>
web/app/(app)/layout.tsx                  # add /profile nav link
docs/frontend-rebuild/backend-contract-changes.md  # add §22
```

---

### Task 1: Types + API client + extend User

**Files:** Create `web/src/features/profile/{types.ts,api.ts,api.test.ts}`; Modify `web/src/features/auth/types.ts`.

**Interfaces — Produces:**
- `web/src/features/auth/types.ts`: add `locale?: string;` and `totpEnabled?: boolean;` to `User` (additive, non-breaking).
- `types.ts`:
  - `ProfileUpdateRequest = { displayName?: string; country?: string; state?: string; locale?: string }`
  - `ChangePasswordRequest = { currentPassword: string; newPassword: string }`
  - `EmailChangeRequest = { nuevoEmail: string; passwordActual: string }`
  - `EmailChangeConfirmRequest = { codigo: string }`
  - `TotpSetupResponse = { otpauthUri: string; secret: string; qr: string }`
  - `TotpCodeRequest = { codigo: string }`
  - `Toggle2FAResponse = { message: string; twoFactorEnabled: boolean }`
  - `NotificationType = 'security'|'transaction'|'kyc'|'system'|'p2p'|'exchange'`
  - `AppNotification = { id: string; type: NotificationType; title: string; message: string; read: boolean; important: boolean; created_at?: string; sentAt?: string }`
  - `NotificationsResponse = { notificaciones: AppNotification[]; total?: number; page?: number; limit?: number }`
  - `KycStatus = { kycVerified: boolean; kycLevel: 'none'|'basic'|'full' }`
  - `ProfileUpdateResponse = { user: import('@/features/auth/types').User; token?: string }`
- `profileApi` (Step 3).

- [ ] **Step 1: Write the failing test** `api.test.ts` — mock `apiClient`, assert exact legacy paths and the EXACT Spanish body field names:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/shared/api';
import { profileApi } from './api';

vi.mock('@/shared/api', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
const m = apiClient as unknown as Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => vi.clearAllMocks());

describe('profileApi', () => {
  it('updateProfile PUTs /user/me with only whitelisted fields', async () => {
    m.put.mockResolvedValue({ user: { id: 'u1' }, token: 't' });
    await profileApi.updateProfile({ displayName: 'Abner', locale: 'es' });
    expect(m.put).toHaveBeenCalledWith('/user/me', { displayName: 'Abner', locale: 'es' });
  });
  it('changePassword PATCHes /user/me/change-password', async () => {
    m.patch.mockResolvedValue({ message: 'ok' });
    await profileApi.changePassword({ currentPassword: 'a', newPassword: 'b' });
    expect(m.patch).toHaveBeenCalledWith('/user/me/change-password', { currentPassword: 'a', newPassword: 'b' });
  });
  it('requestEmailChange POSTs the backend Spanish field names', async () => {
    m.post.mockResolvedValue({ message: 'ok' });
    await profileApi.requestEmailChange({ nuevoEmail: 'n@e.co', passwordActual: 'pw' });
    expect(m.post).toHaveBeenCalledWith('/user/me/email-change', { nuevoEmail: 'n@e.co', passwordActual: 'pw' });
  });
  it('confirmEmailChange POSTs { codigo }', async () => {
    m.post.mockResolvedValue({ message: 'ok' });
    await profileApi.confirmEmailChange({ codigo: '123456' });
    expect(m.post).toHaveBeenCalledWith('/user/me/email-change/confirm', { codigo: '123456' });
  });
  it('toggle2FA PATCHes with no body', async () => {
    m.patch.mockResolvedValue({ message: 'ok', twoFactorEnabled: true });
    await profileApi.toggle2FA();
    expect(m.patch).toHaveBeenCalledWith('/user/me/2fa-toggle');
  });
  it('totp setup/enable/disable hit the right paths', async () => {
    m.post.mockResolvedValue({});
    await profileApi.totpSetup();
    await profileApi.totpEnable({ codigo: '111111' });
    await profileApi.totpDisable({ codigo: '222222' });
    expect(m.post).toHaveBeenNthCalledWith(1, '/user/me/totp/setup');
    expect(m.post).toHaveBeenNthCalledWith(2, '/user/me/totp/enable', { codigo: '111111' });
    expect(m.post).toHaveBeenNthCalledWith(3, '/user/me/totp/disable', { codigo: '222222' });
  });
  it('getNotifications unwraps { notificaciones } and kyc status hits /kyc/status', async () => {
    m.get.mockResolvedValueOnce({ notificaciones: [{ id: 'n1' }], total: 1 });
    const r = await profileApi.getNotifications();
    expect(m.get).toHaveBeenCalledWith('/notificaciones/me');
    expect(r.notificaciones[0].id).toBe('n1');
    m.get.mockResolvedValueOnce({ kycVerified: false, kycLevel: 'none' });
    await profileApi.getKycStatus();
    expect(m.get).toHaveBeenCalledWith('/kyc/status');
  });
});
```
- [ ] **Step 2: Run** `cd web && npx vitest run src/features/profile/api.test.ts` → FAIL.
- [ ] **Step 3: Implement** `types.ts`, extend `auth/types.ts` User, then `api.ts`:
```ts
import { apiClient } from '@/shared/api';
import type { User } from '@/features/auth/types';
import type {
  ProfileUpdateRequest, ChangePasswordRequest, EmailChangeRequest, EmailChangeConfirmRequest,
  TotpSetupResponse, TotpCodeRequest, Toggle2FAResponse, NotificationsResponse, KycStatus, ProfileUpdateResponse,
} from './types';

export const profileApi = {
  updateProfile: (req: ProfileUpdateRequest) => apiClient.put<ProfileUpdateResponse>('/user/me', req),
  changePassword: (req: ChangePasswordRequest) => apiClient.patch<{ message: string }>('/user/me/change-password', req),
  requestEmailChange: (req: EmailChangeRequest) => apiClient.post<{ message: string }>('/user/me/email-change', req),
  confirmEmailChange: (req: EmailChangeConfirmRequest) => apiClient.post<{ message: string }>('/user/me/email-change/confirm', req),
  toggle2FA: () => apiClient.patch<Toggle2FAResponse>('/user/me/2fa-toggle'),
  totpSetup: () => apiClient.post<TotpSetupResponse>('/user/me/totp/setup'),
  totpEnable: (req: TotpCodeRequest) => apiClient.post<{ message: string }>('/user/me/totp/enable', req),
  totpDisable: (req: TotpCodeRequest) => apiClient.post<{ message: string }>('/user/me/totp/disable', req),
  requestKyc: () => apiClient.post<{ message: string; user: User }>('/user/me/kyc-request', {}),
  getNotifications: () => apiClient.get<NotificationsResponse>('/notificaciones/me'),
  getUnreadCount: () => apiClient.get<{ count: number } | number>('/notificaciones/me/unread-count'),
  markAllRead: () => apiClient.patch<{ message: string }>('/notificaciones/me/mark-all-read'),
  markRead: (id: string) => apiClient.patch<{ message: string }>(`/notificaciones/me/${id}/mark-read`),
  markUnread: (id: string) => apiClient.patch<{ message: string }>(`/notificaciones/me/${id}/mark-unread`),
  deleteRead: () => apiClient.delete<{ message: string }>('/notificaciones/me/read'),
  getKycStatus: () => apiClient.get<KycStatus>('/kyc/status'),
};
```
- [ ] **Step 4: Run** → PASS. Then `cd web && npx tsc --noEmit`.
- [ ] **Step 5: Commit** (explicit add of the 4 files): `feat(web): profile/security api client + types (Slice 6 Task 1)`

---

### Task 2: Query hooks + mutations

**Files:** Create `web/src/features/profile/{queries.ts,queries.test.tsx}`.

**Interfaces — Produces:** keys `PROFILE_NOTIFICATIONS_KEY`, `PROFILE_UNREAD_KEY`, `PROFILE_KYC_KEY`; queries `useNotifications()`, `useUnreadCount()`, `useKycStatus()`; mutations `useUpdateProfile()`, `useChangePassword()`, `useRequestEmailChange()`, `useConfirmEmailChange()`, `useToggle2FA()`, `useTotpSetup()`, `useTotpEnable()`, `useTotpDisable()`, `useRequestKyc()`, `useMarkAllRead()`, `useMarkRead()`, `useMarkUnread()`, `useDeleteRead()`. All `useMutation<_, ApiError, _>` with `retry: false`.

- [ ] **Step 1: Write the failing test** `queries.test.tsx` — mock `./api`; assert `useNotifications` fetches; `useUpdateProfile` calls `profileApi.updateProfile` and, on success, invalidates the current-user key (confirm its name) AND stores a returned `token` via `session.setToken` if present; `useToggle2FA` calls with no args. (Mirror `web/src/features/wallet/queries.test.tsx` wrapper.)
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `queries.ts` mirroring `web/src/features/wallet/queries.ts`. `'use client'`. Open `web/src/features/auth/queries.ts`, confirm the current-user query key export, import it, and invalidate it in `useUpdateProfile`/`useToggle2FA`/`useConfirmEmailChange`/`useTotpEnable`/`useTotpDisable`/`useRequestKyc` `onSuccess`. In `useUpdateProfile.onSuccess`, if `res.token` is returned, call `session.setToken(res.token)` (from `@/shared/api`). Notification mutations invalidate `PROFILE_NOTIFICATIONS_KEY` + `PROFILE_UNREAD_KEY`.
- [ ] **Step 4: Run** → PASS. tsc.
- [ ] **Step 5: Commit:** `feat(web): profile/security query hooks + mutations (Slice 6 Task 2)`

---

### Task 3: i18n keys (en/es) + parity test

**Files:** Modify `web/src/shared/i18n/catalogs/{en,es}.ts`; Create `web/src/features/profile/i18nProfileKeys.test.ts`.

The `ui` block is a FLAT object of dotted string keys. Add a `profile.*` namespace + `nav.profile` to BOTH catalogs (English + rioplatense Spanish). Cover: tabs (`profile.tab.{account|security|notifications|kyc}`), `nav.profile`, account form (displayName/country/state/locale labels + helps, username read-only note, save, saved), change-password (current/new labels, submit, mismatch/weak advisory, success), email-change (new-email + current-password labels, request submit, code label, confirm submit, **withdrawal-cooldown warning**, success), 2FA (email-2FA on/off, TOTP section title, enroll CTA, QR/secret instructions, enable-code label, enable/disable submit, enabled/disabled status), notifications (empty, mark-all-read, delete-read, unread badge, type labels, mark read/unread), KYC (status verified/unverified, level label, start-verification CTA, pending note).

- [ ] **Step 1: Write the failing parity test** (flat shape — filter `cat.ui` keys starting with `'profile.'`, assert en==es set + non-empty). Mirror `web/src/features/p2p/i18nP2pKeys.test.ts`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Add the keys** to both catalogs.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit:** `feat(web): profile i18n keys (en/es) + parity test (Slice 6 Task 3)`

---

### Task 4: ProfileForm (account tab)

**Files:** Create `web/src/features/profile/components/{ProfileForm.tsx,ProfileForm.test.tsx,profile.module.css}`.

**Interfaces — Consumes:** `useCurrentUser()` (auth), `useUpdateProfile()` (Task 2), `useLocale()` (`@/shared/i18n`), `useTranslation`, `useErrorTranslation`, `Field`, `Button`.
**Produces:** `export function ProfileForm()`.

Behavior: pre-fill `displayName`, `country`, `state`, `locale` from `useCurrentUser().data`. `username` + `email` shown READ-ONLY (username is immutable; email changes via the Email tab). On submit, `useUpdateProfile().mutate({ displayName, country, state, locale })`. **When `locale` changed, call `setLocale(newLocale)`** (from `useLocale`) on success so the app UI follows the saved preference. Button disabled while pending; success + error (`tError`) surfaced. `locale` is a `<select>` over the supported locales (`es`, `en` today; the catalog has 2 — list those two).

- [ ] **Step 1: Failing test** — renders pre-filled values; username field is read-only/disabled; saving calls `updateProfile` with the 4 fields; changing locale + saving calls `setLocale`. Mock queries + i18n + `useLocale`.
- [ ] **Step 2–4:** RED → implement → GREEN + tsc.
- [ ] **Step 5: Commit:** `feat(web): profile account form (Slice 6 Task 4)`

---

### Task 5: ChangePasswordForm (security — coordinator-reviewed)

**Files:** Create `web/src/features/profile/components/{ChangePasswordForm.tsx,ChangePasswordForm.test.tsx}`.

**Interfaces:** `useChangePassword()`, `useTranslation`, `useErrorTranslation`, `Field`, `Button`.
**Produces:** `export function ChangePasswordForm()`.

Behavior: three inputs — `currentPassword`, `newPassword`, `confirmNewPassword` (all `type="password"`). Client validation (advisory; server authoritative): all non-empty; `newPassword === confirmNewPassword`; `newPassword !== currentPassword`; a minimal length check if the project has one (confirm in auth register; else ≥8). Submit disabled until valid + while pending. On submit `useChangePassword().mutate({ currentPassword, newPassword })` (confirm field is NOT sent). On success clear the fields + show success; on error `tError(code,{requestId})` (e.g. wrong current password → the backend's typed 4xx).

- [ ] **Step 1: Failing test** — mismatch disables submit; valid submit sends `{ currentPassword, newPassword }` only (no confirm field); error renders.
- [ ] **Step 2–4:** RED → implement → GREEN + tsc.
- [ ] **Step 5: Commit:** `feat(web): change-password form (Slice 6 Task 5)`

---

### Task 6: EmailChangeForm (security — coordinator-reviewed)

**Files:** Create `web/src/features/profile/components/{EmailChangeForm.tsx,EmailChangeForm.test.tsx}`.

**Interfaces:** `useRequestEmailChange()`, `useConfirmEmailChange()`, `useTranslation`, `useErrorTranslation`, `Field`, `Button`.
**Produces:** `export function EmailChangeForm()`.

Behavior: **two steps in internal React state** (no URL/storage — mirror the S1 single-page step pattern):
- Step "request": inputs `nuevoEmail` (type=email) + `passwordActual` (type=password). **Display the withdrawal-cooldown warning up-front** (`profile.email.cooldownWarning`): confirming an email change places withdrawals on a temporary cooldown. Submit → `useRequestEmailChange().mutate({ nuevoEmail, passwordActual })`; on success advance to step "confirm".
- Step "confirm": input `codigo` (the code sent to the NEW email). Submit → `useConfirmEmailChange().mutate({ codigo })`; on success show a success state that **re-states the withdrawal cooldown is now active** and invalidates the current-user query (handled in the hook).
- Buttons disabled-while-pending; errors via `tError`. Do NOT persist `nuevoEmail`/`codigo` anywhere but React state.

- [ ] **Step 1: Failing test** — request step sends `{ nuevoEmail, passwordActual }` and advances; confirm step sends `{ codigo }`; the cooldown warning is rendered on the request step; error renders.
- [ ] **Step 2–4:** RED → implement → GREEN + tsc.
- [ ] **Step 5: Commit:** `feat(web): email-change two-step form with cooldown disclosure (Slice 6 Task 6)`

---

### Task 7: TwoFactorSettings (security — coordinator-reviewed)

**Files:** Create `web/src/features/profile/components/{TwoFactorSettings.tsx,TwoFactorSettings.test.tsx}`.

**Interfaces:** `useCurrentUser()`, `useToggle2FA()`, `useTotpSetup()`, `useTotpEnable()`, `useTotpDisable()`, `useTranslation`, `useErrorTranslation`, `Field`, `Button`, `Dialog`.
**Produces:** `export function TwoFactorSettings()`.

Behavior:
- **Email 2FA:** show `twoFactorEnabled` state; a toggle Button → `useToggle2FA().mutate()` (no args); disabled-while-pending; on success the current-user invalidation flips the displayed state.
- **TOTP (authenticator app):** show `totpEnabled` state.
  - If NOT enabled: an "Enroll" Button → `useTotpSetup().mutate()`; on success show the returned `qr` (PNG data URL in an `<img alt=...>`) + the `secret` (text, shown once, with a copy affordance optional) + an input `codigo` → "Enable" Button → `useTotpEnable().mutate({ codigo })`; on success invalidate current-user (totpEnabled→true), clear the setup state.
  - If enabled: a "Disable" Button that opens a confirm `Dialog` asking for a current `codigo` → `useTotpDisable().mutate({ codigo })`.
- All buttons disabled-while-pending; errors via `tError` (bad TOTP code → 401 typed error). The `secret`/`qr` live only in component state (never persisted).

- [ ] **Step 1: Failing test** — email-2FA toggle calls `toggle2FA()`; TOTP enroll shows QR+secret after setup resolves, and Enable sends `{ codigo }`; when `totpEnabled` is true, Disable opens the Dialog and confirming sends `{ codigo }`; a bad-code error renders. Mock the hooks + `useCurrentUser` + i18n.
- [ ] **Step 2–4:** RED → implement → GREEN + tsc.
- [ ] **Step 5: Commit:** `feat(web): 2FA/TOTP security settings (Slice 6 Task 7)`

---

### Task 8: NotificationsView

**Files:** Create `web/src/features/profile/components/{NotificationsView.tsx,NotificationsView.test.tsx}`.

**Interfaces:** `useNotifications()`, `useUnreadCount()`, `useMarkAllRead()`, `useMarkRead()`, `useMarkUnread()`, `useDeleteRead()`, `useTranslation`.
**Produces:** `export function NotificationsView()`.

Behavior: list `notificaciones` (use English fields `title`/`message`/`read`/`type`/`created_at`); unread ones highlighted; a per-item mark-read/mark-unread toggle; a "mark all read" action; a "delete read" action (behind a confirm `Dialog` is optional — a plain button is acceptable since it only removes already-read items); an unread-count badge; type label per item. Loading/empty/error states. Dates via `new Date(created_at).toLocaleDateString(locale)`.

- [ ] **Step 1: Failing test** — renders read + unread items; mark-all-read calls the mutation; per-item mark-read calls `markRead(id)`; empty + error states. Mock queries + i18n.
- [ ] **Step 2–4:** RED → implement → GREEN + tsc.
- [ ] **Step 5: Commit:** `feat(web): notifications view (Slice 6 Task 8)`

---

### Task 9: KycStatusCard

**Files:** Create `web/src/features/profile/components/{KycStatusCard.tsx,KycStatusCard.test.tsx}`.

**Interfaces:** `useKycStatus()`, `useCurrentUser()`, `useRequestKyc()`, `useTranslation`, `useErrorTranslation`, `Button`.
**Produces:** `export function KycStatusCard()`.

Behavior: show the KYC status from `useKycStatus()` (`kycVerified` + `kycLevel`) — a clear verified/unverified indicator + the level. If not verified, a "Start verification" CTA → `useRequestKyc().mutate()` with a note that identity verification is handled by an external provider (Persona, config-driven) and an admin/provider review will follow; on success show a pending/submitted state. Loading/error states; `tError` on error.

- [ ] **Step 1: Failing test** — verified status renders the verified indicator + level; unverified renders the CTA and clicking it calls `requestKyc()`; pending/submitted state after success. Mock queries + i18n.
- [ ] **Step 2–4:** RED → implement → GREEN + tsc.
- [ ] **Step 5: Commit:** `feat(web): KYC status card + verification handoff (Slice 6 Task 9)`

---

### Task 10: Profile page shell + tabs + route + nav + barrel

**Files:** Create `web/src/features/profile/components/{ProfileTabs.tsx,ProfileTabs.test.tsx}`, `web/src/features/profile/index.ts`, `web/app/(app)/profile/page.tsx`; Modify `web/app/(app)/layout.tsx`.

**IMPORTANT paths:** the App Router lives in `web/app/` (NOT `web/src/app/`). Mirror `web/app/(app)/trading/page.tsx` and add the nav link in `web/app/(app)/layout.tsx` (`<Link href="/profile">{t('nav.profile')}</Link>`).

**Produces:** `ProfilePage` (exported from the barrel). A 4-tab shell (`role="tablist"`) over: **Account** (`ProfileForm`), **Security** (`ChangePasswordForm` + `EmailChangeForm` + `TwoFactorSettings` stacked), **Notifications** (`NotificationsView`), **KYC** (`KycStatusCard`).

- [ ] **Step 1: Failing test** `ProfileTabs.test.tsx` — 4 tab labels render; clicking switches panels (mock child components to stubs + i18n).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `ProfileTabs` (`'use client'`, mirror `web/src/features/p2p/components/P2PTabs.tsx`), barrel (`export { ProfilePage } from './components/ProfileTabs'`), `page.tsx` (`import { ProfilePage } from '@/features/profile'; export default function Page(){ return <ProfilePage/>; }`), and the nav link.
- [ ] **Step 4: Run** `cd web && npx vitest run src/features/profile` → PASS; then `cd web && npx tsc --noEmit` and `cd web && npm run build` (confirm `/profile`).
- [ ] **Step 5: Commit:** `feat(web): profile page shell, tabs, route + nav link (Slice 6 Task 10)`

---

### Task 11: Contract doc §22 + final slice gate

**Files:** Modify `docs/frontend-rebuild/backend-contract-changes.md` (add §22).

- [ ] **Step 1:** Add **§22 — Next.js `web/` app — profile & security endpoints consumed (Slice 6, 2026-10-12)** documenting the consumed paths, the EXACT Spanish request body names (`nuevoEmail`/`passwordActual`/`codigo`), that `username` is immutable (whitelist `displayName`/`country`/`state`/`locale`), the email-change → withdrawal-cooldown consequence, TOTP enrollment (setup/enable/disable), notifications, and KYC status + handoff.
- [ ] **Step 2: Full gate:** `cd web && npx tsc --noEmit && npx vitest run && npm run build` — tsc 0; all Vitest green (prior 320 + the new profile tests); `/profile` route in the build.
- [ ] **Step 3: Commit:** `docs: profile & security contract §22 + Slice 6 gate (Slice 6 Task 11)`

---

## Self-Review

**Spec coverage** (sprint line "Profile & security: displayName/locale/perfil, cambio de email + cooldown, notificaciones; handoff KYC"):
- displayName/locale/profile → Task 4 (+ locale→app sync). Email change + cooldown → Task 6. Notifications → Task 8. KYC handoff → Task 9. Security hardening (password + 2FA/TOTP) → Tasks 5, 7 (part of "& security"). Shell/route/nav → Task 10. Contract doc → Task 11.
- **Explicitly out of scope** (documented): public profile / user search; admin user management (→ S7 Admin); ratings; fr/it/pt locales.

**Placeholder scan:** security tasks (5, 6, 7) carry full behavior + test specs; display tasks (4, 8, 9, 10) give exact shapes + interfaces + representative tests and point at the files to mirror (S1 auth forms, S5 P2PTabs, wallet views).

**Type consistency:** `User` extended once (Task 1) with `locale?`/`totpEnabled?`; `ProfileUpdateRequest`/`AppNotification`/`KycStatus`/`TotpSetupResponse` defined in Task 1 and consumed unchanged in 2–10. Wire body names (`nuevoEmail`/`passwordActual`/`codigo`/`currentPassword`/`newPassword`) are the backend's exact names, asserted in Task 1's test.

**Security check:** change-password never sends the confirm field; email-change is two-step with the withdrawal-cooldown disclosed up-front AND re-stated on success; TOTP `secret`/`qr` live only in component state; 2FA/TOTP/email-change/password mutations are `retry:false` and disabled-while-pending; bad-code/wrong-password surface the backend's typed 4xx. No `@/shared/money` anywhere (no spend path).
