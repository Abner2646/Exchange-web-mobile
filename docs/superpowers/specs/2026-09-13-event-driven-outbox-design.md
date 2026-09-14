# Event-driven backbone + transactional outbox (Fase 6.2.1) — design

**Status:** approved (design), pending implementation plan.
**Scope of this spec:** the first vertical slice — the outbox mechanism end-to-end,
proven by migrating **P2P transaction notifications** off the money-path. Later
slices (transfer/user notifications, AML, audit trail, websockets, broker) reuse
the same contract and are explicitly out of scope here.

## Why

Today side-effects are hard-wired into the money-path. Example: `modules/p2p/
p2pTransaction.model.js` calls `Notification.notifyBothParties(...)` inline, inside
the same DB transaction that moves funds, at 4 lifecycle points. Two problems:

- **Coupling:** every new reaction to a money event (AML monitor, audit log,
  websocket push) means editing the money-path function again. It accretes
  responsibilities it shouldn't own.
- **Reliability / dual-write:** a side-effect that throws can complicate the money
  transaction; and a crash between the state change and the side-effect loses the
  side-effect with no record it was owed.

The fix is the **transactional outbox** pattern (industry standard for money
systems): the money-path records a *domain event* in an `outbox` table **in the
same DB transaction** as the state change (both commit or neither), and a separate
worker delivers those events to decoupled consumers with **at-least-once** delivery
and **idempotent** handlers.

This is the correct first stage of a pattern that graduates to a durable broker
(EventBridge/SQS/Kafka) in Fase 5 **without changing the emission code** — the
`emitEvent(...)` calls in the money-path stay identical; only the publisher's
delivery target changes. It is also the substrate for the on-chain reconciliation
alarm (§5.6), AML monitoring (§4.8) and an immutable audit trail (Radar #3).

Maps to NYDFS Part 500 §500.06 (audit trail) and BSA recordkeeping; only reinforces
the security/regulatory standards (never weakens them).

## Architecture — the pieces

A new module `backend/modules/events/` holds the backbone; the worker lives in
`backend/jobs/` with the other jobs.

1. **`outbox_events` table** (`OutboxEvent` model) — one row per domain event.
2. **`emitEvent(type, payload, { transaction, aggregateId })`** — thin helper that
   inserts a `pending` row using the caller's transaction. Always called with the
   money-path's own `transaction` so event + state change are atomic.
3. **`eventBus`** — an in-process handler registry: `on(type, handlerName, fn)` to
   subscribe, `dispatch(event)` to run all handlers for `event.type`. The money-path
   never touches it.
4. **`outboxPublisher.job.js`** — background worker (same shape as
   `reconciliation.job`): polls `pending` events and dispatches them via `eventBus`.
5. **Notification handler** — lives in `modules/notifications/`, subscribed to the
   P2P event types; calls the existing `Notification.notifyBothParties(...)`. The
   money-path no longer calls notifications directly.

**End-to-end flow:** money-path moves funds + `emitEvent(...)` in the same tx →
(commit) → publisher reads the pending event → `eventBus` runs the notification
handler → notification created → row marked `dispatched`.

## Data model — `outbox_events`

Columns (English identifiers, snake_case columns, per backend convention):

| attr | column | type | purpose |
|---|---|---|---|
| `id` | `id` | UUID PK (UUIDV4) | event identity; **also the idempotency key** carried to handlers |
| `type` | `type` | STRING, not null | event type, e.g. `'P2PTransactionCompleted'`; handlers subscribe by it |
| `payload` | `payload` | JSONB, not null | self-contained snapshot of the facts a handler needs |
| `aggregateId` | `aggregate_id` | UUID, nullable | owning entity (e.g. the P2P transaction id) — correlation/debug, future per-aggregate ordering |
| `status` | `status` | ENUM(`pending`,`dispatched`,`failed`) default `pending` | dispatch state |
| `attempts` | `attempts` | INTEGER default 0 | dispatch attempts |
| `availableAt` | `available_at` | DATE default NOW | don't retry before this (backoff) |
| `lastError` | `last_error` | TEXT nullable | last failure message (dead-letter/alarm) |
| `createdAt` | `created_at` | DATE | emit time; defines FIFO dispatch order |
| `dispatchedAt` | `dispatched_at` | DATE nullable | successful-dispatch time |

**Indexes:** `(status, available_at)` for the publisher poll query; `created_at` for
ordering.

**Row lifecycle:** `pending` → publisher takes it in `created_at` order → runs
handlers → all OK: `dispatched` (+ `dispatched_at`). On failure: `attempts++`,
save `last_error`, push `available_at` by exponential backoff (capped), stays
`pending`. After `MAX_ATTEMPTS` (default 10): `status='failed'` (dead-letter) +
alarm (`log.error`, like `reconciliation.job`).

No separate per-handler "deliveries" table: because every handler is idempotent
(pattern rule), retrying the whole event and re-running an already-succeeded handler
does not duplicate. A per-handler tracking table is deferred until there are
multiple/expensive handlers (YAGNI).

## Emission — first slice (P2P)

`emitEvent` replaces the 4 inline `notifyBothParties` calls in
`p2pTransaction.model.js`, each keeping the **same transaction `t`**:

```js
// before (coupled): inside the funds-moving tx
await settleP2P({...}, t);
await Notification.notifyBothParties(buyerId, sellerId, txData, 'completed');

// after (decoupled): record the fact only, same tx
await settleP2P({...}, t);
await emitEvent('P2PTransactionCompleted',
  { buyerId, sellerId, transaction: { id, amount, cryptoSymbol, fiatAmount, fiatCurrency } },
  { transaction: t, aggregateId: tx.id });
```

Four semantic event types: `P2PTransactionCreated`, `P2PPaymentConfirmed`,
`P2PTransactionCompleted`, `P2PTransactionCancelled`. After this, `p2pTransaction.
model.js` no longer imports/knows about notifications.

**Payload** is a flat, JSON-serializable snapshot: `{ buyerId, sellerId, transaction:
{ id, amount, cryptoSymbol, fiatAmount, fiatCurrency } }`. The handler needs no
extra DB lookup to build the notification.

**Scope guard:** only P2P migrates in this slice. The other inline notifiers
(`transfer.controller`, `user.controller` welcome/security/KYC) stay as-is and
migrate later with the same mold.

## The publisher worker

`jobs/outboxPublisher.job.js`, same pattern as `reconciliation.job` (interval from
`OUTBOX_PUBLISHER_INTERVAL_MS`, default ~2000ms, clamped; reentrancy guard
`isRunning`; `start()/stop()/getStatus()`; registered in the `JobManager`).

`run()`:
1. Read a batch: `status='pending' AND available_at <= now`, `ORDER BY created_at`
   ASC, `LIMIT N` (default 100).
2. For each event, `eventBus.dispatch(event)` (runs all handlers for `event.type`).
3. All handlers OK → `status='dispatched'`, `dispatched_at=now`.
4. Any handler throws → `attempts++`, `last_error`, `available_at = now +
   backoff(attempts)`, stays `pending`. At `attempts >= MAX_ATTEMPTS` → `failed` +
   `log.error` alarm.
5. A `type` with no subscribed handlers → mark `dispatched` (no-op).

**At-least-once:** mark `dispatched` only after handlers succeed; a crash in between
leaves the event `pending` → redelivered → idempotent handler dedupes.

**Handler registration:** subscriptions (`eventBus.on(type, 'notifications', fn)`)
are wired at app bootstrap, before jobs start.

**Multi-instance caveat (deferred, ties to §6.7):** today a single instance + the
reentrancy guard suffice. When Fase 5 runs >1 instance, add `SELECT … FOR UPDATE
SKIP LOCKED` to the batch read (or move to a single dedicated worker process).
Not built now.

## Notification handler + idempotency

The handler (in `modules/notifications/`) subscribes to the 4 P2P types and calls
`Notification.notifyBothParties(...)`, mapping `type → status`.

At-least-once means the handler may run twice for the same `event.id`. To avoid
duplicate notifications:

- Add `sourceEventId` (`source_event_id`, UUID, nullable) to the notification model,
  with a **unique index `(source_event_id, user_id)`**.
- `notifyBothParties` creates 2 notifications per event (buyer + seller): same
  `source_event_id`, different `user_id` → the composite unique lets both exist but
  blocks duplicates on retry (via `findOrCreate` / ignore-conflict).
- Idempotency lives in the data (auditable: "this notification came from this
  event"). Notifications not sourced from events (welcome, etc.) leave
  `source_event_id` null and are unaffected.

## Error handling

- Handler throws → event retried with exponential backoff; after `MAX_ATTEMPTS`
  → `failed` (dead-letter) + `log.error` alarm; the worker never crashes on a bad
  event (one poison event must not block the rest — it is skipped via `available_at`
  backoff while others proceed).
- `emitEvent` failure inside the money-path tx → the whole tx rolls back (correct:
  no money change without its event, no event without its money change).

## Testing

Extends the existing suite (376 unit / 150 integration; coverage denominator already
includes `modules/**`).

**Unit**
- `emitEvent` inserts a `pending` row in the given tx.
- `eventBus`: register/dispatch; multiple handlers; unknown type = no-op.
- `publisher.run()` (deps injected): marks `dispatched` on success; `attempts++` +
  backoff + stays `pending` on handler throw; `failed` after MAX; poison event does
  not block others in the batch.
- Notification handler idempotency: same `event.id` twice → one notification per
  user (not two).

**Integration (DB)**
- **Atomicity:** a P2P op that emits then rolls back the tx → **no** outbox row.
- **End-to-end:** create P2P transaction → outbox row `pending` + funds moved → run
  publisher → notification created + row `dispatched`.
- **Redelivery:** run publisher twice → still one notification per user.
- **Dead-letter:** handler always throws → after MAX attempts → `failed`, process
  survives.

## Out of scope (later slices, same contract)

Migrating transfer/user notifications; money events (`TradeExecuted`,
`DepositConfirmed`, …); AML consumer; immutable audit-trail consumer; websocket
push; durable broker + `FOR UPDATE SKIP LOCKED`/dedicated worker (Fase 5 / §6.7);
per-(event,handler) delivery tracking.
