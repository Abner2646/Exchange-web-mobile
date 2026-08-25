# Fase 2 — Withdrawal stale-claim reaper with on-chain verification (EVM) — Design Spec

- **Date:** 2026-08-24
- **Phase:** Roadmap Fase 2 / Fase 1 #0 — completes the atomic-claim robustness
- **Status:** Approved (design), pending implementation plan

## Problem

The atomic claim (`claimForProcessing`, pendiente→procesando before broadcast)
closed the double-spend, but introduced a **stuck-claim** case: if the process
crashes between the claim and recording the result, the row stays `procesando`
and the user's funds stay blocked forever (no run re-picks it — the query only
takes `pendiente`).

The dangerous part is **recovery**: a naive reaper that auto-reverts a stuck
`procesando` row can **lose money** — if the crash happened *after* the on-chain
broadcast succeeded but *before* we recorded it, the crypto already left the
master wallet; reverting would also credit the user back = double loss. We cannot
distinguish "never broadcast" from "broadcast but unrecorded" without checking
the chain, and today we don't record anything to check.

**User decision (2026-08-24):** the serious-product approach — **record the tx
intent (hash) before broadcasting**, and have the reaper **verify on-chain**
whether that tx actually went out, reverting *only* when it provably did not.

## Goal

1. **Pre-record the txHash before broadcast** on the EVM withdrawal path, so a
   stuck `procesando` row always carries the hash of the tx that was (about to be)
   sent.
2. **A reaper job** that sweeps stale `procesando` withdrawals and, using an
   on-chain lookup, reverts only those whose tx is provably absent from the chain;
   leaves (does not touch) any whose tx is present.

Scope: **EVM (ETH + BSC, native + token)** — they share the `EvmChainClient`
port. Bitcoin rides with its own port migration (deferred; its txid is likewise
known pre-broadcast, so the same pattern applies later).

### Non-goals

- Bitcoin reaper support (comes with the BTC port migration).
- Auto-**retry** of a not-broadcast tx (the reaper reverts; re-initiation is a
  separate concern). Reverting returns funds to the user safely.
- Distributed locking for the reaper across instances (single reaper instance
  assumed, like the other jobs; can add a claim later).

## Design

### 1. Sign-then-broadcast (pre-record) in the EVM port

Split the send into "sign" (deterministic hash, no network effect) and
"broadcast", so the hash exists before anything goes on-chain.

`EvmChainClient` gains:
```
// Build + sign a native transfer; NO broadcast. Returns the deterministic hash
// and an opaque signed payload to broadcast later.
signNativeTransfer(toAddress, amount): Promise<{ txHash, signed, fee }>
signTokenTransfer(contractAddress, toAddress, amount): Promise<{ txHash, signed, fee }>

// Broadcast a previously-signed payload. Returns the txHash.
broadcast(signed): Promise<{ txHash }>

// On-chain lookup for the reaper: number of confirmations, or null if the tx is
// not found on-chain at all (never broadcast / dropped).
getConfirmations(txHash): Promise<number | null>
```
The existing `sendNativeTransfer`/`sendTokenTransfer` become thin `sign` +
`broadcast` compositions (kept for callers that don't need the two-phase form),
or are replaced at the call site. `EthersEvmClient` implements sign via
`wallet.signTransaction(populated)` and `ethers.Transaction.from(signed).hash`;
broadcast via `provider.broadcastTransaction(signed)`; getConfirmations via
`provider.getTransactionReceipt`/`getTransaction` (null when not found).
`FakeEvmClient` returns canned hash/signed/fee and a configurable
`getConfirmations` (found vs not-found) for the reaper tests.

### 2. Withdrawal flow (EthereumService / BscService `processWithdrawal`)

```
claimForProcessing(id)            // pendiente → procesando  [already]
{ txHash, signed, fee } = sign…   // no network effect yet
recordWithdrawalTxHash(id, txHash)// persist the intent BEFORE broadcast  [NEW]
broadcast(signed)                 // on-chain
markWithdrawalAsSent(id, txHash, fee)  // finalize (fee, confirmaciones=0)
```
Crash-window analysis after this change:
- before `recordWithdrawalTxHash`: row `procesando`, **txHash null** → nothing was
  broadcast (we hadn't even recorded intent) → reaper safely reverts.
- after `recordWithdrawalTxHash`, around `broadcast`: row `procesando`, **txHash
  set** → reaper checks on-chain: present → leave; absent after grace → revert.

### 3. New model methods

- `recordWithdrawalTxHash(id, txHash)`: `UPDATE ... SET txHash=? WHERE id AND
  estado='procesando'`. (No estado change; just persists intent.)
- Reuse `failWithdrawal(id, razon)` for the revert (already reverts balance +
  sets `fallido`).

### 4. The reaper job (`reapStaleWithdrawals`)

A method (initially callable manually + wired into the blockchain job scheduler
later) that, per EVM network:
```
rows = procesando withdrawals, tipo=retiro, red=<network>, updated_at < now - STALE_MINUTES
for each row:
  if !row.txHash:                       // never got to broadcast
    failWithdrawal(row.id, 'reaped: no broadcast')     // safe revert
  else:
    confs = await chainClient.getConfirmations(row.txHash)
    if confs === null:                  // provably not on-chain
      failWithdrawal(row.id, 'reaped: tx absent on-chain')  // safe revert
    // else: tx is out — leave it; the confirmation job finalizes it
```
`STALE_MINUTES` is a config (default e.g. 15) — comfortably longer than a normal
send, so we never reap an in-flight withdrawal.

## Tests (integration, real Postgres + fake chain)

`withdrawalReaper.integration.test.js`:
1. **Stuck with no txHash → reverted:** seed a `procesando` withdrawal, txHash
   null, updated_at old. Reaper reverts: estado `fallido`, user balance restored.
2. **Stuck with txHash, tx absent on-chain → reverted:** fake `getConfirmations`
   returns null. Reaper reverts.
3. **Stuck with txHash, tx present on-chain → left untouched:** fake
   `getConfirmations` returns e.g. 2. Reaper does NOT revert; row stays
   `procesando`, balance still blocked.
4. **Not stale yet → skipped:** a recent `procesando` row is not touched.

Plus the pre-record change is covered by updating the existing ETH/BSC withdrawal
tests: after a successful send the row has the txHash (now pre-recorded), and a
crash simulated by stopping after `recordWithdrawalTxHash` (fake broadcast throws)
leaves a `procesando` row WITH txHash that the reaper then evaluates.

## Risks / open decisions

- **Deterministic hash before broadcast:** `ethers.Transaction.from(signed).hash`
  must equal the mined tx hash. It does for a fully-signed tx. Verified in the
  real adapter; the fake sidesteps it.
- **`getConfirmations` semantics:** must return `null` (not 0) when the tx is
  entirely unknown to the node, vs `0` for "in mempool, unconfirmed". A mempool tx
  (0 confs) must be treated as PRESENT (do not revert). The reaper reverts only on
  `null`.
- **Grace period vs mempool eviction:** a tx dropped from the mempool without
  mining would eventually read `null` and be reverted — correct (it didn't go
  out). But a very-long-pending tx (stuck low gas) reads `0` and is left — correct
  (it may still mine). Re-broadcast/replacement is a separate follow-up.
- **Bitcoin:** same pattern applies (txid known from signed txHex pre-broadcast)
  but rides with the BTC port migration — not in this spec.
