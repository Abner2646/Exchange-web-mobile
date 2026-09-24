# Backend contract changes — frontend rebuild reference

> **Why this file exists.** The web/mobile frontends will be rebuilt (see roadmap
> phases 6–7). While that happens, the backend keeps evolving — and several
> low-level changes already alter the **client-facing contract** (response
> shapes, required headers, value types). This document is the single place that
> records those changes so the rebuild starts from an accurate picture instead of
> reverse-engineering the current clients (which predate these changes and are
> now partly out of sync).
>
> **This is a living document.** When a backend change alters anything a client
> depends on — a response shape, a status code, a required header, the *type* of
> a field, an enum value, an endpoint path/method — add an entry here in the same
> commit. If it doesn't touch the client contract, it doesn't belong here.
>
> **Also update the OpenAPI annotations.** The API is documented with OpenAPI /
> Swagger (interactive UI at `/api-docs`, raw spec at `/api-docs.json`), generated
> from `@openapi` JSDoc annotations that live **above each route** in
> `backend/routes/*.js`. On any endpoint create/change/delete, update its
> `@openapi` annotation **in the same commit** — an un-annotated endpoint simply
> does not appear in the spec. Setup: `backend/config/swagger.js`; regression
> guard: `backend/tests/openapiSpec.test.js`.
>
> Audience: whoever rebuilds the frontend. Written as "what the contract is now
> and what you must handle", not as internal planning (that lives in the
> gitignored `ROADMAP.md`).

---

## Contract as it stands now

### 1. Error responses use a canonical envelope

Every error from the money-path controllers, and **any** error that reaches the
central error handler, is returned as:

```json
{ "error": { "code": "STABLE_CODE", "message": "human-readable message" } }
```

- `code` is a **stable, machine-readable string** (e.g. `INSUFFICIENT_FUNDS`,
  `TRANSFER_NOT_FOUND`, `EXCHANGE_DAILY_LIMIT_EXCEEDED`). The frontend should
  branch on `code`, never on `message`.
- `message` is a default human string. It is **not** localized server-side — the
  frontend is expected to own the i18n catalog keyed by `code` (roadmap 7.3).
  Do not display `message` as the primary UX text once i18n exists; use it as a
  fallback.
- **Unexpected/internal errors** return HTTP 500 with a **sanitized** body:
  `{ "error": { "code": "INTERNAL_ERROR", "message": "...", "requestId": "<12-hex>" } }`.
  The raw internal error is **never** leaked; `requestId` correlates with the
  server log. Show the user a generic message + the `requestId` for support.
- 404 for unknown routes also uses this envelope.

**Caveat:** controllers outside the money-path may still return legacy shapes
until migrated. Treat the envelope above as the **target contract** — build the
client error handling around it, and report any endpoint that doesn't conform.

Migrated controllers (envelope guaranteed): `trading`, `transaccionBlockchain`,
`intercambioExchange`, `ofertaP2P`, `transaccionesP2P`, `transferencia`,
`balanceUsuario` (2026-09-03).

**`balanceUsuario` migration (2026-09-03) — error shape change on the balance
endpoints.** All `/api/balances/*` endpoints now return the canonical
`{ error: { code, message } }` envelope instead of the previous `{ error: "<raw
message>" }` (which leaked internal Sequelize/JS messages on unexpected errors).
Business error codes: `BALANCE_INVALID_INPUT` (bad/missing params, invalid
compartments) and `BALANCE_INSUFFICIENT` (not enough available balance, incl. the
Funding↔Spot self-transfer and admin ops). Unexpected errors are now a sanitized
`500 INTERNAL_ERROR` (no raw message). **Exception:** the testnet faucet
`PUT /api/balances/reclamarBTC` keeps its own `{ success, ... }` envelope (it is
disabled in production).

**`transaccionesP2P` envelope completed (2026-09-03) — state-machine & create
rejections are now typed 4xx, not 500.** The P2P transaction controller only
translated its own controller-level checks; the business errors thrown by the
model's state machine and by `createTransaction` leaked as a sanitized `500`.
They now return the canonical envelope with a proper status:
- `POST /api/transaccionP2P/` (accept offer): `P2P_TX_OFFER_INACTIVE`,
  `P2P_TX_AMOUNT_OUT_OF_RANGE`, `P2P_TX_INSUFFICIENT_FUNDS` (seller funds) — all `400`;
  `P2P_TX_OFFER_NOT_FOUND` (`404`), `P2P_TX_OWN_OFFER` (`400`).
- `PATCH /api/transaccionP2P/{id}/confirm-payment|complete|cancel`:
  `P2P_TX_INVALID_STATE` (`400`, wrong state transition — e.g. cancel after
  complete, complete before confirm), `P2P_TX_FORBIDDEN` (`403`, only the
  buyer confirms / only the seller completes / only a participant cancels),
  `P2P_TX_NOT_FOUND` (`404`). Success responses are unchanged.

### 2. Monetary values are canonical strings, not numbers

All money that comes **out** of money-path reads is now a **canonical decimal
string** (`"1234.56789012"`), not a JS `Number`. This is deliberate: numbers are
computed with decimal.js on the backend to avoid binary-float rounding errors,
and serializing them back through a JS `Number` would reintroduce the very
imprecision the backend is avoiding.

What this means for the client:
- **Never** run an incoming amount through `parseFloat`/`Number` and then back
  through arithmetic. Keep it as a string; if you must do math on the client
  (display totals, etc.), use a decimal library (decimal.js / big.js) — never
  native `+`/`*` on money.
- Affected reads include: user balances (available/blocked/total), swap preview
  amounts, fees, prices, and the amounts echoed back in swap/transfer responses.
- **Input** amounts sent to the backend should also be sent as strings. The API
  contract is "amounts as strings" (roadmap 7.3). Sending a JS number still works
  today (the backend normalizes at the edge) but is discouraged — a number with
  >15 significant digits already lost precision before it left the browser.

Formatting for display (thousands separators, locale decimal comma vs point) is a
**presentation** concern done at the render edge with `Intl.NumberFormat` — the
value on the wire is always canonical (dot decimal, no thousands separator).

### 3. `Idempotency-Key` header is required on money-moving POSTs

These endpoints now **require** an `Idempotency-Key` request header and return
**400** if it is missing:

- `POST /trading/orders`
- `POST /transaccionBlockchain/withdraw`
- `POST /transferencia/`
- `POST /intercambioExchange/` (swap execution) — added with the ledger/Spot work
- `POST /balances/my/transfer` (Funding↔Spot transfer) — added with the Spot compartment

Client responsibilities:
- Generate a UUID per user-intent (one per "submit"), send it as
  `Idempotency-Key`, and **reuse the same key on retries** of that same intent
  (network timeout, axios retry). A new key = a new operation.
- On a duplicate/replay the backend returns the original result. Concurrent
  in-flight duplicates may get 409/422 — treat those as "the first request is
  still processing", not as a hard failure.
- This is the server-side defense against double-submits. Keep the cheap
  client-side defense too (disable the button + "sending…" state on submit) — it
  covers the common double-click but does **not** cover network retries, which is
  why the header is mandatory.

### 4. Email / username are case-insensitive

Emails and usernames are trimmed and lowercased on every write. `Foo@x.com` and
`foo@x.com` are the **same** account; `Alice` and `alice` collide. The client
should not assume case is preserved for these fields, and should not rely on case
to distinguish accounts. (Display-name casing, if a separate nickname field is
ever added, is a different concern — see roadmap.)

### 5. Swap preview now matches execution math

The swap preview (`calculateExchange`) and the actual settlement now run the
**same** exact calculation (same money.js code path), so the amounts shown in a
preview equal the amounts the execution produces **for the same price**.

**Still open (do not assume fixed):** the price itself can change between the
moment the user sees the preview and the moment they confirm — there is no
quote-lock yet. Until that lands (roadmap Radar #11), the UX should not promise
that the previewed price is the executed price; show it as indicative. This is a
tracked backend change that will alter the swap flow contract when done (a quote
id + short TTL, or an explicit slippage tolerance the client sends).

### 6. Daily-limit window is UTC

The exchange daily-volume limit is computed over the **UTC** calendar day, not
the server's local day. Any client-side "remaining daily limit resets at…"
display should compute the boundary in UTC to match.

### 7. Google login sends a verified id_token (breaking change)

`POST /api/usuario/login/google` **no longer accepts** the old
`{ googleId, email, username, pais }` body. That shape trusted a client-supplied
`googleId` with no server-side verification — an account-takeover vector (anyone
could claim any Google identity). The endpoint now requires a **Google Identity
Services `id_token`** and verifies it server-side (signature + audience) before
trusting anything.

New contract:

```json
POST /api/usuario/login/google
{ "idToken": "<the Google id_token / credential from Google Identity Services>" }
```

- The client obtains the `idToken` from Google Identity Services (the `credential`
  field of the GIS callback) and sends **only** that. The backend derives the
  Google id, email, and name from the verified token — do not send them.
- **401** if the token is missing, expired, forged, or minted for a different
  client (audience mismatch). Treat 401 here as "Google sign-in failed, retry".
- Success returns the same shape as before: `{ message, user, token, isNew }`
  (`token` is our app JWT; `isNew` true when the account was just created).
- Country is **not** taken from this request anymore; it's set later via
  profile/KYC (roadmap 4.7). New Google accounts get a default until then.
- Both this endpoint and the server-side OAuth redirect flow
  (`GET /auth/google/callback`) now resolve to the **same** account logic
  (link-by-email + force email-verified), so signing in with Google via either
  path is consistent.

**Still open (do not assume fixed):** the OAuth redirect flow still returns the
app JWT in the **redirect URL query string** — a separate concern tracked in
ROADMAP Radar #12c; the callback contract may change (cookie / short-lived
exchange) when that's addressed.

### 8. Spot trading fee is charged from the received asset

The taker fee on a spot order is charged from the asset you **receive** at
settlement (Binance-style), not reserved up front in the asset you spend:

- **Buy:** placing a buy order locks exactly `quantity * price` in the quote
  asset (e.g. USDT). The fee is deducted from the **base** asset received (you
  get `quantity - fee` BTC). So the quote balance a buy needs is `quantity *
  price` — do **not** add the fee on top when showing "required balance".
- **Sell:** locks `quantity` of the base asset; the fee is deducted from the
  **quote** received.

Previously a buy over-reserved the estimated taker fee in quote and never
released it (funds stuck in "locked" forever). That is fixed: the lock now
matches what settlement consumes, and cancelling an order returns exactly what
was locked. (ROADMAP Radar #12a.)

**Still open:** if a buy fills at a **better** price than its limit, the price
improvement currently stays in "locked" until the order fully resolves — a
separate residual-release gap tracked in the roadmap. Don't assume locked hits
zero on a price-improved partial fill.

### 9. Compartmentalized balances — additive shape + internal transfer (2026-09-02)

**`GET /api/balances/my/balances` — additive per-compartment shape (non-breaking)**

Each entry in the array preserves the **existing** root keys
(`userId`, `criptomonedaId`, `balanceDisponible`, `balanceBloqueado`,
`balancePendiente`) — names are unchanged, making this a truly non-breaking
additive change. The root totals now represent the **sum of Funding + Spot**
for that crypto. A new `compartimentos` sub-object with the per-compartment
breakdown is added alongside:

```json
[
  {
    "userId":             "<uuid>",
    "criptomonedaId":     "<uuid>",
    "balanceDisponible":  "500.00000000",
    "balanceBloqueado":   "0.00000000",
    "balancePendiente":   "0.00000000",
    "compartimentos": {
      "funding": { "disponible": "300.00000000", "bloqueado": "0.00000000", "pendiente": "0.00000000" },
      "spot":    { "disponible": "200.00000000", "bloqueado": "0.00000000" }
    }
  }
]
```

Notes:
- The change is **non-breaking and additive**: the existing root fields
  `balanceDisponible`, `balanceBloqueado`, `balancePendiente`, and `userId` are
  preserved with their original names. Their values now carry the consolidated
  total across Funding and Spot (previously Funding-only). Clients reading those
  fields keep working and will automatically see the combined balance. The
  `compartimentos` sub-object is entirely new — existing clients that ignore
  unknown fields are unaffected.
- `pendiente` is a Funding-only concept (on-chain deposits detected but not yet
  confirmed). Spot has no `pendiente` field.
- All monetary values are 8-decimal canonical strings (see §2).
- Entries only appear for cryptos with at least one ledger account (Funding or Spot).
  An asset with no activity does not appear — treat a missing asset as `0` (see §3
  of the "Expected upcoming" notes in the previous ledger migration entry).

**Unified "my balances" shape across all three endpoints (2026-09-03) — BREAKING for two of them**

The three "my balances" endpoints now return the **same** compartmentalized shape
above, each entry additionally carrying a `criptomoneda` object
(`{ id, symbol, nombre, red, decimales }`):

- `GET /api/balances/my/balances` — was already this shape; now also includes
  `criptomoneda` (additive).
- `GET /api/intercambioExchange/me/balances` — **BREAKING**: was Funding-only flat
  (`balanceDisponible/Bloqueado/Pendiente` + `criptomoneda`, sorted by available
  desc). Now returns the consolidated root totals + `compartimentos` breakdown.
  Ordering is **no longer guaranteed** (sort client-side if needed).
- `GET /api/usuario/.../my-balances` — **BREAKING**: was Funding-only flat with no
  `criptomoneda` object. Now the unified shape.

Rationale: one source of truth for "my balances" (the frontend is being rebuilt,
so the break is acceptable now and cheap to absorb). Clients should read the root
totals for a consolidated view and `compartimentos.{funding,spot}` for the
per-wallet breakdown.

**`POST /api/balances/my/transfer` — internal Funding↔Spot transfer (new endpoint)**

Self-service transfer between a user's own compartments:

```
POST /api/balances/my/transfer
Authorization: Bearer <token>
{ "criptomonedaId": "<uuid>", "cantidad": "200", "origen": "funding", "destino": "spot" }
```

- `origen` and `destino` must each be one of `funding` or `spot`, and must differ.
- `cantidad` must be a positive amount (string preferred).
- **200** on success: `{ "message": "...", "data": { "origen": "funding", "destino": "spot" } }`.
- **400** if funds in `origen` are insufficient, if compartments are invalid/equal,
  or if `cantidad` is missing/zero.
- The ledger guard (double-entry FOR UPDATE) is the authoritative anti-overdraft
  check; the endpoint also runs an early-error availability check before posting.

**`POST /api/balances/testnet-faucet` — testnet multi-asset faucet (staging & internal preview)**

Testnet-only endpoint for employees and QA to claim test assets in 1 click:

```
POST /api/balances/testnet-faucet
Authorization: Bearer <token>
{ "symbol": "ALL", "amount": "10000" }
```

- When `symbol: "ALL"` (or omitted), credits 10,000 USDT + 1.00 BTC to Funding wallet.
- When `symbol` is a specific token (e.g. `"USDT"`, `"BTC"`, `"ETH"`), credits that token.
- Returns **404** automatically when `NODE_ENV === 'production'`.
- Returns **200** with `{ message: "...", data: { credited: [...], balances: [...] } }`.

**Swap `compartimento` param (landing in Task 9)**

The swap endpoint will accept an optional `compartimento` parameter (default
`"funding"`) to allow swapping from either compartment. Until Task 9 lands, swaps
always read from `funding`. Do not hard-code `funding` on the client — use the
field when available.

**Behavior change: order-book trading now requires funds in Spot**

Placing a trading order (buy or sell) now reserves funds from the **Spot**
compartment, not Funding. A user whose balance is in Funding must first transfer
to Spot (`POST /api/balances/my/transfer`) before trading. Withdrawals remain
**Funding-only** — funds must be in Funding to withdraw.

Summary of which operation reads from which compartment:

| Operation | Reads from |
|-----------|-----------|
| Order-book buy / sell | Spot |
| Withdrawal | Funding |
| Swap (current) | Funding (Task 9 adds `compartimento` param) |
| Internal transfer | User-chosen (`origen`/`destino`) |

---

### 10. User model — layered identity + profile fields (2026-09-05, Radar #14)

The `Usuario` model gained layered identity/profile fields (additive, all nullable
or defaulted — non-breaking):

- **Login vs display split:** `username` is the **unique, immutable** login handle;
  **`displayName`** is a separate **editable, non-unique** nickname to show (falls
  back to `username` when empty). Build profile/registration UIs around this split.
- **Profile / KYC (CIP set):** `nombreLegal`, `fechaNacimiento` (date), `estado`
  (province/state; `pais` already existed), `taxId`. **Sensitive** — only the owner
  (and admin) sees them; `taxId` is excluded from admin bulk listings.
- **Preferences:** `locale`.
- **Account status:** `nivelKyc` (`ninguno`|`basico`|`completo`, default `ninguno`;
  complements the existing `kycVerificado` boolean).
- **Never exposed:** the AML risk flag (`nivelRiesgoAml`, `revisionAmlPendiente`) is
  **stripped from every response** (`Usuario.toJSON`) — the frontend never receives
  it. Don't build UI around it.

**Profile edit is live:** the existing profile-update endpoint now edits
`displayName`, `pais`, `estado`, `locale` — **`username` is immutable** (removed
from the editable whitelist) and the whitelist blocks any mass-assignment
(`rol`, limits, KYC/AML fields are not user-editable). KYC identity fields
(`nombreLegal`/`fechaNacimiento`/`taxId`) are set by the KYC flow (§4.7), not free
profile edit.

**Email-change flow is live (sensitive action):**
- `POST /api/usuario/me/email-change` — body `{ nuevoEmail, passwordActual }`. Re-auths
  with the current password, checks the new email is free, and sends a confirmation
  **code to the new email**. Errors: `400/401 EMAIL_CHANGE_INVALID`.
- `POST /api/usuario/me/email-change/confirm` — body `{ codigo }`. Validates the code,
  updates the email (marks it verified), **notifies the old email**, and sets a
  **withdrawal cooldown** (`cooldownRetiroHasta`, duration = business config
  `cooldown_retiro_cambio_email_horas`, default 24h). Returns a fresh `token`.
- During the cooldown, `POST /api/transaccionBlockchain/withdraw` returns
  `403 WITHDRAWAL_COOLDOWN`.

(Full 2FA step-up for 2FA-enabled operators pairs with the §4.9 step-up infra — Fase 5.)

---

### 11. Referral program (Hito 8) — LIVE (2026-09-23)

One-level referral program. Money-path; all amounts are canonical decimal strings.

- `GET /api/referrals/summary` (auth): returns
  `{ pendingUsdt: "0.00000000", invitedCount: <n>, invited: [{ email, createdAt }] }`.
  Invited emails are **anonymized** server-side (e.g. `"jo***@domain.com"`) — never raw.
- `POST /api/referrals/claim` (auth, **`Idempotency-Key` header required**): atomically
  moves the accrued referral balance into the user's `funding:disponible` via the ledger and
  zeroes the pending balance in the same transaction. Returns
  `{ amountClaimed: "<string>", asset: "USDT" }`. Reusing the same key is idempotent (no double
  credit). `400 VALIDATION_ERROR` if there is nothing to claim or the key is missing.
- Commission rate is admin-configurable via business config `referral_commission_pct`
  (default `0.1`). Accrual books the commission to a dedicated house `referral_liability` ledger
  account at earn time (funded from `fee_revenue`); a claim drains that liability into the user's
  funding balance. Accrual from invitee trading fees is server-side; the automatic hook into the
  trade-fee settlement flow is a pending server-side follow-up.

---

### 12. Launchpad / token presales (Hito 10) — LIVE (2026-09-23)

Exchange-administered token presales. Money as canonical strings.

- `GET /api/launchpad/presales`: list presales (token, price in USDT, hard/soft cap, ticket min/max, dates, progress).
- `GET /api/launchpad/presales/:id`: presale detail.
- `POST /api/launchpad/buy` (auth, **`Idempotency-Key` required**): body `{ presaleId, amountUsdt }`. Debits USDT
  from `funding:disponible` into a suspense (escrow) account via the ledger; enforces per-user min/max, hard cap, and
  active dates. `400` on validation/insufficient funds.
- Resolution is server-side (job): at/above soft cap → tokens credited to buyers' `funding:disponible` instantly;
  below soft cap → 100% USDT refunded from suspense to buyers (no fees). Clients should reflect presale status.

**Operator Admin Lifecycle (LIVE 2026-09-23)**
Three new endpoints govern the presale lifecycle. These are strictly operator-gated and require Operator MFA.

- `POST /api/launchpad/presales` (auth: operator + MFA): create a new presale.
  - Body: `{ tokenCryptoId, priceUsdt, hardCapUsdt, softCapUsdt, minTicketUsdt, maxTicketUsdt, startDate, endDate }`
  - All money limits must be positive (minTicket can be zero), and valid combinations are enforced (e.g. softCap <= hardCap).
  - Returns `201` with the created presale. The status will be `PENDING`.
- `POST /api/launchpad/presales/:id/activate` (auth: operator + MFA): marks a `PENDING` presale as `ACTIVE`.
  - Only active presales accept contributions. Returns `200` with the updated presale.
- `POST /api/launchpad/presales/:id/resolve` (auth: operator + MFA): manually resolves an `ACTIVE` presale.
  - Returns `200` with the resolved presale (`RESOLVED_SUCCESS` or `RESOLVED_FAILED`).

---

### 13. KYC (Persona) (Hito 7) — LIVE (2026-09-23)

- `GET /api/kyc/status` (auth): returns the caller's current KYC tier/verification status. Use it to drive tier-gated UI.
- `POST /api/kyc/persona-webhook` is **server-to-server only** (HMAC-signed, not called by the client). On approval the
  user is upgraded to Tier 1 server-side; the client should re-read `/kyc/status` (or the user profile) after the
  provider flow completes. The withdrawal KYC requirement is gated by business config `kyc_required_for_withdrawals`
  (default false); enforcement in the withdrawal path is a pending server-side follow-up.

### 14. Maker-Checker / dual control (Hito 11) — LIVE engine (2026-09-23)

Operator-only governance for privileged actions (4-eyes). All routes require an operator with MFA enabled.
- `GET /api/governance/pending` — inbox of pending actions.
- `POST /api/governance/propose` — a maker proposes `{ actionType, payload, amountUsd? }`; returns a pending action with a TTL.
- `POST /api/governance/:id/approve` — a **distinct** checker authorizes with a **TOTP** code `{ codigo }` from
  their authenticator app (see §15). The checker can NEVER be the maker (`MAKER_CHECKER_SAME_USER`). Execution of the
  effect is atomic with authorization.
- `POST /api/governance/:id/reject` — reject with an optional reason.
- Hard rule: no monetary action above **$20,000 USD** can auto-execute — always dual control (inviolable ceiling; a
  higher configured threshold cannot bypass it). Error codes: `MAKER_CHECKER_SAME_USER/INVALID_STATE/EXPIRED/MFA_INVALID/NOT_FOUND`.
- A malformed `:id` (not a UUID) returns a clean `404 MAKER_CHECKER_NOT_FOUND` (no 500).

**Wired: large-withdrawal release (LIVE 2026-09-23).** The first privileged effect is now wired into the engine.
- On `POST /transaccionBlockchain/withdraw`, the server computes the withdrawal's USD magnitude **server-side** from
  the real crypto + amount (never a client-declared value). If it exceeds the configured threshold (default **> $5,000**,
  business config `withdrawal_dual_control_usd_threshold`) — or the **$20,000** hard ceiling — the withdrawal is created
  **held** and a `large_withdrawal_release` pending action is proposed automatically. The held withdrawal is NOT
  transmitted until a **distinct** operator approves it via `POST /api/governance/:id/approve` with their TOTP code.
- An asset with no USD valuation (no stable pair) fails **closed** by default (routed to dual control); operators can
  flip this via business config `withdrawal_dual_control_on_unvaluable` (default `true`).
- The withdrawal response shape is unchanged; clients should surface that large withdrawals may enter a
  pending-approval state before they are broadcast on-chain.

### 15. TOTP authenticator-app 2FA (replaces email-code 2FA) — LIVE enrollment (2026-09-23)

Second factor is migrating to **TOTP** (RFC 6238, e.g. Google Authenticator/Authy). Self-service enrollment
(all require the user's JWT):
- `POST /api/usuario/me/totp/setup` — begins enrollment; returns `{ otpauthUri, secret, qr }` where `qr` is a
  PNG data URL and `secret` is shown **once** for manual entry. Render the QR for the user to scan. 2FA is NOT yet active.
- `POST /api/usuario/me/totp/enable` — body `{ codigo }`; verifies the first code and activates TOTP (also flips the
  account's 2FA-enabled flag). `401 TOTP_INVALID` on a wrong code.
- `POST /api/usuario/me/totp/disable` — body `{ codigo }`; requires a valid current code. `401 TOTP_INVALID`.
- Error codes: `TOTP_INVALID / TOTP_NOT_ENABLED / TOTP_ALREADY_ENABLED / TOTP_ENROLLMENT_REQUIRED`.
- The TOTP `secret` is never returned again after setup and never appears in any user serialization.
- Used today by the Maker-Checker checker step-up (§14). **Migrating the login second factor** (`/login` →
  `/verify-2fa`) from the email code to TOTP is the next server slice; until then, login may still use the email code
  while governance uses TOTP.

---

## Expected upcoming contract changes (heads-up, not yet done)

These are tracked in `ROADMAP.md`; listed here so the rebuild anticipates them and
doesn't hard-code assumptions that are about to change:

- **Localized errors (7.3):** the frontend will own a `code → message` i18n
  catalog. Design error handling around `error.code` from day one.
- **Quote-lock for swaps (Radar #11):** swap flow will likely gain a quote id +
  TTL, or a client-sent slippage tolerance. See §5.
- **Double-entry ledger + compartmentalized balances (Radar #1 + #10) — MIGRATION IN PROGRESS:**
  the mutable `BalanceUsuario` is being replaced by an append-only double-entry
  ledger as the source of truth (balances are now read from a ledger projection;
  writes are being cut over path-by-path). Behavior is currently preserved
  (parity-reconciled), with two live changes to note: (a) **balance listings no
  longer include zero-balance entries** (a crypto the user has never funded simply
  won't appear, instead of showing `0`); and (b) **balance-listing entries no
  longer carry a per-row `id` or `updatedAt`** — an entry is keyed by its
  `criptomoneda`/`criptomonedaId`, with `balanceDisponible`/`balanceBloqueado` as
  canonical strings (never `parseFloat` them). Affects
  `GET /api/intercambioExchange/me/balances` and the other balance-listing reads;
  (c) **the user profile (`GET /api/usuario/me`, `getById`) no longer embeds a
  `balances` array** — fetch balances from a balances endpoint
  (`GET /api/balances/my/balances` or `/api/intercambioExchange/me/balances`)
  instead; and (d) **balances now carry a `balancePendiente` field** (canonical
  string): the **pending** state is live for deposits — an on-chain deposit shows
  in `balancePendiente` from the moment it's detected until it confirms, then moves
  to `balanceDisponible`. `getTotalBalance` gained a `pendiente` field; its `total`
  is still `disponible + bloqueado` and does **not** include pending (unconfirmed).
  Show pending deposits distinctly from spendable balance. Coming next: a single
  balance-per-(user,crypto)
  becomes several accounts (funding / spot / futures / earn) with available /
  blocked / **pending** states, and internal transfer flows between them. Don't
  hard-code "one balance per asset", and don't assume every listed asset has a row
  — treat a missing asset as `0`.
- **Business config moves to the DB (roadmap — admin-editable settings):**
  commissions, trading/swap pairs, limits — currently partly hardcoded/env — are
  expected to become admin-editable data. The client should read these from the
  API, never assume fixed values.
- **User data model expansion (roadmap — user identity review):** additional
  profile fields (legal name, country/state, tax id, locale, possibly a
  display-name/nickname distinct from the login username, an email-change flow).
  Registration/profile screens will change accordingly.
- **API versioning + OpenAPI (Radar #4):** endpoints may move under `/api/v1`
  and gain a published schema. Prefer a generated client once that exists.

---

## How to add an entry

1. Put it under **"Contract as it stands now"** if it's already live, or under
   **"Expected upcoming"** if it's planned.
2. State it as client-facing behavior: shape, type, header, status, path/method.
3. Note the caveat/scope (which endpoints, what's still legacy).
4. Cross-reference the roadmap item if there is one.
```
