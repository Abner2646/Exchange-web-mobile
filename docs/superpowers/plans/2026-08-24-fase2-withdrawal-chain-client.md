# Fase 2 Withdrawal EVM chain-client (ETH native) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Introduce an EVM chain-client port + real/fake adapters, refactor the native-ETH withdrawal path to use it, and cover the withdrawal pipeline end-to-end against real Postgres with a fake chain.

**Architecture:** Ports & adapters. `EvmChainClient` (base) defines `getNativeBalance` + `sendNativeTransfer`. `EthersEvmClient` (real) wraps the ethers logic moved from `EthereumService`. `FakeEvmClient` (test) returns canned values + records calls. `EthereumService` takes `{ chainClient }`, falling back to `EthersEvmClient.fromEnv` — production behavior unchanged.

**Tech Stack:** Node/CommonJS, ethers v6, Sequelize 6, jest 29. No new dependencies.

## Global Constraints

- English code/comments; Conventional Commits in English.
- **Production behavior unchanged**: with no injected `chainClient`, `EthereumService` builds the real ethers client from env exactly as before, and `this.provider`/`this.wallet` remain available for the not-yet-migrated paths (token withdrawal, scan, confirmations).
- **Only the native-ETH withdrawal path** moves to the port. Token/BSC/BTC untouched.
- Money assertions are exact canonical strings (DECIMAL(28,8) balances / (18,8) fee).
- Integration tests under `backend/tests/integration/`, `npm run test:integration` (test DB up).
- Characterize current behavior; do NOT fix the broadcast-before-atomic-claim risk.

---

### Task 1: Port + adapters + service refactor (driven by the happy-path test)

**Files:**
- Create: `backend/services/blockchain/evmChainClient.js`
- Create: `backend/services/blockchain/ethersEvmClient.js`
- Create: `backend/tests/helpers/fakeEvmClient.js`
- Modify: `backend/services/blockchain/ethereum.service.js` (constructor + `processWithdrawal`)
- Create: `backend/tests/integration/ethWithdrawal.integration.test.js`

**Interfaces:**
- `EvmChainClient` (base class): `async getNativeBalance(): Promise<string>`, `async sendNativeTransfer(toAddress, amount): Promise<{ txHash, fee }>`.
- `EthersEvmClient`: `static fromEnv({ isTestnet }): EthersEvmClient`; `.provider`, `.wallet` (ethers objects).
- `FakeEvmClient`: `new FakeEvmClient({ nativeBalance, txHash, fee })`; `.sendCalls` array.
- `EthereumService`: `new EthereumService({ chainClient })`.

- [ ] **Step 1: Write the happy-path integration test (RED)**

`backend/tests/integration/ethWithdrawal.integration.test.js`:
```javascript
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const FakeEvmClient = require('../helpers/fakeEvmClient');
const EthereumService = require('../../services/blockchain/ethereum.service');
const { TransaccionBlockchain } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

// ETH cripto on the test network (actualNetwork = 'sepolia' under NODE_ENV=test).
async function seedEth() {
  const eth = await f.seedCripto('ETH');       // symbol ETH
  await eth.update({ red: 'sepolia' });         // match actualNetwork; native (no contract)
  return eth;
}

async function seedPendingWithdrawal(user, eth, cantidad) {
  return TransaccionBlockchain.createWithdrawal({
    userId: user.id, criptomonedaId: eth.id, cantidad, direccionDestino: '0xrecipient0000000000000000000000000000dead',
  });
}

describe('ETH native withdrawal — processPendingWithdrawals (fake chain)', () => {
  test('sends the pending withdrawal and marks it procesando with txHash + fee', async () => {
    const user = await f.seedUser();
    const eth = await seedEth();
    await f.seedBalance(user, eth, '5');
    const w = await seedPendingWithdrawal(user, eth, '1');

    const fake = new FakeEvmClient({ nativeBalance: '10', txHash: '0xsent00000000000000000000000000000000000000000000000000000000beef', fee: '0.00042' });
    const service = new EthereumService({ chainClient: fake });

    await service.processPendingWithdrawals();

    const row = await TransaccionBlockchain.findByPk(w.id);
    expect(row.estado).toBe('procesando');
    expect(row.txHash).toBe('0xsent00000000000000000000000000000000000000000000000000000000beef');
    expect(row.feeBlockchain).toBe('0.00042000');

    expect(fake.sendCalls).toHaveLength(1);
    expect(fake.sendCalls[0].toAddress).toBe('0xrecipient0000000000000000000000000000dead');
    expect(fake.sendCalls[0].amount).toBe('1');
  });
});
```

- [ ] **Step 2: Run to verify RED**

Run: `cd backend && npm run test:integration:up && npm run test:integration -- ethWithdrawal`
Expected: FAIL — `Cannot find module '../helpers/fakeEvmClient'` (and the service can't accept a chainClient yet).

- [ ] **Step 3: Create the port base class**

`backend/services/blockchain/evmChainClient.js`:
```javascript
// Port: the chain operations the withdrawal path needs. Adapters implement it
// (EthersEvmClient for prod, FakeEvmClient for tests). ethers lives only in the
// real adapter — the service never touches it for the native path.
class EvmChainClient {
  // Master wallet native balance, human units (e.g. "10.5"), as a string.
  async getNativeBalance() { throw new Error('EvmChainClient.getNativeBalance not implemented'); }

  // Send `amount` (human units, string) of native coin to `toAddress`.
  // Returns { txHash, fee } (fee in human units, string).
  async sendNativeTransfer(toAddress, amount) { throw new Error('EvmChainClient.sendNativeTransfer not implemented'); }
}

module.exports = EvmChainClient;
```

- [ ] **Step 4: Create the real adapter**

`backend/services/blockchain/ethersEvmClient.js`:
```javascript
require('dotenv').config();
const { ethers } = require('ethers');
const EvmChainClient = require('./evmChainClient');

// Real adapter: wraps the ethers provider + wallet. Holds the exact native
// logic previously inline in EthereumService.
class EthersEvmClient extends EvmChainClient {
  constructor({ rpcUrl, privateKey, provider, wallet }) {
    super();
    this.provider = provider || new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = wallet || new ethers.Wallet(privateKey, this.provider);
  }

  static fromEnv({ isTestnet }) {
    const rpcUrl = isTestnet ? process.env.ETHEREUM_SEPOLIA_RPC_URL : process.env.ETHEREUM_RPC_URL;
    const privateKey = isTestnet ? process.env.ETH_SEPOLIA_PRIVATE_KEY : process.env.ETH_PRIVATE_KEY;
    return new EthersEvmClient({ rpcUrl, privateKey });
  }

  async getNativeBalance() {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  async sendNativeTransfer(toAddress, amount) {
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
    const tx = await this.wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount.toString()),
      gasLimit: 21000,
      gasPrice,
    });
    const fee = ethers.formatEther(gasPrice * BigInt(21000));
    return { txHash: tx.hash, fee };
  }
}

module.exports = EthersEvmClient;
```

- [ ] **Step 5: Create the fake adapter (test helper)**

`backend/tests/helpers/fakeEvmClient.js`:
```javascript
const EvmChainClient = require('../../services/blockchain/evmChainClient');

// Test double: canned native balance + send result, records send calls.
class FakeEvmClient extends EvmChainClient {
  constructor({ nativeBalance = '10', txHash = '0xdeadbeef', fee = '0.00042' } = {}) {
    super();
    this.nativeBalance = nativeBalance;
    this._txHash = txHash;
    this._fee = fee;
    this.sendCalls = [];
  }
  async getNativeBalance() { return this.nativeBalance; }
  async sendNativeTransfer(toAddress, amount) {
    this.sendCalls.push({ toAddress, amount });
    return { txHash: this._txHash, fee: this._fee };
  }
}

module.exports = FakeEvmClient;
```

- [ ] **Step 6: Refactor `EthereumService` constructor**

Replace the constructor body (currently building `this.provider`/`this.wallet` from env) with the seam. Add at the top of the file: `const EthersEvmClient = require('./ethersEvmClient');`. New constructor:
```javascript
  constructor(opts = {}) {
    this.isTestnet = process.env.NODE_ENV !== 'production';

    // Chain-client seam: injected in tests, built from env in prod.
    this.chain = opts.chainClient || EthersEvmClient.fromEnv({ isTestnet: this.isTestnet });

    // Legacy ethers handles for the not-yet-migrated paths (token withdrawal,
    // scan, confirmations, token balance). The real adapter exposes them; a fake
    // adapter leaves them undefined (the native path never touches them).
    this.provider = this.chain.provider || null;
    this.wallet = this.chain.wallet || null;

    this.network = 'ethereum';
    this.actualNetwork = this.isTestnet ? 'sepolia' : 'ethereum';
    this.chainId = this.isTestnet ? 11155111 : 1;
    this.requiredConfirmations = parseInt(process.env.ETH_REQUIRED_CONFIRMATIONS) || 12;
    this.hasApiKey = !!process.env.ETHERSCAN_API_KEY;

    console.log(`Ethereum Service inicializado - Red: ${this.actualNetwork} (chainId: ${this.chainId}) - API: ${this.hasApiKey ? 'Disponible' : 'No disponible'}`);
    if (!this.hasApiKey) {
      console.error('❌ CRITICAL: ETHERSCAN_API_KEY faltante. Ethereum NO FUNCIONARÁ.');
    }
  }
```

- [ ] **Step 7: Refactor `processWithdrawal` — native branch to the port, token branch unchanged**

Replace the whole `processWithdrawal` method with a branch-first version. The native branch uses the port; the token branch keeps the exact existing inline-ethers code:
```javascript
  async processWithdrawal(withdrawal) {
    const { cantidad, direccionDestino, criptomoneda } = withdrawal;

    if (criptomoneda.symbol === 'ETH') {
      // NATIVE — migrated to the chain-client port.
      const walletBalance = await this.chain.getNativeBalance();
      if (money.compare(String(walletBalance), String(cantidad)) < 0) {
        throw new Error(`Balance insuficiente en wallet maestra ETH: ${walletBalance} < ${cantidad}`);
      }
      const { txHash, fee } = await this.chain.sendNativeTransfer(direccionDestino, cantidad.toString());
      const updated = await TransaccionBlockchain.markWithdrawalAsSent(withdrawal.id, txHash, fee);
      console.log(`✅ [ETH] Retiro enviado: ${cantidad} ${criptomoneda.symbol} - TX: ${txHash}`);
      return updated;
    }

    // TOKEN (ERC20) — unchanged inline ethers; migrated in a follow-up.
    const walletBalance = await this.getWalletBalance(criptomoneda);
    if (money.compare(String(walletBalance), String(cantidad)) < 0) {
      throw new Error(`Balance insuficiente en wallet maestra ETH: ${walletBalance} < ${cantidad}`);
    }
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
    try {
      const contract = new ethers.Contract(
        criptomoneda.direccionContrato,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function decimals() view returns (uint8)'
        ],
        this.wallet
      );
      const estimatedFee = ethers.formatEther(gasPrice * BigInt(60000));
      const decimales = await contract.decimals();
      const amount = ethers.parseUnits(cantidad.toString(), decimales);
      const tx = await contract.transfer(direccionDestino, amount, { gasLimit: 60000, gasPrice });
      const updated = await TransaccionBlockchain.markWithdrawalAsSent(withdrawal.id, tx.hash, estimatedFee);
      console.log(`✅ [ETH] Retiro enviado: ${cantidad} ${criptomoneda.symbol} - TX: ${tx.hash}`);
      return updated;
    } catch (txError) {
      throw new Error(`Error enviando transacción ETH: ${txError.message}`);
    }
  }
```

- [ ] **Step 8: Run the happy-path test (GREEN)**

Run: `cd backend && npm run test:integration -- ethWithdrawal`
Expected: PASS. If `seedCripto('ETH')` collides with a unique symbol from another test, note `resetDb` clears between tests so it's fine.

- [ ] **Step 9: Confirm an assertion can fail**

Temporarily change `'0.00042000'` to `'0.00099000'`, run, confirm FAIL, restore.

- [ ] **Step 10: Run the full unit suite (prod parity — service still constructs from env for its other paths)**

Run: `cd backend && npm test`
Expected: PASS (~277). The unit suite does not build EthereumService from env, so no regression; this confirms the refactor did not break requires.

- [ ] **Step 11: Commit**

```bash
git add backend/services/blockchain/evmChainClient.js backend/services/blockchain/ethersEvmClient.js backend/tests/helpers/fakeEvmClient.js backend/services/blockchain/ethereum.service.js backend/tests/integration/ethWithdrawal.integration.test.js
git commit -m "feat(blockchain): EVM chain-client port; test ETH native withdrawal e2e"
```

---

### Task 2: Failure + no-resend scenarios

**Files:**
- Modify: `backend/tests/integration/ethWithdrawal.integration.test.js`

- [ ] **Step 1: Add the insufficient-master-balance test**

Append inside the describe:
```javascript
  test('insufficient master wallet balance → not sent, marked fallido, user balance restored', async () => {
    const user = await f.seedUser();
    const eth = await seedEth();
    await f.seedBalance(user, eth, '5');
    const w = await seedPendingWithdrawal(user, eth, '1'); // locks 1 → available 4, blocked 1

    const fake = new FakeEvmClient({ nativeBalance: '0.001' }); // < 1
    await new EthereumService({ chainClient: fake }).processPendingWithdrawals();

    const row = await TransaccionBlockchain.findByPk(w.id);
    expect(row.estado).toBe('fallido');
    expect(fake.sendCalls).toHaveLength(0);

    // failWithdrawal returns the locked funds to available.
    const bal = await f.getBalance(user, eth);
    expect(bal.balanceDisponible).toBe('5.00000000');
    expect(bal.balanceBloqueado).toBe('0.00000000');
  });
```

- [ ] **Step 2: Add the no-resend test**

```javascript
  test('a second run does not re-send an already-processing withdrawal', async () => {
    const user = await f.seedUser();
    const eth = await seedEth();
    await f.seedBalance(user, eth, '5');
    await seedPendingWithdrawal(user, eth, '1');

    const fake = new FakeEvmClient({ nativeBalance: '10' });
    const service = new EthereumService({ chainClient: fake });

    await service.processPendingWithdrawals(); // sends, row → procesando
    await service.processPendingWithdrawals(); // query only picks 'pendiente' → nothing

    expect(fake.sendCalls).toHaveLength(1);
  });
```

- [ ] **Step 3: Run the ETH withdrawal suite (GREEN)**

Run: `cd backend && npm run test:integration -- ethWithdrawal`
Expected: all three PASS.

- [ ] **Step 4: Run the whole integration + unit suites**

Run: `cd backend && npm run test:integration && npm test`
Expected: integration green (all suites incl. ethWithdrawal); unit green (~277).

- [ ] **Step 5: Commit**

```bash
git add backend/tests/integration/ethWithdrawal.integration.test.js
git commit -m "test(integration): ETH withdrawal failure revert + no double-send"
```

---

## Notes / findings to record

- **Broadcast-before-atomic-claim** (roadmap Fase 1 #0): the row is claimed
  `procesando` only after the send; sequential re-runs are safe (query skips
  non-`pendiente`), but concurrent/multi-instance runs are not. Characterized, not
  fixed. The atomic-claim fix is the real robustness follow-up.
- **Follow-ups reusing the port:** ERC20 token withdrawals; BSC (EVM, shares the
  adapter); Bitcoin (own adapter shape); scan/confirmations migration; Fase 3
  NetworkProfile; Fase 4.2 HSM/KMS signer behind the port.

## Self-Review

- **Spec coverage:** port + real adapter + fake adapter (Task 1 steps 3–5);
  service constructor + native `processWithdrawal` refactor (steps 6–7); happy
  path (Task 1), insufficient + no-resend (Task 2). Prod-parity via env fallback
  (step 6 + step 10). ✓
- **Placeholder scan:** no TBD; the "confirm collision" note is a runtime check.
- **Type consistency:** `EvmChainClient.getNativeBalance/sendNativeTransfer`
  signatures identical across base/real/fake and the service call sites;
  `EthersEvmClient.fromEnv`/`.provider`/`.wallet` used consistently; `FakeEvmClient.sendCalls`
  shape (`{ toAddress, amount }`) matches assertions.
