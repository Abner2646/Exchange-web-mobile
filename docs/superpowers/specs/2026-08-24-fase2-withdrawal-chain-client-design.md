# Fase 2 — Withdrawal pipeline: EVM chain-client port (ETH native) — Design Spec

- **Date:** 2026-08-24
- **Phase:** Roadmap Fase 2 (Testing) — withdrawal pipeline + blockchain provider injection
- **Status:** Approved (design), pending implementation plan

## Problem

The withdrawal pipeline (`runWithdrawalProcessJob` → per network
`service.processPendingWithdrawals()` → `processWithdrawal()`) sends real crypto
on-chain, and is **untestable** without hitting a real RPC + a funded wallet:
`EthereumService`'s constructor builds `this.provider = new ethers.JsonRpcProvider(...)`
and `this.wallet = new ethers.Wallet(privateKey, provider)` from env. There is no
seam to substitute a fake chain. This is the highest-value untested money-path
(real crypto leaving the master wallet).

The roadmap (Fase 2 #4 + Fase 3) calls for an injected blockchain provider. The
chosen architecture (user decision, 2026-08-24) is a **ports & adapters** seam: a
chain-client interface owned by us, with `ethers` hidden behind a real adapter and
a fake adapter for tests — not merely injecting concrete `ethers` objects. This
same seam is where the testnet/mainnet profile (Fase 3) and a future HSM/KMS
signer (Fase 4.2) will live.

### Known risk (characterized, not fixed here)

`processWithdrawal` broadcasts the on-chain tx **before** the row is atomically
claimed (`pendiente → procesando` happens in `markWithdrawalAsSent`, after the
send). Single-process double-spend is mitigated by the job's `withdrawalProcessing`
reentrancy guard, but there is no atomic per-row claim before broadcast
(multi-instance risk — roadmap Fase 1 #0). This pass tests the pipeline; the
atomic-claim fix is the real robustness follow-up.

## Goal

Introduce a minimal EVM chain-client port, extracted from what `processWithdrawal`
actually does for **native ETH**, with a real ethers adapter (prod, behavior
unchanged) and a fake adapter (tests). Refactor only the native-ETH withdrawal
path to use the port. Prove the pipeline end to end against real Postgres with a
fake chain: a pending ETH withdrawal is sent, the row transitions to `procesando`
with the tx hash + fee, and a failed send reverts correctly.

### Scope & non-goals

- **In scope:** native ETH withdrawal path only (`EthereumService`), the port +
  both adapters, and the integration tests.
- **Non-goals (follow-ups, reuse the port):** ERC20 token withdrawals (token
  branch stays inline-ethers, unchanged); BSC and Bitcoin services; deposit
  scanning / confirmations migration; the testnet/mainnet NetworkProfile (Fase 3);
  the atomic-claim-before-broadcast fix; HSM/KMS signer.
- **Incremental discipline:** migrate one path at a time, each with a test. The
  token path and other services keep working unchanged until their own specs.

## The port

`backend/services/blockchain/evmChainClient.js` — an interface (documented shape,
duck-typed in JS) with exactly what the native withdrawal path needs:

```
EvmChainClient {
  // Master wallet native balance, human units (e.g. "10.5" ETH), as a string.
  getNativeBalance(): Promise<string>

  // Send `amount` (human units, string) of native coin to `toAddress`.
  // Returns the broadcast tx hash and the fee actually applied (human units).
  sendNativeTransfer(toAddress: string, amount: string): Promise<{ txHash: string, fee: string }>
}
```

The port deliberately hides all ethers concerns (gas price, `parseEther`,
`formatEther`, the `gasPrice * 21000` fee math) inside the adapter — the service
never touches `ethers` for the native path.

### Real adapter — `EthersEvmClient`

`backend/services/blockchain/ethersEvmClient.js`. Wraps the exact ethers logic
currently inline in `EthereumService`:
- Built from `{ rpcUrl, privateKey }` (or an injected provider/wallet). Exposes
  `.provider` and `.wallet` (its ethers objects) so the not-yet-migrated paths
  (token withdrawal, scan, confirmations, token balance) keep working via the
  service's existing `this.provider`/`this.wallet`.
- `getNativeBalance()` = `formatEther(await provider.getBalance(wallet.address))`.
- `sendNativeTransfer(to, amount)`: `getFeeData()` → gasPrice → `wallet.sendTransaction({ to, value: parseEther(amount), gasLimit: 21000, gasPrice })`; `fee = formatEther(gasPrice * 21000n)`; returns `{ txHash: tx.hash, fee }`.

### Fake adapter — `FakeEvmClient` (test helper)

Returns canned `getNativeBalance` and a canned `{ txHash, fee }` from
`sendNativeTransfer`, and records calls (args + count) so tests assert what was
sent and that it was sent exactly once.

## Service refactor (`EthereumService`)

- Constructor accepts `{ chainClient }`. `this.chain = opts.chainClient ||
  EthersEvmClient.fromEnv({ isTestnet })`. Set `this.provider = this.chain.provider
  || null` and `this.wallet = this.chain.wallet || null` (real adapter exposes
  them; fake adapter leaves them null — fine, the native test never touches the
  token/scan paths). **Production is unchanged:** with no `chainClient`, it builds
  the real ethers client from env exactly as before.
- `processWithdrawal`: the **native branch** (`criptomoneda.symbol === 'ETH'`)
  becomes:
  ```
  const walletBalance = await this.chain.getNativeBalance();
  if (money.compare(String(walletBalance), String(cantidad)) < 0) throw ...;
  const { txHash, fee } = await this.chain.sendNativeTransfer(direccionDestino, cantidad.toString());
  return TransaccionBlockchain.markWithdrawalAsSent(withdrawal.id, txHash, fee);
  ```
  The **token branch** (ERC20) is left exactly as-is (inline ethers via
  `this.provider`/`this.wallet`), migrated in a follow-up.

## Tests (integration, real Postgres + fake chain)

New `backend/tests/integration/ethWithdrawal.integration.test.js`. Seed helpers:
a user with an ETH balance, an ETH criptomoneda (`symbol: 'ETH'`, `red: 'sepolia'`
to match `actualNetwork` under `NODE_ENV=test`, `direccionContrato: null`), and a
pending withdrawal via `TransaccionBlockchain.createWithdrawal(...)` (which locks
the user's balance — the real precondition).

1. **Happy path:** master wallet has enough (`fake.getNativeBalance → '10'`).
   `await new EthereumService({ chainClient: fake }).processPendingWithdrawals()`.
   Assert: row `estado === 'procesando'`, `txHash` = the fake's hash,
   `feeBlockchain` = the fake's fee; `fake.sendNativeTransfer` called once with
   `(direccionDestino, cantidad)`.
2. **Insufficient master-wallet balance:** `fake.getNativeBalance → '0.001'` (<
   cantidad). Assert: `sendNativeTransfer` NOT called; row marked failed
   (`failWithdrawal` path); the user's locked balance is returned to available.
3. **No re-send once processing:** run `processPendingWithdrawals` twice. After the
   first run the row is `procesando` (not `pendiente`), so the second run's query
   skips it → `sendNativeTransfer` total call count is 1. Characterizes that a
   sequential re-run does not double-send (distinct from the concurrent /
   multi-instance broadcast-before-claim risk, which is the documented follow-up).

## Risks / open decisions

- **`this.provider`/`this.wallet` null under the fake:** acceptable — the native
  test never calls token/scan/confirmations. Documented.
- **`actualNetwork` = 'sepolia' in test:** the withdrawal query filters
  criptomoneda by `red`; the seed must use `red: 'sepolia'`. Pinned in the plan.
- **`failWithdrawal` exact `estado` value:** confirmed against the model when
  writing the test (assert the real terminal state, e.g. `fallido`).
- **Behavior parity:** the real adapter must reproduce the current native fee math
  (`gasPrice * 21000`) and send params exactly — it is a move of existing code,
  not new logic.
