# Backend changes that break the current frontend — remediation checklist

> **Purpose.** The backend matured a lot (Fases 0–4 + Radar #13/#14) while the web
> (`frontend/`) and mobile (`mobile/`) apps were built against an older backend.
> This is the **consolidated, frontend-oriented checklist** of every backend
> contract characteristic the old frontends will break on, with what the frontend
> must do. The chronological detail lives in
> [`backend-contract-changes.md`](./backend-contract-changes.md) (§1–§10) — this
> file is the "start here when fixing the integration" view.
>
> **Sequencing note (decided).** The backend will be **renamed to English in
> Fase 6.2** (routes, models, DB columns, response field names) — safely, backed by
> ~526 tests. So the frontend integration should be rebuilt **once, against the
> post-rename English contract**, not against today's Spanish routes/fields. Treat
> the routes/field names below as *today's* (Spanish); expect them to become English.
> Use this doc to understand *what* changed conceptually; pin exact names against the
> live OpenAPI (`/api-docs`, 209+ paths) at rebuild time.

Legend: 🔴 breaks silently / hard · 🟡 behavioral, handle it · 🆕 new capability.

---

## 1. 🔴 Error responses — canonical envelope (branch on `code`, not `message`)

Every error from the money-path controllers, P2P, and anything reaching the central
handler is now:

```json
{ "error": { "code": "STABLE_CODE", "message": "human message" } }
```

- **Frontend must branch on `error.code`** (stable machine string), never on the
  message text. Old code that read `res.data.error` as a *string*, or read a
  `{ success:false, message }` shape, **breaks**.
- Unexpected/internal errors: `{ "error": { "code": "INTERNAL_ERROR", "message": "...", "requestId": "<hex>" } }` — show a generic message + the `requestId` for support.
- P2P transaction business errors that used to be `500` are now typed `4xx`
  (`P2P_TX_INVALID_STATE`, `P2P_TX_FORBIDDEN`, `P2P_TX_OFFER_INACTIVE`,
  `P2P_TX_AMOUNT_OUT_OF_RANGE`, `P2P_TX_INSUFFICIENT_FUNDS`, …).
- **Caveat:** a few non-money controllers still return legacy shapes; build a
  tolerant error reader but treat the envelope as the target. (Detail: §1 of the
  change-log doc.)

## 2. 🔴 Money is canonical **strings**, not numbers

Balances, amounts, fees come back as exact decimal **strings** (`"0.69700000"`),
not JS numbers. The frontend must:
- Never do float math on them (use a decimal lib, e.g. decimal.js/big.js, for any
  arithmetic or comparison).
- Format for display per locale at render time (the value is canonical: `.`
  decimal, no thousands separator). i18n of number/date formatting is Fase 7.3.

## 3. 🔴 `Idempotency-Key` header REQUIRED on money POSTs

These 5 endpoints now **reject with 400 `IDEMPOTENCY_KEY_REQUIRED`** if the header
is missing:
- create spot order · create withdrawal · create transfer · swap (intercambio) ·
  Funding↔Spot compartment transfer.

Frontend must, per money action: generate a UUID and send it as `Idempotency-Key`;
**reuse the same key on retries** of the same intent. Handle:
- `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` → the first request is still running; retry shortly.
- `422 IDEMPOTENCY_KEY_REUSED` → same key, different body (a bug in the client).
- A retry with the same key **replays the original response** (don't double-submit).
Also disable the submit button + show a "sending…" state (cheap first-line defense).

## 4. 🔴 Auth changes

- **Google login now requires a real `id_token`.** `POST /login/google` takes
  `{ idToken }` and verifies it server-side; the old `{ googleId, email, … }` body
  is gone (it was an account-takeover hole). Frontend must use Google Identity
  Services to obtain an `id_token` and send that. (Detail §7.)
- `requireEmailVerified` gates many authenticated endpoints → `403` with
  `requiresEmailVerification: true`; the frontend must route the user to the
  verify-email flow.
- 2FA (email-code), password reset, email verification are code-based flows —
  align the screens to the current endpoints (pin against `/api-docs`).

## 5. 🆕 Compartmentalized balances (Funding / Spot)

- `GET /balances/my/balances` (and the intercambio/usuario "my balances" endpoints,
  now unified) return an **additive compartmented shape**: per crypto, root totals
  (Funding+Spot) **plus** a per-compartment breakdown **plus** a `criptomoneda`
  object. Old code that read a flat `{ balanceDisponible }` still finds the root
  totals but must be updated to show/By-compartment where relevant.
- New self-service **Funding↔Spot transfer**: `POST /balances/my/transfer`
  `{ criptomonedaId, cantidad, origen, destino }` — **idempotent** (needs the header, §3).
- Trading order book reserves/settles in **Spot**; withdrawals are **Funding-only**;
  swap can be from funding or spot. (Detail §9.)

## 6. 🆕 User model — layered identity (Radar #14)

- **`username` is immutable** (login handle); **`displayName`** is a new editable,
  non-unique nickname (falls back to `username`). Profile edit (`PUT /usuario/me`)
  now whitelists `displayName`, `pais`, `estado`, `locale` — sending `username`/`rol`/
  limits is silently ignored (mass-assignment cut). Build the profile UI around the split.
- New CIP/KYC profile fields exist (`nombreLegal`, `fechaNacimiento`, `estado`,
  `taxId`, `nivelKyc` tier) — sensitive ones only for the owner/admin.
- **AML risk flag is NEVER in any response** (`Usuario.toJSON` strips it) — don't
  build UI expecting it.
- 🆕 **Email-change flow** (sensitive): `POST /usuario/me/email-change`
  `{ nuevoEmail, passwordActual }` → sends a code to the **new** email; then
  `POST /usuario/me/email-change/confirm` `{ codigo }` → updates the email, notifies
  the old one, and sets a **withdrawal cooldown**. During the cooldown, withdrawals
  return **`403 WITHDRAWAL_COOLDOWN`** — the frontend must surface this state.
  (Detail §10.)

## 7. 🆕 Operator / admin surface (affects an admin panel, not end users)

- Privileged admin actions (system withdrawal/scan triggers, admin balance
  adjust/block/unblock/transfer, master-wallet create, setup-wallets initialize,
  P2P force-status) now require the operator to have **2FA enabled** →
  `403 OPERATOR_MFA_REQUIRED` (or `403 OPERATOR_REQUIRED` for non-admins).
- 🆕 **Business config** admin CRUD: `GET/PUT /config/:clave` (operator-MFA guarded)
  — the admin panel can edit fees/limits/confirmations as data (Radar #13).

## 8. 🟡 Other behavioral changes

- **Rate limiting** is live on auth (login/register/2FA/reset) and withdrawals →
  handle `429` gracefully (backoff + message).
- **Swap preview matches execution** (§5) and the **daily-limit window is UTC** (§6).
- Email/username are **case-insensitive** for uniqueness/login (§4).

---

## How to use this at rebuild time

1. Rebuild the frontend's **API/HTTP layer** against the **English** contract
   (post-Fase-6.2) — base URL, the canonical error-envelope reader, the money-string
   handling, the `Idempotency-Key` interceptor for money POSTs, and the auth/token flow.
2. Pin exact route paths + request/response field names against the **live
   `/api-docs`** — do not hardcode from this doc (names change with the rename).
3. Re-flow the screens that touch: balances (compartmented), money POSTs
   (idempotency + string amounts), auth (Google id_token, email-verified gate),
   profile (username/displayName split + email-change + cooldown), and the admin
   panel (operator-MFA, business config).

---

## Fase 6.2 rename — applied changes (living, per domain)

> As each backend domain is renamed to English (chunked, ~526 tests green after
> each), its concrete old→new contract lands here. Domains not yet listed are still
> in Spanish. Pin exact names against live `/api-docs`.

### ✅ users / auth  (chunk 1 — done)

- **Route base:** `/api/usuario/*` → **`/api/user/*`** (all auth + profile + admin
  user endpoints: `register`, `login`, `login/google`, `logout`, `verify-email`,
  `resend-verification-email`, `forgot-password`, `verify-reset-code`,
  `reset-password`, `me`, `verify-2fa`, `resend-2fa`, `me/2fa-toggle`,
  `me/email-change`, `me/email-change/confirm`, `:id/role`, `:id/status`, …).
- **User object fields (response + request):**
  `rol`→`role`, `activo`→`active`, `pais`→`country`, `estado`→`state` (province),
  `emailVerificado`→`emailVerified`, `dosFactoresActivado`→`twoFactorEnabled`,
  `kycVerificado`→`kycVerified`, `nivelKyc`→`kycLevel`,
  `reputacionPromedio`→`averageRating`, `totalValoraciones`→`totalRatings`,
  `limiteDiarioUsd`→`dailyLimitUsd`, `nombreLegal`→`legalName`,
  `fechaNacimiento`→`dateOfBirth`, `emailPendiente`→`pendingEmail`,
  `cooldownRetiroHasta`→`withdrawalCooldownUntil`.
- **List response key:** `{ usuarios: [...] }` → **`{ users: [...] }`**.
- **Enum values:** `kycLevel` `ninguno|basico|completo` → **`none|basic|full`**.
- **Cross-cutting:** `active` / `role` / `country` are now the field names wherever
  they appear (also on other domains' objects that expose an active flag — those
  domains' full rename lands in later chunks).
