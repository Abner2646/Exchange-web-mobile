# Idempotency — Design Spec

- **Date:** 2026-08-22
- **Phase:** Roadmap Fase 1 ("Otros errores de bajo nivel" → Idempotencia)
- **Status:** Approved (design), pending implementation plan

## Problem

The money-creating POST endpoints have no idempotency protection. A double
click, a network timeout with a client retry, or an axios auto-retry can create
two identical orders / withdrawals / transfers. The columns and balances are
now exact (money.js migration), but nothing stops the *same operation* from
running twice.

Endpoints in scope:

- `POST /trading/orders` → `tradingController.createOrder`
- `POST /transactions/withdraw` → `transaccionBlockchainController.createWithdrawal`
- `POST /transfers/` → `transferenciaController.createTransferencia`

## Goal

A single reusable Express middleware that makes these endpoints idempotent using
a client-supplied `Idempotency-Key` header, Stripe-style: a retry with the same
key returns the exact original response without re-executing the operation.

Non-goals (explicitly deferred):

- Transactional idempotency (recording the key inside each operation's own DB
  transaction) — see "Known limitation" below. This pass uses the standard
  middleware approach, which the roadmap specifies.
- A real SQL migration file for the new table — the project currently builds its
  schema via `sequelize.sync` (migrations are empty, known debt). The new model
  is synced like every other model.
- Frontend/mobile changes to send the header — the frontend is being reformulated
  separately (Fase 7.3). This spec makes the header **required** on these
  endpoints; wiring the clients to send it is out of scope here.

## Behavior

The client generates a UUID and sends it in the `Idempotency-Key` header.

| Case | Response |
|---|---|
| 1st request with a key | Operation runs; the response `(statusCode, body)` is stored. |
| Retry: same key + same body | The stored original response is replayed verbatim (no re-execution). |
| Same key + different body | `422 IDEMPOTENCY_KEY_REUSED` (request fingerprint mismatch). |
| Same key while the 1st is still running (live concurrency) | `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` (no execution). |
| Header missing | `400 IDEMPOTENCY_KEY_REQUIRED`. |

### Approved defaults

1. **Header required** on these 3 endpoints. Optional idempotency gives false
   safety, and the frontend is being reformulated anyway.
2. **5xx responses are NOT cached.** If the operation returns a server error
   (status ≥ 500), the key row is released so a retry can execute (5xx are
   transient). Responses with status < 500 (including 4xx business errors like
   "insufficient balance") ARE cached — they are definitive results.
3. **Stale `in_progress` reclaim.** A row left `in_progress` for more than 90s
   (server crashed mid-request) may be re-claimed and re-executed. This is safe
   because each operation is transactional: if it crashed, its DB transaction
   rolled back and no money moved.

## Data model — `IdempotencyKey`

New Sequelize model (entity + model factory following the existing pattern),
created via `sequelize.sync` like the rest.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID, PK, default v4 | |
| `userId` | UUID, not null | scopes keys per user (avoids cross-user collision/enumeration) |
| `idempotencyKey` | STRING, not null | the header value |
| `requestHash` | STRING(64), not null | `sha256(method + '\n' + path + '\n' + canonicalJSON(body))` |
| `status` | ENUM `in_progress` \| `completed`, not null | concurrency gate |
| `responseStatusCode` | INTEGER, nullable | stored response (set on completion) |
| `responseBody` | JSONB, nullable | stored response body |
| `createdAt` / `updatedAt` | timestamps | used for TTL and stale reclaim |

- **UNIQUE constraint on `(userId, idempotencyKey)`** — the atomic claim gate.
  Postgres guarantees exactly one INSERT wins under concurrency (same
  atomic-claim pattern as the Fase 0 withdrawal row-claim; no application lock).
- Index on `createdAt` for the cleanup job.

## Request fingerprint

`requestHash = sha256(method + '\n' + path + '\n' + canonicalJSON(body))`.

`canonicalJSON` serializes the body with **sorted object keys** (recursively) so
that a re-ordered-but-equivalent body produces the same hash. This is what
detects "same key, different params" (→ 422) while tolerating harmless key
reordering by the client.

## Middleware — `backend/middleware/idempotency.middleware.js`

Exported as a factory or plain middleware usable on any route. Flow:

1. Read `Idempotency-Key` header. If absent → `400 IDEMPOTENCY_KEY_REQUIRED`.
2. Compute `requestHash` from `req.method`, the request path **without query
   string** (`req.baseUrl + req.path`), and `req.body`. Read `userId` from
   `req.user` (auth middleware ran already).
3. **Atomic claim:** `INSERT` a row `(userId, key, requestHash, status='in_progress')`.
   - **INSERT succeeds (this is the first request):**
     - Wrap `res.json` to capture the response body; remember `res.statusCode`.
     - Call `next()` (runs the controller).
     - On response finish:
       - status < 500 → `UPDATE` row to `status='completed'`, store
         `responseStatusCode` + `responseBody`.
       - status ≥ 500 → `DELETE` the row (release the key for retry).
   - **INSERT fails (unique violation) — a row already exists:** load it.
     - `requestHash` differs → `422 IDEMPOTENCY_KEY_REUSED`.
     - `status='in_progress'` and `updatedAt` within 90s → `409 IDEMPOTENCY_REQUEST_IN_PROGRESS`.
     - `status='in_progress'` and older than 90s (stale) → re-claim
       (`UPDATE ... SET requestHash, updatedAt=now WHERE id=? AND status='in_progress'`)
       and proceed as the first request. If the conditional UPDATE affects 0 rows
       (another request reclaimed first), fall back to `409`.
     - `status='completed'` → **replay**: send `responseStatusCode` +
       `responseBody` and do NOT call the controller.

### Response capture

Controllers respond via `res.json(...)`. The middleware monkeypatches `res.json`
on this request to record the serialized body, then calls the original. The
persist step runs on the response `finish` event (so it also covers the error
path). `res.statusCode` gives the status.

## Placement in the route chain

Idempotency runs as the **last middleware before the controller**, after auth and
validation:

```
authenticateToken → [validation: joi or express-validator] → idempotencyMiddleware → controller
```

Rationale: only authenticated, well-formed requests reserve a key (`userId` is
available; invalid bodies never create key rows), and the replay short-circuits
before the controller. The middleware is agnostic to which validation system the
route uses.

## TTL / cleanup

Keys are retained 24h. A small cleanup job in the existing `JobManager`
periodically deletes rows with `createdAt < now - 24h`. The 90s stale-reclaim is
independent of this 24h retention (it only governs re-execution of hung
requests).

## Error responses (stable codes)

All idempotency errors return a JSON body `{ error, code }` with a stable `code`
(for the future frontend i18n catalog per Fase 7.3):

- `400` → `IDEMPOTENCY_KEY_REQUIRED`
- `409` → `IDEMPOTENCY_REQUEST_IN_PROGRESS`
- `422` → `IDEMPOTENCY_KEY_REUSED`

## Testing (TDD, Red-Green)

Unit tests with mocked `req`/`res` and a mocked `IdempotencyKey` model:

1. First request: INSERT succeeds → `next()` is called; on finish the row is
   updated to `completed` with the captured status/body.
2. Replay: existing `completed` row with matching hash → stored response is sent,
   `next()` is NOT called.
3. Same key, different body → `422`, `next()` not called.
4. `in_progress` within 90s → `409`, `next()` not called.
5. Missing header → `400`, `next()` not called.
6. 5xx from the controller → row is deleted (key released), not cached.
7. `requestHash` stability: two bodies that differ only in key order produce the
   same hash.

Plus a focused test that the atomic-claim branch selection is driven by the
unique-violation error (simulate the INSERT rejecting).

## Known limitation (documented tradeoff)

If an operation **commits** but the server crashes **before** the `finish`
handler writes `completed`, the row stays `in_progress`; after 90s a retry would
re-execute (the original op did commit, so this could double-execute in that
narrow window). Closing this fully requires writing the idempotency row inside
each operation's own DB transaction (invasive; touches every controller). The
middleware approach is the industry standard and what the roadmap specifies; the
transactional version is noted as future hardening and pairs naturally with the
double-entry ledger (Radar #1).
