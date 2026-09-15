# AML monitor — Slice C design (periodic sweep + compliance activation)

**Status:** approved (design), pending implementation plan.
**Parent:** `docs/superpowers/specs/2026-09-14-aml-monitor-design.md` (approved). Slice A
(foundation + S5 hold, PR #32) and Slice B (detective on-event engine + 5 signals +
USD valuation, PR #33) are on `main`.
**Scope:** the **batch pata** of the hybrid — a periodic sweep that runs the same
detective ruleset over recent activity as a safety net and whole-window pass — plus
the **compliance-doc activation** that closes the AML monitor. This is the last AML
slice.

## Why (and why replay)

Slices A+B monitor money in real time. A batch sweep is the second half of what a real
institution runs: it catches events a handler failed/dead-lettered, and re-evaluates
windowed patterns as a scheduled pass. The design decision — **the sweep REPLAYS
recent money events through the existing `amlConsumer.handleEvent`**, rather than a
separate per-user evaluator — is a compliance decision: an examiner's independent
testing checks that batch and real-time monitoring apply ONE consistent ruleset with
no drift and full coverage. Replay guarantees a single engine (same signals,
thresholds, valuation, case/dedupe logic) — impossible to diverge — and adds no new
evaluation code. Idempotency by `dedupeKey` means anything already caught on-event is
a no-op; the sweep only adds what was missed. Reinforces FinCEN BSA transaction
monitoring + NYDFS Part 500. Purely additive; no money-path change.

## Components (under `backend/modules/aml/` + `backend/jobs/`)

| Unit | Responsibility |
|---|---|
| `amlSweep.js` (`runSweep()`) | Enumerate recent money rows (last `lookbackHours`), build the same payload shape the real emitters produce, and replay each through `amlConsumer.handleEvent({ id, type, payload })`. No new evaluation logic. |
| `jobs/amlSweep.job.js` | Singleton scheduler (mirrors `jobs/reconciliation.job.js`): `start/stop/run/getStatus`, re-entrancy guard, interval clamp. Registered in `jobs/index.js` `JobManager`. |

Reuses everything from Slices A/B: `amlConfig`, `amlConsumer.handleEvent` (which
already gates on monitoring, evaluates, and persists cases + raises the flag
atomically), `amlDataAccess`, the signal functions, `case.model`, `riskFlag`.

## `amlSweep.runSweep`

1. If `aml.monitoring.enabled` is false → return immediately (no-op). (The master
   gate also lives inside `handleEvent`, but checking here avoids the enumeration
   queries entirely when off.)
2. `since = now - aml.sweep.lookbackHours`.
3. Enumerate, via a small set of queries (reuse `amlDataAccess` where possible, add
   sweep-specific finders otherwise):
   - **Withdrawals** in `[since, now]` with `status IN ('confirmed','completed')` →
     replay as `WithdrawalTransmitted` with payload `{ blockchainTransactionId: row.id,
     userId, cryptoId, amount: String(row.amount) }`. (Confirmed/completed = actually
     transmitted on-chain — the exact state at which the real event fires; including
     pending/processing would replay a "transmitted" event for a withdrawal that
     hasn't left, a false positive.)
   - **Deposits** in `[since, now]` with `status IN ('confirmed','completed')` →
     replay as `DepositConfirmed` with payload `{ blockchainTransactionId: row.id,
     userId, cryptoId, amount: String(row.amount) }`.
   - **P2P** in `[since, now]` with `status = 'completed'` → replay as
     `P2PTransactionCompleted` with payload `{ buyerId, sellerId, transaction: { id:
     row.id } }`.
4. For each row: `await amlConsumer.handleEvent({ id: row.id, type, payload })`. The
   synthetic `id` is the row's own UUID (stable provenance for `sourceEventId`); the
   `dedupeKey` (derived from the payload, identical to the on-event path) is the
   idempotency barrier, so a row already handled on-event opens no second case.
5. Return a summary `{ scanned, byType }` for the job's status/logging.

**Ordering:** replay is sequential (one `await` per row) — matches the single-threaded
consumer and avoids connection-pool exhaustion, same posture as the reconciliation and
outbox jobs.

## `jobs/amlSweep.job.js`

Mirror `reconciliation.job.js`: a class with `start()` (runs once then `setInterval`),
`stop()`, `run()` (guarded by a `sweeping` re-entrancy flag so a long pass doesn't
stack), `getStatus()`. Interval from `AML_SWEEP_INTERVAL_MS` env **or**
`aml.sweep.intervalMinutes` config, clamped to a positive default (e.g. 30 min).
Registered in `jobs/index.js` `JobManager` (added to the `jobs` map + a `try/catch`
`start()` in `startAll`, matching the others). Exported as a singleton.

**Config keys** (business-config; unseeded → in-code default): `aml.sweep.lookbackHours`
(default 48), `aml.sweep.intervalMinutes` (default 30). The sweep runs only when
`aml.monitoring.enabled` is true (no separate sweep-enable — one master switch keeps
operations simple; the interval/lookback are tuning knobs).

## Error handling

- Re-entrancy guard: if the previous pass is still running, skip this tick (log a
  warn) — a slow pass over a large window must not stack.
- A `handleEvent` throw for one row is caught, logged, and the sweep CONTINUES with the
  remaining rows — a single poison row never aborts the whole pass. (Per-row isolation,
  same as the outbox publisher's batch isolation.)
- The job's `run()` wraps `runSweep()` in try/catch so a pass failure logs and the next
  tick recovers.
- Read-only except for the cases/flags the consumer already writes (atomically, per
  Slice B).

## Compliance activation (closes the AML monitor)

- Update `docs/compliance/fincen-bsa-aml-mapping.md`: transaction monitoring now covers
  **on-event AND batch**; the S1–S6 catalog + S5 sanctions screening map to the
  program's monitoring/SAR/OFAC obligations; case resolution → audit trail (§500.06).
- Flip `docs/compliance/aml-signal-catalog.md` from "design, not engine" to
  **"activated"** — the engine runs (on-event, slice B; batch, slice C), toggle-gated,
  default-off, shadow mode available.

## Testing

**Unit (no DB)** — `runSweep` with `amlConsumer.handleEvent` + `amlDataAccess`/finders
mocked: monitoring off → returns without enumerating; enumerates the right rows for the
window and replays each with the correct `{ id, type, payload }` shape; a throwing
`handleEvent` for one row does not stop the others (per-row isolation).

**Integration (DB)** — seed recent activity (a fast deposit→withdrawal, a repeated P2P
pair) with monitoring on → `runSweep()` opens the expected S3/S4 cases; **idempotency**:
if the same activity was already processed on-event (call `handleEvent` first, then
`runSweep`) the sweep opens no duplicate case; monitoring off → `runSweep` is a no-op.

**Full verification:** unit + integration + both coverage floors exit 0.

## Out of scope (follow-ups, not blocking the AML close)

The Slice-B perf follow-ups (valuation N+1, memoize `getUsdValue`, merge user queries,
S1/S6 overlapping windows) — a sweep amplifies these, so they become worthwhile in a
dedicated perf pass, but are not required to close functional AML. Also: a stale-price
alarm; event-payload schema validation; multi-instance sweep locking (Fase 5); a
periodic `verifyAuditChain` alarm wired into a job.
