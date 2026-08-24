# Fase 2 Withdrawal reaper (on-chain verified) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Pre-record the txHash before broadcasting (sign → record → broadcast) on the EVM withdrawal path, and add a reaper that reverts stuck `procesando` claims only when their tx is provably absent on-chain.

**Architecture:** Extend `EvmChainClient` with `signNativeTransfer`/`signTokenTransfer` (deterministic hash, no broadcast), `broadcast(signed)`, and `getConfirmations(txHash) → number|null`. `processWithdrawal` becomes claim → sign → `recordWithdrawalTxHash` → broadcast → `markWithdrawalAsSent`. The reaper sweeps stale `procesando` rows and reverts via `failWithdrawal` only when txHash is null or `getConfirmations` returns null.

**Tech Stack:** Node/CommonJS, ethers v6, Sequelize 6, jest 29. No new deps.

## Global Constraints

- English code/comments; Conventional Commits in English.
- **Orchestration + reaper logic fully tested with the fake chain; the real EthersEvmClient sign/broadcast is mechanically faithful to the current `sendTransaction` and flagged for a testnet smoke-test before prod** (no real-chain test in the harness).
- `getConfirmations` returns `null` ONLY when the tx is unknown to the node (absent); `0` means in-mempool/unconfirmed (present — never revert).
- Reaper reverts only on: txHash null, OR `getConfirmations === null`. Never on `>= 0`.
- `STALE_MINUTES` config (default 15), comfortably longer than a normal send.
- EVM only (ETH+BSC, native+token). Bitcoin deferred.

---

### Task 1: Sign-then-broadcast (pre-record txHash)

**Files:**
- Modify: `backend/services/blockchain/evmChainClient.js` (port)
- Modify: `backend/services/blockchain/ethersEvmClient.js` (real)
- Modify: `backend/tests/helpers/fakeEvmClient.js` (fake)
- Modify: `backend/models/transaccionBlockchain.model.js` (`recordWithdrawalTxHash`)
- Modify: `backend/services/blockchain/ethereum.service.js` + `bsc.service.js` (`processWithdrawal`)
- Modify: `backend/tests/integration/ethWithdrawal.integration.test.js` + `bscWithdrawal.integration.test.js`

**Interfaces:**
- `signNativeTransfer(toAddress, amount): Promise<{ txHash, signed, fee }>`
- `signTokenTransfer(contractAddress, toAddress, amount): Promise<{ txHash, signed, fee }>`
- `broadcast(signed): Promise<{ txHash }>`
- `getConfirmations(txHash): Promise<number|null>`
- `TransaccionBlockchain.recordWithdrawalTxHash(id, txHash): Promise<void>`

- [ ] **Step 1: Update the existing ETH happy-path test to expect pre-record wiring (RED)**

The fake will grow `signNativeTransfer`/`broadcast`; assert the fake was driven in two phases:
```javascript
// in the ETH happy-path test, replace the fake with a two-phase-aware one and assert:
expect(fake.signCalls).toHaveLength(1);
expect(fake.broadcastCalls).toHaveLength(1);
// row still ends procesando with txHash + fee (unchanged outcome)
```
Run: `cd backend && npm run test:integration:up && npm run test:integration -- ethWithdrawal` → RED (fake has no signCalls; service still calls sendNativeTransfer).

- [ ] **Step 2: Extend the port**

Add to `EvmChainClient`:
```javascript
  async signNativeTransfer(toAddress, amount) { throw new Error('EvmChainClient.signNativeTransfer not implemented'); }
  async signTokenTransfer(contractAddress, toAddress, amount) { throw new Error('EvmChainClient.signTokenTransfer not implemented'); }
  async broadcast(signed) { throw new Error('EvmChainClient.broadcast not implemented'); }
  async getConfirmations(txHash) { throw new Error('EvmChainClient.getConfirmations not implemented'); }
```

- [ ] **Step 3: Implement in the real adapter (flag: testnet smoke-test)**

In `EthersEvmClient` (mechanically faithful to the current `sendTransaction`; the split just captures the hash before broadcast):
```javascript
  async signNativeTransfer(toAddress, amount) {
    const gasPrice = await this._gasPrice();
    const populated = await this.wallet.populateTransaction({
      to: toAddress, value: ethers.parseEther(amount.toString()), gasLimit: 21000, gasPrice,
    });
    const signed = await this.wallet.signTransaction(populated);
    const txHash = ethers.Transaction.from(signed).hash;
    const fee = ethers.formatEther(gasPrice * BigInt(21000));
    return { txHash, signed, fee };
  }

  async signTokenTransfer(contractAddress, toAddress, amount) {
    const gasPrice = await this._gasPrice();
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, this.wallet);
    const decimales = await contract.decimals();
    const value = ethers.parseUnits(amount.toString(), decimales);
    const req = await contract.transfer.populateTransaction(toAddress, value, { gasLimit: 60000, gasPrice });
    const populated = await this.wallet.populateTransaction(req);
    const signed = await this.wallet.signTransaction(populated);
    const txHash = ethers.Transaction.from(signed).hash;
    const fee = ethers.formatEther(gasPrice * BigInt(60000));
    return { txHash, signed, fee };
  }

  async broadcast(signed) {
    const resp = await this.provider.broadcastTransaction(signed);
    return { txHash: resp.hash };
  }

  // null when the node does not know the tx at all (absent); 0 when in mempool
  // (present, unconfirmed); >0 when mined.
  async getConfirmations(txHash) {
    const tx = await this.provider.getTransaction(txHash);
    if (!tx) return null;
    if (tx.blockNumber == null) return 0;
    const latest = await this.provider.getBlockNumber();
    return Math.max(0, latest - tx.blockNumber + 1);
  }
```
Keep the existing `sendNativeTransfer`/`sendTokenTransfer` (unused by the new flow but harmless; remove in a later cleanup).

- [ ] **Step 4: Extend the fake**

In `FakeEvmClient`:
```javascript
  // add to constructor: this.signCalls = []; this.broadcastCalls = [];
  //   this._confirmations = opts.confirmations (may be null/number, default 1)
  async signNativeTransfer(toAddress, amount) {
    this.signCalls.push({ kind: 'native', toAddress, amount });
    return { txHash: this._txHash, signed: `signed:${this._txHash}`, fee: this._fee };
  }
  async signTokenTransfer(contractAddress, toAddress, amount) {
    this.signCalls.push({ kind: 'token', contractAddress, toAddress, amount });
    return { txHash: this._txHash, signed: `signed:${this._txHash}`, fee: this._fee };
  }
  async broadcast(signed) { this.broadcastCalls.push({ signed }); return { txHash: this._txHash }; }
  async getConfirmations(txHash) { return this._confirmations; }
```
Default `confirmations` to `1` (present) so existing tests are unaffected; reaper tests set it explicitly. Keep `sendCalls`/`sendTokenCalls`/`getNativeBalance`/`getTokenBalance` as-is.

- [ ] **Step 5: Add `recordWithdrawalTxHash` to the model**

```javascript
  TransaccionBlockchain.recordWithdrawalTxHash = async (id, txHash) => {
    await TransaccionBlockchain.update(
      { txHash },
      { where: { id, tipo: 'retiro', estado: 'procesando' } }
    );
  };
```

- [ ] **Step 6: Refactor `processWithdrawal` (ETH native + token) to sign → record → broadcast → mark**

Native branch:
```javascript
      const walletBalance = await this.chain.getNativeBalance();
      if (money.compare(String(walletBalance), String(cantidad)) < 0) {
        throw new Error(`Balance insuficiente en wallet maestra ETH: ${walletBalance} < ${cantidad}`);
      }
      const { txHash, signed, fee } = await this.chain.signNativeTransfer(direccionDestino, cantidad.toString());
      await TransaccionBlockchain.recordWithdrawalTxHash(withdrawal.id, txHash); // pre-record intent
      await this.chain.broadcast(signed);
      const updated = await TransaccionBlockchain.markWithdrawalAsSent(withdrawal.id, txHash, fee);
      console.log(`✅ [ETH] Retiro enviado: ${cantidad} ${criptomoneda.symbol} - TX: ${txHash}`);
      return updated;
```
Token branch (analogous, `signTokenTransfer(criptomoneda.direccionContrato, direccionDestino, cantidad.toString())`).

- [ ] **Step 7: Apply the same refactor to BSC** (`bsc.service.js`, BNB native + BEP20 token).

- [ ] **Step 8: Update ETH + BSC happy-path/token tests for two-phase assertions**

Assert `fake.signCalls`/`fake.broadcastCalls` length 1 where relevant; row still ends `procesando` with the txHash + fee. Run: `npm run test:integration -- Withdrawal` → GREEN.

- [ ] **Step 9: Full suites + parity**

Run: `cd backend && npm run test:integration && npm test && npx jest --config jest.config.js "bscService|ethereumService|bitcoinService"`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add backend/services/blockchain/evmChainClient.js backend/services/blockchain/ethersEvmClient.js backend/tests/helpers/fakeEvmClient.js backend/models/transaccionBlockchain.model.js backend/services/blockchain/ethereum.service.js backend/services/blockchain/bsc.service.js backend/tests/integration/ethWithdrawal.integration.test.js backend/tests/integration/bscWithdrawal.integration.test.js
git commit -m "feat(withdrawal): pre-record txHash before broadcast (sign->record->broadcast)"
```

---

### Task 2: The reaper (`reapStaleWithdrawals`)

**Files:**
- Create: `backend/services/blockchain/withdrawalReaper.js`
- Create: `backend/tests/integration/withdrawalReaper.integration.test.js`

**Interfaces:**
- `reapStaleWithdrawals({ getClientForNetwork, staleMinutes = 15, now = new Date() }): Promise<{ reverted, left }>` — dependency-injected client resolver so tests pass a fake; scans `procesando` retiros with `updated_at < now - staleMinutes`.

- [ ] **Step 1: Write the reaper tests (RED)**

`backend/tests/integration/withdrawalReaper.integration.test.js`:
```javascript
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const FakeEvmClient = require('../helpers/fakeEvmClient');
const { reapStaleWithdrawals } = require('../../services/blockchain/withdrawalReaper');
const { TransaccionBlockchain } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

async function seedStuck(user, eth, { txHash = null, ageMinutes = 60 } = {}) {
  const w = await TransaccionBlockchain.createWithdrawal({
    userId: user.id, criptomonedaId: eth.id, cantidad: '1', direccionDestino: '0xrecipient0000000000000000000000000000dead',
  });
  await TransaccionBlockchain.update(
    { estado: 'procesando', txHash, updatedAt: new Date(Date.now() - ageMinutes * 60000) },
    { where: { id: w.id }, silent: false },
  );
  return w;
}

async function seedEth() {
  const eth = await f.seedCripto('ETH');
  await eth.update({ red: 'sepolia' });
  return eth;
}

const clientFor = (fake) => () => fake;

test('stuck with no txHash → reverted (never broadcast)', async () => {
  const user = await f.seedUser();
  const eth = await seedEth();
  await f.seedBalance(user, eth, '5');
  const w = await seedStuck(user, eth, { txHash: null });

  const res = await reapStaleWithdrawals({ getClientForNetwork: clientFor(new FakeEvmClient({})) });

  const row = await TransaccionBlockchain.findByPk(w.id);
  expect(row.estado).toBe('fallido');
  expect((await f.getBalance(user, eth)).balanceDisponible).toBe('5.00000000');
});

test('stuck with txHash, tx absent on-chain → reverted', async () => {
  const user = await f.seedUser();
  const eth = await seedEth();
  await f.seedBalance(user, eth, '5');
  const w = await seedStuck(user, eth, { txHash: '0xabc' });

  await reapStaleWithdrawals({ getClientForNetwork: clientFor(new FakeEvmClient({ confirmations: null })) });

  const row = await TransaccionBlockchain.findByPk(w.id);
  expect(row.estado).toBe('fallido');
  expect((await f.getBalance(user, eth)).balanceDisponible).toBe('5.00000000');
});

test('stuck with txHash, tx present on-chain → left untouched', async () => {
  const user = await f.seedUser();
  const eth = await seedEth();
  await f.seedBalance(user, eth, '5');
  const w = await seedStuck(user, eth, { txHash: '0xabc' });

  await reapStaleWithdrawals({ getClientForNetwork: clientFor(new FakeEvmClient({ confirmations: 2 })) });

  const row = await TransaccionBlockchain.findByPk(w.id);
  expect(row.estado).toBe('procesando');
  expect((await f.getBalance(user, eth)).balanceBloqueado).toBe('1.00000000');
});

test('not stale yet → skipped', async () => {
  const user = await f.seedUser();
  const eth = await seedEth();
  await f.seedBalance(user, eth, '5');
  const w = await seedStuck(user, eth, { txHash: null, ageMinutes: 1 });

  await reapStaleWithdrawals({ getClientForNetwork: clientFor(new FakeEvmClient({})), staleMinutes: 15 });

  const row = await TransaccionBlockchain.findByPk(w.id);
  expect(row.estado).toBe('procesando');
});
```
Run → RED (module missing). Note: confirm `updatedAt` can be forced (the model uses `updatedAt` timestamps; if `silent`/manual set doesn't stick, set via raw update or a dedicated column — adjust to what persists).

- [ ] **Step 2: Implement the reaper**

`backend/services/blockchain/withdrawalReaper.js`:
```javascript
const { Op } = require('sequelize');
const { TransaccionBlockchain, Criptomoneda } = require('../../models');

// Reverts stuck 'procesando' withdrawals only when their tx is provably absent
// on-chain. getClientForNetwork(red) returns an EvmChainClient (getConfirmations).
async function reapStaleWithdrawals({ getClientForNetwork, staleMinutes = 15, now = new Date() }) {
  const cutoff = new Date(now.getTime() - staleMinutes * 60000);
  const stuck = await TransaccionBlockchain.findAll({
    where: { tipo: 'retiro', estado: 'procesando', updatedAt: { [Op.lt]: cutoff } },
    include: [{ model: Criptomoneda, as: 'criptomoneda' }],
  });

  let reverted = 0, left = 0;
  for (const row of stuck) {
    if (!row.txHash) {
      await TransaccionBlockchain.failWithdrawal(row.id, 'reaped: no broadcast (no txHash recorded)');
      reverted++;
      continue;
    }
    const client = getClientForNetwork(row.criptomoneda.red);
    const confs = client ? await client.getConfirmations(row.txHash) : null;
    if (confs === null) {
      await TransaccionBlockchain.failWithdrawal(row.id, 'reaped: tx absent on-chain');
      reverted++;
    } else {
      left++; // present (mempool or mined) — the confirmation job finalizes it
    }
  }
  return { reverted, left };
}

module.exports = { reapStaleWithdrawals };
```

- [ ] **Step 3: Run the reaper tests (GREEN)**

Run: `cd backend && npm run test:integration -- withdrawalReaper`
Expected: 4 PASS. If `updatedAt` can't be forced via `update`, use `TransaccionBlockchain.update(..., { where }, )` with `sequelize.query` to set `updated_at`, or add the age via a direct SQL update in the seed helper.

- [ ] **Step 4: Full suites**

Run: `cd backend && npm run test:integration && npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add backend/services/blockchain/withdrawalReaper.js backend/tests/integration/withdrawalReaper.integration.test.js
git commit -m "feat(withdrawal): stale-claim reaper reverts only on-chain-absent txs"
```

---

## Notes / follow-ups

- **Real EthersEvmClient sign/broadcast is not exercised by the harness** (fake
  only). Needs a testnet smoke-test before prod. Documented; `dev` is local, no
  real funds.
- **Wire the reaper into the job scheduler** (`blockchain.jobs.js`) with a real
  `getClientForNetwork` (via `BlockchainServiceManager`) — deferred with the
  scheduler/CI work (Fase 5). The reaper is unit/integration-callable now.
- **Bitcoin**: same pre-record + reaper pattern rides with the BTC port migration.
- **Re-broadcast of a signed-but-not-sent tx** (instead of revert) is a possible
  future refinement; reverting is the safe default.

## Self-Review

- Spec coverage: pre-record (Task 1: sign/record/broadcast, steps 5–7); reaper
  with on-chain verify (Task 2, 4 scenarios matching the spec); `getConfirmations`
  null-vs-0 semantics (Task 1 step 3, Task 2 revert-only-on-null). ✓
- Placeholder scan: the `updatedAt`-forcing note is an explicit runtime check, not
  deferred work.
- Type consistency: `signX → { txHash, signed, fee }`, `broadcast → { txHash }`,
  `getConfirmations → number|null` used consistently across port/real/fake/service/reaper.
