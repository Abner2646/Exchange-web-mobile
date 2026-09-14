# Transactional Outbox + Event Bus (Fase 6.2.1, first slice) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple side-effects from the money-path via a transactional outbox + in-process event bus, proven by migrating P2P transaction notifications off `p2pTransaction.model.js`.

**Architecture:** The money-path records domain events in an `outbox_events` table inside its own DB transaction (atomic with the state change). A polling worker (`outboxPublisher.job`) reads pending events and dispatches them through an in-process `eventBus` to subscribed handlers, with at-least-once delivery and idempotent handlers. The notification handler reacts to P2P events; the money-path no longer calls notifications directly.

**Tech Stack:** Node.js, Express, Sequelize (Postgres), Jest (unit + integration). No new runtime dependencies (in-process bus; broker deferred to Fase 5).

**Spec:** `docs/superpowers/specs/2026-09-13-event-driven-outbox-design.md`

## Global Constraints

- **Atomic emission:** `emitEvent` is ALWAYS called with the money-path's own Sequelize `transaction`; event + state change commit or roll back together.
- **At-least-once + idempotent handlers:** the publisher marks `dispatched` only after handlers succeed; handlers must tolerate re-delivery of the same `event.id` without duplicating side-effects.
- **Persisted-value & conventions:** backend code lives under `backend/modules/<domain>/`; identifiers English, DB columns snake_case; new modules are in the coverage denominator via the existing `modules/**` glob in `jest.config.js`.
- **No new runtime deps.** In-process only.
- **Env (all with a positive-number clamp → default):** `OUTBOX_PUBLISHER_INTERVAL_MS` (default 2000), `OUTBOX_MAX_ATTEMPTS` (default 10), `OUTBOX_BATCH_SIZE` (default 100), `OUTBOX_BASE_BACKOFF_MS` (default 5000).
- **Commits:** Conventional, English, direct to `dev`. Integration tests need the test DB up (`npm run test:integration:up`; on Windows use `DB_PORT=15432` if WinNAT blocks 55432).

## File Structure

**Create:**
- `backend/modules/events/outbox.entity.js` — `OutboxEvent` Sequelize entity (columns/indexes).
- `backend/modules/events/outbox.model.js` — model factory `createOutboxEventModel(sequelize)`.
- `backend/modules/events/emitEvent.js` — `emitEvent(type, payload, { transaction, aggregateId })`.
- `backend/modules/events/eventBus.js` — in-process registry: `on(type, name, fn)`, `dispatch(event)`, `_reset()`.
- `backend/modules/events/outboxPublisher.js` — pure core: `computeRetry(event, error, opts)`, `publishBatch({...})`.
- `backend/jobs/outboxPublisher.job.js` — the worker (wires real deps, JobManager-registered).
- `backend/modules/notifications/notificationEventHandlers.js` — P2P notification handler + `register(eventBus)`.
- `backend/modules/events/registerHandlers.js` — `registerAllHandlers()` (bootstrap wiring).
- Tests under `backend/tests/` (unit) and `backend/tests/integration/` (DB).

**Modify:**
- `backend/models/index.js` — require + instantiate + export `OutboxEvent`.
- `backend/modules/notifications/notification.entity.js` — add `sourceEventId` column + unique index `(source_event_id, user_id)`.
- `backend/modules/notifications/notification.model.js` — `createNotification`/`notifyBothParties` accept `sourceEventId` + dedupe.
- `backend/modules/p2p/p2pTransaction.model.js` — replace 4 inline `notifyBothParties` calls with `emitEvent`.
- `backend/jobs/index.js` — register `outboxPublisher` in `JobManager`.
- `backend/server.js` — call `registerAllHandlers()` before `JobManager.startAll()`.

---

### Task 1: OutboxEvent model

**Files:**
- Create: `backend/modules/events/outbox.entity.js`
- Create: `backend/modules/events/outbox.model.js`
- Modify: `backend/models/index.js`
- Test: `backend/tests/integration/outboxEvent.integration.test.js`

**Interfaces:**
- Produces: `OutboxEvent` Sequelize model exported from `models/index.js`. Columns: `id` (UUID PK), `type` (string), `payload` (JSONB), `aggregateId`/`aggregate_id` (UUID nullable), `status` (enum `pending|dispatched|failed`, default `pending`), `attempts` (int, default 0), `availableAt`/`available_at` (date, default NOW), `lastError`/`last_error` (text nullable), `createdAt`/`created_at`, `dispatchedAt`/`dispatched_at` (nullable).

- [ ] **Step 1: Create the entity**

`backend/modules/events/outbox.entity.js`:
```js
// modules/events/outbox.entity.js
const { DataTypes, Model } = require('sequelize');

class OutboxEvent extends Model {}

function initOutboxEvent(sequelize) {
  OutboxEvent.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    type: { type: DataTypes.STRING, allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false },
    aggregateId: { type: DataTypes.UUID, allowNull: true, field: 'aggregate_id' },
    status: {
      type: DataTypes.ENUM('pending', 'dispatched', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    availableAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'available_at' },
    lastError: { type: DataTypes.TEXT, allowNull: true, field: 'last_error' },
    dispatchedAt: { type: DataTypes.DATE, allowNull: true, field: 'dispatched_at' },
  }, {
    sequelize,
    modelName: 'OutboxEvent',
    tableName: 'outbox_events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['status', 'available_at'] },
      { fields: ['created_at'] },
    ],
  });
  return OutboxEvent;
}

module.exports = initOutboxEvent;
```

- [ ] **Step 2: Create the model factory**

`backend/modules/events/outbox.model.js`:
```js
// modules/events/outbox.model.js
const initOutboxEvent = require('./outbox.entity');

function createOutboxEventModel(sequelize) {
  return initOutboxEvent(sequelize);
}

module.exports = createOutboxEventModel;
```

- [ ] **Step 3: Register in models/index.js**

In `backend/models/index.js`, add the require alongside the other model requires (near line 31, after `idempotencyKeyModel`):
```js
const outboxEventModel = require('../modules/events/outbox.model');
```
Add the instantiation alongside the others (after `const IdempotencyKey = idempotencyKeyModel(sequelize);`):
```js
const OutboxEvent = outboxEventModel(sequelize);
```
Add to the `module.exports` object (after `IdempotencyKey,`):
```js
  OutboxEvent,
```

- [ ] **Step 4: Write the failing integration test**

`backend/tests/integration/outboxEvent.integration.test.js`:
```js
const { sequelize, OutboxEvent } = require('../../models');

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

describe('OutboxEvent model', () => {
  test('persists an event with the expected defaults', async () => {
    const ev = await OutboxEvent.create({ type: 'TestEvent', payload: { a: 1 }, aggregateId: null });
    expect(ev.status).toBe('pending');
    expect(ev.attempts).toBe(0);
    expect(ev.availableAt).toBeInstanceOf(Date);
    expect(ev.dispatchedAt).toBeNull();
    expect(ev.payload).toEqual({ a: 1 });
  });
});
```

- [ ] **Step 5: Run it — expect PASS**

Run: `npm run test:integration -- outboxEvent`
Expected: PASS (table syncs, defaults applied). If it fails on connect, run `npm run test:integration:up` first.

- [ ] **Step 6: Commit**
```bash
git add backend/modules/events/outbox.entity.js backend/modules/events/outbox.model.js backend/models/index.js backend/tests/integration/outboxEvent.integration.test.js
git commit -m "feat(events): OutboxEvent model (transactional outbox table)"
```

---

### Task 2: emitEvent helper

**Files:**
- Create: `backend/modules/events/emitEvent.js`
- Test: `backend/tests/integration/emitEvent.integration.test.js`

**Interfaces:**
- Consumes: `OutboxEvent` from `models/index.js` (Task 1).
- Produces: `emitEvent(type, payload, { transaction, aggregateId }) → Promise<OutboxEvent>`. Inserts a `pending` row using the given `transaction` (lazy-requires the model to avoid a require cycle).

- [ ] **Step 1: Create the helper**

`backend/modules/events/emitEvent.js`:
```js
// modules/events/emitEvent.js
// Records a domain event in the outbox WITHIN the caller's transaction, so the
// event and the state change commit atomically (transactional outbox). Lazy-
// requires models/index to avoid a require cycle (models → outbox model).
async function emitEvent(type, payload, { transaction, aggregateId = null } = {}) {
  const { OutboxEvent } = require('../../models');
  return OutboxEvent.create(
    { type, payload, aggregateId, status: 'pending', attempts: 0 },
    { transaction }
  );
}

module.exports = { emitEvent };
```

- [ ] **Step 2: Write the failing integration test (atomicity)**

`backend/tests/integration/emitEvent.integration.test.js`:
```js
const { sequelize, OutboxEvent } = require('../../models');
const { emitEvent } = require('../../modules/events/emitEvent');

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterEach(async () => { await OutboxEvent.destroy({ where: {} }); });
afterAll(async () => { await sequelize.close(); });

describe('emitEvent', () => {
  test('writes a pending row inside the given transaction', async () => {
    const t = await sequelize.transaction();
    await emitEvent('X', { n: 1 }, { transaction: t, aggregateId: null });
    await t.commit();
    const rows = await OutboxEvent.findAll({ where: { type: 'X' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].payload).toEqual({ n: 1 });
  });

  test('is atomic: nothing persists if the transaction rolls back', async () => {
    const t = await sequelize.transaction();
    await emitEvent('Y', { n: 2 }, { transaction: t });
    await t.rollback();
    const rows = await OutboxEvent.findAll({ where: { type: 'Y' } });
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run it — expect PASS**

Run: `npm run test:integration -- emitEvent`
Expected: PASS (both tests).

- [ ] **Step 4: Commit**
```bash
git add backend/modules/events/emitEvent.js backend/tests/integration/emitEvent.integration.test.js
git commit -m "feat(events): emitEvent helper (atomic outbox write in caller's tx)"
```

---

### Task 3: eventBus registry

**Files:**
- Create: `backend/modules/events/eventBus.js`
- Test: `backend/tests/eventBus.test.js`

**Interfaces:**
- Produces: `eventBus.on(type, name, fn)`, `eventBus.dispatch(event) → Promise<void>` (runs all handlers for `event.type` in registration order; a handler throw propagates), `eventBus._reset()` (test-only).

- [ ] **Step 1: Write the failing unit test**

`backend/tests/eventBus.test.js`:
```js
const eventBus = require('../modules/events/eventBus');

beforeEach(() => eventBus._reset());

describe('eventBus', () => {
  test('runs all handlers registered for the event type', async () => {
    const calls = [];
    eventBus.on('A', 'h1', async (e) => calls.push(['h1', e.payload]));
    eventBus.on('A', 'h2', async (e) => calls.push(['h2', e.payload]));
    await eventBus.dispatch({ type: 'A', payload: 1 });
    expect(calls).toEqual([['h1', 1], ['h2', 1]]);
  });

  test('unknown type is a no-op', async () => {
    await expect(eventBus.dispatch({ type: 'nope', payload: 1 })).resolves.toBeUndefined();
  });

  test('a throwing handler propagates (so the publisher can retry)', async () => {
    eventBus.on('B', 'boom', async () => { throw new Error('fail'); });
    await expect(eventBus.dispatch({ type: 'B', payload: 1 })).rejects.toThrow('fail');
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm test -- eventBus`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement eventBus**

`backend/modules/events/eventBus.js`:
```js
// modules/events/eventBus.js
// In-process domain-event registry. Handlers subscribe by event type; the outbox
// publisher calls dispatch(). Deliberately dumb — durability lives in the outbox
// table, not here.
const handlers = new Map(); // type -> [{ name, fn }]

function on(type, name, fn) {
  if (!handlers.has(type)) handlers.set(type, []);
  handlers.get(type).push({ name, fn });
}

async function dispatch(event) {
  const list = handlers.get(event.type) || [];
  for (const { fn } of list) {
    await fn(event); // a throw propagates so the publisher retries the whole event
  }
}

function _reset() { handlers.clear(); }

module.exports = { on, dispatch, _reset };
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- eventBus`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/modules/events/eventBus.js backend/tests/eventBus.test.js
git commit -m "feat(events): in-process eventBus registry"
```

---

### Task 4: outbox publisher (pure core + job)

**Files:**
- Create: `backend/modules/events/outboxPublisher.js`
- Create: `backend/jobs/outboxPublisher.job.js`
- Modify: `backend/jobs/index.js`
- Test: `backend/tests/outboxPublisher.test.js`

**Interfaces:**
- Consumes: `eventBus.dispatch` (Task 3), `OutboxEvent` (Task 1).
- Produces:
  - `computeRetry(event, error, { maxAttempts, baseBackoffMs, now }) → { status, attempts, lastError, availableAt? }`.
  - `publishBatch({ events, dispatch, markDispatched, markFailed, computeRetryState }) → { processed, ok, failed }`.
  - `jobs/outboxPublisher.job.js` singleton with `start()/stop()/run()/getStatus()`, registered in `JobManager` as `outboxPublisher`.

- [ ] **Step 1: Write the failing unit test for the pure core**

`backend/tests/outboxPublisher.test.js`:
```js
const { computeRetry, publishBatch } = require('../modules/events/outboxPublisher');

describe('computeRetry', () => {
  const opts = { maxAttempts: 3, baseBackoffMs: 1000, now: 0 };
  test('reschedules with exponential backoff below max attempts', () => {
    expect(computeRetry({ attempts: 0 }, new Error('e'), opts))
      .toEqual({ status: 'pending', attempts: 1, lastError: 'e', availableAt: new Date(1000) });
    expect(computeRetry({ attempts: 1 }, new Error('e'), opts).availableAt).toEqual(new Date(2000));
  });
  test('dead-letters at max attempts', () => {
    expect(computeRetry({ attempts: 2 }, new Error('boom'), opts))
      .toEqual({ status: 'failed', attempts: 3, lastError: 'boom' });
  });
});

describe('publishBatch', () => {
  test('dispatches, marks dispatched on success, and a poison event does not block the rest', async () => {
    const dispatched = [], failed = [];
    const events = [
      { id: '1', type: 'ok' },
      { id: '2', type: 'boom', attempts: 0 },
      { id: '3', type: 'ok' },
    ];
    const res = await publishBatch({
      events,
      dispatch: async (e) => { if (e.type === 'boom') throw new Error('x'); },
      markDispatched: async (e) => dispatched.push(e.id),
      markFailed: async (e) => failed.push(e.id),
      computeRetryState: () => ({ status: 'pending' }),
    });
    expect(dispatched).toEqual(['1', '3']);
    expect(failed).toEqual(['2']);
    expect(res).toEqual({ processed: 3, ok: 2, failed: 1 });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm test -- outboxPublisher`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the pure core**

`backend/modules/events/outboxPublisher.js`:
```js
// modules/events/outboxPublisher.js
// Pure retry/backoff decision + batch orchestration. No DB/bus deps — everything
// is injected, so it unit-tests without a database.

function computeRetry(event, error, { maxAttempts, baseBackoffMs, now }) {
  const attempts = event.attempts + 1;
  if (attempts >= maxAttempts) {
    return { status: 'failed', attempts, lastError: error.message };
  }
  const backoff = baseBackoffMs * 2 ** (attempts - 1);
  return { status: 'pending', attempts, lastError: error.message, availableAt: new Date(now + backoff) };
}

async function publishBatch({ events, dispatch, markDispatched, markFailed, computeRetryState }) {
  let ok = 0, failed = 0;
  for (const event of events) {
    try {
      await dispatch(event);
      await markDispatched(event);
      ok++;
    } catch (error) {
      await markFailed(event, computeRetryState(event, error));
      failed++;
    }
  }
  return { processed: events.length, ok, failed };
}

module.exports = { computeRetry, publishBatch };
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- outboxPublisher`
Expected: PASS.

- [ ] **Step 5: Implement the job (wires real deps)**

`backend/jobs/outboxPublisher.job.js`:
```js
// Outbox publisher (Fase 6.2.1): polls pending outbox events and dispatches them
// through the eventBus with at-least-once delivery + backoff. Decision logic lives
// in modules/events/outboxPublisher (unit-tested); here only scheduling + I/O.
const { Op } = require('sequelize');
const { OutboxEvent } = require('../models');
const eventBus = require('../modules/events/eventBus');
const { computeRetry, publishBatch } = require('../modules/events/outboxPublisher');

const n = (v, d) => (Number(v) > 0 ? Number(v) : d);
const FREQUENCY_MS = n(process.env.OUTBOX_PUBLISHER_INTERVAL_MS, 2000);
const MAX_ATTEMPTS = n(process.env.OUTBOX_MAX_ATTEMPTS, 10);
const BATCH_SIZE = n(process.env.OUTBOX_BATCH_SIZE, 100);
const BASE_BACKOFF_MS = n(process.env.OUTBOX_BASE_BACKOFF_MS, 5000);

class OutboxPublisherJob {
  constructor() { this.interval = null; this.isRunning = false; this.publishing = false; this.lastRunAt = null; }

  start() {
    if (this.isRunning) return;
    this.run();
    this.interval = setInterval(() => this.run(), FREQUENCY_MS);
    this.isRunning = true;
    console.log('✅ Outbox Publisher Job started');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
  }

  async run() {
    if (this.publishing) return; // reentrancy guard
    this.publishing = true;
    try {
      const events = await OutboxEvent.findAll({
        where: { status: 'pending', availableAt: { [Op.lte]: new Date() } },
        order: [['created_at', 'ASC']],
        limit: BATCH_SIZE,
      });
      await publishBatch({
        events,
        dispatch: (ev) => eventBus.dispatch(ev),
        markDispatched: (ev) => ev.update({ status: 'dispatched', dispatchedAt: new Date() }),
        markFailed: (ev, next) => {
          if (next.status === 'failed') {
            console.error(`❌ Outbox event ${ev.id} (${ev.type}) dead-lettered after ${next.attempts} attempts: ${next.lastError}`);
          }
          return ev.update(next);
        },
        computeRetryState: (ev, err) => computeRetry(ev, err, { maxAttempts: MAX_ATTEMPTS, baseBackoffMs: BASE_BACKOFF_MS, now: Date.now() }),
      });
      this.lastRunAt = new Date();
    } catch (error) {
      console.error('❌ Outbox Publisher Job error:', error.message);
    } finally {
      this.publishing = false;
    }
  }

  getStatus() { return { isRunning: this.isRunning, frequencyMs: FREQUENCY_MS, lastRunAt: this.lastRunAt }; }
}

module.exports = new OutboxPublisherJob();
```

- [ ] **Step 6: Register the job in JobManager**

In `backend/jobs/index.js`, add the require near the other job requires (after `reconciliationJob`):
```js
const outboxPublisherJob = require('./outboxPublisher.job');
```
Add it to `this.jobs` in the constructor object:
```js
      outboxPublisher: outboxPublisherJob,
```
In `startAll()`, add (mirroring the `reconciliation` block):
```js
    if (this.jobs.outboxPublisher && typeof this.jobs.outboxPublisher.start === 'function') {
      this.jobs.outboxPublisher.start();
    }
```

- [ ] **Step 7: Run the unit suite to confirm nothing broke**

Run: `npm test -- outboxPublisher`
Expected: PASS. (Job wiring is exercised end-to-end in Task 7.)

- [ ] **Step 8: Commit**
```bash
git add backend/modules/events/outboxPublisher.js backend/jobs/outboxPublisher.job.js backend/jobs/index.js backend/tests/outboxPublisher.test.js
git commit -m "feat(events): outbox publisher core + worker job"
```

---

### Task 5: Notification idempotency (source_event_id)

**Files:**
- Modify: `backend/modules/notifications/notification.entity.js`
- Modify: `backend/modules/notifications/notification.model.js`
- Test: `backend/tests/integration/notificationIdempotency.integration.test.js`

**Interfaces:**
- Produces: notification rows carry `sourceEventId`/`source_event_id` (UUID nullable) with unique `(source_event_id, user_id)`. `createNotification(data)` accepts optional `data.sourceEventId` and dedupes per `(sourceEventId, userId)` via `findOrCreate`. `notifyBothParties(buyerId, sellerId, transaccionData, status, { sourceEventId } = {})` forwards `sourceEventId` to both notifications.

- [ ] **Step 1: Add the column + index to the entity**

In `backend/modules/notifications/notification.entity.js`, add to the attributes (after `sentAt`):
```js
    sourceEventId: { type: DataTypes.UUID, allowNull: true, field: 'source_event_id' },
```
And add to the `indexes` array:
```js
      { unique: true, fields: ['source_event_id', 'user_id'] },
```
(Postgres treats NULLs as distinct, so notifications without a source event never collide.)

- [ ] **Step 2: Thread sourceEventId through createNotification**

In `backend/modules/notifications/notification.model.js`, in `createNotification`, add `sourceEventId` to the destructure and to `finalData`, and dedupe when present. Replace the final lines of `createNotification` (`finalData.sentAt = new Date();` … `return await Notification.create(finalData, options);`) with:
```js
    finalData.sentAt = new Date();

    if (data.sourceEventId) {
      finalData.sourceEventId = data.sourceEventId;
      const [notification] = await Notification.findOrCreate({
        where: { sourceEventId: data.sourceEventId, userId: finalData.userId },
        defaults: finalData,
        transaction: options?.transaction,
      });
      return notification;
    }

    return await Notification.create(finalData, options);
```

- [ ] **Step 3: Forward sourceEventId from notifyBothParties**

In `backend/modules/notifications/notification.model.js`, change the `notifyBothParties` signature to accept options and forward `sourceEventId` to both `createNotification` calls:
```js
  Notification.notifyBothParties = async (buyerId, sellerId, transaccionData, status, { sourceEventId } = {}) => {
```
and in each of its two `createNotification({ ... })` calls add `sourceEventId,` to the object.

- [ ] **Step 4: Write the failing integration test**

`backend/tests/integration/notificationIdempotency.integration.test.js`:
```js
const { sequelize, Notification, User } = require('../../models');

let user;
beforeAll(async () => {
  await sequelize.sync({ force: true });
  user = await User.create({ email: 'a@b.co', username: 'u1', passwordHash: 'x', country: 'US', role: 'normal' });
});
afterAll(async () => { await sequelize.close(); });

describe('notification idempotency by sourceEventId', () => {
  test('same sourceEventId + user creates only one notification', async () => {
    const data = { userId: user.id, type: 'p2p', title: 't', message: 'm', sourceEventId: '11111111-1111-1111-1111-111111111111' };
    await Notification.createNotification(data);
    await Notification.createNotification(data); // redelivery
    const rows = await Notification.findAll({ where: { userId: user.id, sourceEventId: data.sourceEventId } });
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Run it — expect PASS**

Run: `npm run test:integration -- notificationIdempotency`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add backend/modules/notifications/notification.entity.js backend/modules/notifications/notification.model.js backend/tests/integration/notificationIdempotency.integration.test.js
git commit -m "feat(notifications): idempotency by sourceEventId (unique per user)"
```

---

### Task 6: Notification event handler + bootstrap registration

**Files:**
- Create: `backend/modules/notifications/notificationEventHandlers.js`
- Create: `backend/modules/events/registerHandlers.js`
- Modify: `backend/server.js`
- Test: `backend/tests/notificationEventHandlers.test.js`

**Interfaces:**
- Consumes: `Notification.notifyBothParties` (Task 5), `eventBus.on` (Task 3).
- Produces:
  - `handleP2PTransactionEvent(event)` — maps `event.type` → status and calls `notifyBothParties(..., { sourceEventId: event.id })`.
  - `notificationEventHandlers.register(eventBus)` — subscribes the handler to the 4 P2P types.
  - `registerHandlers.registerAllHandlers()` — wires all module handlers at bootstrap.
  - Event type → status map: `P2PTransactionCreated→initiated`, `P2PPaymentConfirmed→payment_confirmed`, `P2PTransactionCompleted→completed`, `P2PTransactionCancelled→cancelled`.

- [ ] **Step 1: Write the failing unit test**

`backend/tests/notificationEventHandlers.test.js`:
```js
jest.mock('../models', () => ({ Notification: { notifyBothParties: jest.fn() } }));
const { Notification } = require('../models');
const { handleP2PTransactionEvent } = require('../modules/notifications/notificationEventHandlers');

beforeEach(() => jest.clearAllMocks());

test('maps event type to status and forwards sourceEventId', async () => {
  await handleP2PTransactionEvent({
    id: 'evt-1',
    type: 'P2PTransactionCompleted',
    payload: {
      buyerId: 'b', sellerId: 's',
      transaction: { id: 'tx1', amount: '1', cryptoSymbol: 'BTC', fiatAmount: '100', fiatCurrency: 'USD' },
    },
  });
  expect(Notification.notifyBothParties).toHaveBeenCalledWith(
    'b', 's',
    expect.objectContaining({ id: 'tx1', amount: '1', crypto: { symbol: 'BTC' }, fiatAmount: '100', fiatCurrency: 'USD' }),
    'completed',
    { sourceEventId: 'evt-1' },
  );
});

test('unknown type is ignored', async () => {
  await handleP2PTransactionEvent({ id: 'e', type: 'Nope', payload: {} });
  expect(Notification.notifyBothParties).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npm test -- notificationEventHandlers`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the handler**

`backend/modules/notifications/notificationEventHandlers.js`:
```js
// modules/notifications/notificationEventHandlers.js
// Reacts to P2P domain events by sending the both-parties notification. Subscribed
// to the eventBus at bootstrap; the money-path no longer calls notifications.

const TYPE_TO_STATUS = {
  P2PTransactionCreated: 'initiated',
  P2PPaymentConfirmed: 'payment_confirmed',
  P2PTransactionCompleted: 'completed',
  P2PTransactionCancelled: 'cancelled',
};

async function handleP2PTransactionEvent(event) {
  const status = TYPE_TO_STATUS[event.type];
  if (!status) return;
  const { Notification } = require('../../models');
  const { buyerId, sellerId, transaction } = event.payload;
  const transaccionData = {
    id: transaction.id,
    amount: transaction.amount,
    crypto: { symbol: transaction.cryptoSymbol },
    fiatAmount: transaction.fiatAmount,
    fiatCurrency: transaction.fiatCurrency,
  };
  await Notification.notifyBothParties(buyerId, sellerId, transaccionData, status, { sourceEventId: event.id });
}

function register(eventBus) {
  for (const type of Object.keys(TYPE_TO_STATUS)) {
    eventBus.on(type, 'notifications', handleP2PTransactionEvent);
  }
}

module.exports = { handleP2PTransactionEvent, register, TYPE_TO_STATUS };
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npm test -- notificationEventHandlers`
Expected: PASS.

- [ ] **Step 5: Create the bootstrap registrar**

`backend/modules/events/registerHandlers.js`:
```js
// modules/events/registerHandlers.js
// Wires all domain-event handlers to the eventBus. Call once at app bootstrap,
// before the outbox publisher job starts.
const eventBus = require('./eventBus');
const notificationHandlers = require('../notifications/notificationEventHandlers');

function registerAllHandlers() {
  notificationHandlers.register(eventBus);
}

module.exports = { registerAllHandlers };
```

- [ ] **Step 6: Call it at bootstrap**

In `backend/server.js`, require the registrar and call it BEFORE `JobManager.startAll()` (or before the jobs are started). Add near the top with the other requires:
```js
const { registerAllHandlers } = require('./modules/events/registerHandlers');
```
And immediately before the line that starts the jobs (search for `JobManager` / `startAll` / `.start(`):
```js
registerAllHandlers();
```

- [ ] **Step 7: Run the unit suite**

Run: `npm test -- notificationEventHandlers`
Expected: PASS. Also `node --check backend/server.js` → no syntax error.

- [ ] **Step 8: Commit**
```bash
git add backend/modules/notifications/notificationEventHandlers.js backend/modules/events/registerHandlers.js backend/server.js backend/tests/notificationEventHandlers.test.js
git commit -m "feat(events): P2P notification handler + bootstrap registration"
```

---

### Task 7: Migrate P2P emission (end-to-end)

**Files:**
- Modify: `backend/modules/p2p/p2pTransaction.model.js`
- Test: `backend/tests/integration/p2pOutboxNotifications.integration.test.js`

**Interfaces:**
- Consumes: `emitEvent` (Task 2), the registered handler + publisher (Tasks 4, 6).
- Produces: P2P lifecycle transitions write `P2PTransaction{Created,PaymentConfirmed,Completed,Cancelled}` outbox events (in the money tx) instead of calling `notifyBothParties` inline.

- [ ] **Step 1: Replace the 4 inline notify calls with emitEvent**

In `backend/modules/p2p/p2pTransaction.model.js`, at the top add:
```js
const { emitEvent } = require('../events/emitEvent');
```
For each of the 4 sites that currently build `transaccionConDatos` and call `Notification.notifyBothParties(buyerId, sellerId, transaccionConDatos, '<status>', { transaction })`, replace the `notifyBothParties` call (and the local `const { Notification } = require('../../models/index');` that precedes it, if unused elsewhere in that method) with:
```js
await emitEvent('<EventType>', {
  buyerId,
  sellerId,
  transaction: {
    id: transaccionConDatos.id,
    amount: transaccionConDatos.amount,
    cryptoSymbol: transaccionConDatos.crypto?.symbol,
    fiatAmount: transaccionConDatos.fiatAmount,
    fiatCurrency: transaccionConDatos.fiatCurrency,
  },
}, { transaction, aggregateId: transaccionConDatos.id });
```
using the mapping: created→`P2PTransactionCreated`, payment_confirmed→`P2PPaymentConfirmed`, completed→`P2PTransactionCompleted`, cancelled→`P2PTransactionCancelled`. The `buyerId`/`sellerId` at each site are the same values passed to the old `notifyBothParties` call (e.g. `transaccion.buyerId`/`transaccion.sellerId`, or `buyerId`/`sellerId` for the create path — use whatever that site already passed as the first two args).

- [ ] **Step 2: Confirm no stale notify references remain**

Run: `grep -n "notifyBothParties" backend/modules/p2p/p2pTransaction.model.js`
Expected: no matches. Then `node --check backend/modules/p2p/p2pTransaction.model.js`.

- [ ] **Step 3: Write the failing end-to-end integration test**

`backend/tests/integration/p2pOutboxNotifications.integration.test.js`:
```js
const { sequelize, OutboxEvent, Notification } = require('../../models');
const { emitEvent } = require('../../modules/events/emitEvent');
const eventBus = require('../../modules/events/eventBus');
const { registerAllHandlers } = require('../../modules/events/registerHandlers');
const publisherJob = require('../../jobs/outboxPublisher.job');
const f = require('../helpers/factories');

beforeAll(async () => { await sequelize.sync({ force: true }); registerAllHandlers(); });
afterAll(async () => { await sequelize.close(); });
afterEach(async () => { await OutboxEvent.destroy({ where: {} }); await Notification.destroy({ where: {} }); });

describe('P2P outbox → notifications end-to-end', () => {
  test('emit → publisher dispatches → one notification per user, marked dispatched; re-run stays idempotent', async () => {
    const buyer = await f.seedUser();
    const seller = await f.seedUser();
    const evt = await emitEvent('P2PTransactionCompleted', {
      buyerId: buyer.id, sellerId: seller.id,
      transaction: { id: '22222222-2222-2222-2222-222222222222', amount: '1', cryptoSymbol: 'BTC', fiatAmount: '100', fiatCurrency: 'USD' },
    }, { aggregateId: '22222222-2222-2222-2222-222222222222' });

    await publisherJob.run();
    await publisherJob.run(); // at-least-once redelivery must not duplicate

    const reloaded = await OutboxEvent.findByPk(evt.id);
    expect(reloaded.status).toBe('dispatched');
    const notifs = await Notification.findAll({ where: { sourceEventId: evt.id } });
    expect(notifs).toHaveLength(2); // buyer + seller, once each
  });
});
```
> Note: use the real user factory (`tests/helpers/factories.js`). If it lacks a bare `seedUser`, seed two users with `User.create({...})` inline as in `notificationIdempotency.integration.test.js`.

- [ ] **Step 4: Run it — expect PASS**

Run: `npm run test:integration -- p2pOutboxNotifications`
Expected: PASS (event dispatched, exactly 2 notifications, no duplicates on the second run).

- [ ] **Step 5: Full verification**

Run: `npm test` (expect 379+ suite green) and `npm run test:integration` (expect all green). Then both coverage floors:
`npm run test:coverage` and `npm run test:integration:coverage` — expect exit 0.

- [ ] **Step 6: Commit**
```bash
git add backend/modules/p2p/p2pTransaction.model.js backend/tests/integration/p2pOutboxNotifications.integration.test.js
git commit -m "feat(p2p): emit domain events to outbox instead of inline notifications"
```

---

## Self-review notes

- **Spec coverage:** outbox table (T1), atomic emit (T2), bus (T3), publisher + backoff + dead-letter (T4), idempotency (T5), handler + bootstrap (T6), P2P migration + end-to-end incl. atomicity/redelivery (T2/T7). Dead-letter alarm = `console.error` in T4 (matches `reconciliation.job`).
- **Ordering:** `computeRetry`/`publishBatch` names consistent between T4 core and job. `notifyBothParties(..., { sourceEventId })` signature consistent between T5 (definition) and T6 (call).
- **Deferred (out of scope, per spec):** transfer/user notification migration, money events, AML/audit/websocket consumers, broker + `FOR UPDATE SKIP LOCKED`/dedicated worker, per-(event,handler) tracking.
