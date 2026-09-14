# AML monitor (Fase 4.8 activation) — design

**Status:** approved (design), pending implementation plan.
**Depends on:** the transactional outbox + event bus (slice 1), the hash-chained
audit trail (slice 2), and the money-path domain events (slice 3) — all on `main`
(PR #31). Also the append-only double-entry ledger (Radar #1), the business-config
store (Radar #13), and the user risk flags (Radar #14 + §4.8).
**Scope:** the "Activation" that `docs/compliance/aml-signal-catalog.md` explicitly
deferred — the engine that consumes the money-path events (and sweeps recent ledger
activity), evaluates the S1–S6 signal catalog, opens AML cases, raises the account
risk flag, and — for sanctions hits only — holds a withdrawal pending human review.

## Why

Fase 4.8 delivered the *design*: the signal catalog (S1–S6), the account risk flag,
and the case-queue shape — but no engine runs. The money-path now emits a domain
event for every movement (slice 3) and the audit trail records them. This makes the
detective engine a natural additional **consumer** of that backbone, plus a periodic
sweep for windowed rules. Maps to FinCEN BSA/AML (transaction monitoring + SAR),
OFAC sanctions screening, and NYDFS Part 500 §500.06 (case resolution audit trail).
See [[us-regulatory-framework]], [[security-regulatory-guardrail]].

**What the law actually requires** (context, not a checklist to hardcode): a
risk-based AML *program* — designated officer, written program, training,
independent testing, KYC/CDD, transaction monitoring + SAR filing, CTR, OFAC
screening, recordkeeping/Travel Rule. The *specific* typologies are institution-
defined. S1–S6 are a representative, high-value subset computable from data already
stored; **the catalog is explicitly extensible** (a new signal is one pure function).

## Principles (fixed, from the catalog)

- **Signals → a case for human review and/or an account risk flag. Never an
  automatic action on funds** — the sole exception is the S5 sanctions **hold
  pending review**, and only when hold-enforcement is enabled.
- **Readable rules, not ML.** Explicit thresholds over events/ledger rows.
- **Thresholds and on/off are business config** (Radar #13), editable later from the
  admin panel; code carries safe defaults so an unseeded key behaves safely.
- **Tipping-off:** cases and risk flags are NEVER exposed to the user — admin
  surface only.
- **Additive / default-off:** shipping this changes nothing at runtime until the
  operator flips the toggles.

## Architecture — module `backend/modules/aml/`

Self-contained domain, same mold as `audit` / `events`.

| Unit | Responsibility | Depends on |
|---|---|---|
| `signals/*.js` | One **pure function per signal** (S1…S6): `(facts) → Finding \| null`. No DB. | — |
| `amlDataAccess.js` | The impure part, isolated: **windowed queries** over the ledger + transaction tables that gather each signal's facts. | models, ledger |
| `amlEvaluator.js` | Orchestration: given a trigger, gather facts → run the relevant pure signals → return findings. | signals, amlDataAccess |
| `amlConsumer.js` | Event-bus consumer (detective). Subscribes to money-event types; on each, runs the evaluator, persists cases, raises the risk flag. Idempotent. Never touches funds. | eventBus, amlEvaluator, case.model, amlConfig |
| `amlSweep.js` + `jobs/amlSweep.job.js` | Periodic sweep (batch pata of the hybrid + safety net + whole-window rules). | amlEvaluator, case.model, amlConfig |
| `amlScreening.js` | Synchronous **preventive S5** check, called at withdrawal creation. | denylist.model, amlConfig |
| `case.entity.js` / `case.model.js` | The `AmlCase` queue + idempotent creation + resolution. | models |
| `denylist.entity.js` / `denylist.model.js` | Flagged/sanctioned addresses (S5). | models |
| `amlConfig.js` | Thin wrapper over `businessConfig` (Radar #13): the toggle + threshold keys with in-code defaults. | config/businessConfig |
| `aml.routes.js` (admin) | `/api/admin/aml/*` — config get/put, denylist CRUD, case list/resolve. Reserved now; panel is Fase 7. | authz (admin), models |

**Reuse, do not reinvent:** `User.amlRiskLevel` + `amlReviewPending` (exist, already
stripped from `toJSON`); the withdrawal's `requiresApproval` / `approvedBy` /
`approvalDate` fields for the S5 hold; `businessConfig` (`get/getNumber/getBoolean/
set`, cached) for the toggles/thresholds; the reconciliation-job pattern for the
sweep; the withdrawal refund/fail path for a rejected hold.

## Data model

- **`AmlCase`** (table `aml_cases`): `id` (UUID PK), `userId` (UUID), `signalId`
  (STRING, `S1`…`S6`), `severity` (ENUM `low`|`medium`|`high`), `status` (ENUM
  `open`|`in_review`|`closed`, default `open`), `evidence` (JSONB — amounts, tx ids,
  window bounds), `sourceEventId` (UUID nullable — the outbox event that opened it,
  for provenance), `dedupeKey` (STRING, **UNIQUE** — `userId:signalId:windowBucket`,
  the anti-duplicate barrier), `resolvedBy` (UUID nullable), `resolvedAt` (DATE
  nullable), timestamps. Indexes: unique `(dedupe_key)`; `(user_id)`; `(status)`.
- **`AmlDenylistedAddress`** (table `aml_denylisted_addresses`): `id` (UUID PK),
  `address` (STRING, normalized — lowercase for EVM, as-stored for BTC), `network`
  (STRING, e.g. `ethereum`|`bsc`|`bitcoin`), `reason` (TEXT), `source` (STRING, e.g.
  `OFAC`), `addedBy` (UUID nullable), timestamps. Unique `(address, network)`.
- **No new withdrawal status.** S5 sets the existing `requiresApproval = true`; the
  withdrawal claim/transmit query is narrowed to exclude `requiresApproval = true`
  so a held withdrawal is not picked up until an operator clears it.
- **Business-config keys** (table `business_config`; unseeded → in-code default):
  - `aml.monitoring.enabled` (bool, **default `false`**) — master switch.
  - `aml.holdEnforcement.enabled` (bool, **default `false`**) — S5 hold on/off
    (off = shadow mode).
  - Per-signal thresholds, one line each, e.g. `aml.s1.windowHours`,
    `aml.s1.limitMultiplier`, `aml.s2.reportingThreshold`, `aml.s2.count`,
    `aml.s2.windowHours`, `aml.s3.ratio`, `aml.s3.windowMinutes`, `aml.s4.count`,
    `aml.s4.windowHours`, `aml.s6.volume`, `aml.s6.accountAgeDays`. Exact keys +
    defaults pinned in the plan.

## Signal catalog (evaluation source of truth: `aml-signal-catalog.md`)

| # | Signal | Trigger event(s) | Output |
|---|---|---|---|
| S1 | High volume per rolling window | SwapExecuted, TradeExecuted, sweep | medium + case |
| S2 | Structuring / smurfing | WithdrawalTransmitted, sweep | high + case |
| S3 | Deposit→withdrawal velocity (layering) | WithdrawalTransmitted (+ DepositConfirmed primes the window), sweep | high + case |
| S4 | Repeated P2P counterparty | P2PTransactionCompleted, sweep | medium + case |
| S5 | Withdrawal to flagged address | **withdrawal creation (synchronous, preventive)** | high + case + hold |
| S6 | New-account large activity | DepositConfirmed, SwapExecuted, TradeExecuted, sweep | medium + case |

Each signal is a pure function evaluated over facts gathered by `amlDataAccess`; the
severity → risk-flag mapping is: high → `amlRiskLevel='high'`; medium → raise to
`medium` only if currently `low` (never downgrade).

## Data flow

### Preventive — S5 hold (the only money-path touch)

At **withdrawal creation**, before reserving/transmitting:

1. Call `amlScreening.checkWithdrawal({ address, network })` → normalize `address`,
   look it up in `aml_denylisted_addresses`.
2. **Not denylisted** → withdrawal proceeds normally (the overwhelming majority;
   zero behavior change).
3. **Denylisted** → branch on `aml.holdEnforcement.enabled`:
   - **ON (production):** create the withdrawal with `requiresApproval = true`
     (funds reserved out of available, but the transmit job skips it); open an
     `AmlCase` (S5, high, evidence = address + source + withdrawal id); set
     `amlRiskLevel='high'` + `amlReviewPending=true`. The withdrawal is **frozen
     pending human decision.**
   - **OFF (shadow / testnet):** open the case + raise the flag anyway (so the
     operator sees what *would* have been held), but do **not** set
     `requiresApproval` → the withdrawal proceeds. Observe without blocking.
4. **Operator resolution** via `PUT /api/admin/aml/cases/:id`:
   - **Approve** → `requiresApproval=false`, set `approvedBy`/`approvalDate` → the
     transmit job now picks it up. Case `closed`.
   - **Reject** → mark the withdrawal `failed` and refund the reserved funds (reuse
     the existing withdrawal fail/refund path). Case `closed`.
   - Resolution is written to the immutable audit trail (§500.06): who, when, decision.

The **only** automatic fund action in the whole system is this sanctions hold, and
only with enforcement ON. Everything else is purely detective.

### Detective — on-event consumer

`amlConsumer` subscribes to the money-event types. Per event:
1. If `aml.monitoring.enabled` is **off** → no-op (the event is still in the audit
   trail regardless).
2. If **on** → the evaluator runs only the signals relevant to that event type (per
   the catalog table), opening idempotent cases + raising the risk flag. Never
   touches funds. Idempotent by `sourceEventId` + `dedupeKey`, so the outbox's
   at-least-once delivery does not duplicate cases.

### Detective — periodic sweep

`jobs/amlSweep.job.js` (reconciliation-job mold), every N minutes, if monitoring on:
1. Sweep recent ledger activity (last 24–48h) and run the windowed signals over the
   aggregate.
2. Exists for two real reasons (matches real institutions, not redundancy): a safety
   net for events a handler may have failed/dead-lettered, and whole-window rules
   (structuring/volume read better over the full window than event-by-event).
3. Opens the same idempotent `AmlCase`s — `dedupeKey` guarantees on-event and sweep
   do not double-open the same case.

## Error handling

- `amlConsumer` throw → propagates → the outbox publisher retries the event
  (backoff/dead-letter); idempotent by `sourceEventId`/`dedupeKey` so retry is safe.
  The audit consumer runs first (any-handler), so an AML failure never loses the
  audit record.
- `amlScreening` failure at withdrawal creation is inside the withdrawal's
  transaction/try path → a screening error rolls the withdrawal creation back rather
  than letting a possibly-sanctioned withdrawal through un-screened (fail-closed when
  enforcement is on). When monitoring/enforcement is off, screening is skipped.
- The sweep job is idempotent and safe to re-run; a failed sweep tick logs and the
  next tick recovers.
- Config reads fall back to safe in-code defaults if the store is unreachable
  (monitoring/enforcement default `false`).

## Testing

**Unit**
- Each signal pure function: fires / does not fire exactly at the boundary threshold
  (e.g. S2 at K withdrawals in `[0.8T, T)`; S3 at ratio/window edges).
- `amlEvaluator` dispatch: the right signals run for each trigger.
- `amlScreening`: address normalization + denylist match/miss per network.
- `amlConfig`: unseeded keys return the safe defaults (monitoring/enforcement false).
- `AmlCase` dedupe: same `dedupeKey` does not open a second case.

**Integration (DB)**
- Consumer opens a case from a real money event (drive through the op → publisher →
  case row); risk flag raised.
- Sweep opens windowed cases over seeded ledger activity.
- **S5:** a held withdrawal is NOT transmitted (transmit query excludes it); operator
  **approve** → it transmits; operator **reject** → funds refunded; case closed.
- **Toggles:** monitoring off → no case; enforcement off (shadow) → case opened but
  withdrawal NOT held.
- **Tipping-off:** a case / risk flag never appears in the user-facing serialization.

**Full verification:** unit + integration + both coverage floors exit 0.

## Implementation slicing (for writing-plans)

Large subsystem → the plan is built in slices, each with its own review cycle:
- **Slice A** — module skeleton + `AmlCase` entity/model + denylist entity/model +
  `amlConfig` (toggles/thresholds) + S5 preventive screening & hold at withdrawal
  creation + transmit-query exclusion + admin config/denylist routes.
- **Slice B** — detective on-event `amlConsumer` + `amlDataAccess` + the pure signal
  functions + risk-flag raising + case dedupe.
- **Slice C** — periodic sweep job + any remaining signals + admin case list/resolve
  routes + the FinCEN mapping/catalog "activated" doc updates.

## Out of scope (later / follow-ups)

The admin **panel UI** (Fase 7 — only the API routes land here); real SAR/CTR
filing and real OFAC list ingestion (manual/seeded denylist only); ML/behavioral
scoring; Travel-Rule payload capture; multi-instance config-cache invalidation
(Fase 5); automated denylist feeds. Additional signals (mixers/tumblers, high-risk
jurisdictions, peel chains) are additive later — one pure function each.

## Mapping

Populates `docs/compliance/fincen-bsa-aml-mapping.md` (transaction monitoring, SAR,
OFAC screening) and flips `docs/compliance/aml-signal-catalog.md` from "design" to
"activated". NYDFS Part 500 §500.06 underpins the case-resolution trail.
