# AML Monitor — Slice A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of the AML monitor — config toggles, the case queue, the address denylist — and the only money-path piece: the synchronous S5 sanctions hold at withdrawal creation, with operator resolution.

**Architecture:** New self-contained module `backend/modules/aml/`. Pure/isolated units: `amlConfig` (toggles+thresholds over the existing `businessConfig`), `AmlCase` + `AmlDenylistedAddress` Sequelize models, `riskFlag` (raise `User.amlRiskLevel`), `amlScreening` (denylist lookup). The S5 hold reuses the withdrawal's existing `requiresApproval`/`approvedBy`/`approvalDate` fields — no new status — by setting `requiresApproval=true` at creation and excluding it from the `claimForProcessing` transmit query. Admin routes under `/api/aml`, gated exactly like `/api/config`.

**Tech Stack:** Node.js, Express, Sequelize (Postgres), Jest (unit + integration), Joi, swagger-jsdoc.

## Global Constraints

- Module lives in `backend/modules/aml/`. Follow existing module conventions (Sequelize `Model.init` factory returning the class; lazy `require('../../models')` inside functions to avoid circular requires).
- **Default-off / additive:** shipping Slice A must change NO runtime behavior until an operator flips a toggle. Both toggles default `false`.
- Toggle keys (verbatim): `aml.monitoring.enabled` (bool, default `false`), `aml.holdEnforcement.enabled` (bool, default `false`). Read via the existing `businessConfig` (`modules/config/businessConfig.js`, functions `get/getNumber/getBoolean/set`).
- **S5 hold reuses** the withdrawal's `requiresApproval` / `approvedBy` / `approvalDate` columns (already on `BlockchainTransaction`). **No new withdrawal status.**
- **Tipping-off:** `AmlCase` rows and `User.amlRiskLevel`/`amlReviewPending` are NEVER exposed to end users. AML routes are admin-only (`authenticateToken` + `isAdmin` + `requireOperatorMFA`, same as `businessConfig.routes.js`).
- **Never downgrade risk:** raising the flag only moves `low→medium→high` upward; never lowers an existing level.
- Amounts are strings; never introduce floats into money paths.
- Any endpoint added updates its route file's `@openapi` annotation in the SAME commit (per the project's OpenAPI convention). The frontend contract doc (`docs/frontend-rebuild/backend-contract-changes.md`) covers CLIENT-facing changes only; these are admin routes, so it is not required for them.
- Every task ends green: run the named tests; before the final task's commit, run `npm test`, `npm run test:integration`, `npm run test:coverage`, `npm run test:integration:coverage` — all exit 0. Integration DB is the Docker `exchange_test_db` on the default port (do NOT set DB_PORT; use `DB_PORT=15432` only if WinNAT blocks it).
- Commits: Conventional English + trailers `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01LeJZyLF82A2RQ1JcnLePEJ`.

---

### Task 1: `amlConfig` — toggle + threshold reader

**Files:**
- Create: `backend/modules/aml/amlConfig.js`
- Test: `backend/tests/amlConfig.test.js`

**Interfaces:**
- Consumes: `modules/config/businessConfig.js` → `getBoolean(key, fallback)`, `getNumber(key, fallback)`.
- Produces: `isMonitoringEnabled(): Promise<boolean>`, `isHoldEnforcementEnabled(): Promise<boolean>`, `getThreshold(key, fallback): Promise<number>`, and `KEYS` (frozen object of the config-key strings + `DEFAULTS`).

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/amlConfig.test.js
jest.mock('../modules/config/businessConfig', () => ({
  getBoolean: jest.fn(),
  getNumber: jest.fn(),
}));
const businessConfig = require('../modules/config/businessConfig');
const amlConfig = require('../modules/aml/amlConfig');

describe('amlConfig', () => {
  beforeEach(() => jest.clearAllMocks());

  test('monitoring + hold enforcement default to false when unseeded', async () => {
    businessConfig.getBoolean.mockImplementation(async (_k, fallback) => fallback);
    expect(await amlConfig.isMonitoringEnabled()).toBe(false);
    expect(await amlConfig.isHoldEnforcementEnabled()).toBe(false);
    expect(businessConfig.getBoolean).toHaveBeenCalledWith('aml.monitoring.enabled', false);
    expect(businessConfig.getBoolean).toHaveBeenCalledWith('aml.holdEnforcement.enabled', false);
  });

  test('reflects a seeded true value', async () => {
    businessConfig.getBoolean.mockResolvedValue(true);
    expect(await amlConfig.isMonitoringEnabled()).toBe(true);
  });

  test('getThreshold passes the provided fallback through to getNumber', async () => {
    businessConfig.getNumber.mockImplementation(async (_k, fallback) => fallback);
    expect(await amlConfig.getThreshold('aml.s2.count', 5)).toBe(5);
    expect(businessConfig.getNumber).toHaveBeenCalledWith('aml.s2.count', 5);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest amlConfig`
Expected: FAIL — `Cannot find module '../modules/aml/amlConfig'`.

- [ ] **Step 3: Implement**

```js
// backend/modules/aml/amlConfig.js
// Thin wrapper over the business-config store (Radar #13) for the AML toggles
// and thresholds. Unseeded keys return the in-code default, so shipping the AML
// module changes nothing until an operator flips a toggle from the admin panel.
const businessConfig = require('../config/businessConfig');

const KEYS = Object.freeze({
  MONITORING_ENABLED: 'aml.monitoring.enabled',
  HOLD_ENFORCEMENT_ENABLED: 'aml.holdEnforcement.enabled',
});

async function isMonitoringEnabled() {
  return businessConfig.getBoolean(KEYS.MONITORING_ENABLED, false);
}

async function isHoldEnforcementEnabled() {
  return businessConfig.getBoolean(KEYS.HOLD_ENFORCEMENT_ENABLED, false);
}

async function getThreshold(key, fallback) {
  return businessConfig.getNumber(key, fallback);
}

module.exports = { KEYS, isMonitoringEnabled, isHoldEnforcementEnabled, getThreshold };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest amlConfig`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/modules/aml/amlConfig.js backend/tests/amlConfig.test.js
git commit -m "feat(aml): config wrapper for monitoring/hold toggles (default off)"
```

---

### Task 2: `AmlDenylistedAddress` entity + model + registration

**Files:**
- Create: `backend/modules/aml/denylist.entity.js`
- Create: `backend/modules/aml/denylist.model.js`
- Modify: `backend/models/index.js` (register the model)
- Test: `backend/tests/integration/amlDenylist.integration.test.js`

**Interfaces:**
- Produces:
  - `initAmlDenylistedAddress(sequelize)` → `AmlDenylistedAddress` model. Table `aml_denylisted_addresses`. Columns: `id` UUID PK (UUIDV4), `address` STRING notNull, `network` STRING notNull, `reason` TEXT nullable, `source` STRING nullable, `addedBy` UUID nullable (`added_by`), timestamps (`created_at`/`updated_at`). Unique index `(address, network)`.
  - `denylist.model.js`: `normalizeAddress(address, network) → string` (lowercases for `ethereum`/`bsc`; trims and returns as-is for `bitcoin`/others), `addAddress({ address, network, reason, source, addedBy }, transaction?) → AmlDenylistedAddress`, `isDenylisted(address, network, transaction?) → Promise<AmlDenylistedAddress|null>` (matches on the normalized address), `listAddresses() → AmlDenylistedAddress[]`, `removeAddress(id) → number`.

- [ ] **Step 1: Write the entity**

```js
// backend/modules/aml/denylist.entity.js
const { DataTypes, Model } = require('sequelize');

class AmlDenylistedAddress extends Model {}

function initAmlDenylistedAddress(sequelize) {
  AmlDenylistedAddress.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    address: { type: DataTypes.STRING, allowNull: false },
    network: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
    addedBy: { type: DataTypes.UUID, allowNull: true, field: 'added_by' },
  }, {
    sequelize,
    modelName: 'AmlDenylistedAddress',
    tableName: 'aml_denylisted_addresses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['address', 'network'] }],
  });
  return AmlDenylistedAddress;
}

module.exports = initAmlDenylistedAddress;
```

- [ ] **Step 2: Write the model helpers**

```js
// backend/modules/aml/denylist.model.js
// Flagged/sanctioned withdrawal-destination addresses (AML signal S5). Manual
// list for now (seeded via the admin route); real OFAC ingestion is a follow-up.
function normalizeAddress(address, network) {
  const a = String(address || '').trim();
  if (network === 'ethereum' || network === 'bsc') return a.toLowerCase();
  return a;
}

async function addAddress({ address, network, reason, source, addedBy }, transaction = null) {
  const { AmlDenylistedAddress } = require('../../models');
  return AmlDenylistedAddress.create(
    { address: normalizeAddress(address, network), network, reason, source, addedBy },
    { transaction }
  );
}

async function isDenylisted(address, network, transaction = null) {
  const { AmlDenylistedAddress } = require('../../models');
  return AmlDenylistedAddress.findOne({
    where: { address: normalizeAddress(address, network), network },
    transaction,
  });
}

async function listAddresses() {
  const { AmlDenylistedAddress } = require('../../models');
  return AmlDenylistedAddress.findAll({ order: [['created_at', 'DESC']] });
}

async function removeAddress(id) {
  const { AmlDenylistedAddress } = require('../../models');
  return AmlDenylistedAddress.destroy({ where: { id } });
}

module.exports = { normalizeAddress, addAddress, isDenylisted, listAddresses, removeAddress };
```

- [ ] **Step 3: Register the model in `models/index.js`**

After line `const AuditLog = auditLogModel(sequelize);` add the require near the other model requires (top of file, beside `auditLogModel`) and the init:

```js
// near the other `require` lines at the top of models/index.js:
const amlDenylistModel = require('../modules/aml/denylist.entity');
// beside `const AuditLog = auditLogModel(sequelize);`:
const AmlDenylistedAddress = amlDenylistModel(sequelize);
```

And add `AmlDenylistedAddress,` to the `module.exports` object (beside `AuditLog,`).

- [ ] **Step 4: Write the failing integration test**

```js
// backend/tests/integration/amlDenylist.integration.test.js
const { sequelize, resetDb } = require('../helpers/db');
const denylist = require('../../modules/aml/denylist.model');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('AML denylist model', () => {
  test('EVM address match is case-insensitive; miss returns null', async () => {
    await denylist.addAddress({ address: '0xABCdef0000000000000000000000000000000001', network: 'ethereum', reason: 'test', source: 'OFAC' });
    const hit = await denylist.isDenylisted('0xabcDEF0000000000000000000000000000000001', 'ethereum');
    expect(hit).not.toBeNull();
    const miss = await denylist.isDenylisted('0x0000000000000000000000000000000000000002', 'ethereum');
    expect(miss).toBeNull();
  });

  test('same address on a different network does not match', async () => {
    await denylist.addAddress({ address: 'bc1qexample', network: 'bitcoin' });
    expect(await denylist.isDenylisted('bc1qexample', 'ethereum')).toBeNull();
    expect(await denylist.isDenylisted('bc1qexample', 'bitcoin')).not.toBeNull();
  });

  test('list + remove', async () => {
    const row = await denylist.addAddress({ address: '0xdead', network: 'ethereum' });
    expect(await denylist.listAddresses()).toHaveLength(1);
    expect(await denylist.removeAddress(row.id)).toBe(1);
    expect(await denylist.listAddresses()).toHaveLength(0);
  });
});
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test:integration -- amlDenylist`
Expected: PASS (3 tests). If it fails on connection, retry with `DB_PORT=15432 npm run test:integration -- amlDenylist`.

- [ ] **Step 6: Commit**

```bash
git add backend/modules/aml/denylist.entity.js backend/modules/aml/denylist.model.js backend/models/index.js backend/tests/integration/amlDenylist.integration.test.js
git commit -m "feat(aml): denylisted-address model (S5 substrate)"
```

---

### Task 3: `AmlCase` model + `riskFlag` helper + registration

**Files:**
- Create: `backend/modules/aml/case.entity.js`
- Create: `backend/modules/aml/case.model.js`
- Create: `backend/modules/aml/riskFlag.js`
- Modify: `backend/models/index.js` (register `AmlCase`)
- Test: `backend/tests/integration/amlCase.integration.test.js`

**Interfaces:**
- Consumes: `models` (`AmlCase`, `User`).
- Produces:
  - `initAmlCase(sequelize)` → `AmlCase`. Table `aml_cases`. Columns: `id` UUID PK; `userId` UUID notNull (`user_id`); `signalId` STRING notNull (`signal_id`); `severity` ENUM(`low`,`medium`,`high`) notNull; `status` ENUM(`open`,`in_review`,`closed`) notNull default `open`; `evidence` JSONB notNull; `sourceEventId` UUID nullable (`source_event_id`); `dedupeKey` STRING notNull unique (`dedupe_key`); `resolvedBy` UUID nullable (`resolved_by`); `resolvedAt` DATE nullable (`resolved_at`); timestamps. Indexes: unique `(dedupe_key)`, `(user_id)`, `(status)`.
  - `case.model.js`: `openCase({ userId, signalId, severity, evidence, dedupeKey, sourceEventId? }, transaction?) → { case: AmlCase, created: boolean }` (idempotent via `findOrCreate` on `dedupeKey`); `resolveCase(id, { status, resolvedBy }, transaction?) → AmlCase` (sets `status`,`resolvedBy`,`resolvedAt=now`); `listCases(filter?) → AmlCase[]`; `getCase(id) → AmlCase|null`.
  - `riskFlag.js`: `RANK = { low:0, medium:1, high:2 }`; `raiseUserRisk(userId, targetLevel, transaction?) → Promise<void>` — reads the user's current `amlRiskLevel`; if `RANK[target] > RANK[current]` updates `amlRiskLevel=target` and `amlReviewPending=true` (never downgrades).

- [ ] **Step 1: Entity**

```js
// backend/modules/aml/case.entity.js
const { DataTypes, Model } = require('sequelize');

class AmlCase extends Model {}

function initAmlCase(sequelize) {
  AmlCase.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    signalId: { type: DataTypes.STRING, allowNull: false, field: 'signal_id' },
    severity: { type: DataTypes.ENUM('low', 'medium', 'high'), allowNull: false },
    status: { type: DataTypes.ENUM('open', 'in_review', 'closed'), allowNull: false, defaultValue: 'open' },
    evidence: { type: DataTypes.JSONB, allowNull: false },
    sourceEventId: { type: DataTypes.UUID, allowNull: true, field: 'source_event_id' },
    dedupeKey: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'dedupe_key' },
    resolvedBy: { type: DataTypes.UUID, allowNull: true, field: 'resolved_by' },
    resolvedAt: { type: DataTypes.DATE, allowNull: true, field: 'resolved_at' },
  }, {
    sequelize,
    modelName: 'AmlCase',
    tableName: 'aml_cases',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['dedupe_key'] },
      { fields: ['user_id'] },
      { fields: ['status'] },
    ],
  });
  return AmlCase;
}

module.exports = initAmlCase;
```

- [ ] **Step 2: Case model helpers**

```js
// backend/modules/aml/case.model.js
// The AML case queue. Idempotent by dedupeKey so at-least-once event delivery
// and the on-event/sweep double-path never open the same case twice.
async function openCase({ userId, signalId, severity, evidence, dedupeKey, sourceEventId = null }, transaction = null) {
  const { AmlCase } = require('../../models');
  const [row, created] = await AmlCase.findOrCreate({
    where: { dedupeKey },
    defaults: { userId, signalId, severity, evidence, sourceEventId, status: 'open' },
    transaction,
  });
  return { case: row, created };
}

async function resolveCase(id, { status, resolvedBy }, transaction = null) {
  const { AmlCase } = require('../../models');
  await AmlCase.update(
    { status, resolvedBy, resolvedAt: new Date() },
    { where: { id }, transaction }
  );
  return AmlCase.findByPk(id, { transaction });
}

async function listCases(filter = {}) {
  const { AmlCase } = require('../../models');
  const where = {};
  if (filter.status) where.status = filter.status;
  if (filter.userId) where.userId = filter.userId;
  return AmlCase.findAll({ where, order: [['created_at', 'DESC']] });
}

async function getCase(id) {
  const { AmlCase } = require('../../models');
  return AmlCase.findByPk(id);
}

module.exports = { openCase, resolveCase, listCases, getCase };
```

- [ ] **Step 3: Risk-flag helper**

```js
// backend/modules/aml/riskFlag.js
// Raises User.amlRiskLevel monotonically (never downgrades) and marks the account
// for review. NEVER exposed to the user (User.toJSON already strips both fields).
const RANK = { low: 0, medium: 1, high: 2 };

async function raiseUserRisk(userId, targetLevel, transaction = null) {
  const { User } = require('../../models');
  const user = await User.findByPk(userId, { transaction });
  if (!user) return;
  if (RANK[targetLevel] > RANK[user.amlRiskLevel]) {
    await User.update(
      { amlRiskLevel: targetLevel, amlReviewPending: true },
      { where: { id: userId }, transaction }
    );
  }
}

module.exports = { RANK, raiseUserRisk };
```

- [ ] **Step 4: Register `AmlCase` in `models/index.js`**

Add beside the Task 2 registration:

```js
const amlCaseModel = require('../modules/aml/case.entity');
const AmlCase = amlCaseModel(sequelize);
```

Add `AmlCase,` to `module.exports`.

- [ ] **Step 5: Failing integration test**

```js
// backend/tests/integration/amlCase.integration.test.js
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const cases = require('../../modules/aml/case.model');
const riskFlag = require('../../modules/aml/riskFlag');
const { User } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('AML case model + risk flag', () => {
  test('openCase is idempotent by dedupeKey', async () => {
    const user = await f.seedUser();
    const args = { userId: user.id, signalId: 'S5', severity: 'high', evidence: { a: 1 }, dedupeKey: `${user.id}:S5:w1` };
    const first = await cases.openCase(args);
    const second = await cases.openCase(args);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.case.id).toBe(first.case.id);
    expect(await cases.listCases()).toHaveLength(1);
  });

  test('raiseUserRisk moves up and never downgrades', async () => {
    const user = await f.seedUser();
    await riskFlag.raiseUserRisk(user.id, 'high');
    let u = await User.findByPk(user.id);
    expect(u.amlRiskLevel).toBe('high');
    expect(u.amlReviewPending).toBe(true);
    await riskFlag.raiseUserRisk(user.id, 'medium'); // no downgrade
    u = await User.findByPk(user.id);
    expect(u.amlRiskLevel).toBe('high');
  });

  test('resolveCase sets status + resolver + timestamp', async () => {
    const user = await f.seedUser();
    const { case: c } = await cases.openCase({ userId: user.id, signalId: 'S5', severity: 'high', evidence: {}, dedupeKey: `${user.id}:S5:w2` });
    const resolved = await cases.resolveCase(c.id, { status: 'closed', resolvedBy: user.id });
    expect(resolved.status).toBe('closed');
    expect(resolved.resolvedBy).toBe(user.id);
    expect(resolved.resolvedAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test:integration -- amlCase`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/modules/aml/case.entity.js backend/modules/aml/case.model.js backend/modules/aml/riskFlag.js backend/models/index.js backend/tests/integration/amlCase.integration.test.js
git commit -m "feat(aml): case queue (idempotent) + monotonic risk flag"
```

---

### Task 4: `amlScreening.checkWithdrawal`

**Files:**
- Create: `backend/modules/aml/amlScreening.js`
- Test: `backend/tests/amlScreening.test.js`

**Interfaces:**
- Consumes: `denylist.model.isDenylisted`.
- Produces: `checkWithdrawal({ address, network }, transaction?) → Promise<{ denylisted: boolean, match: AmlDenylistedAddress|null }>`.

- [ ] **Step 1: Failing unit test**

```js
// backend/tests/amlScreening.test.js
jest.mock('../modules/aml/denylist.model', () => ({ isDenylisted: jest.fn() }));
const denylist = require('../modules/aml/denylist.model');
const screening = require('../modules/aml/amlScreening');

describe('amlScreening.checkWithdrawal', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns denylisted:false when no match', async () => {
    denylist.isDenylisted.mockResolvedValue(null);
    const r = await screening.checkWithdrawal({ address: '0xabc', network: 'ethereum' });
    expect(r).toEqual({ denylisted: false, match: null });
  });

  test('returns denylisted:true + the match row', async () => {
    const row = { id: 'x', source: 'OFAC' };
    denylist.isDenylisted.mockResolvedValue(row);
    const r = await screening.checkWithdrawal({ address: '0xabc', network: 'ethereum' }, 'TX');
    expect(r).toEqual({ denylisted: true, match: row });
    expect(denylist.isDenylisted).toHaveBeenCalledWith('0xabc', 'ethereum', 'TX');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest amlScreening`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```js
// backend/modules/aml/amlScreening.js
// Synchronous, preventive sanctions screening (AML signal S5). Called at
// withdrawal creation, inside the withdrawal's transaction, BEFORE the funds
// leave. A hit does not itself act — the caller decides (hold vs shadow) based
// on the amlConfig hold-enforcement toggle.
const denylist = require('./denylist.model');

async function checkWithdrawal({ address, network }, transaction = null) {
  const match = await denylist.isDenylisted(address, network, transaction);
  return { denylisted: !!match, match: match || null };
}

module.exports = { checkWithdrawal };
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest amlScreening`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/modules/aml/amlScreening.js backend/tests/amlScreening.test.js
git commit -m "feat(aml): synchronous withdrawal sanctions screening (S5)"
```

---

### Task 5: Wire the S5 hold into the withdrawal money-path

**Files:**
- Modify: `backend/modules/wallets/blockchainTransaction.model.js` (`createWithdrawal` at ~:384; `claimForProcessing` at ~:438)
- Test: `backend/tests/integration/amlWithdrawalHold.integration.test.js`

**Interfaces:**
- Consumes: `amlConfig.isMonitoringEnabled/isHoldEnforcementEnabled`, `amlScreening.checkWithdrawal`, `case.model.openCase`, `riskFlag.raiseUserRisk`.
- Produces: behavior change in `createWithdrawal` (may set `requiresApproval:true` + open an S5 case + raise risk, all in the withdrawal tx) and in `claimForProcessing` (excludes `requiresApproval:true`).

**Design notes for the implementer:** `createWithdrawal(data, { finalize })` opens its own `transaction`, calls `UserBalance.blockBalance(...)`, builds `retiroData` with `requiresApproval:false`, creates the row, runs `finalize`, commits. Insert the screening AFTER `blockBalance` and BEFORE building `retiroData`, so the whole thing (block + row + case + flag) is atomic. Read `network` from the crypto: the withdrawal `data` has `cryptoId`; load the crypto's `network` via `sequelize.models.Crypto.findByPk(data.cryptoId, { transaction })`. Gate ALL of it behind `isMonitoringEnabled()` — if monitoring is off, do nothing (byte-for-byte current behavior). The `dedupeKey` for S5 is `${data.userId}:S5:${nuevoRetiro.id}` — so open the case AFTER the row is created (you need its id); still inside the same tx.

- [ ] **Step 1: Write the failing integration test**

```js
// backend/tests/integration/amlWithdrawalHold.integration.test.js
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { BlockchainTransaction, User, AmlCase } = require('../../models');
const businessConfig = require('../../modules/config/businessConfig');
const denylist = require('../../modules/aml/denylist.model');

// NOTE: f.seedCripto(symbol) hard-codes network 'test', so create the crypto
// explicitly with network 'ethereum' here and add denylist entries with the SAME
// network. For the balance/withdrawal seeding, mirror
// tests/integration/ethWithdrawal.integration.test.js (it shows the exact funding
// setup createWithdrawal's blockBalance needs).
const { Crypto } = require('../../models');
async function seedAndWithdraw(address) {
  const user = await f.seedUser();
  const eth = await Crypto.create({ symbol: 'ETH', name: 'ETH', network: 'ethereum' });
  await f.seedBalance(user, eth, '10'); // if this helper doesn't fund what blockBalance reads, copy the seeding from ethWithdrawal.integration.test.js
  const w = await BlockchainTransaction.createWithdrawal({
    userId: user.id, cryptoId: eth.id, amount: '1', destinationAddress: address,
  });
  return { user, eth, w };
}

beforeEach(async () => {
  await resetDb();
  businessConfig.clearCache();
});
afterAll(async () => { await sequelize.close(); });

describe('S5 withdrawal hold', () => {
  test('monitoring OFF: denylisted address is NOT held (byte-for-byte legacy)', async () => {
    await denylist.addAddress({ address: '0xbad', network: 'ethereum', source: 'OFAC' });
    const { w } = await seedAndWithdraw('0xbad');
    expect(w.requiresApproval).toBe(false);
    expect(await AmlCase.count()).toBe(0);
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(true); // claimable
  });

  test('enforcement ON + denylisted: held, case opened, risk raised, NOT claimable', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    await businessConfig.set('aml.holdEnforcement.enabled', 'true');
    await denylist.addAddress({ address: '0xbad', network: 'ethereum', source: 'OFAC' });
    const { user, w } = await seedAndWithdraw('0xbad');
    const held = await BlockchainTransaction.findByPk(w.id);
    expect(held.requiresApproval).toBe(true);
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(false); // NOT claimable
    const cases = await AmlCase.findAll();
    expect(cases).toHaveLength(1);
    expect(cases[0].signalId).toBe('S5');
    expect(cases[0].severity).toBe('high');
    const u = await User.findByPk(user.id);
    expect(u.amlRiskLevel).toBe('high');
    expect(u.amlReviewPending).toBe(true);
  });

  test('shadow mode (monitoring ON, enforcement OFF): case opened but NOT held', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    await businessConfig.set('aml.holdEnforcement.enabled', 'false');
    await denylist.addAddress({ address: '0xbad', network: 'ethereum', source: 'OFAC' });
    const { w } = await seedAndWithdraw('0xbad');
    expect(w.requiresApproval).toBe(false); // NOT held
    expect(await AmlCase.count()).toBe(1); // but observed
  });

  test('monitoring ON, clean address: no case, claimable', async () => {
    await businessConfig.set('aml.monitoring.enabled', 'true');
    await businessConfig.set('aml.holdEnforcement.enabled', 'true');
    const { w } = await seedAndWithdraw('0xclean');
    expect(w.requiresApproval).toBe(false);
    expect(await AmlCase.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:integration -- amlWithdrawalHold`
Expected: FAIL — cases not opened / `requiresApproval` never true / held row still claimable.

- [ ] **Step 3: Add the require block at the top of `blockchainTransaction.model.js`**

The file already `require`s `emitEvent`. Add beside it (module top):

```js
const amlConfig = require('../aml/amlConfig');
const amlScreening = require('../aml/amlScreening');
const amlCases = require('../aml/case.model');
const amlRiskFlag = require('../aml/riskFlag');
```

- [ ] **Step 4: Insert the S5 screening into `createWithdrawal`**

Replace the block from `await UserBalance.blockBalance(...)` through the `BlockchainTransaction.create(retiroData, ...)` + enriched read with the version below (adds screening + hold + case + flag, all inside the existing `transaction`):

```js
      await UserBalance.blockBalance(data.userId, data.cryptoId, String(data.amount), transaction);

      // AML S5 (sanctions screening) — only when monitoring is enabled; otherwise
      // this is byte-for-byte the legacy path. A denylist hit HOLDS the withdrawal
      // (requiresApproval=true → the transmit claim skips it) when enforcement is on,
      // or is observed-only (shadow) when off.
      let hold = false;
      let s5Match = null;
      const amlOn = await amlConfig.isMonitoringEnabled();
      if (amlOn) {
        const crypto = await sequelize.models.Crypto.findByPk(data.cryptoId, { transaction });
        const network = crypto ? crypto.network : null;
        const screen = await amlScreening.checkWithdrawal(
          { address: data.destinationAddress, network }, transaction
        );
        if (screen.denylisted) {
          s5Match = screen.match;
          hold = await amlConfig.isHoldEnforcementEnabled();
        }
      }

      const retiroData = {
        ...data,
        type: 'withdrawal',
        status: 'pending',
        confirmations: 0,
        requiresApproval: hold,
        blockchainFee: data.blockchainFee || 0
      };

      const nuevoRetiro = await BlockchainTransaction.create(retiroData, { transaction });

      if (s5Match) {
        await amlCases.openCase({
          userId: data.userId,
          signalId: 'S5',
          severity: 'high',
          evidence: {
            withdrawalId: nuevoRetiro.id,
            address: data.destinationAddress,
            source: s5Match.source || null,
            held: hold,
          },
          dedupeKey: `${data.userId}:S5:${nuevoRetiro.id}`,
        }, transaction);
        await amlRiskFlag.raiseUserRisk(data.userId, 'high', transaction);
      }

      // Lectura enriquecida DENTRO de la tx (ver comentario original).
      const retiro = await BlockchainTransaction.getById(nuevoRetiro.id, transaction);
```

Leave the rest of the function (`if (finalize)…`, `commit`, `catch`) unchanged.

- [ ] **Step 5: Exclude held withdrawals from the transmit claim**

In `claimForProcessing` change the `where` so a held row is never picked up:

```js
  BlockchainTransaction.claimForProcessing = async (id) => {
    const [affected] = await BlockchainTransaction.update(
      { status: 'processing' },
      { where: { id, type: 'withdrawal', status: 'pending', requiresApproval: false } }
    );
    return affected === 1;
  };
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test:integration -- amlWithdrawalHold`
Expected: PASS (4 tests).

- [ ] **Step 7: Regression — the existing withdrawal suites still pass**

Run: `npm run test:integration -- withdrawal` then `npx jest transaccionBlockchain`
Expected: PASS (no regression — with monitoring off, behavior is unchanged).

- [ ] **Step 8: Commit**

```bash
git add backend/modules/wallets/blockchainTransaction.model.js backend/tests/integration/amlWithdrawalHold.integration.test.js
git commit -m "feat(aml): S5 sanctions hold at withdrawal creation (default-off)"
```

---

### Task 6: Admin routes `/api/aml` (config, denylist, cases) + resolution + final verification

**Files:**
- Create: `backend/modules/aml/aml.controller.js`
- Create: `backend/modules/aml/aml.routes.js`
- Modify: `backend/routes/index.js` (mount `/aml`)
- Test: `backend/tests/integration/amlAdminRoutes.integration.test.js`

**Interfaces:**
- Consumes: `amlConfig`, `businessConfig`, `denylist.model`, `case.model`, `riskFlag`, `BlockchainTransaction` (for withdrawal approve/reject).
- Produces routes (all admin-gated): 
  - `GET /api/aml/config` → the two toggles' current values.
  - `PUT /api/aml/config/:key` → set a toggle/threshold (delegates to `businessConfig.set`; only allows keys starting with `aml.`).
  - `GET /api/aml/denylist` · `POST /api/aml/denylist` · `DELETE /api/aml/denylist/:id`.
  - `GET /api/aml/cases` (optional `?status=`) · `PUT /api/aml/cases/:id/resolve` (body `{ decision: 'approve'|'reject' }`).

**Resolution semantics (`PUT /cases/:id/resolve`):** load the case; if its `signalId==='S5'` and `evidence.withdrawalId` is set, then:
- `approve` → `BlockchainTransaction.approveWithdrawal(withdrawalId, adminId)` (new tiny model helper: set `requiresApproval:false`, `approvedBy:adminId`, `approvalDate:now` where `id`,`type:'withdrawal'`,`status:'pending'`); then `resolveCase(id, { status:'closed', resolvedBy:adminId })`.
- `reject` → `BlockchainTransaction.failWithdrawal(withdrawalId, 'AML S5 rejected')` **if such a refund/fail helper exists** — the implementer MUST grep `blockchainTransaction.model.js` for the existing withdrawal fail/refund path (there is a fail path used by the reaper) and reuse it so the blocked funds are returned to the ledger; then `resolveCase(id, { status:'closed', resolvedBy:adminId })`. If no reusable refund helper is found, STOP and report BLOCKED rather than hand-rolling a ledger refund.

- [ ] **Step 1: Add the `approveWithdrawal` helper to `blockchainTransaction.model.js`**

```js
  // Operator clears an AML hold: the withdrawal becomes claimable again.
  BlockchainTransaction.approveWithdrawal = async (id, adminId) => {
    const [affected] = await BlockchainTransaction.update(
      { requiresApproval: false, approvedBy: adminId, approvalDate: new Date() },
      { where: { id, type: 'withdrawal', status: 'pending' } }
    );
    return affected === 1;
  };
```

- [ ] **Step 2: Controller**

```js
// backend/modules/aml/aml.controller.js
const amlConfig = require('./amlConfig');
const businessConfig = require('../config/businessConfig');
const denylist = require('./denylist.model');
const cases = require('./case.model');
const { BlockchainTransaction } = require('../../models');

async function getConfig(req, res) {
  res.json({
    monitoringEnabled: await amlConfig.isMonitoringEnabled(),
    holdEnforcementEnabled: await amlConfig.isHoldEnforcementEnabled(),
  });
}

async function putConfig(req, res) {
  const { key } = req.params;
  if (!key.startsWith('aml.')) return res.status(400).json({ error: 'Solo se permiten claves aml.*' });
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'Falta value' });
  await businessConfig.set(key, value, { category: 'aml' });
  res.json({ key, value: String(value) });
}

async function getDenylist(req, res) { res.json(await denylist.listAddresses()); }

async function addDenylist(req, res) {
  const { address, network, reason, source } = req.body;
  if (!address || !network) return res.status(400).json({ error: 'address y network son requeridos' });
  const row = await denylist.addAddress({ address, network, reason, source, addedBy: req.user.id });
  res.status(201).json(row);
}

async function removeDenylist(req, res) {
  const n = await denylist.removeAddress(req.params.id);
  res.json({ removed: n });
}

async function getCases(req, res) { res.json(await cases.listCases({ status: req.query.status })); }

async function resolveCase(req, res) {
  const { decision } = req.body;
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'decision debe ser approve|reject' });
  const c = await cases.getCase(req.params.id);
  if (!c) return res.status(404).json({ error: 'Caso no encontrado' });

  if (c.signalId === 'S5' && c.evidence && c.evidence.withdrawalId) {
    const wId = c.evidence.withdrawalId;
    if (decision === 'approve') {
      await BlockchainTransaction.approveWithdrawal(wId, req.user.id);
    } else {
      // Reuse the existing withdrawal fail/refund path (implementer: grep + wire).
      await BlockchainTransaction.failWithdrawal(wId, 'AML S5 rejected');
    }
  }
  const resolved = await cases.resolveCase(req.params.id, { status: 'closed', resolvedBy: req.user.id });
  res.json(resolved);
}

module.exports = { getConfig, putConfig, getDenylist, addDenylist, removeDenylist, getCases, resolveCase };
```

> Implementer: confirm the exact name/signature of the existing withdrawal fail/refund helper (grep `blockchainTransaction.model.js` for `failWithdrawal`/`revert`/`refund`/`fail`). Use the real one. If it needs different args, adapt the `reject` branch. If none exists, report BLOCKED.

- [ ] **Step 3: Routes (with `@openapi` annotations)**

```js
// backend/modules/aml/aml.routes.js
// Admin AML surface (§4.8). Same gate as business-config: authenticated + admin +
// operator 2FA. Reserved for the Fase 7 admin panel; no user-facing routes here.
const { Router } = require('express');
const router = Router();
const { authenticateToken } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/adminMiddleware');
const requireOperatorMFA = require('../../middleware/operatorMFA.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./aml.controller');

router.use(authenticateToken, isAdmin, requireOperatorMFA);

/**
 * @openapi
 * /aml/config:
 *   get:
 *     tags: [AML - admin]
 *     summary: Estado de los toggles AML (monitoring + hold enforcement)
 *     responses:
 *       200: { description: Toggles }
 *       403: { description: Operador sin 2FA }
 * /aml/config/{key}:
 *   put:
 *     tags: [AML - admin]
 *     summary: Setear una clave de config aml.* (invalida la cache)
 *     parameters: [ { in: path, name: key, required: true, schema: { type: string } } ]
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, required: [value], properties: { value: { type: string } } } } } }
 *     responses: { 200: { description: Guardado }, 400: { description: Clave no-aml o value faltante } }
 * /aml/denylist:
 *   get:
 *     tags: [AML - admin]
 *     summary: Listar direcciones en denylist (S5)
 *     responses: { 200: { description: Lista } }
 *   post:
 *     tags: [AML - admin]
 *     summary: Agregar una direccion a la denylist
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, required: [address, network], properties: { address: { type: string }, network: { type: string }, reason: { type: string }, source: { type: string } } } } } }
 *     responses: { 201: { description: Creada }, 400: { description: Faltan address/network } }
 * /aml/denylist/{id}:
 *   delete:
 *     tags: [AML - admin]
 *     summary: Quitar una direccion de la denylist
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     responses: { 200: { description: Removida } }
 * /aml/cases:
 *   get:
 *     tags: [AML - admin]
 *     summary: Listar casos AML (tipping-off — solo admin)
 *     parameters: [ { in: query, name: status, required: false, schema: { type: string } } ]
 *     responses: { 200: { description: Casos } }
 * /aml/cases/{id}/resolve:
 *   put:
 *     tags: [AML - admin]
 *     summary: Resolver un caso (approve|reject; S5 libera o rechaza el retiro)
 *     parameters: [ { in: path, name: id, required: true, schema: { type: string } } ]
 *     requestBody: { required: true, content: { application/json: { schema: { type: object, required: [decision], properties: { decision: { type: string, enum: [approve, reject] } } } } } }
 *     responses: { 200: { description: Resuelto }, 400: { description: decision invalida }, 404: { description: No encontrado } }
 */
router.get('/config', asyncHandler(controller.getConfig));
router.put('/config/:key', asyncHandler(controller.putConfig));
router.get('/denylist', asyncHandler(controller.getDenylist));
router.post('/denylist', asyncHandler(controller.addDenylist));
router.delete('/denylist/:id', asyncHandler(controller.removeDenylist));
router.get('/cases', asyncHandler(controller.getCases));
router.put('/cases/:id/resolve', asyncHandler(controller.resolveCase));

module.exports = router;
```

- [ ] **Step 4: Mount in `backend/routes/index.js`**

Add the require beside `businessConfigRoutes` and the mount beside `/config`:

```js
const amlRoutes = require('../modules/aml/aml.routes.js')
// ...
router.use('/aml', amlRoutes)
```

- [ ] **Step 5: Failing integration test**

```js
// backend/tests/integration/amlAdminRoutes.integration.test.js
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const businessConfig = require('../../modules/config/businessConfig');
const { BlockchainTransaction, AmlCase } = require('../../models');

// Admin auth = an admin user with 2FA enabled + the standard auth header, exactly
// as tests/integration/configuracionNegocio.integration.test.js authenticates the
// /api/config admin routes (same middleware stack).
const { Crypto } = require('../../models');
const adminConMFA = () => f.seedUser({ role: 'admin', twoFactorEnabled: true });
beforeEach(async () => { await resetDb(); businessConfig.clearCache(); });
afterAll(async () => { await sequelize.close(); });

describe('AML admin routes', () => {
  test('PUT /aml/config/:key rejects non-aml keys, accepts aml.*', async () => {
    const admin = await adminConMFA();
    const h = f.authHeader(admin);
    await request(app).put('/api/aml/config/foo.bar').set(h).send({ value: 'true' }).expect(400);
    await request(app).put('/api/aml/config/aml.monitoring.enabled').set(h).send({ value: 'true' }).expect(200);
    expect(await businessConfig.getBoolean('aml.monitoring.enabled', false)).toBe(true);
  });

  test('denylist add/list/remove roundtrip', async () => {
    const h = f.authHeader(await adminConMFA());
    const created = await request(app).post('/api/aml/denylist').set(h).send({ address: '0xBAD', network: 'ethereum', source: 'OFAC' }).expect(201);
    await request(app).get('/api/aml/denylist').set(h).expect(200).then(r => expect(r.body).toHaveLength(1));
    await request(app).delete(`/api/aml/denylist/${created.body.id}`).set(h).expect(200);
  });

  test('resolve S5 case: approve makes the held withdrawal claimable', async () => {
    const h = f.authHeader(await adminConMFA());
    await businessConfig.set('aml.monitoring.enabled', 'true');
    await businessConfig.set('aml.holdEnforcement.enabled', 'true');
    const denylist = require('../../modules/aml/denylist.model');
    await denylist.addAddress({ address: '0xbad', network: 'ethereum', source: 'OFAC' });
    const user = await f.seedUser();
    const eth = await Crypto.create({ symbol: 'ETH', name: 'ETH', network: 'ethereum' });
    await f.seedBalance(user, eth, '10'); // mirror ethWithdrawal.integration.test.js if this doesn't fund blockBalance
    const w = await BlockchainTransaction.createWithdrawal({ userId: user.id, cryptoId: eth.id, amount: '1', destinationAddress: '0xbad' });
    const c = await AmlCase.findOne({ where: { signalId: 'S5' } });

    await request(app).put(`/api/aml/cases/${c.id}/resolve`).set(h).send({ decision: 'approve' }).expect(200);
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(true); // now claimable
    expect((await AmlCase.findByPk(c.id)).status).toBe('closed');
  });

  test('unauthenticated request is rejected', async () => {
    await request(app).get('/api/aml/cases').expect(401);
  });
});
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run test:integration -- amlAdminRoutes`
Expected: PASS (4 tests). (If `f.seedAdmin`/`f.adminAuthHeader` don't exist, add them mirroring the existing admin-authenticated tests — grep `tests/` for how `/api/config` tests authenticate an admin with operator MFA.)

- [ ] **Step 7: Full verification (Slice A exit gate)**

Run each; all must exit 0:
```bash
npm test
npm run test:integration
npm run test:coverage
npm run test:integration:coverage
```
If a coverage floor drops because a new file is integration-only, add a no-DB unit test for it (per the project's coverage-gate convention) rather than lowering the floor.

- [ ] **Step 8: Commit**

```bash
git add backend/modules/aml/aml.controller.js backend/modules/aml/aml.routes.js backend/modules/wallets/blockchainTransaction.model.js backend/routes/index.js backend/tests/integration/amlAdminRoutes.integration.test.js
git commit -m "feat(aml): admin routes for config, denylist + S5 case resolution"
```

---

## Self-Review

**Spec coverage (Slice A scope):**
- Module `backend/modules/aml/` ✅ (Tasks 1–6).
- `amlConfig` toggles default-off ✅ (Task 1).
- `AmlCase` + dedupe + resolution ✅ (Task 3, 6).
- `AmlDenylistedAddress` + normalization ✅ (Task 2).
- Risk flag monotonic + tipping-off (never in user JSON — reuses existing stripped fields) ✅ (Task 3).
- S5 preventive hold reusing `requiresApproval`, excluded from claim, shadow/off modes ✅ (Task 5).
- Operator approve/reject with fund refund on reject ✅ (Task 6).
- Admin routes gated like `businessConfig`, `@openapi` in same commit ✅ (Task 6).
- Detective on-event consumer, periodic sweep, signals S1–S4/S6 → **Slice B/C** (out of this plan, per the spec's slicing).

**Placeholder scan:** No TBD/TODO. The one deferred lookup — the existing withdrawal fail/refund helper name in Task 6 `reject` — is called out explicitly with a grep instruction and a BLOCKED fallback, not hand-waved.

**Type consistency:** `openCase({...}) → { case, created }` used consistently (Task 3 def, Task 5/6 use). `raiseUserRisk(userId, level, tx)` consistent. `checkWithdrawal({address,network},tx) → {denylisted,match}` consistent (Task 4 def, Task 5 use). `claimForProcessing` WHERE gains `requiresApproval:false` (Task 5) and the approve helper clears it (Task 6) — consistent. Config keys `aml.monitoring.enabled` / `aml.holdEnforcement.enabled` identical across Tasks 1, 5, 6.
