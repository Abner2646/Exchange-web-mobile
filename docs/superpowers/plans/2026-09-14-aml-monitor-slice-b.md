# AML Monitor — Slice B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the on-event detective AML engine — a USD-valuation helper, windowed data access, five pure signal functions (S1/S2/S3/S4/S6), an evaluator, and an idempotent event-bus consumer that opens cases + raises the risk flag — all default-off, no money-path change.

**Architecture:** New units under `backend/modules/aml/`. Pure signal functions take pre-computed facts (`(facts) → Finding|null`); the evaluator gathers facts via `amlDataAccess` + `amlValuation` and picks the signals per trigger event; the consumer subscribes to the money-event types and, when monitoring is enabled, runs the evaluator and persists idempotent cases. Walking-skeleton order: prove the event→consumer→case path early with the two valuation-free signals (S3, S4), then add the USD-valued signals (S1, S2, S6) onto the proven spine.

**Tech Stack:** Node.js, Express, Sequelize (Postgres), Jest (unit + integration). `utils/money` for decimal math.

## Global Constraints

- All new code under `backend/modules/aml/`. Lazy `require('../../models')` INSIDE functions (avoid circular requires), mirroring the existing AML/audit modules.
- **Default-off / additive:** the consumer is a no-op unless `amlConfig.isMonitoringEnabled()` is true. This slice adds NO money-path change (Slice A carries the only one, S5). It only adds a new event-bus consumer.
- Reuse Slice A: `amlConfig` (`isMonitoringEnabled`, `getThreshold(key, fallback)`), `case.model.openCase({userId,signalId,severity,evidence,dedupeKey,sourceEventId?}) → {case, created}`, `riskFlag.raiseUserRisk(userId, level, tx?)`.
- **Signals are pure:** no DB, no valuation call inside a signal — facts (including USD values) are pre-computed by the evaluator. Each `(facts) → Finding|null`; a `Finding` is `{ signalId, severity, evidence }`.
- Severity → risk flag: `high` → `amlRiskLevel='high'`; `medium` → raise to `medium` only if currently `low` (`raiseUserRisk` already enforces monotonicity).
- **USD valuation:** `amlValuation.getUsdValue(cryptoId, amount, tx?)` returns `{ usd: string|null, priceAsOf: Date|null, source }`. `usd: null` = unvaluable; a value-based signal SKIPS an unvaluable item and records `unvaluable` in evidence — never a silent miss. USD-stable symbol set = `['USDT','USDC','USD','DAI']`.
- Amounts are strings; all decimal math via `utils/money` (`add`, `subtract`, `multiply`, `compare`). Never floats.
- **Idempotency:** every case carries `sourceEventId = event.id` and a `dedupeKey` (unique). Per-signal dedupe buckets are defined per task. At-least-once delivery + `findOrCreate` on `dedupeKey` ⇒ no duplicate cases.
- Consumer subscribes ONLY to `DepositConfirmed`, `WithdrawalTransmitted`, `P2PTransactionCompleted` (the only Slice-B triggers). Money-event payload shapes (from Slice 3): `WithdrawalTransmitted` `{blockchainTransactionId,userId,cryptoId,amount,destinationAddress,txHash}`; `DepositConfirmed` `{blockchainTransactionId,userId,cryptoId,amount,txHash}`; `P2PTransactionCompleted` `{buyerId,sellerId,transaction:{id,amount,cryptoSymbol,fiatAmount,fiatCurrency}}`.
- Config threshold keys + defaults (verbatim): `aml.s1.windowHours`(24), `aml.s1.multiplier`(3), `aml.s2.thresholdUsd`(10000), `aml.s2.count`(3), `aml.s2.windowHours`(24), `aml.s3.ratio`(0.9), `aml.s3.windowMinutes`(60), `aml.s4.count`(5), `aml.s4.windowHours`(168), `aml.s6.accountAgeDays`(7), `aml.s6.volumeUsd`(50000).
- Every task ends green: run the named tests. Before Task 6's commit run `npm test`, `npm run test:integration`, `npm run test:coverage`, `npm run test:integration:coverage` — all exit 0. Integration DB = Docker `exchange_test_db`, default port (do NOT set DB_PORT unless WinNAT blocks it, then `DB_PORT=15432`). `resetDb` truncates all registered models.
- Commits: Conventional English + trailers `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01LeJZyLF82A2RQ1JcnLePEJ`.

---

### Task 1: `amlValuation.getUsdValue`

**Files:**
- Create: `backend/modules/aml/amlValuation.js`
- Test: `backend/tests/integration/amlValuation.integration.test.js`

**Interfaces:**
- Consumes: `models` (`Crypto`, `SwapPair`), `utils/money`.
- Produces: `getUsdValue(cryptoId, amount, transaction=null) → Promise<{ usd: string|null, priceAsOf: Date|null, source: 'stable'|'pair'|'unknown' }>` and `STABLE_SYMBOLS` (array).

**Context:** `SwapPair` has `baseCryptoId`, `quoteCryptoId`, `currentPrice` (DECIMAL, base priced in quote), `active`, `lastUpdated`. `Crypto` has `symbol`. Valuation: stable → 1:1; else a direct active pair `base=cryptoId` whose quote symbol is stable → `amount × currentPrice`; else unknown.

- [ ] **Step 1: Write the failing integration test**

```js
// backend/tests/integration/amlValuation.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const { Crypto, SwapPair } = require('../../models');
const valuation = require('../../modules/aml/amlValuation');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('amlValuation.getUsdValue', () => {
  test('a USD-stable crypto is valued 1:1', async () => {
    const usdt = await Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 });
    const r = await valuation.getUsdValue(usdt.id, '250.5');
    expect(r.source).toBe('stable');
    expect(Number(r.usd)).toBe(250.5);
  });

  test('a crypto with an active pair against a stable is valued at amount × price', async () => {
    const btc = await Crypto.create({ symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 });
    const usdt = await Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 });
    await SwapPair.create({ baseCryptoId: btc.id, quoteCryptoId: usdt.id, currentPrice: '40000', feePercent: '0.1', active: true });
    const r = await valuation.getUsdValue(btc.id, '0.5');
    expect(r.source).toBe('pair');
    expect(Number(r.usd)).toBe(20000);
    expect(r.priceAsOf).toBeInstanceOf(Date);
  });

  test('a crypto with no stable pair is unvaluable (usd null)', async () => {
    const doge = await Crypto.create({ symbol: 'DOGE', name: 'Dogecoin', network: 'dogecoin', decimals: 8 });
    const r = await valuation.getUsdValue(doge.id, '1000');
    expect(r).toEqual({ usd: null, priceAsOf: null, source: 'unknown' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:integration -- amlValuation`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// backend/modules/aml/amlValuation.js
// Best-effort USD valuation for AML value-based signals. Built on SwapPair.currentPrice
// (base priced in quote) + the USD-stable-quote convention already used in the swap
// pricing code. No cross-quote chaining: an asset with no direct stable pair is
// 'unknown' (the caller records it rather than silently missing it).
const money = require('../../utils/money');

const STABLE_SYMBOLS = ['USDT', 'USDC', 'USD', 'DAI'];

async function getUsdValue(cryptoId, amount, transaction = null) {
  const { Crypto, SwapPair } = require('../../models');
  const crypto = await Crypto.findByPk(cryptoId, { transaction });
  if (!crypto) return { usd: null, priceAsOf: null, source: 'unknown' };

  if (STABLE_SYMBOLS.includes(crypto.symbol)) {
    return { usd: String(amount), priceAsOf: new Date(), source: 'stable' };
  }

  const pairs = await SwapPair.findAll({ where: { baseCryptoId: cryptoId, active: true }, transaction });
  for (const pair of pairs) {
    const quote = await Crypto.findByPk(pair.quoteCryptoId, { transaction });
    if (quote && STABLE_SYMBOLS.includes(quote.symbol)) {
      return {
        usd: money.multiply(String(amount), String(pair.currentPrice)),
        priceAsOf: pair.lastUpdated || null,
        source: 'pair',
      };
    }
  }
  return { usd: null, priceAsOf: null, source: 'unknown' };
}

module.exports = { STABLE_SYMBOLS, getUsdValue };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:integration -- amlValuation`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/modules/aml/amlValuation.js backend/tests/integration/amlValuation.integration.test.js
git commit -m "feat(aml): USD valuation helper for value-based signals"
```

---

### Task 2: `amlDataAccess` — windowed queries

**Files:**
- Create: `backend/modules/aml/amlDataAccess.js`
- Test: `backend/tests/integration/amlDataAccess.integration.test.js`

**Interfaces:**
- Consumes: `models` (`BlockchainTransaction`, `P2PTransaction`, `User`), sequelize `Op`.
- Produces (all `transaction=null` optional last arg):
  - `withdrawalsInWindow(userId, since) → [{ id, cryptoId, amount, createdAt }]` — `type:'withdrawal'`, `status != 'failed'`, `created_at >= since`.
  - `onchainMovementsInWindow(userId, since) → [{ id, type, cryptoId, amount, createdAt }]` — deposits (`status IN ('confirmed','completed')`) + withdrawals (`status != 'failed'`), `created_at >= since`.
  - `confirmedDepositsInWindow(userId, cryptoId, since) → [{ id, amount, createdAt }]` — `type:'deposit'`, `status IN ('confirmed','completed')`, `cryptoId`, `created_at >= since`.
  - `p2pCompletedCountBetween(userIdA, userIdB, since) → number` — `p2p_transactions` `status:'completed'`, unordered pair, `created_at >= since`.
  - `userCreatedAt(userId) → Date|null`.

- [ ] **Step 1: Write the failing integration test**

```js
// backend/tests/integration/amlDataAccess.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, P2PTransaction, Crypto } = require('../../models');
const da = require('../../modules/aml/amlDataAccess');

const HOUR = 3600 * 1000;
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

async function tx(over) {
  return BlockchainTransaction.create({
    userId: over.userId, cryptoId: over.cryptoId, type: over.type, amount: over.amount,
    status: over.status, txHash: over.txHash || `h-${Math.random()}`, confirmations: 0,
    requiresApproval: false, created_at: over.created_at,
  });
}

describe('amlDataAccess', () => {
  test('withdrawalsInWindow excludes failed and old rows', async () => {
    const u = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const now = Date.now();
    await tx({ userId: u.id, cryptoId: c.id, type: 'withdrawal', amount: '1', status: 'processing', created_at: new Date(now - HOUR) });
    await tx({ userId: u.id, cryptoId: c.id, type: 'withdrawal', amount: '2', status: 'failed', created_at: new Date(now - HOUR) });
    await tx({ userId: u.id, cryptoId: c.id, type: 'withdrawal', amount: '3', status: 'completed', created_at: new Date(now - 48 * HOUR) });
    const rows = await da.withdrawalsInWindow(u.id, new Date(now - 24 * HOUR));
    expect(rows.map(r => String(r.amount))).toEqual(['1']); // only the recent non-failed one
  });

  test('confirmedDepositsInWindow filters by crypto + confirmed status + window', async () => {
    const u = await f.seedUser();
    const btc = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const eth = await Crypto.create({ symbol: 'ETH', name: 'ETH', network: 'ethereum' });
    const now = Date.now();
    await tx({ userId: u.id, cryptoId: btc.id, type: 'deposit', amount: '5', status: 'confirmed', created_at: new Date(now - 10 * 60 * 1000) });
    await tx({ userId: u.id, cryptoId: btc.id, type: 'deposit', amount: '9', status: 'pending', created_at: new Date(now - 10 * 60 * 1000) });
    await tx({ userId: u.id, cryptoId: eth.id, type: 'deposit', amount: '7', status: 'confirmed', created_at: new Date(now - 10 * 60 * 1000) });
    const rows = await da.confirmedDepositsInWindow(u.id, btc.id, new Date(now - 60 * 60 * 1000));
    expect(rows.map(r => String(r.amount))).toEqual(['5']);
  });

  test('p2pCompletedCountBetween counts the unordered pair, completed only, in window', async () => {
    const a = await f.seedUser(); const b = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const base = { offerId: a.id, cryptoId: c.id, amount: '1', unitPrice: '1', fiatAmount: '1', fiatCurrency: 'USD', paymentMethodId: a.id };
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id, status: 'completed' });
    await P2PTransaction.create({ ...base, buyerId: b.id, sellerId: a.id, status: 'completed' }); // reversed pair still counts
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id, status: 'cancelled' }); // not counted
    const n = await da.p2pCompletedCountBetween(a.id, b.id, new Date(Date.now() - 7 * 24 * HOUR));
    expect(n).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:integration -- amlDataAccess`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// backend/modules/aml/amlDataAccess.js
// The impure, isolated windowed queries the AML signals need. Reads the tx tables;
// returns plain fact rows so the signal functions stay pure.
const { Op } = require('sequelize');

async function withdrawalsInWindow(userId, since, transaction = null) {
  const { BlockchainTransaction } = require('../../models');
  const rows = await BlockchainTransaction.findAll({
    where: { userId, type: 'withdrawal', status: { [Op.ne]: 'failed' }, created_at: { [Op.gte]: since } },
    transaction,
  });
  return rows.map(r => ({ id: r.id, cryptoId: r.cryptoId, amount: String(r.amount), createdAt: r.created_at }));
}

async function onchainMovementsInWindow(userId, since, transaction = null) {
  const { BlockchainTransaction } = require('../../models');
  const rows = await BlockchainTransaction.findAll({
    where: {
      userId,
      created_at: { [Op.gte]: since },
      [Op.or]: [
        { type: 'withdrawal', status: { [Op.ne]: 'failed' } },
        { type: 'deposit', status: { [Op.in]: ['confirmed', 'completed'] } },
      ],
    },
    transaction,
  });
  return rows.map(r => ({ id: r.id, type: r.type, cryptoId: r.cryptoId, amount: String(r.amount), createdAt: r.created_at }));
}

async function confirmedDepositsInWindow(userId, cryptoId, since, transaction = null) {
  const { BlockchainTransaction } = require('../../models');
  const rows = await BlockchainTransaction.findAll({
    where: { userId, cryptoId, type: 'deposit', status: { [Op.in]: ['confirmed', 'completed'] }, created_at: { [Op.gte]: since } },
    transaction,
  });
  return rows.map(r => ({ id: r.id, amount: String(r.amount), createdAt: r.created_at }));
}

async function p2pCompletedCountBetween(userIdA, userIdB, since, transaction = null) {
  const { P2PTransaction } = require('../../models');
  return P2PTransaction.count({
    where: {
      status: 'completed',
      created_at: { [Op.gte]: since },
      [Op.or]: [
        { buyerId: userIdA, sellerId: userIdB },
        { buyerId: userIdB, sellerId: userIdA },
      ],
    },
    transaction,
  });
}

async function userCreatedAt(userId, transaction = null) {
  const { User } = require('../../models');
  const u = await User.findByPk(userId, { transaction });
  return u ? u.created_at : null;
}

module.exports = { withdrawalsInWindow, onchainMovementsInWindow, confirmedDepositsInWindow, p2pCompletedCountBetween, userCreatedAt };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:integration -- amlDataAccess`
Expected: PASS (3 tests). If `BlockchainTransaction.create` rejects `created_at`, set it via `{ silent: true }` or update after create — but Sequelize accepts explicit `created_at` when the field is mapped; if the test fails on that, create then `await row.update({ created_at }, { silent: true })`.

- [ ] **Step 5: Commit**

```bash
git add backend/modules/aml/amlDataAccess.js backend/tests/integration/amlDataAccess.integration.test.js
git commit -m "feat(aml): windowed data-access queries for the signal engine"
```

---

### Task 3: Signals S3 (velocity) + S4 (P2P repeat) — pure functions

**Files:**
- Create: `backend/modules/aml/signals/s3.js`
- Create: `backend/modules/aml/signals/s4.js`
- Test: `backend/tests/amlSignalsS3S4.test.js`

**Interfaces:**
- Produces:
  - `s3({ withdrawalAmount, deposits, ratio }) → Finding|null` — `deposits` is `[{ id, amount }]`; fires if any deposit with `withdrawalAmount ≥ ratio × deposit.amount` (money.compare). Finding: `{ signalId:'S3', severity:'high', evidence:{ withdrawalAmount, matchedDepositId, matchedDepositAmount, ratio } }`.
  - `s4({ count, threshold }) → Finding|null` — fires if `count ≥ threshold`. Finding: `{ signalId:'S4', severity:'medium', evidence:{ count, threshold } }`.
- `Finding` shape: `{ signalId, severity, evidence }`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/amlSignalsS3S4.test.js
const s3 = require('../modules/aml/signals/s3');
const s4 = require('../modules/aml/signals/s4');

describe('S3 velocity', () => {
  test('fires when the withdrawal is ≥ ratio × a recent deposit (same asset)', () => {
    const f = s3({ withdrawalAmount: '0.95', deposits: [{ id: 'd1', amount: '1' }], ratio: '0.9' });
    expect(f).toMatchObject({ signalId: 'S3', severity: 'high' });
    expect(f.evidence.matchedDepositId).toBe('d1');
  });
  test('does not fire below the ratio', () => {
    expect(s3({ withdrawalAmount: '0.5', deposits: [{ id: 'd1', amount: '1' }], ratio: '0.9' })).toBeNull();
  });
  test('does not fire with no deposits', () => {
    expect(s3({ withdrawalAmount: '10', deposits: [], ratio: '0.9' })).toBeNull();
  });
});

describe('S4 P2P repeat', () => {
  test('fires at the count threshold', () => {
    expect(s4({ count: 5, threshold: 5 })).toMatchObject({ signalId: 'S4', severity: 'medium' });
  });
  test('does not fire below threshold', () => {
    expect(s4({ count: 4, threshold: 5 })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest amlSignalsS3S4`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```js
// backend/modules/aml/signals/s3.js
// S3 layering/velocity: a withdrawal that is ≥ ratio × a recent same-asset deposit —
// funds passing straight through. Pure: the evaluator supplies the recent deposits.
const money = require('../../../utils/money');

module.exports = function s3({ withdrawalAmount, deposits, ratio }) {
  for (const d of deposits) {
    const floor = money.multiply(String(d.amount), String(ratio));
    if (money.compare(String(withdrawalAmount), floor) >= 0) {
      return {
        signalId: 'S3',
        severity: 'high',
        evidence: { withdrawalAmount: String(withdrawalAmount), matchedDepositId: d.id, matchedDepositAmount: String(d.amount), ratio: String(ratio) },
      };
    }
  }
  return null;
};
```

```js
// backend/modules/aml/signals/s4.js
// S4: the same two parties trading P2P repeatedly (wash/collusion). Pure: the
// evaluator supplies the completed-count for the pair over the window.
module.exports = function s4({ count, threshold }) {
  if (count >= threshold) {
    return { signalId: 'S4', severity: 'medium', evidence: { count, threshold } };
  }
  return null;
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest amlSignalsS3S4`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/modules/aml/signals/s3.js backend/modules/aml/signals/s4.js backend/tests/amlSignalsS3S4.test.js
git commit -m "feat(aml): S3 velocity + S4 P2P-repeat signal functions"
```

---

### Task 4: `amlEvaluator` + `amlConsumer` + wiring (walking skeleton, S3 + S4)

**Files:**
- Create: `backend/modules/aml/amlEvaluator.js`
- Create: `backend/modules/aml/amlConsumer.js`
- Modify: `backend/modules/events/registerHandlers.js` (register the consumer)
- Test: `backend/tests/integration/amlConsumer.integration.test.js`

**Interfaces:**
- Consumes: `amlConfig`, `amlDataAccess`, `case.model.openCase`, `riskFlag.raiseUserRisk`, `signals/s3`, `signals/s4`, `eventBus`.
- Produces:
  - `amlEvaluator.evaluate(event) → Promise<[{ userId, finding, dedupeKey }]>` — pure-ish orchestration: maps the event type to its signals, gathers facts, returns the findings to persist (with the target userId + dedupeKey). No DB writes.
  - `amlConsumer.handleEvent(event)` — if monitoring on, calls `evaluate`, then for each result `openCase` + `raiseUserRisk`. `register(eventBus)` subscribes `handleEvent` to the three trigger types under the handler name `'aml'`.

**Dedupe buckets (this task):** S3 → `${userId}:S3:${withdrawalId}` (withdrawalId = `event.payload.blockchainTransactionId`); S4 → `${[buyerId,sellerId].sort().join(':')}:S4:${utcDay}` where `utcDay = new Date().toISOString().slice(0,10)`.

- [ ] **Step 1: Write the failing integration test**

```js
// backend/tests/integration/amlConsumer.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, P2PTransaction, Crypto, AmlCase, User } = require('../../models');
const businessConfig = require('../../modules/config/businessConfig');
const consumer = require('../../modules/aml/amlConsumer');

beforeEach(async () => { await resetDb(); businessConfig.clearCache(); });
afterAll(async () => { await sequelize.close(); });

async function deposit(userId, cryptoId, amount, minutesAgo) {
  return BlockchainTransaction.create({ userId, cryptoId, type: 'deposit', amount, status: 'confirmed', txHash: `d-${Math.random()}`, confirmations: 3, requiresApproval: false, created_at: new Date(Date.now() - minutesAgo * 60000) });
}

describe('amlConsumer (S3, S4)', () => {
  test('monitoring OFF → no case', async () => {
    const u = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    await deposit(u.id, c.id, '1', 5);
    await consumer.handleEvent({ id: 'evt-1', type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: 'w1', userId: u.id, cryptoId: c.id, amount: '0.95' } });
    expect(await AmlCase.count()).toBe(0);
  });

  test('S3 fires on a fast deposit→withdrawal and opens a high case + raises risk', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    const u = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    await deposit(u.id, c.id, '1', 5); // 5 min ago
    await consumer.handleEvent({ id: 'evt-2', type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: 'w1', userId: u.id, cryptoId: c.id, amount: '0.95' } });
    const cases = await AmlCase.findAll();
    expect(cases).toHaveLength(1);
    expect(cases[0].signalId).toBe('S3');
    expect((await User.findByPk(u.id)).amlRiskLevel).toBe('high');
    // idempotent: same event again → still one case
    await consumer.handleEvent({ id: 'evt-2', type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: 'w1', userId: u.id, cryptoId: c.id, amount: '0.95' } });
    expect(await AmlCase.count()).toBe(1);
  });

  test('S4 fires when the same P2P pair repeats past the threshold', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    await businessConfig.set('aml.s4.count', '2');
    const a = await f.seedUser(); const b = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const base = { offerId: a.id, cryptoId: c.id, amount: '1', unitPrice: '1', fiatAmount: '1', fiatCurrency: 'USD', paymentMethodId: a.id, status: 'completed' };
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id });
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id });
    await consumer.handleEvent({ id: 'evt-3', type: 'P2PTransactionCompleted', payload: { buyerId: a.id, sellerId: b.id, transaction: { id: 'p1' } } });
    const cases = await AmlCase.findAll();
    expect(cases).toHaveLength(1);
    expect(cases[0].signalId).toBe('S4');
    // both parties flagged
    expect((await User.findByPk(a.id)).amlRiskLevel).toBe('medium');
    expect((await User.findByPk(b.id)).amlRiskLevel).toBe('medium');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:integration -- amlConsumer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the evaluator (S3 + S4 only for now)**

```js
// backend/modules/aml/amlEvaluator.js
// Maps a money event to its signals, gathers facts, returns the findings to persist.
// No DB writes — the consumer persists. Pure signals; impure fact-gathering here.
const amlConfig = require('./amlConfig');
const da = require('./amlDataAccess');
const s3 = require('./signals/s3');
const s4 = require('./signals/s4');

function utcDay() { return new Date().toISOString().slice(0, 10); }

async function evaluate(event) {
  const results = [];
  const p = event.payload || {};

  if (event.type === 'WithdrawalTransmitted') {
    // S3 velocity
    const ratio = await amlConfig.getThreshold('aml.s3.ratio', 0.9);
    const windowMin = await amlConfig.getThreshold('aml.s3.windowMinutes', 60);
    const deposits = await da.confirmedDepositsInWindow(p.userId, p.cryptoId, new Date(Date.now() - windowMin * 60000));
    const f3 = s3({ withdrawalAmount: p.amount, deposits, ratio });
    if (f3) results.push({ userId: p.userId, finding: f3, dedupeKey: `${p.userId}:S3:${p.blockchainTransactionId}` });
  }

  if (event.type === 'P2PTransactionCompleted') {
    const threshold = await amlConfig.getThreshold('aml.s4.count', 5);
    const windowHours = await amlConfig.getThreshold('aml.s4.windowHours', 168);
    const count = await da.p2pCompletedCountBetween(p.buyerId, p.sellerId, new Date(Date.now() - windowHours * 3600000));
    const f4 = s4({ count, threshold });
    if (f4) {
      const pairKey = [p.buyerId, p.sellerId].sort().join(':');
      results.push({ userId: p.buyerId, finding: f4, dedupeKey: `${pairKey}:S4:${utcDay()}`, alsoFlag: [p.sellerId] });
    }
  }

  return results;
}

module.exports = { evaluate, utcDay };
```

```js
// backend/modules/aml/amlConsumer.js
// Detective AML consumer. On each money event, if monitoring is enabled, evaluate the
// signals and persist idempotent cases + raise the risk flag. Never touches funds.
const amlConfig = require('./amlConfig');
const evaluator = require('./amlEvaluator');
const cases = require('./case.model');
const riskFlag = require('./riskFlag');

const TRIGGER_TYPES = ['DepositConfirmed', 'WithdrawalTransmitted', 'P2PTransactionCompleted'];

async function handleEvent(event) {
  if (!(await amlConfig.isMonitoringEnabled())) return;
  const results = await evaluator.evaluate(event);
  for (const r of results) {
    const { created } = await cases.openCase({
      userId: r.userId,
      signalId: r.finding.signalId,
      severity: r.finding.severity,
      evidence: r.finding.evidence,
      dedupeKey: r.dedupeKey,
      sourceEventId: event.id,
    });
    if (created) {
      await riskFlag.raiseUserRisk(r.userId, r.finding.severity);
      for (const other of (r.alsoFlag || [])) await riskFlag.raiseUserRisk(other, r.finding.severity);
    }
  }
}

function register(eventBus) {
  for (const t of TRIGGER_TYPES) eventBus.on(t, 'aml', handleEvent);
}

module.exports = { handleEvent, register, TRIGGER_TYPES };
```

- [ ] **Step 4: Register the consumer in `registerHandlers.js`**

```js
// backend/modules/events/registerHandlers.js — add the require + the register call
const amlHandlers = require('../aml/amlConsumer');
// inside registerAllHandlers(), after auditHandlers.register(eventBus):
  amlHandlers.register(eventBus);
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:integration -- amlConsumer`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/modules/aml/amlEvaluator.js backend/modules/aml/amlConsumer.js backend/modules/events/registerHandlers.js backend/tests/integration/amlConsumer.integration.test.js
git commit -m "feat(aml): detective consumer + evaluator (S3, S4) wired to the event bus"
```

---

### Task 5: Signals S1 (volume) + S2 (structuring) + S6 (new-account) + evaluator wiring

**Files:**
- Create: `backend/modules/aml/signals/s1.js`
- Create: `backend/modules/aml/signals/s2.js`
- Create: `backend/modules/aml/signals/s6.js`
- Modify: `backend/modules/aml/amlEvaluator.js` (add S1/S2/S6 branches + valuation)
- Test: `backend/tests/amlSignalsS1S2S6.test.js`

**Interfaces:**
- Produces:
  - `s1({ totalUsd, limitUsd, multiplier }) → Finding|null` — fires if `totalUsd > limitUsd × multiplier`. `{ signalId:'S1', severity:'medium', evidence }`.
  - `s2({ withdrawalUsds, thresholdUsd, count }) → Finding|null` — `withdrawalUsds` = array of USD strings (unvaluable already dropped); count those in `[0.8×T, T)`; fire if `≥ count` AND their sum `≥ T`. `{ signalId:'S2', severity:'high', evidence:{ matched, sumUsd, thresholdUsd } }`.
  - `s6({ accountAgeDays, maxAgeDays, totalUsd, volumeUsd }) → Finding|null` — fires if `accountAgeDays < maxAgeDays` AND `totalUsd > volumeUsd`. `{ signalId:'S6', severity:'medium', evidence }`.
- Consumes in evaluator: `amlValuation.getUsdValue`, `amlDataAccess.onchainMovementsInWindow`, `amlDataAccess.userCreatedAt`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/amlSignalsS1S2S6.test.js
const s1 = require('../modules/aml/signals/s1');
const s2 = require('../modules/aml/signals/s2');
const s6 = require('../modules/aml/signals/s6');

describe('S1 volume', () => {
  test('fires above limit × multiplier', () => {
    expect(s1({ totalUsd: '3001', limitUsd: '1000', multiplier: '3' })).toMatchObject({ signalId: 'S1', severity: 'medium' });
  });
  test('does not fire at/below', () => {
    expect(s1({ totalUsd: '3000', limitUsd: '1000', multiplier: '3' })).toBeNull();
  });
});

describe('S2 structuring', () => {
  test('fires with ≥count near-threshold withdrawals summing ≥ T', () => {
    const f = s2({ withdrawalUsds: ['9000', '9500', '8500'], thresholdUsd: '10000', count: 3 });
    expect(f).toMatchObject({ signalId: 'S2', severity: 'high' });
    expect(f.evidence.matched).toBe(3);
  });
  test('ignores withdrawals outside [0.8T, T)', () => {
    // 5000 is below 0.8×10000=8000; 10000 is not < T
    expect(s2({ withdrawalUsds: ['5000', '10000', '9000'], thresholdUsd: '10000', count: 3 })).toBeNull();
  });
});

describe('S6 new-account volume', () => {
  test('fires for a young account over the volume', () => {
    expect(s6({ accountAgeDays: 2, maxAgeDays: 7, totalUsd: '60000', volumeUsd: '50000' })).toMatchObject({ signalId: 'S6' });
  });
  test('does not fire for an old account', () => {
    expect(s6({ accountAgeDays: 30, maxAgeDays: 7, totalUsd: '60000', volumeUsd: '50000' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest amlSignalsS1S2S6`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the three signals**

```js
// backend/modules/aml/signals/s1.js
const money = require('../../../utils/money');
module.exports = function s1({ totalUsd, limitUsd, multiplier }) {
  const ceiling = money.multiply(String(limitUsd), String(multiplier));
  if (money.compare(String(totalUsd), ceiling) > 0) {
    return { signalId: 'S1', severity: 'medium', evidence: { totalUsd: String(totalUsd), limitUsd: String(limitUsd), multiplier: String(multiplier) } };
  }
  return null;
};
```

```js
// backend/modules/aml/signals/s2.js
// Structuring: many withdrawals JUST under a reporting threshold to stay invisible.
const money = require('../../../utils/money');
module.exports = function s2({ withdrawalUsds, thresholdUsd, count }) {
  const T = String(thresholdUsd);
  const floor = money.multiply(T, '0.8');
  const matched = withdrawalUsds.filter(v => money.compare(String(v), floor) >= 0 && money.compare(String(v), T) < 0);
  if (matched.length < count) return null;
  const sum = matched.reduce((acc, v) => money.add(acc, String(v)), '0');
  if (money.compare(sum, T) < 0) return null;
  return { signalId: 'S2', severity: 'high', evidence: { matched: matched.length, sumUsd: sum, thresholdUsd: T } };
};
```

```js
// backend/modules/aml/signals/s6.js
const money = require('../../../utils/money');
module.exports = function s6({ accountAgeDays, maxAgeDays, totalUsd, volumeUsd }) {
  if (accountAgeDays < maxAgeDays && money.compare(String(totalUsd), String(volumeUsd)) > 0) {
    return { signalId: 'S6', severity: 'medium', evidence: { accountAgeDays, totalUsd: String(totalUsd), volumeUsd: String(volumeUsd) } };
  }
  return null;
};
```

- [ ] **Step 4: Add S1/S2/S6 to the evaluator**

In `amlEvaluator.js`, add the requires at top:

```js
const valuation = require('./amlValuation');
const s1 = require('./signals/s1');
const s2 = require('./signals/s2');
const s6 = require('./signals/s6');
```

Add a helper (values a list of `{amount, cryptoId}` items, dropping unvaluable, returning `{ sumUsd, valuedUsds, unvaluable }`):

```js
async function valueItems(items) {
  let sumUsd = '0';
  const valuedUsds = [];
  let unvaluable = 0;
  for (const it of items) {
    const { usd } = await valuation.getUsdValue(it.cryptoId, it.amount);
    if (usd === null) { unvaluable++; continue; }
    valuedUsds.push(usd);
    sumUsd = require('../../utils/money').add(sumUsd, usd);
  }
  return { sumUsd, valuedUsds, unvaluable };
}
```

Then, inside `evaluate`, extend the `WithdrawalTransmitted` block AND add the shared volume block for both on-chain triggers. Add after the S3 push, still inside the `WithdrawalTransmitted` branch:

```js
    // S2 structuring (USD-valued withdrawals in the window)
    const T = await amlConfig.getThreshold('aml.s2.thresholdUsd', 10000);
    const s2count = await amlConfig.getThreshold('aml.s2.count', 3);
    const s2Hours = await amlConfig.getThreshold('aml.s2.windowHours', 24);
    const wds = await da.withdrawalsInWindow(p.userId, new Date(Date.now() - s2Hours * 3600000));
    const { valuedUsds } = await valueItems(wds);
    const f2 = s2({ withdrawalUsds: valuedUsds, thresholdUsd: T, count: s2count });
    if (f2) results.push({ userId: p.userId, finding: f2, dedupeKey: `${p.userId}:S2:${utcDay()}` });
```

Add a shared block that runs for BOTH `DepositConfirmed` and `WithdrawalTransmitted` (S1 + S6), after the type-specific blocks:

```js
  if (event.type === 'DepositConfirmed' || event.type === 'WithdrawalTransmitted') {
    const userId = p.userId;
    // S1 volume over the rolling window
    const s1Hours = await amlConfig.getThreshold('aml.s1.windowHours', 24);
    const s1Mult = await amlConfig.getThreshold('aml.s1.multiplier', 3);
    const { User } = require('../../models');
    const user = await User.findByPk(userId);
    const limitUsd = user ? String(user.dailyLimitUsd) : '0';
    const moves1 = await da.onchainMovementsInWindow(userId, new Date(Date.now() - s1Hours * 3600000));
    const { sumUsd: vol1, unvaluable: unv1 } = await valueItems(moves1);
    const f1 = s1({ totalUsd: vol1, limitUsd, multiplier: s1Mult });
    if (f1) { f1.evidence.unvaluable = unv1; results.push({ userId, finding: f1, dedupeKey: `${userId}:S1:${utcDay()}` }); }

    // S6 new-account volume since signup
    const maxAgeDays = await amlConfig.getThreshold('aml.s6.accountAgeDays', 7);
    const volumeUsd = await amlConfig.getThreshold('aml.s6.volumeUsd', 50000);
    const createdAt = await da.userCreatedAt(userId);
    if (createdAt) {
      const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000;
      if (ageDays < maxAgeDays) {
        const movesAll = await da.onchainMovementsInWindow(userId, new Date(createdAt));
        const { sumUsd: vol6, unvaluable: unv6 } = await valueItems(movesAll);
        const f6 = s6({ accountAgeDays: ageDays, maxAgeDays, totalUsd: vol6, volumeUsd });
        if (f6) { f6.evidence.unvaluable = unv6; results.push({ userId, finding: f6, dedupeKey: `${userId}:S6:${utcDay()}` }); }
      }
    }
  }
```

> Implementer: keep the existing S3 (in the `WithdrawalTransmitted` branch) and S4 (in the `P2PTransactionCompleted` branch) intact. The S1/S6 shared block is ADDITIVE. Ensure `valueItems` and the `money` require don't shadow the top-level `money`/requires — reuse the top-level `require('../../utils/money')` by importing it once at the top of the file instead of inline.

- [ ] **Step 5: Run to verify it passes**

Run: `npx jest amlSignalsS1S2S6`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/modules/aml/signals/s1.js backend/modules/aml/signals/s2.js backend/modules/aml/signals/s6.js backend/modules/aml/amlEvaluator.js backend/tests/amlSignalsS1S2S6.test.js
git commit -m "feat(aml): S1 volume + S2 structuring + S6 new-account signals + evaluator"
```

---

### Task 6: End-to-end integration for the valued signals + final verification

**Files:**
- Test: `backend/tests/integration/amlValuedSignals.integration.test.js`

**Interfaces:** Consumes the full stack (consumer → evaluator → valuation/dataAccess → cases).

- [ ] **Step 1: Write the failing integration test**

```js
// backend/tests/integration/amlValuedSignals.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, Crypto, SwapPair, AmlCase, User } = require('../../models');
const businessConfig = require('../../modules/config/businessConfig');
const consumer = require('../../modules/aml/amlConsumer');

beforeEach(async () => { await resetDb(); businessConfig.clearCache(); });
afterAll(async () => { await sequelize.close(); });

async function usdtBtc() {
  const usdt = await Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 });
  const btc = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin', decimals: 8 });
  await SwapPair.create({ baseCryptoId: btc.id, quoteCryptoId: usdt.id, currentPrice: '10000', feePercent: '0.1', active: true });
  return { usdt, btc };
}
async function wd(userId, cryptoId, amount, minutesAgo) {
  return BlockchainTransaction.create({ userId, cryptoId, type: 'withdrawal', amount, status: 'processing', txHash: `w-${Math.random()}`, confirmations: 0, requiresApproval: false, created_at: new Date(Date.now() - minutesAgo * 60000) });
}

describe('AML valued signals end-to-end', () => {
  test('S2 structuring: 3 BTC withdrawals ≈ $9k each (0.9 BTC @ $10k) opens a high case', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    const u = await f.seedUser();
    const { btc } = await usdtBtc();
    await wd(u.id, btc.id, '0.9', 30); // $9000
    await wd(u.id, btc.id, '0.9', 20); // $9000
    const last = await wd(u.id, btc.id, '0.9', 10); // $9000
    await consumer.handleEvent({ id: 'evt-s2', type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: last.id, userId: u.id, cryptoId: btc.id, amount: '0.9' } });
    const s2 = await AmlCase.findOne({ where: { signalId: 'S2' } });
    expect(s2).not.toBeNull();
    expect(s2.severity).toBe('high');
    expect((await User.findByPk(u.id)).amlRiskLevel).toBe('high');
  });

  test('monitoring OFF → no valued cases even with structuring pattern', async () => {
    const u = await f.seedUser();
    const { btc } = await usdtBtc();
    const last = await wd(u.id, btc.id, '0.9', 10);
    await consumer.handleEvent({ id: 'evt-off', type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: last.id, userId: u.id, cryptoId: btc.id, amount: '0.9' } });
    expect(await AmlCase.count()).toBe(0);
  });

  test('unvaluable asset does not crash the consumer and opens no S2 case', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    const u = await f.seedUser();
    const doge = await Crypto.create({ symbol: 'DOGE', name: 'Dogecoin', network: 'dogecoin', decimals: 8 }); // no stable pair
    const last = await wd(u.id, doge.id, '100000', 10);
    await consumer.handleEvent({ id: 'evt-unv', type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: last.id, userId: u.id, cryptoId: doge.id, amount: '100000' } });
    // S2/S1 can't value DOGE → no valued case; must not throw.
    expect(await AmlCase.findOne({ where: { signalId: 'S2' } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails, then passes**

Run: `npm run test:integration -- amlValuedSignals`
Expected: FAIL first (if any wiring gap), then PASS (3 tests) once the Task 5 evaluator is correct. Fix evaluator wiring if a case doesn't open.

- [ ] **Step 3: Full verification (Slice B exit gate)**

Run each; all must exit 0:
```bash
npm test
npm run test:integration
npm run test:coverage
npm run test:integration:coverage
```
If a coverage floor drops because a new file is integration-only, add a no-DB unit test for it (per the project's coverage-gate convention) rather than lowering the floor. (S1/S2/S3/S4/S6 already have unit tests; `amlValuation`/`amlDataAccess`/`amlEvaluator`/`amlConsumer` are integration-covered — add a tiny unit test for any that drags the unit function floor.)

- [ ] **Step 4: Commit**

```bash
git add backend/tests/integration/amlValuedSignals.integration.test.js
git commit -m "test(aml): end-to-end valued-signal + monitoring-off + unvaluable coverage"
```

---

## Self-Review

**Spec coverage:** amlValuation (T1) ✅; amlDataAccess (T2) ✅; S3+S4 (T3) ✅; evaluator+consumer+wiring (T4) ✅; S1+S2+S6 + valuation wiring (T5) ✅; e2e + monitoring-off + unvaluable + full gate (T6) ✅. Dedupe buckets per signal ✅ (S3 withdrawalId; S1/S2/S6 daily; S4 pair+day). Idempotency via `sourceEventId` + `dedupeKey` ✅. Default-off ✅. Tipping-off: cases/flags admin-only, unchanged from Slice A ✅.

**Deviations from the design note (intentional, documented here):** S1/S6 "volume" = on-chain deposits+withdrawals only (not swaps/trades) — coherent, less surface; the design note table was updated to match. S3 dedupe bucket keyed on the withdrawal id (the trigger) rather than the deposit id — one case per suspicious withdrawal.

**Placeholder scan:** none. The one implementer judgement call (avoid shadowing `money` in the evaluator) is flagged explicitly with the fix.

**Type consistency:** `Finding = { signalId, severity, evidence }` uniform across all signals; `evaluate → [{ userId, finding, dedupeKey, alsoFlag? }]` consumed by `handleEvent`; `getUsdValue → { usd, priceAsOf, source }` used by `valueItems`; config keys identical to the Global Constraints list. `openCase`/`raiseUserRisk` signatures match Slice A.
