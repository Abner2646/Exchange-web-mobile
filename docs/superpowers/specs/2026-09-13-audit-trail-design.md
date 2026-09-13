# Immutable audit trail (Fase 6.2.1 slice 2, Radar #3) — design

**Status:** approved (design), pending implementation plan.
**Depends on:** the transactional outbox + event bus (slice 1, on `dev`,
`docs/superpowers/specs/2026-09-13-event-driven-outbox-design.md`).
**Scope:** a generic, hash-chained, tamper-evident audit log that records EVERY
domain event flowing through the outbox, plus a chain-verification function. This
slice adds NO new event emitters and touches NO money-path code — it is a pure
additive consumer, proven with the P2P events slice 1 already emits.

## Why

Radar #3 wants an immutable audit trail. What exists is close but not it:
- The **ledger** (LedgerEntry/LedgerMovement) is an immutable, append-only record
  of *money* only.
- The **outbox_events** table is an append-log of domain events, but its rows
  **mutate** (`pending`→`dispatched`) and are operational/prunable — not a
  retained, tamper-evident record.

The audit trail is a distinct concern: one retained, tamper-evident history of
*what happened* (money and, later, non-money events like KYC/admin/login),
independent of the operational outbox, cryptographically verifiable. Maps to
NYDFS Part 500 §500.06 (audit trail) and BSA recordkeeping; only reinforces the
standards.

## Architecture — the pieces

A new module `backend/modules/audit/`, consuming the existing event bus.

1. **`audit_log` table** (`AuditLog` model) — the immutable record, one row per
   event, hash-chained.
2. **`eventBus.onAny(name, fn)`** — a new small method on the existing eventBus:
   subscribe a handler to ALL events (not per type). This is what lets the audit
   trail record everything without enumerating types.
3. **`auditConsumer(event)`** — the handler subscribed via `onAny`. Writes one
   chained `audit_log` row per event; idempotent by `event_id`.
4. **`verifyAuditChain()`** — recomputes the chain and reports tampering.
5. **Wiring** — `auditConsumer` registered in `registerHandlers.registerAllHandlers()`
   (beside the notification handler); `scripts/verifyAuditChain.js` runs the check
   manually.

**Flow:** money-path emits event → outbox → publisher dispatches → eventBus runs
the `onAny` handlers (audit) FIRST, then the type handlers (notifications) →
`auditConsumer` writes the chained row. Zero money-path changes (purely additive).

## Data model — `audit_log`

English identifiers, snake_case columns:

| attr | column | type | purpose |
|---|---|---|---|
| `id` | `id` | BIGINT PK auto-increment (serial) | identity + monotonic chain order |
| `eventId` | `event_id` | UUID, **UNIQUE**, not null | source outbox event id; idempotency key (one row per event) |
| `eventType` | `event_type` | STRING not null | e.g. `P2PTransactionCompleted` |
| `payload` | `payload` | JSONB not null | snapshot of the event facts |
| `aggregateId` | `aggregate_id` | UUID nullable | affected entity (correlation/query) |
| `occurredAt` | `occurred_at` | DATE not null | when it happened (the event's outbox `created_at`) |
| `prevHash` | `prev_hash` | CHAR(64) nullable | hash of the previous row (null/genesis for the first) |
| `hash` | `hash` | CHAR(64) not null | this row's hash — the chain link |
| `createdAt` | `created_at` | DATE | when audited |

Indexes: unique `(event_id)`; `(event_type)`; `(aggregate_id)`. PK `id` gives order.

### Hash chain

```
hash = sha256( canonical({ eventId, eventType, payload, aggregateId, occurredAt }) + '|' + prevHash )
```
- `canonical(...)` = deterministic serialization: JSON with recursively sorted
  keys, so identical content always hashes identically.
- The auto `id` is NOT part of the hash (unknown before insert); integrity comes
  from *content + prevHash*.
- Computed with Node's built-in `crypto` (no new dependency).
- `GENESIS` = a fixed constant string used as `prevHash` for the first row.

### Writing a link (`auditConsumer`, per event, serialized by the single publisher)

1. Idempotency: if a row with this `event_id` exists → return (no-op).
2. Read the head: the `AuditLog` row with max `id` → its `hash` is `prevHash`
   (or `GENESIS` if the table is empty).
3. Compute `hash`.
4. Insert the row (`occurred_at = event.createdAt`).

Because the single publisher dispatches events one at a time in `created_at`
order, there are no concurrent inserts → the chain is linear and correct. The
unique `event_id` constraint is the final backstop against duplicates.

**Deferred (multi-instance, Fase 5 / §6.7):** with >1 publisher instance the
read-head-then-insert would race; add a lock (e.g. `SELECT … FOR UPDATE` on the
head, or a single dedicated worker) — same deferral as the publisher's
`FOR UPDATE SKIP LOCKED`. Not built now.

## eventBus.onAny + dispatch order

`onAny(name, fn)` appends to a separate `anyHandlers` list. `dispatch(event)`
runs `anyHandlers` FIRST, then the per-type handlers; both propagate throws (so
the publisher retries). `_reset()` clears both lists.

**Why any-handlers first:** guarantees every event is audited even if a type
handler later throws and the event eventually dead-letters — audit recorded the
fact on the first pass, and idempotency makes retries a no-op. Accepted
trade-off: if the audit write itself fails, the event retries (type handlers do
not run until it can be audited) — the correct posture for a money-event audit
trail ("no side-effect I can't audit"); the durable outbox row is the ultimate
backstop.

## Verification

`verifyAuditChain()` reads all rows by `id` ascending and, for each: (a)
recomputes `hash` from its content + `prev_hash` and compares to the stored
`hash`; (b) checks its `prev_hash` equals the previous row's stored `hash` (the
first against `GENESIS`). Returns `{ ok, brokenAtSeq, checked }`. Editing or
deleting any historical row breaks one of these checks and is detected.

Exposed via `scripts/verifyAuditChain.js` (manual run; prints the result, exits
non-zero on a broken chain).

**Follow-up (not this slice):** wire a periodic alarm — the existing
`reconciliation.job` could also call `verifyAuditChain()` and alarm on a break.
Kept out to keep this slice focused.

## Error handling

- `auditConsumer` throw (e.g. DB down) → propagates → publisher retries the event
  (backoff/dead-letter); idempotent so retry is safe.
- Because audit runs first, a persistent audit failure holds that event (retries)
  rather than doing un-audited side-effects; the outbox row is the backstop.
- `verifyAuditChain` is read-only, no mutation risk.

## Testing

Extends the suite (unit 387 / integration 155; coverage denominator already
includes `modules/**`).

**Unit**
- `computeHash` deterministic (same input → same hash; any changed field →
  different hash); `canonical` serialization independent of key order.
- `eventBus.onAny`: `dispatch` runs any-handlers (and before type handlers);
  `_reset` clears them; a throwing any-handler propagates.
- `verifyAuditChain` (inject rows): a valid chain returns `ok:true`; a row with an
  altered payload → `ok:false` with the right `brokenAtSeq`; a deleted middle row
  → `prev_hash` mismatch detected.

**Integration (DB)**
- `auditConsumer` writes a chained row for an event; calling it twice with the
  same `event_id` → no duplicate (idempotent), chain unchanged.
- Chain across multiple events links correctly (`row2.prev_hash == row1.hash`);
  `verifyAuditChain` returns `ok:true`.
- Tamper detection end-to-end: a manual `UPDATE` of a payload in `audit_log` →
  `verifyAuditChain` returns `ok:false` with the correct seq.
- End-to-end via publisher: emit an event → run the publisher → `audit_log` has a
  chained row AND (from slice 1) the notification is still created — both the
  any-handler and the type handler ran.
- Full verification: unit + integration + both coverage floors exit 0.

## Out of scope (later slices / follow-ups)

New event emitters (TradeExecuted, DepositConfirmed, WithdrawalTransmitted,
security/KYC/admin events) — the generic consumer captures them automatically as
they are added; a periodic chain-verification alarm; an admin/API surface to read
the audit trail; multi-instance chain-write locking; retention/export tooling.
