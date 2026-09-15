# AML monitor — Slice B design (detective on-event engine + 5 signals + USD valuation)

**Status:** approved (design refinement of the parent spec), pending implementation plan.
**Parent:** `docs/superpowers/specs/2026-09-14-aml-monitor-design.md` (approved). Slice A
(foundation + S5 hold) is on `main` (PR #32). This note pins the design detail the
parent left to the plan for the **detective on-event engine** and the five signals.
**Scope decision (user, 2026-09-14):** build all five detective signals now, including
the USD-valued ones, with a dedicated USD-valuation helper.

## Why a valuation helper

S1 (volume), S2 (structuring), S6 (new-account volume) threshold on **USD value**,
not on a single asset's amount. The codebase has no general crypto→USD valuation:
the swap's `dailyLimitUsd` check leans on the pair's quote asset being USD-stable
(`Swap.getDailyVolume` sums `quoteAmount`). So Slice B adds `amlValuation`, built on
`SwapPair.currentPrice` (base priced in quote) + the USD-stable convention already in
the code (`swapPair.controller`: quote ∈ {USDT, USDC, USD}). S3 (velocity) and S4
(P2P repeat) need no valuation (same-asset amount comparison / counting).

## Components (all under `backend/modules/aml/`)

| Unit | Responsibility |
|---|---|
| `amlValuation.js` | `getUsdValue(cryptoId, amount, transaction?) → { usd: string\|null, priceAsOf: Date\|null, source: 'stable'\|'pair'\|'unknown' }`. Pure-ish (reads Crypto + SwapPair). |
| `amlDataAccess.js` | The windowed queries each signal needs (impure, isolated): user withdrawals/deposits in a window, P2P tx by counterparty pair, account age. Reads the `blockchain_transaction`, `transacciones_p2p`, `Usuario` tables. |
| `signals/s1..s6.js` (S5 already done) | One **pure function per signal**: `(facts) → Finding\|null`. No DB, no valuation call inside — facts (including any USD values) are pre-computed by the evaluator/dataAccess and passed in. |
| `amlEvaluator.js` | For a trigger event: gather facts (dataAccess + valuation), run the relevant signals, return findings. |
| `amlConsumer.js` | Event-bus consumer (gated by `amlConfig.isMonitoringEnabled`): on each money event, run the evaluator, open idempotent cases + raise the risk flag. Never touches funds. |

`amlConfig`, `case.model` (`openCase`), `riskFlag` (`raiseUserRisk`) already exist (Slice A).

## `amlValuation.getUsdValue`

1. Load the Crypto (`cryptoId`). If `symbol ∈ {USDT, USDC, USD, DAI}` → `{ usd: amount, priceAsOf: now, source: 'stable' }` (1:1).
2. Else find an **active** `SwapPair` where `baseCryptoId = cryptoId` and the quote Crypto's symbol ∈ the USD-stable set → `usd = money.multiply(amount, String(pair.currentPrice))` (the `money` util exposes `multiply`), `priceAsOf = pair.lastUpdated`, `source: 'pair'`.
3. Else → `{ usd: null, priceAsOf: null, source: 'unknown' }`. No cross-quote chaining (deliberately — avoids fragile multi-hop pricing; documented limitation, extend later).

**Stale prices:** the helper does NOT reject stale prices — a stale heuristic price is
better than none for a detective signal. It returns `priceAsOf` so the evaluator can
record it in the case evidence. (A staleness alarm is a later follow-up.)

**Unvaluable assets (`usd: null`):** a value-based signal cannot threshold an
unvaluable item. The evaluator **skips** that item for S1/S2/S6 and records
`unvaluable: true` (+ the crypto) in the evidence of any case it does open, so the
gap is visible rather than a silent false-negative. Amounts stay strings (`money`).

## Signal definitions (thresholds = business-config, in-code defaults)

Each signal is a pure function over facts. Severity → risk flag: high →
`amlRiskLevel='high'`; medium → raise to `medium` only if currently `low`.

"Volume" for S1/S6 = Σ USD of the user's **on-chain movements (deposits + withdrawals)**
in the window — the custody-boundary value moved, the most AML-relevant measure. This
deliberately excludes internal swaps/trades (which don't move money in/out and would
add internal-pair valuation surface for little AML value). Both signals need only the
`blockchain_transaction` table + `amlValuation`.

| # | Rule | Trigger event(s) | Config keys (default) | Severity |
|---|---|---|---|---|
| **S1** Volume | Σ USD of the user's on-chain deposits+withdrawals in the last `windowHours` > `dailyLimitUsd × multiplier` | DepositConfirmed, WithdrawalTransmitted | `aml.s1.windowHours` (24), `aml.s1.multiplier` (3) | medium |
| **S2** Structuring | ≥ `count` withdrawals whose USD value ∈ [`0.8×T`, `T`) within `windowHours`, and Σ of those ≥ `T` | WithdrawalTransmitted | `aml.s2.thresholdUsd` (10000), `aml.s2.count` (3), `aml.s2.windowHours` (24) | high |
| **S3** Velocity (layering) | a withdrawal of crypto C with amount ≥ `ratio` × a confirmed deposit of the SAME crypto C to the same user within the last `windowMinutes` | WithdrawalTransmitted | `aml.s3.ratio` (0.9), `aml.s3.windowMinutes` (60) | high |
| **S4** P2P repeat | ≥ `count` completed P2P tx between the same (buyer,seller) unordered pair within `windowHours` | P2PTransactionCompleted | `aml.s4.count` (5), `aml.s4.windowHours` (168) | medium |
| **S6** New-account volume | account age < `accountAgeDays` AND Σ USD of the user's on-chain deposits+withdrawals since signup > `volumeUsd` | DepositConfirmed, WithdrawalTransmitted | `aml.s6.accountAgeDays` (7), `aml.s6.volumeUsd` (50000) | medium |

`T` for S2 = `aml.s2.thresholdUsd`. Amounts compared with `money.compare`.

## Consumer: event → signals, idempotency, dedupe

`amlConsumer` subscribes to the money-event **types** (not `onAny`; the audit consumer
owns `onAny`). Per event, if monitoring is enabled, run the signals mapped to that
type (the trigger column above), open a case per firing signal, raise the flag.

**Idempotency:** each case carries `sourceEventId = event.id` (provenance) and a
`dedupeKey` (the unique barrier from Slice A). The dedupe **window bucket** per signal:
- **S3**: `${userId}:S3:${triggeringDepositId}` — one case per deposit→withdrawal layering incident.
- **S1 / S2 / S6**: `${userId}:${signal}:${YYYY-MM-DD(UTC)}` — at most one case per user per signal per UTC day (a rolling-window pattern shouldn't reopen on every event).
- **S4**: `${sortedPairKey}:S4:${YYYY-MM-DD(UTC)}` where `sortedPairKey = [buyerId,sellerId].sort().join(':')` — one per counterparty-pair per day.

At-least-once delivery + `findOrCreate` on `dedupeKey` ⇒ no duplicate cases. A signal
throw propagates → the publisher retries → idempotent, so retry is safe. The audit
consumer runs first (`onAny`), so an AML failure never loses the audit record.

## Wiring

`amlConsumer.register(eventBus)` added to `registerAllHandlers()` (beside the audit +
notification handlers, under the `wired` guard). No money-path change — this slice is
purely a new consumer (Slice A already carries the only money-path touch, S5).

## Testing

**Unit (no DB):** each signal pure function fires/doesn't at the exact boundary
(S2 at count and the [0.8T,T) band edges; S3 at ratio/window edges; S4 at count; S1/S6
at the USD threshold); `amlValuation` returns 1:1 for stables, `amount×price` for a
pair, `null` for an unvaluable asset; the evaluator maps each trigger to the right
signals; dedupeKey bucketing is correct.
**Integration (DB):** drive a real money event through the publisher → the expected
case row appears with the right signal/severity/evidence + risk flag raised; idempotent
(same pattern twice → one case); monitoring-off → no case; an unvaluable asset in a
value signal → recorded, no crash. `amlValuation` against seeded SwapPairs.
**Full verification:** unit + integration + both coverage floors exit 0.

## Out of scope (Slice C / follow-ups)

The periodic sweep job (batch pata of the hybrid); cross-quote valuation chains; a
stale-price alarm; the admin case-list UI (Fase 7). The recorded Slice-A cleanup
follow-ups (centralize the `requiresApproval:false` transmit exclusion; etc.) can ride
along a cleanup pass, not this slice.
