# Immutable Audit Trail (Fase 6.2.1 slice 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A generic, hash-chained, tamper-evident `audit_log` that records every domain event flowing through the outbox, plus a chain-verification function — purely additive, no money-path changes.

**Architecture:** A new `modules/audit/` consumes the existing event bus via a new `eventBus.onAny(...)` wildcard subscription. `auditConsumer` writes one immutable hash-chained row per event (idempotent by `event_id`); `verifyAuditChain` recomputes the chain to detect tampering. Proven with the P2P events slice 1 already emits.

**Tech Stack:** Node.js, Express, Sequelize (Postgres), Node built-in `crypto` (SHA-256), Jest (unit + integration). No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-13-audit-trail-design.md`

## Global Constraints

- **Purely additive:** no money-path code changes; the audit trail is a consumer.
- **Hash chain:** `hash = sha256( canonical({eventId,eventType,payload,aggregateId,occurredAt}) + '|' + prevHash )`, via Node `crypto`. `GENESIS = 'GENESIS'` is the first row's `prevHash`. `canonical` = JSON with recursively sorted keys. The auto `id` is NOT hashed.
- **Idempotent consumer:** one `audit_log` row per `event_id` (unique constraint); re-delivery is a no-op.
- **Dispatch order:** `onAny` (audit) handlers run BEFORE per-type handlers.
- **Single-writer chain:** correct because the single publisher dispatches events sequentially; multi-instance locking is deferred (Fase 5 / §6.7).
- **Conventions:** `backend/modules/<domain>/`; English identifiers; snake_case columns via `field:`. Coverage denominator already includes `modules/**`. No new deps.
- **Commits:** Conventional, English, direct to `dev`. Integration tests need the test DB up (`npm run test:integration:up`; on Windows use `DB_PORT=15432` if 55432 is blocked).

## File Structure

**Create:**
- `backend/modules/audit/auditHash.js` — `GENESIS`, `canonical(value)`, `computeHash(fields, prevHash)` (pure).
- `backend/modules/audit/auditLog.entity.js` — `AuditLog` Sequelize entity.
- `backend/modules/audit/auditLog.model.js` — factory `createAuditLogModel(sequelize)`.
- `backend/modules/audit/auditConsumer.js` — `auditConsumer(event)` + `register(eventBus)`.
- `backend/modules/audit/verifyAuditChain.js` — `verifyRows(rows)` (pure) + `verifyAuditChain()` (fetch + verify).
- `backend/scripts/verifyAuditChain.js` — manual runner.
- Tests under `backend/tests/` (unit) and `backend/tests/integration/` (DB).

**Modify:**
- `backend/modules/events/eventBus.js` — add `onAny`, run any-handlers first in `dispatch`, clear them in `_reset`.
- `backend/models/index.js` — require + instantiate + export `AuditLog`.
- `backend/modules/events/registerHandlers.js` — register `auditConsumer`.

---

### Task 1: auditHash (pure hashing)

**Files:**
- Create: `backend/modules/audit/auditHash.js`
- Test: `backend/tests/auditHash.test.js`

**Interfaces:**
- Produces: `GENESIS` (string), `canonical(value) → string`, `computeHash({ eventId, eventType, payload, aggregateId, occurredAt }, prevHash) → string` (64-char hex sha256).

- [ ] **Step 1: Write the failing unit test**

`backend/tests/auditHash.test.js`:
```js
const { GENESIS, canonical, computeHash } = require('../modules/audit/auditHash');

describe('canonical', () => {
  test('is independent of key insertion order', () => {
    expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }));
  });
  test('recurses into nested objects and arrays', () => {
    expect(canonical({ x: { b: 1, a: 2 }, y: [3, { d: 4, c: 5 }] }))
      .toBe(canonical({ y: [3, { c: 5, d: 4 }], x: { a: 2, b: 1 } }));
  });
});

describe('computeHash', () => {
  const fields = {
    eventId: 'e1', eventType: 'T', payload: { n: 1 },
    aggregateId: 'agg', occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  test('is a 64-char hex string, deterministic for the same input', () => {
    const h1 = computeHash(fields, GENESIS);
    const h2 = computeHash({ ...fields }, GENESIS);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
  });
  test('changes if any content field or prevHash changes', () => {
    const base = computeHash(fields, GENESIS);
    expect(computeHash({ ...fields, payload: { n: 2 } }, GENESIS)).not.toBe(base);
    expect(computeHash(fields, 'other')).not.toBe(base);
  });
  test('key order in payload does not change the hash', () => {
    expect(computeHash({ ...fields, payload: { a: 1, b: 2 } }, GENESIS))
      .toBe(computeHash({ ...fields, payload: { b: 2, a: 1 } }, GENESIS));
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm test -- auditHash`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`backend/modules/audit/auditHash.js`:
```js
// modules/audit/auditHash.js
// Pure hashing for the audit-trail chain. No DB. Node built-in crypto only.
const crypto = require('crypto');

const GENESIS = 'GENESIS';

// Deterministic serialization: JSON with recursively sorted keys, so identical
// content always hashes identically regardless of key insertion order.
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
}

// hash = sha256( canonical(content) + '|' + prevHash ). The auto id is NOT hashed.
function computeHash({ eventId, eventType, payload, aggregateId, occurredAt }, prevHash) {
  const content = canonical({
    eventId,
    eventType,
    payload,
    aggregateId: aggregateId ?? null,
    occurredAt: occurredAt instanceof Date ? occurredAt.toISOString() : occurredAt,
  });
  return crypto.createHash('sha256').update(content + '|' + prevHash).digest('hex');
}

module.exports = { GENESIS, canonical, computeHash };
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- auditHash`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/modules/audit/auditHash.js backend/tests/auditHash.test.js
git commit -m "feat(audit): pure hash-chain hashing (canonical + computeHash)"
```

---

### Task 2: AuditLog model

**Files:**
- Create: `backend/modules/audit/auditLog.entity.js`
- Create: `backend/modules/audit/auditLog.model.js`
- Modify: `backend/models/index.js`
- Test: `backend/tests/integration/auditLog.integration.test.js`

**Interfaces:**
- Produces: `AuditLog` model exported from `models/index.js`. Columns: `id` (BIGINT PK autoincrement), `eventId`/`event_id` (UUID unique not null), `eventType`/`event_type` (string), `payload` (JSONB), `aggregateId`/`aggregate_id` (UUID nullable), `occurredAt`/`occurred_at` (date), `prevHash`/`prev_hash` (CHAR(64) nullable), `hash` (CHAR(64) not null), `createdAt`/`created_at`.

- [ ] **Step 1: Create the entity**

`backend/modules/audit/auditLog.entity.js`:
```js
// modules/audit/auditLog.entity.js
const { DataTypes, Model } = require('sequelize');

class AuditLog extends Model {}

function initAuditLog(sequelize) {
  AuditLog.init({
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    eventId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'event_id' },
    eventType: { type: DataTypes.STRING, allowNull: false, field: 'event_type' },
    payload: { type: DataTypes.JSONB, allowNull: false },
    aggregateId: { type: DataTypes.UUID, allowNull: true, field: 'aggregate_id' },
    occurredAt: { type: DataTypes.DATE, allowNull: false, field: 'occurred_at' },
    prevHash: { type: DataTypes.CHAR(64), allowNull: true, field: 'prev_hash' },
    hash: { type: DataTypes.CHAR(64), allowNull: false },
  }, {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_log',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['event_type'] },
      { fields: ['aggregate_id'] },
    ],
  });
  return AuditLog;
}

module.exports = initAuditLog;
```

- [ ] **Step 2: Create the factory**

`backend/modules/audit/auditLog.model.js`:
```js
// modules/audit/auditLog.model.js
const initAuditLog = require('./auditLog.entity');

function createAuditLogModel(sequelize) {
  return initAuditLog(sequelize);
}

module.exports = createAuditLogModel;
```

- [ ] **Step 3: Register in models/index.js**

Add the require near the other model requires (after `const outboxEventModel = require('../modules/events/outbox.model');`):
```js
const auditLogModel = require('../modules/audit/auditLog.model');
```
Add the instantiation after `const OutboxEvent = outboxEventModel(sequelize);`:
```js
const AuditLog = auditLogModel(sequelize);
```
Add to the `module.exports` object (after `OutboxEvent,`):
```js
  AuditLog,
```

- [ ] **Step 4: Write the failing integration test**

`backend/tests/integration/auditLog.integration.test.js`:
```js
const { sequelize, AuditLog } = require('../../models');

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

describe('AuditLog model', () => {
  test('persists a row with an auto-increment id and the expected fields', async () => {
    const row = await AuditLog.create({
      eventId: '11111111-1111-1111-1111-111111111111',
      eventType: 'TestEvent',
      payload: { a: 1 },
      aggregateId: null,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      prevHash: null,
      hash: 'a'.repeat(64),
    });
    expect(Number(row.id)).toBeGreaterThan(0);
    expect(row.eventType).toBe('TestEvent');
    expect(row.payload).toEqual({ a: 1 });
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  test('rejects a duplicate event_id (unique)', async () => {
    const base = {
      eventId: '22222222-2222-2222-2222-222222222222',
      eventType: 'T', payload: {}, occurredAt: new Date(), prevHash: null, hash: 'b'.repeat(64),
    };
    await AuditLog.create(base);
    await expect(AuditLog.create({ ...base, hash: 'c'.repeat(64) })).rejects.toThrow();
  });
});
```

- [ ] **Step 5: Run it — expect PASS**

Run: `npm run test:integration -- auditLog`
Expected: PASS (table syncs; unique event_id rejects the duplicate). Start the DB first with `npm run test:integration:up` if needed.

- [ ] **Step 6: Commit**
```bash
git add backend/modules/audit/auditLog.entity.js backend/modules/audit/auditLog.model.js backend/models/index.js backend/tests/integration/auditLog.integration.test.js
git commit -m "feat(audit): AuditLog model (immutable hash-chained record)"
```

---

### Task 3: eventBus.onAny (wildcard subscription)

**Files:**
- Modify: `backend/modules/events/eventBus.js`
- Modify: `backend/tests/eventBus.test.js`

**Interfaces:**
- Consumes: existing `eventBus.on(type, name, fn)`, `dispatch(event)`, `_reset()`.
- Produces: `eventBus.onAny(name, fn)` — subscribe to ALL events. `dispatch(event)` now runs any-handlers FIRST, then per-type handlers. `_reset()` clears both.

- [ ] **Step 1: Add the failing unit tests**

Append to `backend/tests/eventBus.test.js` (inside the existing `describe('eventBus', ...)`):
```js
  test('onAny handlers run for every event type', async () => {
    const seen = [];
    eventBus.onAny('audit', async (e) => seen.push(e.type));
    await eventBus.dispatch({ type: 'A', payload: 1 });
    await eventBus.dispatch({ type: 'Z', payload: 2 });
    expect(seen).toEqual(['A', 'Z']);
  });

  test('onAny handlers run BEFORE per-type handlers', async () => {
    const order = [];
    eventBus.on('A', 'typed', async () => order.push('typed'));
    eventBus.onAny('any', async () => order.push('any'));
    await eventBus.dispatch({ type: 'A', payload: 1 });
    expect(order).toEqual(['any', 'typed']);
  });

  test('a throwing onAny handler propagates', async () => {
    eventBus.onAny('boom', async () => { throw new Error('fail'); });
    await expect(eventBus.dispatch({ type: 'A', payload: 1 })).rejects.toThrow('fail');
  });
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm test -- eventBus`
Expected: FAIL (`onAny is not a function`).

- [ ] **Step 3: Implement onAny + dispatch order**

Replace the body of `backend/modules/events/eventBus.js` with:
```js
// modules/events/eventBus.js
// In-process domain-event registry. Handlers subscribe by type via on(); onAny()
// subscribes to every event (used by the audit trail). The outbox publisher calls
// dispatch(). Durability lives in the outbox table, not here.
const handlers = new Map(); // type -> [{ name, fn }]
const anyHandlers = [];      // [{ name, fn }] — run for every event

function on(type, name, fn) {
  if (!handlers.has(type)) handlers.set(type, []);
  handlers.get(type).push({ name, fn });
}

function onAny(name, fn) {
  anyHandlers.push({ name, fn });
}

async function dispatch(event) {
  // any-handlers first (e.g. audit records the event before any type handler can
  // abort dispatch), then per-type handlers. A throw propagates so the publisher
  // retries the whole event.
  for (const { fn } of anyHandlers) {
    await fn(event);
  }
  const list = handlers.get(event.type) || [];
  for (const { fn } of list) {
    await fn(event);
  }
}

function _reset() { handlers.clear(); anyHandlers.length = 0; }

module.exports = { on, onAny, dispatch, _reset };
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- eventBus`
Expected: PASS (all existing + 3 new tests).

- [ ] **Step 5: Commit**
```bash
git add backend/modules/events/eventBus.js backend/tests/eventBus.test.js
git commit -m "feat(events): eventBus.onAny wildcard subscription (any-handlers first)"
```

---

### Task 4: auditConsumer

**Files:**
- Create: `backend/modules/audit/auditConsumer.js`
- Test: `backend/tests/integration/auditConsumer.integration.test.js`

**Interfaces:**
- Consumes: `AuditLog` (Task 2), `GENESIS`/`computeHash` (Task 1).
- Produces: `auditConsumer(event) → Promise<AuditLog>` (writes one chained row; idempotent by `event.id`; reads the current head for `prevHash`; `occurredAt = event.createdAt`). `register(eventBus)` subscribes it via `eventBus.onAny('audit', auditConsumer)`. The `event` is an OutboxEvent-shaped object with `id`, `type`, `payload`, `aggregateId`, `createdAt`.

- [ ] **Step 1: Implement the consumer**

`backend/modules/audit/auditConsumer.js`:
```js
// modules/audit/auditConsumer.js
// Records every domain event as an immutable, hash-chained audit_log row.
// Subscribed to ALL events via eventBus.onAny. Idempotent by event id.
const { GENESIS, computeHash } = require('./auditHash');

async function auditConsumer(event) {
  const { AuditLog } = require('../../models'); // lazy-require to avoid a cycle

  const existing = await AuditLog.findOne({ where: { eventId: event.id } });
  if (existing) return existing; // at-least-once redelivery → no-op

  const head = await AuditLog.findOne({ order: [['id', 'DESC']] });
  const prevHash = head ? head.hash : GENESIS;

  const fields = {
    eventId: event.id,
    eventType: event.type,
    payload: event.payload,
    aggregateId: event.aggregateId ?? null,
    occurredAt: event.createdAt,
  };
  const hash = computeHash(fields, prevHash);

  return AuditLog.create({ ...fields, prevHash, hash });
}

function register(eventBus) {
  eventBus.onAny('audit', auditConsumer);
}

module.exports = { auditConsumer, register };
```

- [ ] **Step 2: Write the failing integration test**

`backend/tests/integration/auditConsumer.integration.test.js`:
```js
const { sequelize, AuditLog } = require('../../models');
const { auditConsumer } = require('../../modules/audit/auditConsumer');
const { GENESIS, computeHash } = require('../../modules/audit/auditHash');

const ev = (over = {}) => ({
  id: '33333333-3333-3333-3333-333333333333',
  type: 'P2PTransactionCompleted',
  payload: { buyerId: 'b', sellerId: 's' },
  aggregateId: 'agg-1',
  createdAt: new Date('2026-02-02T00:00:00.000Z'),
  ...over,
});

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterEach(async () => { await AuditLog.destroy({ where: {}, truncate: true, restartIdentity: true }); });
afterAll(async () => { await sequelize.close(); });

describe('auditConsumer', () => {
  test('writes a chained row whose hash matches the content', async () => {
    const row = await auditConsumer(ev());
    expect(row.prevHash).toBe(GENESIS);
    expect(row.hash).toBe(computeHash(
      { eventId: ev().id, eventType: ev().type, payload: ev().payload, aggregateId: ev().aggregateId, occurredAt: ev().createdAt },
      GENESIS,
    ));
  });

  test('is idempotent: same event id twice → one row', async () => {
    await auditConsumer(ev());
    await auditConsumer(ev());
    const rows = await AuditLog.findAll();
    expect(rows).toHaveLength(1);
  });

  test('links the chain: row2.prevHash === row1.hash', async () => {
    const r1 = await auditConsumer(ev({ id: '44444444-4444-4444-4444-444444444444' }));
    const r2 = await auditConsumer(ev({ id: '55555555-5555-5555-5555-555555555555' }));
    expect(r2.prevHash).toBe(r1.hash);
  });
});
```

- [ ] **Step 3: Run it — expect PASS**

Run: `npm run test:integration -- auditConsumer`
Expected: PASS (chained write, idempotency, chain linkage). The hash-match assertion also proves the `occurredAt` Date round-trips consistently.

- [ ] **Step 4: Commit**
```bash
git add backend/modules/audit/auditConsumer.js backend/tests/integration/auditConsumer.integration.test.js
git commit -m "feat(audit): auditConsumer writes idempotent hash-chained rows"
```

---

### Task 5: verifyAuditChain + script

**Files:**
- Create: `backend/modules/audit/verifyAuditChain.js`
- Create: `backend/scripts/verifyAuditChain.js`
- Test: `backend/tests/verifyAuditChain.test.js`
- Test: `backend/tests/integration/verifyAuditChain.integration.test.js`

**Interfaces:**
- Consumes: `GENESIS`/`computeHash` (Task 1), `AuditLog` (Task 2).
- Produces: `verifyRows(rows) → { ok, brokenAtSeq, checked }` (pure; rows are objects with `id, eventId, eventType, payload, aggregateId, occurredAt, prevHash, hash`, ordered by `id` ASC). `verifyAuditChain() → Promise<same>` (fetches rows ordered by `id` ASC, calls `verifyRows`).

- [ ] **Step 1: Write the failing unit test for verifyRows**

`backend/tests/verifyAuditChain.test.js`:
```js
const { GENESIS, computeHash } = require('../modules/audit/auditHash');
const { verifyRows } = require('../modules/audit/verifyAuditChain');

function chained(events) {
  let prevHash = GENESIS;
  return events.map((e, i) => {
    const fields = { eventId: e.eventId, eventType: e.eventType, payload: e.payload, aggregateId: e.aggregateId ?? null, occurredAt: e.occurredAt };
    const hash = computeHash(fields, prevHash);
    const row = { id: i + 1, ...fields, prevHash, hash };
    prevHash = hash;
    return row;
  });
}

const base = [
  { eventId: 'e1', eventType: 'T', payload: { n: 1 }, occurredAt: '2026-01-01T00:00:00.000Z' },
  { eventId: 'e2', eventType: 'T', payload: { n: 2 }, occurredAt: '2026-01-02T00:00:00.000Z' },
  { eventId: 'e3', eventType: 'T', payload: { n: 3 }, occurredAt: '2026-01-03T00:00:00.000Z' },
];

describe('verifyRows', () => {
  test('a valid chain verifies', () => {
    expect(verifyRows(chained(base))).toEqual({ ok: true, brokenAtSeq: null, checked: 3 });
  });
  test('an altered payload is detected at that row', () => {
    const rows = chained(base);
    rows[1].payload = { n: 999 }; // tamper: hash no longer matches content
    expect(verifyRows(rows)).toEqual({ ok: false, brokenAtSeq: 2, checked: 3 });
  });
  test('a deleted middle row breaks the prevHash link', () => {
    const rows = chained(base);
    rows.splice(1, 1); // remove row 2 → row 3's prevHash no longer matches row 1's hash
    expect(verifyRows(rows)).toEqual({ ok: false, brokenAtSeq: 3, checked: 2 });
  });
  test('an empty chain verifies', () => {
    expect(verifyRows([])).toEqual({ ok: true, brokenAtSeq: null, checked: 0 });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm test -- verifyAuditChain`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`backend/modules/audit/verifyAuditChain.js`:
```js
// modules/audit/verifyAuditChain.js
// Recomputes the audit hash-chain to detect tampering (edited/deleted rows).
const { GENESIS, computeHash } = require('./auditHash');

// Pure: rows are audit_log rows ordered by id ASC.
function verifyRows(rows) {
  let prevHash = GENESIS;
  for (const row of rows) {
    if (row.prevHash !== prevHash) {
      return { ok: false, brokenAtSeq: Number(row.id), checked: rows.length };
    }
    const recomputed = computeHash({
      eventId: row.eventId,
      eventType: row.eventType,
      payload: row.payload,
      aggregateId: row.aggregateId,
      occurredAt: row.occurredAt,
    }, row.prevHash);
    if (recomputed !== row.hash) {
      return { ok: false, brokenAtSeq: Number(row.id), checked: rows.length };
    }
    prevHash = row.hash;
  }
  return { ok: true, brokenAtSeq: null, checked: rows.length };
}

async function verifyAuditChain() {
  const { AuditLog } = require('../../models');
  const rows = await AuditLog.findAll({ order: [['id', 'ASC']] });
  return verifyRows(rows);
}

module.exports = { verifyRows, verifyAuditChain };
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- verifyAuditChain`
Expected: PASS.

- [ ] **Step 5: Create the manual runner script**

`backend/scripts/verifyAuditChain.js`:
```js
// scripts/verifyAuditChain.js — manual audit-chain integrity check.
// Usage: node scripts/verifyAuditChain.js  (exit 0 = intact, 1 = broken)
const { sequelize } = require('../models');
const { verifyAuditChain } = require('../modules/audit/verifyAuditChain');

(async () => {
  try {
    await sequelize.authenticate();
    const result = await verifyAuditChain();
    if (result.ok) {
      console.log(`✅ Audit chain intact (${result.checked} records).`);
    } else {
      console.error(`❌ Audit chain BROKEN at seq ${result.brokenAtSeq} (${result.checked} records checked).`);
    }
    await sequelize.close();
    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    console.error('❌ Audit chain verification failed to run:', error.message);
    process.exit(2);
  }
})();
```

- [ ] **Step 6: Write the failing integration test (real tamper detection)**

`backend/tests/integration/verifyAuditChain.integration.test.js`:
```js
const { sequelize, AuditLog } = require('../../models');
const { auditConsumer } = require('../../modules/audit/auditConsumer');
const { verifyAuditChain } = require('../../modules/audit/verifyAuditChain');

const ev = (id, n) => ({ id, type: 'T', payload: { n }, aggregateId: null, createdAt: new Date(`2026-03-0${n}T00:00:00.000Z`) });

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

describe('verifyAuditChain (DB)', () => {
  test('an intact chain verifies, a tampered payload is detected', async () => {
    await auditConsumer(ev('66666666-6666-6666-6666-666666666666', 1));
    const r2 = await auditConsumer(ev('77777777-7777-7777-7777-777777777777', 2));
    await auditConsumer(ev('88888888-8888-8888-8888-888888888888', 3));

    expect(await verifyAuditChain()).toEqual({ ok: true, brokenAtSeq: null, checked: 3 });

    // Tamper: edit a historical payload directly (bypassing the model).
    await sequelize.query(
      `UPDATE audit_log SET payload = '{"n": 999}' WHERE id = :id`,
      { replacements: { id: Number(r2.id) } },
    );

    const result = await verifyAuditChain();
    expect(result.ok).toBe(false);
    expect(result.brokenAtSeq).toBe(Number(r2.id));
  });
});
```

- [ ] **Step 7: Run it — expect PASS**

Run: `npm run test:integration -- verifyAuditChain`
Expected: PASS (intact chain OK; the raw UPDATE is detected at the tampered row's id).

- [ ] **Step 8: Commit**
```bash
git add backend/modules/audit/verifyAuditChain.js backend/scripts/verifyAuditChain.js backend/tests/verifyAuditChain.test.js backend/tests/integration/verifyAuditChain.integration.test.js
git commit -m "feat(audit): chain verification (verifyRows + verifyAuditChain + script)"
```

---

### Task 6: Register the consumer + end-to-end

**Files:**
- Modify: `backend/modules/events/registerHandlers.js`
- Test: `backend/tests/integration/auditTrailEndToEnd.integration.test.js`

**Interfaces:**
- Consumes: `auditConsumer.register` (Task 4), the outbox publisher + `emitEvent` + notification handler (slice 1).
- Produces: `registerAllHandlers()` also wires the audit consumer via `eventBus.onAny`.

- [ ] **Step 1: Wire the audit consumer into registerAllHandlers**

In `backend/modules/events/registerHandlers.js`, add the require beside the notification handler require:
```js
const auditHandlers = require('../audit/auditConsumer');
```
And inside `registerAllHandlers()` (after the existing `notificationHandlers.register(eventBus);` line, still guarded by the existing `wired` idempotency flag):
```js
  auditHandlers.register(eventBus);
```

- [ ] **Step 2: Write the failing end-to-end integration test**

`backend/tests/integration/auditTrailEndToEnd.integration.test.js`:
```js
const { sequelize, OutboxEvent, AuditLog, Notification } = require('../../models');
const { emitEvent } = require('../../modules/events/emitEvent');
const { registerAllHandlers } = require('../../modules/events/registerHandlers');
const { verifyAuditChain } = require('../../modules/audit/verifyAuditChain');
const publisherJob = require('../../jobs/outboxPublisher.job');
const f = require('../helpers/factories');

beforeAll(async () => { await sequelize.sync({ force: true }); registerAllHandlers(); });
afterAll(async () => { await sequelize.close(); });

describe('audit trail end-to-end (publisher → audit + notifications)', () => {
  test('a dispatched event is audited (chained) AND still notifies both parties', async () => {
    const buyer = await f.seedUser();
    const seller = await f.seedUser();
    const evt = await emitEvent('P2PTransactionCompleted', {
      buyerId: buyer.id, sellerId: seller.id,
      transaction: { id: '99999999-9999-9999-9999-999999999999', amount: '1', cryptoSymbol: 'BTC', fiatAmount: '100', fiatCurrency: 'USD' },
    }, { aggregateId: '99999999-9999-9999-9999-999999999999' });

    await publisherJob.run();

    // audited
    const audit = await AuditLog.findAll({ where: { eventId: evt.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0].eventType).toBe('P2PTransactionCompleted');
    expect((await verifyAuditChain()).ok).toBe(true);

    // notified (slice 1 still works — both any-handler and type handler ran)
    const notifs = await Notification.findAll({ where: { sourceEventId: evt.id } });
    expect(notifs).toHaveLength(2);

    // outbox row dispatched
    expect((await OutboxEvent.findByPk(evt.id)).status).toBe('dispatched');
  });
});
```
> Note: use the real user factory in `tests/helpers/factories.js` (`seedUser` if present; otherwise seed inline with `User.create({ email, username, passwordHash, country, role })`, username ≥3 chars, mirroring `notificationIdempotency.integration.test.js`). Check the factory first.

- [ ] **Step 3: Run it — expect PASS**

Run: `npm run test:integration -- auditTrailEndToEnd`
Expected: PASS (event audited + chain OK + 2 notifications + outbox dispatched).

- [ ] **Step 4: Full verification**

Run `npm test` (full unit, expect green) and `npm run test:integration` (full integration, expect green). Then both coverage floors: `npm run test:coverage` and `npm run test:integration:coverage` — expect exit 0.

- [ ] **Step 5: Commit**
```bash
git add backend/modules/events/registerHandlers.js backend/tests/integration/auditTrailEndToEnd.integration.test.js
git commit -m "feat(audit): register audit consumer + end-to-end (publisher audits every event)"
```

---

## Self-review notes

- **Spec coverage:** audit_log table (T2), hash chain (T1 hashing, T4 write, T2 columns), onAny + any-first dispatch (T3), idempotent consumer (T4), verification + script (T5), registration + end-to-end incl. "notifications still work" (T6). No new emitters / no money-path changes (confirmed — no money-path file is touched).
- **Type consistency:** `computeHash(fields, prevHash)` and `GENESIS` consistent across T1/T4/T5; `verifyRows`/`verifyAuditChain` return `{ ok, brokenAtSeq, checked }` consistent across T5 uses; `AuditLog` field names consistent T2/T4/T5; `eventBus.onAny(name, fn)` consistent T3/T4.
- **Deferred (per spec):** new event emitters, periodic verification alarm, read API, multi-instance chain-write lock, retention/export.
