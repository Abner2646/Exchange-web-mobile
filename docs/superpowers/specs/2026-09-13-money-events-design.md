# Money-path domain events (Fase 6.2.1 slice 3) — design

**Status:** approved (design), pending implementation plan.
**Depends on:** the transactional outbox + event bus (slice 1) and the audit trail
(slice 2), both on `dev`.
**Scope:** emit the core money-path domain events (trade, swap, deposit lifecycle,
withdrawal) so the audit trail (and future consumers like AML) cover all money
movement, not just P2P. No new consumers — the generic audit consumer captures
them automatically.

## Why

Slices 1–2 built the outbox + a generic hash-chained audit trail, proven with the
P2P events. But only P2P currently emits, so the audit trail covers just one money
flow. This slice emits the remaining money-path events so the trail records every
money movement: internal trading (trade + swap) and the on-chain custody boundary
(deposits + withdrawals). Each event is written to the outbox in the same DB
transaction as the money change (transactional outbox). Reinforces BSA
recordkeeping / NYDFS Part 500 §500.06; only additive.

## Event catalog

Five semantic events, each emitted at its domain op after the ledger settlement and
before commit, using the op's existing `transaction`. Payload = flat, JSON-
serializable snapshot. `aggregateId` = the primary entity id. (Exact field names
are pinned in the plan by reading each row; the shapes below are the contract.)

| Event | Emit point | Payload | aggregateId |
|---|---|---|---|
| `TradeExecuted` | `modules/trading/tradeExecutor.service.js` `executeTrade` (after the Trade row is created + `updateBalancesAfterTrade`/`settleTrade`) | `{ tradeId, tradingPairId, buyerId, sellerId, price, quantity, buyerFee, sellerFee }` | tradeId |
| `SwapExecuted` | `modules/swap/swap.controller.js` `createSwap` (after the Swap row + `settleSwap`) | `{ swapId, userId, pairId, type, baseAmount, quoteAmount, price, feeAmount }` | swapId |
| `DepositRegistered` | `modules/wallets/blockchainTransaction.model.js` (at `registerPendingDeposit` — on-chain deposit detected, pending) | `{ blockchainTransactionId, userId, cryptoId, amount, txHash }` | blockchainTransactionId |
| `DepositConfirmed` | `modules/wallets/blockchainTransaction.model.js` (at `confirmDeposit` — credited) | `{ blockchainTransactionId, userId, cryptoId, amount, txHash }` | blockchainTransactionId |
| `WithdrawalTransmitted` | `modules/wallets/blockchainTransaction.model.js` (at `markWithdrawalTransmitted`) | `{ blockchainTransactionId, userId, cryptoId, amount, destinationAddress, txHash }` | blockchainTransactionId |

## Emission pattern

Same as slice 1's P2P migration. In each of the three files, `require` the
`emitEvent` helper and, in the domain op, after the state change + ledger
settlement and **before commit**, call:

```js
await emitEvent('<EventType>', { ...flat payload... }, { transaction, aggregateId });
```

using the **same `transaction`** the op already holds. This makes the event and the
money change atomic (both commit or both roll back). No new consumers or handlers:
the generic audit consumer (slice 2, subscribed via `eventBus.onAny`) records each
event automatically, hash-chained.

**Requirement:** emission must use the same transaction as the ledger settlement at
each op. Where an op does not already hold a transaction, the plan threads the
existing one (never a new/no transaction — that would break atomicity). If a domain
op has no surrounding transaction at all, the plan flags it rather than emitting
non-atomically.

## Error handling

`emitEvent` failure propagates and the op's transaction rolls back (no money change
without its event) — automatic, since each emit sits inside the op's existing
try/rollback path. Downstream delivery failures are handled by the publisher
(retry/backoff/dead-letter) and the idempotent consumers, already built.

## Testing

Extends the suite (unit 399 / integration 162; coverage denominator includes
`modules/**`).

**Unit**
- Existing unit tests that exercise these ops without a DB (e.g. `tradeExecutor.test`,
  swap's `createOrder.test`, `transaccionBlockchain.model.test`) mock `emitEvent`
  (as `transaccionesP2P.model.test` did in slice 1) so they don't depend on the
  outbox. Where practical, add an assertion that the op calls `emitEvent` with the
  correct type and payload (using the mock).

**Integration (DB)**
- Per event family: run the op and assert an `outbox_events` row exists with the
  correct `type`, `payload`, and `aggregate_id`, written in the op's transaction.
- Atomicity: when an op rolls back, no outbox row remains.
- One end-to-end: a real op → run the publisher → the event appears in `audit_log`
  (chained). The generic publisher→audit path is already proven in slices 1–2, so
  this confirms the wiring for a money event.
- Full verification: unit + integration + both coverage floors exit 0.

## Out of scope (later slices)

New consumers for these events (user-facing deposit/withdrawal notifications, AML
monitor); non-money events (security/KYC/admin/login); websocket push; the
deferred items from slices 1–2 (multi-instance chain-write lock, periodic audit
verification alarm, audit read API).
