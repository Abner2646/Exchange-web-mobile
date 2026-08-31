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
`intercambioExchange`, `ofertaP2P`, `transaccionesP2P`, `transferencia`.

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

---

## Expected upcoming contract changes (heads-up, not yet done)

These are tracked in `ROADMAP.md`; listed here so the rebuild anticipates them and
doesn't hard-code assumptions that are about to change:

- **Localized errors (7.3):** the frontend will own a `code → message` i18n
  catalog. Design error handling around `error.code` from day one.
- **Quote-lock for swaps (Radar #11):** swap flow will likely gain a quote id +
  TTL, or a client-sent slippage tolerance. See §5.
- **Compartmentalized balances / sub-wallets (Radar #10):** a single
  balance-per-(user,crypto) may become several accounts (funding / spot /
  futures / earn). Balance reads and transfer flows would gain a wallet/account
  dimension. Don't hard-code "one balance per asset".
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
