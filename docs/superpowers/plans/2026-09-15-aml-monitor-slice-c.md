# AML Monitor — Slice C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the periodic AML sweep — a scheduled job that replays recent money rows through the existing `amlConsumer.handleEvent` (one consistent ruleset for on-event and batch) — and activate the AML compliance docs, closing the AML monitor.

**Architecture:** A `amlSweep.runSweep()` enumerates recent deposits/withdrawals/P2P (cross-user finders in `amlDataAccess`) and, for each, replays a synthetic money event through `amlConsumer.handleEvent` — reusing all of Slice B's evaluation + idempotent case-opening; `dedupeKey` makes anything already caught on-event a no-op. A singleton `jobs/amlSweep.job.js` (mirrors `jobs/reconciliation.job.js`) schedules it, registered in `JobManager`. Default-off (gated by `aml.monitoring.enabled`); no money-path change.

**Tech Stack:** Node.js, Express, Sequelize (Postgres), Jest (unit + integration), `utils/money` (not needed here — amounts pass through as strings).

## Global Constraints

- New code under `backend/modules/aml/` + `backend/jobs/`. Lazy `require('../../models')` inside functions (anti-circular convention).
- **Default-off / additive:** the sweep is a no-op unless `aml.monitoring.enabled` is true (checked at the top of `runSweep`, and again inside `handleEvent`). NO money-path change — this slice adds only a read-then-replay job.
- **Replay, one ruleset:** the sweep MUST drive detection through `amlConsumer.handleEvent({ id, type, payload })` — it must NOT re-implement any signal/evaluator logic. The synthetic `id` is the source row's own UUID; the payload matches exactly what the real emitters produce (only the fields the evaluator reads):
  - `WithdrawalTransmitted` → `{ blockchainTransactionId: row.id, userId, cryptoId, amount: String(row.amount) }`
  - `DepositConfirmed` → `{ blockchainTransactionId: row.id, userId, cryptoId, amount: String(row.amount) }`
  - `P2PTransactionCompleted` → `{ buyerId, sellerId, transaction: { id: row.id } }`
- **Idempotency:** the sweep opens NO duplicate case for activity already handled on-event — guaranteed by the `dedupeKey` derived from the payload inside the evaluator. The sweep passes no special flag; it just replays.
- **Per-row isolation:** a `handleEvent` throw for one row is caught + logged; the sweep continues with the remaining rows.
- Config keys (business-config; unseeded → in-code default): `aml.sweep.lookbackHours` (48). Job interval from env `AML_SWEEP_INTERVAL_MS`, clamped to a positive default `30 * 60 * 1000` (mirrors `RECONCILIATION_INTERVAL_MS`).
- Job mirrors `jobs/reconciliation.job.js`: singleton class, `start/stop/run/getStatus`, re-entrancy guard, interval clamp; registered in `jobs/index.js` `JobManager`.
- Every task ends green: run the named tests. Before Task 4's commit run `npm test`, `npm run test:integration`, `npm run test:coverage`, `npm run test:integration:coverage` — all exit 0. Integration DB = Docker `exchange_test_db`, default port (only `DB_PORT=15432` if WinNAT blocks). `resetDb` truncates all models.
- Commits: Conventional English + trailers `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01LeJZyLF82A2RQ1JcnLePEJ`.

---

### Task 1: Cross-user recent finders in `amlDataAccess`

**Files:**
- Modify: `backend/modules/aml/amlDataAccess.js` (append 3 finders + exports)
- Test: `backend/tests/integration/amlSweepFinders.integration.test.js`

**Interfaces:**
- Consumes: `models` (`BlockchainTransaction`, `P2PTransaction`), sequelize `Op`.
- Produces (all `transaction=null` optional last arg):
  - `recentWithdrawals(since) → [{ id, userId, cryptoId, amount }]` — `type:'withdrawal'`, `status != 'failed'`, `created_at >= since`. `amount` is `String(row.amount)`.
  - `recentConfirmedDeposits(since) → [{ id, userId, cryptoId, amount }]` — `type:'deposit'`, `status IN ('confirmed','completed')`, `created_at >= since`.
  - `recentCompletedP2P(since) → [{ id, buyerId, sellerId }]` — `status:'completed'`, `created_at >= since`.

- [ ] **Step 1: Write the failing integration test**

```js
// backend/tests/integration/amlSweepFinders.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, P2PTransaction, Crypto, P2POffer, PaymentMethod } = require('../../models');
const da = require('../../modules/aml/amlDataAccess');

const HOUR = 3600 * 1000;
beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

async function backdate(id, ts) {
  await sequelize.query('UPDATE blockchain_transactions SET created_at = :ts WHERE id = :id', { replacements: { ts, id } });
}
async function tx(over) {
  const row = await BlockchainTransaction.create({
    userId: over.userId, cryptoId: over.cryptoId, type: over.type, amount: over.amount,
    status: over.status, txHash: `h-${Math.random()}`, confirmations: 0, requiresApproval: false,
  });
  if (over.created_at) await backdate(row.id, over.created_at);
  return row;
}

describe('amlDataAccess recent (cross-user) finders', () => {
  test('recentWithdrawals + recentConfirmedDeposits exclude failed/pending and old rows, across users', async () => {
    const u1 = await f.seedUser(); const u2 = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const now = Date.now();
    await tx({ userId: u1.id, cryptoId: c.id, type: 'withdrawal', amount: '1', status: 'processing', created_at: new Date(now - HOUR) });
    await tx({ userId: u2.id, cryptoId: c.id, type: 'withdrawal', amount: '2', status: 'failed', created_at: new Date(now - HOUR) });   // excluded
    await tx({ userId: u1.id, cryptoId: c.id, type: 'withdrawal', amount: '3', status: 'completed', created_at: new Date(now - 72 * HOUR) }); // too old
    await tx({ userId: u2.id, cryptoId: c.id, type: 'deposit', amount: '5', status: 'confirmed', created_at: new Date(now - HOUR) });
    await tx({ userId: u2.id, cryptoId: c.id, type: 'deposit', amount: '9', status: 'pending', created_at: new Date(now - HOUR) });   // excluded

    const since = new Date(now - 48 * HOUR);
    const wds = await da.recentWithdrawals(since);
    expect(wds.map(r => r.amount)).toEqual(['1.00000000']);
    expect(wds[0].userId).toBe(u1.id);
    const deps = await da.recentConfirmedDeposits(since);
    expect(deps.map(r => r.amount)).toEqual(['5.00000000']);
  });

  test('recentCompletedP2P returns completed pairs in the window', async () => {
    const a = await f.seedUser(); const b = await f.seedUser();
    const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
    const offer = await P2POffer.create({ userId: a.id, type: 'sell', cryptoId: c.id, minAmount: '0.001', maxAmount: '10', unitPrice: '1', fiatCurrency: 'USD', active: true });
    const pm = await PaymentMethod.create({ name: 'Bank Transfer' });
    const base = { offerId: offer.id, cryptoId: c.id, amount: '1', unitPrice: '1', fiatAmount: '1', fiatCurrency: 'USD', paymentMethodId: pm.id };
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id, status: 'completed' });
    await P2PTransaction.create({ ...base, buyerId: a.id, sellerId: b.id, status: 'cancelled' }); // excluded
    const rows = await da.recentCompletedP2P(new Date(Date.now() - 48 * HOUR));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ buyerId: a.id, sellerId: b.id });
    expect(rows[0].id).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:integration -- amlSweepFinders`
Expected: FAIL — `da.recentWithdrawals is not a function`.

- [ ] **Step 3: Implement — append to `amlDataAccess.js` (before `module.exports`)**

```js
// ── Cross-user recent finders (for the periodic sweep, Slice C) ─────────────
async function recentWithdrawals(since, transaction = null) {
  const { BlockchainTransaction } = require('../../models');
  const rows = await BlockchainTransaction.findAll({
    where: { type: 'withdrawal', status: { [Op.ne]: 'failed' }, created_at: { [Op.gte]: since } },
    transaction,
  });
  return rows.map(r => ({ id: r.id, userId: r.userId, cryptoId: r.cryptoId, amount: String(r.amount) }));
}

async function recentConfirmedDeposits(since, transaction = null) {
  const { BlockchainTransaction } = require('../../models');
  const rows = await BlockchainTransaction.findAll({
    where: { type: 'deposit', status: { [Op.in]: ['confirmed', 'completed'] }, created_at: { [Op.gte]: since } },
    transaction,
  });
  return rows.map(r => ({ id: r.id, userId: r.userId, cryptoId: r.cryptoId, amount: String(r.amount) }));
}

async function recentCompletedP2P(since, transaction = null) {
  const { P2PTransaction } = require('../../models');
  const rows = await P2PTransaction.findAll({
    where: { status: 'completed', created_at: { [Op.gte]: since } },
    transaction,
  });
  return rows.map(r => ({ id: r.id, buyerId: r.buyerId, sellerId: r.sellerId }));
}
```

And add the three names to the `module.exports = { ... }` object at the end of the file.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:integration -- amlSweepFinders`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/modules/aml/amlDataAccess.js backend/tests/integration/amlSweepFinders.integration.test.js
git commit -m "feat(aml): cross-user recent finders for the periodic sweep"
```

---

### Task 2: `amlSweep.runSweep` — enumerate + replay

**Files:**
- Create: `backend/modules/aml/amlSweep.js`
- Test: `backend/tests/amlSweep.test.js` (unit, mocked) + `backend/tests/integration/amlSweep.integration.test.js`

**Interfaces:**
- Consumes: `amlConfig` (`isMonitoringEnabled`, `getThreshold`), `amlDataAccess` (the 3 recent finders), `amlConsumer` (`handleEvent`).
- Produces: `runSweep() → Promise<{ scanned: number, byType: { WithdrawalTransmitted, DepositConfirmed, P2PTransactionCompleted } }>`.

- [ ] **Step 1: Write the failing unit test**

```js
// backend/tests/amlSweep.test.js
jest.mock('../modules/aml/amlConfig', () => ({ isMonitoringEnabled: jest.fn(), getThreshold: jest.fn() }));
jest.mock('../modules/aml/amlDataAccess', () => ({
  recentWithdrawals: jest.fn(), recentConfirmedDeposits: jest.fn(), recentCompletedP2P: jest.fn(),
}));
jest.mock('../modules/aml/amlConsumer', () => ({ handleEvent: jest.fn() }));
const amlConfig = require('../modules/aml/amlConfig');
const da = require('../modules/aml/amlDataAccess');
const consumer = require('../modules/aml/amlConsumer');
const sweep = require('../modules/aml/amlSweep');

describe('amlSweep.runSweep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    amlConfig.getThreshold.mockResolvedValue(48);
    da.recentWithdrawals.mockResolvedValue([]);
    da.recentConfirmedDeposits.mockResolvedValue([]);
    da.recentCompletedP2P.mockResolvedValue([]);
    consumer.handleEvent.mockResolvedValue(undefined);
  });

  test('monitoring OFF → no enumeration, no replay', async () => {
    amlConfig.isMonitoringEnabled.mockResolvedValue(false);
    const res = await sweep.runSweep();
    expect(res).toEqual({ scanned: 0, byType: { WithdrawalTransmitted: 0, DepositConfirmed: 0, P2PTransactionCompleted: 0 } });
    expect(da.recentWithdrawals).not.toHaveBeenCalled();
    expect(consumer.handleEvent).not.toHaveBeenCalled();
  });

  test('replays each recent row with the correct event shape', async () => {
    amlConfig.isMonitoringEnabled.mockResolvedValue(true);
    da.recentWithdrawals.mockResolvedValue([{ id: 'w1', userId: 'u1', cryptoId: 'c1', amount: '2.5' }]);
    da.recentConfirmedDeposits.mockResolvedValue([{ id: 'd1', userId: 'u2', cryptoId: 'c1', amount: '1' }]);
    da.recentCompletedP2P.mockResolvedValue([{ id: 'p1', buyerId: 'a', sellerId: 'b' }]);
    const res = await sweep.runSweep();

    expect(res.scanned).toBe(3);
    expect(res.byType).toEqual({ WithdrawalTransmitted: 1, DepositConfirmed: 1, P2PTransactionCompleted: 1 });
    expect(consumer.handleEvent).toHaveBeenCalledWith({ id: 'w1', type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: 'w1', userId: 'u1', cryptoId: 'c1', amount: '2.5' } });
    expect(consumer.handleEvent).toHaveBeenCalledWith({ id: 'd1', type: 'DepositConfirmed', payload: { blockchainTransactionId: 'd1', userId: 'u2', cryptoId: 'c1', amount: '1' } });
    expect(consumer.handleEvent).toHaveBeenCalledWith({ id: 'p1', type: 'P2PTransactionCompleted', payload: { buyerId: 'a', sellerId: 'b', transaction: { id: 'p1' } } });
  });

  test('a throwing handleEvent for one row does not stop the others (per-row isolation)', async () => {
    amlConfig.isMonitoringEnabled.mockResolvedValue(true);
    da.recentWithdrawals.mockResolvedValue([{ id: 'w1', userId: 'u1', cryptoId: 'c1', amount: '1' }, { id: 'w2', userId: 'u1', cryptoId: 'c1', amount: '1' }]);
    consumer.handleEvent.mockRejectedValueOnce(new Error('boom')); // w1 throws
    const res = await sweep.runSweep();
    expect(res.scanned).toBe(2); // both attempted
    expect(consumer.handleEvent).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest amlSweep.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// backend/modules/aml/amlSweep.js
// The periodic AML sweep (Slice C). REPLAYS recent money rows through the same
// amlConsumer.handleEvent the on-event path uses — one consistent ruleset for
// real-time and batch (no drift), idempotent by dedupeKey. No evaluation logic here.
const amlConfig = require('./amlConfig');
const da = require('./amlDataAccess');
const consumer = require('./amlConsumer');

async function replay(id, type, payload, byType) {
  try {
    await consumer.handleEvent({ id, type, payload });
  } catch (err) {
    // Per-row isolation: one poison row must not abort the whole pass.
    console.error(`[amlSweep] replay ${type} ${id} failed:`, err.message);
  }
  byType[type]++;
}

async function runSweep() {
  const byType = { WithdrawalTransmitted: 0, DepositConfirmed: 0, P2PTransactionCompleted: 0 };
  if (!(await amlConfig.isMonitoringEnabled())) return { scanned: 0, byType };

  const lookbackHours = await amlConfig.getThreshold('aml.sweep.lookbackHours', 48);
  const since = new Date(Date.now() - lookbackHours * 3600000);

  for (const r of await da.recentWithdrawals(since)) {
    await replay(r.id, 'WithdrawalTransmitted', { blockchainTransactionId: r.id, userId: r.userId, cryptoId: r.cryptoId, amount: r.amount }, byType);
  }
  for (const r of await da.recentConfirmedDeposits(since)) {
    await replay(r.id, 'DepositConfirmed', { blockchainTransactionId: r.id, userId: r.userId, cryptoId: r.cryptoId, amount: r.amount }, byType);
  }
  for (const r of await da.recentCompletedP2P(since)) {
    await replay(r.id, 'P2PTransactionCompleted', { buyerId: r.buyerId, sellerId: r.sellerId, transaction: { id: r.id } }, byType);
  }

  const scanned = byType.WithdrawalTransmitted + byType.DepositConfirmed + byType.P2PTransactionCompleted;
  return { scanned, byType };
}

module.exports = { runSweep };
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npx jest amlSweep.test`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing integration test (real e2e + idempotency)**

```js
// backend/tests/integration/amlSweep.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, Crypto, AmlCase, User } = require('../../models');
const businessConfig = require('../../modules/config/businessConfig');
const sweep = require('../../modules/aml/amlSweep');
const consumer = require('../../modules/aml/amlConsumer');

beforeEach(async () => { await resetDb(); businessConfig.clearCache(); });
afterAll(async () => { await sequelize.close(); });

async function seedFastDepositThenWithdrawal() {
  const u = await f.seedUser();
  const c = await Crypto.create({ symbol: 'BTC', name: 'BTC', network: 'bitcoin' });
  await BlockchainTransaction.create({ userId: u.id, cryptoId: c.id, type: 'deposit', amount: '1', status: 'confirmed', txHash: `d-${Math.random()}`, confirmations: 3, requiresApproval: false });
  const w = await BlockchainTransaction.create({ userId: u.id, cryptoId: c.id, type: 'withdrawal', amount: '0.95', status: 'processing', txHash: `w-${Math.random()}`, confirmations: 0, requiresApproval: false });
  return { u, c, w };
}

describe('amlSweep end-to-end', () => {
  test('monitoring OFF → sweep is a no-op', async () => {
    await seedFastDepositThenWithdrawal();
    const res = await sweep.runSweep();
    expect(res.scanned).toBe(0);
    expect(await AmlCase.count()).toBe(0);
  });

  test('sweep opens the S3 case the on-event path would have (safety net)', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    const { u } = await seedFastDepositThenWithdrawal();
    const res = await sweep.runSweep();
    expect(res.scanned).toBeGreaterThanOrEqual(2); // deposit + withdrawal
    const s3 = await AmlCase.findOne({ where: { signalId: 'S3' } });
    expect(s3).not.toBeNull();
    expect((await User.findByPk(u.id)).amlRiskLevel).toBe('high');
  });

  test('idempotent with on-event: if handleEvent already opened the case, the sweep opens no duplicate', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    const { u, c, w } = await seedFastDepositThenWithdrawal();
    // On-event first: the real handler opens the S3 case.
    await consumer.handleEvent({ id: w.id, type: 'WithdrawalTransmitted', payload: { blockchainTransactionId: w.id, userId: u.id, cryptoId: c.id, amount: '0.95' } });
    expect(await AmlCase.count()).toBe(1);
    // Then the sweep replays the same activity → still exactly one case.
    await sweep.runSweep();
    expect(await AmlCase.count()).toBe(1);
  });
});
```

- [ ] **Step 6: Run the integration test to verify it passes**

Run: `npm run test:integration -- amlSweep`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/modules/aml/amlSweep.js backend/tests/amlSweep.test.js backend/tests/integration/amlSweep.integration.test.js
git commit -m "feat(aml): periodic sweep replays recent activity through the consumer"
```

---

### Task 3: `amlSweep.job.js` + JobManager registration

**Files:**
- Create: `backend/jobs/amlSweep.job.js`
- Modify: `backend/jobs/index.js` (register in `JobManager`)
- Test: `backend/tests/amlSweepJob.test.js`

**Interfaces:**
- Consumes: `modules/aml/amlSweep` (`runSweep`).
- Produces: a singleton with `start()`, `stop()`, `run()`, `getStatus()`; registered in `JobManager.jobs.amlSweep` and started in `startAll()`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/amlSweepJob.test.js
jest.mock('../modules/aml/amlSweep', () => ({ runSweep: jest.fn() }));
const amlSweep = require('../modules/aml/amlSweep');
const job = require('../jobs/amlSweep.job');

describe('amlSweep.job', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => job.stop());

  test('getStatus reports not-running before start', () => {
    expect(job.getStatus().isRunning).toBe(false);
  });

  test('run() invokes runSweep and records the last run', async () => {
    amlSweep.runSweep.mockResolvedValue({ scanned: 2, byType: {} });
    await job.run();
    expect(amlSweep.runSweep).toHaveBeenCalledTimes(1);
    expect(job.getStatus().lastRunAt).toBeInstanceOf(Date);
  });

  test('run() re-entrancy guard: a second run while one is in flight is skipped', async () => {
    let release;
    amlSweep.runSweep.mockImplementation(() => new Promise((res) => { release = res; }));
    const first = job.run();       // starts, holds
    await job.run();               // should skip (guard)
    expect(amlSweep.runSweep).toHaveBeenCalledTimes(1);
    release({ scanned: 0, byType: {} });
    await first;
  });

  test('a runSweep throw is caught (run does not reject)', async () => {
    amlSweep.runSweep.mockRejectedValue(new Error('boom'));
    await expect(job.run()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest amlSweepJob`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the job**

```js
// backend/jobs/amlSweep.job.js
// Periodic AML sweep scheduler (Slice C). Mirrors reconciliation.job: a singleton
// with a re-entrancy guard so a slow pass never stacks. The sweep itself is a no-op
// when monitoring is off (checked inside runSweep), so this can always run.
const amlSweep = require('../modules/aml/amlSweep');

const parsedInterval = Number(process.env.AML_SWEEP_INTERVAL_MS);
const FREQUENCY_MS = parsedInterval > 0 ? parsedInterval : 30 * 60 * 1000; // 30 min

class AmlSweepJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.sweeping = false; // re-entrancy guard
    this.lastRunAt = null;
    this.lastResult = null;
  }

  start() {
    if (this.isRunning) return;
    this.run();
    this.interval = setInterval(() => this.run(), FREQUENCY_MS);
    this.isRunning = true;
    console.log('✅ AML Sweep Job started');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
  }

  async run() {
    if (this.sweeping) {
      console.warn('[amlSweep] previous pass still running, skipping this tick');
      return;
    }
    this.sweeping = true;
    try {
      this.lastResult = await amlSweep.runSweep();
      this.lastRunAt = new Date();
    } catch (error) {
      console.error('❌ AML Sweep Job error:', error.message);
    } finally {
      this.sweeping = false;
    }
  }

  getStatus() {
    return { isRunning: this.isRunning, frequencyMs: FREQUENCY_MS, lastRunAt: this.lastRunAt, lastResult: this.lastResult };
  }
}

module.exports = new AmlSweepJob();
```

- [ ] **Step 4: Register in `jobs/index.js`**

Add the require beside the other job requires:
```js
const amlSweepJob = require('./amlSweep.job');
```
Add to the `this.jobs` map in the constructor:
```js
      amlSweep: amlSweepJob,
```
Add a guarded start in `startAll()` (after the outboxPublisher block):
```js
    try {
      this.jobs.amlSweep.start();
    } catch (error) {
      console.error('❌ Error iniciando AML Sweep:', error.message);
    }
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx jest amlSweepJob`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/jobs/amlSweep.job.js backend/jobs/index.js backend/tests/amlSweepJob.test.js
git commit -m "feat(aml): schedule the periodic sweep job in the JobManager"
```

---

### Task 4: Compliance-doc activation + final verification

**Files:**
- Modify: `docs/compliance/aml-signal-catalog.md` (flip status → activated)
- Modify: `docs/compliance/fincen-bsa-aml-mapping.md` (record on-event + batch monitoring)

- [ ] **Step 1: Flip the catalog status**

In `docs/compliance/aml-signal-catalog.md`, replace the top scope blockquote (the "Scope for this phase … design, not engine … no real AML engine runs" paragraph) with an **activated** status note:

```markdown
> **Status: ACTIVATED (Fase 4.8 + AML monitor slices A–C).** The engine runs:
> S5 sanctions screening + hold at withdrawal creation (slice A), the S1–S6
> detective signals on-event (slice B), and a periodic sweep replaying recent
> activity through the same consumer (slice C). All toggle-gated
> (`aml.monitoring.enabled` / `aml.holdEnforcement.enabled`), **default-off**, with
> a shadow mode. Cases + the account risk flag are admin-only (tipping-off).
> Thresholds are business-config (`aml.*`). Still a demo/portfolio: no real SAR/CTR
> is filed and the denylist is manually seeded (no live OFAC feed).
```

- [ ] **Step 2: Record the monitoring activation in the FinCEN mapping**

In `docs/compliance/fincen-bsa-aml-mapping.md`, under the transaction-monitoring / SAR section, add (or update) a short subsection:

```markdown
### Transaction monitoring — implemented (AML monitor slices A–C)

- **Real-time (on-event):** every money-path domain event (deposit confirmed,
  withdrawal transmitted, P2P completed, swap/trade) is evaluated against the S1–S6
  signal catalog as it happens (`backend/modules/aml/amlConsumer`), opening
  hash-chain-audited cases (§500.06) and raising an account risk flag.
- **Batch (periodic sweep):** a scheduled job (`backend/jobs/amlSweep.job`) replays
  recent activity through the SAME consumer/ruleset — one consistent engine for
  real-time and batch, a safety net for missed events and a whole-window pass. No
  drift between the two paths (independent-testing property).
- **Sanctions screening (OFAC):** withdrawals are screened against a denylist at
  creation; a hit holds the withdrawal pending operator review (slice A, S5).
- **Case → SAR:** each case is a SAR candidate worked from the admin surface;
  resolution is written to the immutable audit trail.
- Toggle-gated, default-off, thresholds in business-config; shadow mode for tuning.
```

(If the mapping file lacks such a section, add it under the existing transaction-monitoring heading; match the file's existing heading style — read it first.)

- [ ] **Step 3: Full verification (Slice C exit gate)**

Run each; all must exit 0:
```bash
npm test
npm run test:integration
npm run test:coverage
npm run test:integration:coverage
```
If a coverage floor drops because `amlSweep.js` is integration-covered only, the Task-2 unit test already covers `runSweep`; the job has a unit test. If the floor still drops, add a tiny no-DB unit test rather than lowering the floor.

- [ ] **Step 4: Commit**

```bash
git add docs/compliance/aml-signal-catalog.md docs/compliance/fincen-bsa-aml-mapping.md
git commit -m "docs(compliance): activate the AML signal catalog + monitoring mapping"
```

---

## Self-Review

**Spec coverage:** cross-user recent finders (T1) ✅; `amlSweep.runSweep` replay + monitoring-off + per-row isolation + idempotency (T2) ✅; singleton job + JobManager registration + re-entrancy (T3) ✅; compliance-doc activation + full gate (T4) ✅. Replay-through-`handleEvent` (one ruleset) ✅. Default-off ✅. No money-path change ✅.

**Placeholder scan:** none. The one "read the file first" note (T4 mapping heading) is a real instruction, not a placeholder — the exact text to add is given.

**Type consistency:** `runSweep() → { scanned, byType }` used by the job (T3) and asserted in tests. The three finders' return shapes (`{id,userId,cryptoId,amount}` / `{id,buyerId,sellerId}`) match how `runSweep` builds each payload. Payload shapes match the evaluator's reads (verified in Slice B). `amlConsumer.handleEvent({id,type,payload})` signature matches Slice B. Job mirrors `reconciliation.job` (`isRunning`/`sweeping`/`lastRunAt`/`getStatus`).

**Deviation from spec (noted):** the job interval is env-only (`AML_SWEEP_INTERVAL_MS`, default 30 min), matching the codebase's other jobs; the spec's optional `aml.sweep.intervalMinutes` config knob is dropped (YAGNI — interval is an ops/env concern; `aml.sweep.lookbackHours` remains the business tuning knob, read in `runSweep`).
