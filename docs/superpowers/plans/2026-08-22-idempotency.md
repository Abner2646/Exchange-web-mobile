# Idempotency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three money-creating POST endpoints (`createOrder`, `createWithdrawal`, `createTransferencia`) idempotent via a Stripe-style `Idempotency-Key` header, so retries don't double-execute.

**Architecture:** A reusable Express middleware sits as the last middleware before each controller. It claims a per-user key atomically via a `UNIQUE (user_id, idempotency_key)` constraint on a new `idempotency_keys` table; the first request runs the controller and its response is stored; retries replay the stored response; a different body for the same key returns 422; a concurrent in-flight request returns 409; 5xx releases the key; a cleanup job purges keys older than 24h.

**Tech Stack:** Node.js, Express, Sequelize + PostgreSQL, Jest. Node's built-in `crypto` for hashing.

## Global Constraints

- All new code and comments in **English** (project idioma rule — ROADMAP "Idioma del proyecto").
- **Conventional Commits in English** (`type(scope): description`).
- Work directly on branch **`dev`**.
- Tests are **Jest unit tests with mocked models** — no real Postgres (the suite runs without a DB; integration tests that need one are skipped).
- Schema is created via `sequelize.sync` (migrations are empty, known debt) — the new model is registered in `models/index.js`; **no SQL migration file**.
- `req.user.id` is the authenticated user id (set by `authenticateToken`, which runs before idempotency on all three routes).
- Error responses use `{ error, code }` with stable `code` values: `IDEMPOTENCY_KEY_REQUIRED` (400), `IDEMPOTENCY_REQUEST_IN_PROGRESS` (409), `IDEMPOTENCY_KEY_REUSED` (422).

---

## File Structure

- Create `backend/utils/requestFingerprint.js` — canonical-JSON + sha256 fingerprint of a request.
- Create `backend/models/entities/idempotencyKey.entity.js` — Sequelize entity.
- Create `backend/models/idempotencyKey.model.js` — thin model factory (matches project pattern).
- Modify `backend/models/index.js` — import, init, and export the new model.
- Create `backend/middleware/idempotency.middleware.js` — the middleware.
- Modify `backend/routes/trading.routes.js`, `backend/routes/transaccionBlockchain.routes.js`, `backend/routes/transferencia.routes.js` — apply the middleware.
- Create `backend/jobs/idempotencyCleanup.job.js` — 24h TTL cleanup, and modify `backend/jobs/index.js` to register it.
- Tests: `backend/tests/requestFingerprint.test.js`, `backend/tests/idempotencyMiddleware.test.js`, `backend/tests/idempotencyRouteWiring.test.js`, `backend/tests/idempotencyCleanupJob.test.js`.

---

## Task 1: Request fingerprint utility

**Files:**
- Create: `backend/utils/requestFingerprint.js`
- Test: `backend/tests/requestFingerprint.test.js`

**Interfaces:**
- Produces: `fingerprint(method: string, path: string, body: any) -> string` (64-char hex sha256), and `canonicalize(value) -> value` (recursively sorts object keys).

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/requestFingerprint.test.js
const { fingerprint } = require('../utils/requestFingerprint');

describe('requestFingerprint', () => {
  test('is stable regardless of object key order', () => {
    const a = fingerprint('POST', '/trading/orders', { side: 'buy', quantity: '1', price: '2' });
    const b = fingerprint('POST', '/trading/orders', { price: '2', quantity: '1', side: 'buy' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  test('differs when the body differs', () => {
    const a = fingerprint('POST', '/trading/orders', { quantity: '1' });
    const b = fingerprint('POST', '/trading/orders', { quantity: '2' });
    expect(a).not.toBe(b);
  });

  test('differs when method or path differ', () => {
    const base = fingerprint('POST', '/a', { x: 1 });
    expect(fingerprint('PUT', '/a', { x: 1 })).not.toBe(base);
    expect(fingerprint('POST', '/b', { x: 1 })).not.toBe(base);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- requestFingerprint.test.js`
Expected: FAIL — `Cannot find module '../utils/requestFingerprint'`.

- [ ] **Step 3: Write minimal implementation**

```js
// backend/utils/requestFingerprint.js
const crypto = require('crypto');

// Recursively sort object keys so an equivalent body with reordered fields
// produces the same canonical form (and therefore the same hash).
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = canonicalize(value[key]);
      return acc;
    }, {});
  }
  return value;
}

// Stable request fingerprint used to detect "same idempotency key, different
// request params" (Stripe-style). sha256 hex of method + path + canonical body.
function fingerprint(method, path, body) {
  const canonical = JSON.stringify({ method, path, body: canonicalize(body ?? null) });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

module.exports = { fingerprint, canonicalize };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- requestFingerprint.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/utils/requestFingerprint.js backend/tests/requestFingerprint.test.js
git commit -m "feat(idempotency): add stable request fingerprint util"
```

---

## Task 2: IdempotencyKey model

**Files:**
- Create: `backend/models/entities/idempotencyKey.entity.js`
- Create: `backend/models/idempotencyKey.model.js`
- Modify: `backend/models/index.js` (imports ~line 30, init ~line 72, export ~line 314)
- Test: `backend/tests/idempotencyKey.model.test.js`

**Interfaces:**
- Produces: Sequelize model `IdempotencyKey` exported from `backend/models` with attributes `userId, idempotencyKey, requestHash, status ('in_progress'|'completed'), responseStatusCode, responseBody`, timestamps `createdAt`/`updatedAt`, table `idempotency_keys`, unique index on `(user_id, idempotency_key)`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/idempotencyKey.model.test.js
const { Sequelize } = require('sequelize');
const initIdempotencyKey = require('../models/entities/idempotencyKey.entity');

// Non-connecting instance: .init() only defines the model, no DB round-trip.
const sequelize = new Sequelize('postgres://user:pass@localhost:5432/none', { logging: false });
const IdempotencyKey = initIdempotencyKey(sequelize);

describe('IdempotencyKey entity', () => {
  test('has the expected attributes and table name', () => {
    const attrs = IdempotencyKey.getAttributes();
    expect(Object.keys(attrs)).toEqual(
      expect.arrayContaining(['userId', 'idempotencyKey', 'requestHash', 'status', 'responseStatusCode', 'responseBody'])
    );
    expect(IdempotencyKey.tableName).toBe('idempotency_keys');
    expect(attrs.status.type.values).toEqual(['in_progress', 'completed']);
  });

  test('declares a unique index on (user_id, idempotency_key)', () => {
    const indexes = IdempotencyKey.options.indexes || [];
    const unique = indexes.find(i => i.unique);
    expect(unique.fields).toEqual(['user_id', 'idempotency_key']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- idempotencyKey.model.test.js`
Expected: FAIL — `Cannot find module '../models/entities/idempotencyKey.entity'`.

- [ ] **Step 3: Write the entity, the model factory, and register it**

```js
// backend/models/entities/idempotencyKey.entity.js
const { DataTypes, Model } = require('sequelize');

class IdempotencyKey extends Model {}

function initIdempotencyKey(sequelize) {
  IdempotencyKey.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    idempotencyKey: { type: DataTypes.STRING, allowNull: false, field: 'idempotency_key' },
    requestHash: { type: DataTypes.STRING(64), allowNull: false, field: 'request_hash' },
    status: {
      type: DataTypes.ENUM('in_progress', 'completed'),
      allowNull: false,
      defaultValue: 'in_progress'
    },
    responseStatusCode: { type: DataTypes.INTEGER, allowNull: true, field: 'response_status_code' },
    responseBody: { type: DataTypes.JSONB, allowNull: true, field: 'response_body' }
  }, {
    sequelize,
    modelName: 'IdempotencyKey',
    tableName: 'idempotency_keys',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['user_id', 'idempotency_key'] },
      { fields: ['created_at'] }
    ]
  });

  return IdempotencyKey;
}

module.exports = initIdempotencyKey;
```

```js
// backend/models/idempotencyKey.model.js
const initIdempotencyKey = require('./entities/idempotencyKey.entity');

module.exports = (sequelize) => initIdempotencyKey(sequelize);
```

In `backend/models/index.js`, add the import next to the other trading model imports (after line 30 `const priceCandleModel = require('./priceCandle.model');`):

```js
const idempotencyKeyModel = require('./idempotencyKey.model');
```

Add the init next to the other trading model inits (after line 72 `const PriceCandle = priceCandleModel(sequelize);`):

```js
const IdempotencyKey = idempotencyKeyModel(sequelize);
```

Add to the `module.exports` object (after the `PriceCandle` entry, before the closing `};`):

```js
  ,IdempotencyKey
```

(Or add `IdempotencyKey` on its own line inside the exported object — match the file's existing comma style; the key point is it appears in the exports.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- idempotencyKey.model.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full suite to confirm the model registration didn't break loading**

Run: `npm --prefix backend test`
Expected: all previously-passing suites still pass.

- [ ] **Step 6: Commit**

```bash
git add backend/models/entities/idempotencyKey.entity.js backend/models/idempotencyKey.model.js backend/models/index.js backend/tests/idempotencyKey.model.test.js
git commit -m "feat(idempotency): add IdempotencyKey model"
```

---

## Task 3: Idempotency middleware

**Files:**
- Create: `backend/middleware/idempotency.middleware.js`
- Test: `backend/tests/idempotencyMiddleware.test.js`

**Interfaces:**
- Consumes: `fingerprint` from Task 1; `IdempotencyKey` and `Sequelize` from `backend/models` (Task 2).
- Produces: a default-exported Express middleware `idempotency(req, res, next)`.

- [ ] **Step 1: Write the failing tests**

```js
// backend/tests/idempotencyMiddleware.test.js
jest.mock('../models', () => {
  class SequelizeUniqueConstraintError extends Error {
    constructor() { super('unique'); this.name = 'SequelizeUniqueConstraintError'; }
  }
  return {
    IdempotencyKey: {
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      destroy: jest.fn()
    },
    Sequelize: { UniqueConstraintError: SequelizeUniqueConstraintError }
  };
});

const { IdempotencyKey } = require('../models');
const idempotency = require('../middleware/idempotency.middleware');

function mockReqRes(overrides = {}) {
  const req = {
    method: 'POST',
    baseUrl: '/trading',
    path: '/orders',
    body: { side: 'buy', quantity: '1' },
    user: { id: 'user-1' },
    get: (h) => (h.toLowerCase() === 'idempotency-key' ? overrides.key : undefined),
    ...overrides.req
  };
  const res = {
    statusCode: 200,
    headers: {},
    _json: undefined,
    finishCbs: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this._json = body; this.finishCbs.forEach(cb => cb()); return this; },
    on(event, cb) { if (event === 'finish') this.finishCbs.push(cb); }
  };
  return { req, res };
}

function uniqueError() {
  const e = new Error('unique'); e.name = 'SequelizeUniqueConstraintError'; return e;
}

beforeEach(() => jest.clearAllMocks());

test('missing Idempotency-Key header -> 400, controller not called', async () => {
  const { req, res } = mockReqRes({ key: undefined });
  const next = jest.fn();
  await idempotency(req, res, next);
  expect(res.statusCode).toBe(400);
  expect(res._json.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  expect(next).not.toHaveBeenCalled();
});

test('first request claims the key, calls next, and stores the response on finish', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockResolvedValue({});
  const next = jest.fn(() => res.status(201).json({ ok: true }));
  await idempotency(req, res, next);
  expect(IdempotencyKey.create).toHaveBeenCalledWith(expect.objectContaining({
    userId: 'user-1', idempotencyKey: 'k1', status: 'in_progress'
  }));
  expect(next).toHaveBeenCalled();
  expect(IdempotencyKey.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'completed', responseStatusCode: 201, responseBody: { ok: true } }),
    { where: { userId: 'user-1', idempotencyKey: 'k1' } }
  );
});

test('replay: completed row with matching hash returns stored response, next not called', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockRejectedValue(uniqueError());
  IdempotencyKey.findOne.mockResolvedValue({
    // hash must match what the middleware computes for this req
    requestHash: require('../utils/requestFingerprint').fingerprint('POST', '/trading/orders', { side: 'buy', quantity: '1' }),
    status: 'completed',
    responseStatusCode: 201,
    responseBody: { ok: true }
  });
  const next = jest.fn();
  await idempotency(req, res, next);
  expect(res.statusCode).toBe(201);
  expect(res._json).toEqual({ ok: true });
  expect(next).not.toHaveBeenCalled();
});

test('same key, different body -> 422', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockRejectedValue(uniqueError());
  IdempotencyKey.findOne.mockResolvedValue({ requestHash: 'different', status: 'completed' });
  const next = jest.fn();
  await idempotency(req, res, next);
  expect(res.statusCode).toBe(422);
  expect(res._json.code).toBe('IDEMPOTENCY_KEY_REUSED');
  expect(next).not.toHaveBeenCalled();
});

test('in-progress within 90s -> 409', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockRejectedValue(uniqueError());
  IdempotencyKey.findOne.mockResolvedValue({
    requestHash: require('../utils/requestFingerprint').fingerprint('POST', '/trading/orders', { side: 'buy', quantity: '1' }),
    status: 'in_progress',
    updatedAt: new Date()
  });
  const next = jest.fn();
  await idempotency(req, res, next);
  expect(res.statusCode).toBe(409);
  expect(res._json.code).toBe('IDEMPOTENCY_REQUEST_IN_PROGRESS');
  expect(next).not.toHaveBeenCalled();
});

test('5xx response releases the key (destroy), does not store completed', async () => {
  const { req, res } = mockReqRes({ key: 'k1' });
  IdempotencyKey.create.mockResolvedValue({});
  const next = jest.fn(() => res.status(500).json({ error: 'boom' }));
  await idempotency(req, res, next);
  expect(IdempotencyKey.destroy).toHaveBeenCalledWith({ where: { userId: 'user-1', idempotencyKey: 'k1' } });
  expect(IdempotencyKey.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix backend test -- idempotencyMiddleware.test.js`
Expected: FAIL — `Cannot find module '../middleware/idempotency.middleware'`.

- [ ] **Step 3: Write the middleware**

```js
// backend/middleware/idempotency.middleware.js
//
// Stripe-style idempotency for money-creating POST endpoints. Requires an
// `Idempotency-Key` header. Claims the key atomically via the UNIQUE
// (user_id, idempotency_key) constraint on idempotency_keys; the first request
// runs the controller and its response is stored; retries replay it. See
// docs/superpowers/specs/2026-08-22-idempotency-design.md.
const { IdempotencyKey } = require('../models');
const { fingerprint } = require('../utils/requestFingerprint');

const STALE_MS = 90 * 1000; // in-progress rows older than this are reclaimable

function inProgress(res) {
  return res.status(409).json({
    error: 'A request with this Idempotency-Key is already being processed. Retry shortly.',
    code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS'
  });
}

async function persistResult(where, statusCode, body) {
  if (statusCode >= 500) {
    // Server errors are transient: release the key so a retry can execute.
    await IdempotencyKey.destroy({ where });
    return;
  }
  await IdempotencyKey.update(
    { status: 'completed', responseStatusCode: statusCode, responseBody: body === undefined ? null : body },
    { where }
  );
}

function runClaimed(req, res, next, where) {
  // Capture the controller's JSON response so we can store/replay it.
  let capturedBody;
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    capturedBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    persistResult(where, res.statusCode, capturedBody).catch((e) => {
      console.error('idempotency: failed to persist result:', e.message);
    });
  });

  next();
}

async function handle(req, res, next) {
  const key = req.get('Idempotency-Key');
  if (!key) {
    return res.status(400).json({
      error: 'Idempotency-Key header is required',
      code: 'IDEMPOTENCY_KEY_REQUIRED'
    });
  }

  const userId = req.user.id;
  const path = req.baseUrl + req.path;
  const requestHash = fingerprint(req.method, path, req.body);
  const where = { userId, idempotencyKey: key };

  try {
    await IdempotencyKey.create({ userId, idempotencyKey: key, requestHash, status: 'in_progress' });
    return runClaimed(req, res, next, where);
  } catch (err) {
    if (err.name !== 'SequelizeUniqueConstraintError') throw err;
  }

  // A row already exists for (userId, key).
  const existing = await IdempotencyKey.findOne({ where });
  if (!existing) return inProgress(res); // row vanished (cleanup race)

  if (existing.requestHash !== requestHash) {
    return res.status(422).json({
      error: 'Idempotency-Key was already used with a different request',
      code: 'IDEMPOTENCY_KEY_REUSED'
    });
  }

  if (existing.status === 'completed') {
    return res.status(existing.responseStatusCode).json(existing.responseBody);
  }

  // status === 'in_progress'
  const ageMs = Date.now() - new Date(existing.updatedAt).getTime();
  if (ageMs <= STALE_MS) return inProgress(res);

  // Stale (server likely crashed mid-request; the operation is transactional so
  // it rolled back). Reclaim atomically: only one request wins the conditional update.
  const [affected] = await IdempotencyKey.update(
    { requestHash },
    { where: { id: existing.id, status: 'in_progress' } }
  );
  if (affected === 0) return inProgress(res);
  return runClaimed(req, res, next, where);
}

module.exports = function idempotency(req, res, next) {
  handle(req, res, next).catch(next);
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix backend test -- idempotencyMiddleware.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/middleware/idempotency.middleware.js backend/tests/idempotencyMiddleware.test.js
git commit -m "feat(idempotency): add Idempotency-Key middleware"
```

---

## Task 4: Wire the middleware into the three routes

**Files:**
- Modify: `backend/routes/trading.routes.js` (POST `/orders`, ~line 36)
- Modify: `backend/routes/transaccionBlockchain.routes.js` (POST `/withdraw`, line 26)
- Modify: `backend/routes/transferencia.routes.js` (POST `/`, line 12)
- Test: `backend/tests/idempotencyRouteWiring.test.js`

**Interfaces:**
- Consumes: the `idempotency` middleware (Task 3), placed after auth + validation and immediately before each controller.

- [ ] **Step 1: Write the failing wiring test**

```js
// backend/tests/idempotencyRouteWiring.test.js
// Proves the idempotency middleware is actually in the /trading/orders chain:
// a valid POST with no Idempotency-Key returns 400 before the controller runs.
const request = require('supertest');
const express = require('express');

jest.mock('../models', () => ({
  IdempotencyKey: { create: jest.fn(), findOne: jest.fn(), update: jest.fn(), destroy: jest.fn() },
  Sequelize: {}
}));
jest.mock('../middleware/authMiddleware.js', () => ({
  authenticateToken: (req, _res, nx) => { req.user = { id: 'user-1' }; nx(); },
  requireEmailVerified: (_req, _res, nx) => nx()
}));
jest.mock('../middleware/adminMiddleware.js', () => ({ isAdmin: (_q, _s, n) => n(), isSuperAdmin: (_q, _s, n) => n() }));
jest.mock('../controllers/trading.controller', () => ({
  createOrder: (_req, res) => res.status(201).json({ ok: true })
}));
jest.mock('../controllers/trades.controller', () => ({}));
jest.mock('../controllers/tradingPairs.controller', () => ({}));

const tradingRoutes = require('../routes/trading.routes');

test('POST /trading/orders without Idempotency-Key -> 400', async () => {
  const app = express();
  app.use(express.json());
  app.use('/trading', tradingRoutes);

  const res = await request(app).post('/trading/orders').send({
    tradingPairId: '123e4567-e89b-12d3-a456-426614174000',
    orderType: 'limit',
    side: 'buy',
    quantity: 1.5,
    price: 45000.5
  });

  expect(res.status).toBe(400);
  expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix backend test -- idempotencyRouteWiring.test.js`
Expected: FAIL — the controller returns 201 (middleware not wired yet), so `expect(res.status).toBe(400)` fails.

- [ ] **Step 3: Wire the middleware into all three routes**

In `backend/routes/trading.routes.js`, add the require near the other middleware requires (after line 10):

```js
const idempotency = require('../middleware/idempotency.middleware');
```

In the `router.post('/orders', ...)` chain, insert `idempotency` right after `validate` and before `tradingController.createOrder`:

```js
  validate,
  idempotency,
  tradingController.createOrder
```

In `backend/routes/transaccionBlockchain.routes.js`, add after line 11:

```js
const idempotency = require('../middleware/idempotency.middleware');
```

Change the `/withdraw` route (line 26) to insert `idempotency` before the controller:

```js
router.post('/withdraw', rateLimitMiddleware.withdrawal, joiValidate(transaccionBlockchainSchema.createWithdrawal), idempotency, transaccionBlockchainController.createWithdrawal);
```

In `backend/routes/transferencia.routes.js`, add after line 7:

```js
const idempotency = require('../middleware/idempotency.middleware');
```

Change the create route (line 12) to insert `idempotency` before the controller:

```js
router.post('/', authenticateToken, requireEmailVerified, idempotency, transferenciaController.createTransferencia);
```

- [ ] **Step 4: Run the wiring test to verify it passes**

Run: `npm --prefix backend test -- idempotencyRouteWiring.test.js`
Expected: PASS — no header now yields 400.

- [ ] **Step 5: Run the full suite**

Run: `npm --prefix backend test`
Expected: all suites pass (the new routes still load; existing tests unaffected).

- [ ] **Step 6: Commit**

```bash
git add backend/routes/trading.routes.js backend/routes/transaccionBlockchain.routes.js backend/routes/transferencia.routes.js backend/tests/idempotencyRouteWiring.test.js
git commit -m "feat(idempotency): apply middleware to order/withdraw/transfer routes"
```

---

## Task 5: 24h TTL cleanup job

**Files:**
- Create: `backend/jobs/idempotencyCleanup.job.js`
- Modify: `backend/jobs/index.js` (imports line ~5; `this.jobs` line ~14; `startAll` line ~50)
- Test: `backend/tests/idempotencyCleanupJob.test.js`

**Interfaces:**
- Consumes: `IdempotencyKey` and `Sequelize` from `backend/models`.
- Produces: a singleton job with `start()`, `stop()`, `getStatus()`, and `cleanup()` that deletes rows with `createdAt < now - 24h`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/idempotencyCleanupJob.test.js
jest.mock('../models', () => ({
  IdempotencyKey: { destroy: jest.fn().mockResolvedValue(3) },
  Sequelize: require('sequelize').Sequelize
}));

const { IdempotencyKey } = require('../models');
const job = require('../jobs/idempotencyCleanup.job');
const { Op } = require('sequelize');

test('cleanup() deletes keys older than the 24h TTL', async () => {
  const before = Date.now();
  await job.cleanup();

  expect(IdempotencyKey.destroy).toHaveBeenCalledTimes(1);
  const arg = IdempotencyKey.destroy.mock.calls[0][0];
  const cutoff = arg.where.createdAt[Op.lt].getTime();
  // cutoff is ~24h before now
  const expected = before - 24 * 60 * 60 * 1000;
  expect(Math.abs(cutoff - expected)).toBeLessThan(5000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm --prefix backend test -- idempotencyCleanupJob.test.js`
Expected: FAIL — `Cannot find module '../jobs/idempotencyCleanup.job'`.

- [ ] **Step 3: Write the job and register it**

```js
// backend/jobs/idempotencyCleanup.job.js
const { IdempotencyKey, Sequelize } = require('../models');
const { Op } = Sequelize;

const TTL_MS = 24 * 60 * 60 * 1000;   // keep keys for 24h
const FREQUENCY_MS = 60 * 60 * 1000;  // sweep hourly

class IdempotencyCleanupJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.cleanup();
    this.interval = setInterval(() => this.cleanup(), FREQUENCY_MS);
    this.isRunning = true;
    console.log('✅ Idempotency Cleanup Job started');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
  }

  async cleanup() {
    try {
      const cutoff = new Date(Date.now() - TTL_MS);
      const deleted = await IdempotencyKey.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
      if (deleted > 0) console.log(`🧹 Idempotency cleanup: removed ${deleted} expired keys`);
    } catch (error) {
      console.error('❌ Idempotency Cleanup Job error:', error.message);
    }
  }

  getStatus() {
    return { isRunning: this.isRunning, ttlMs: TTL_MS, frequencyMs: FREQUENCY_MS };
  }
}

module.exports = new IdempotencyCleanupJob();
```

In `backend/jobs/index.js`, add the import (after line 5 `const blockchainJobs = require('./blockchain.jobs');`):

```js
const idempotencyCleanupJob = require('./idempotencyCleanup.job');
```

Add it to `this.jobs` in the constructor (inside the object literal, after `blockchain: blockchainJobs`):

```js
      ,idempotencyCleanup: idempotencyCleanupJob
```

Add a start block in `startAll()` (after the blockchain start block, before the final console.log):

```js
    try {
      this.jobs.idempotencyCleanup.start();
    } catch (error) {
      console.error('❌ Error iniciando Idempotency Cleanup:', error.message);
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm --prefix backend test -- idempotencyCleanupJob.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Run the full suite**

Run: `npm --prefix backend test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add backend/jobs/idempotencyCleanup.job.js backend/jobs/index.js backend/tests/idempotencyCleanupJob.test.js
git commit -m "feat(idempotency): add 24h TTL cleanup job"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** header required (Task 3 test 1) ✓; replay (Task 3 test 3) ✓; 422 mismatch (test 4) ✓; 409 in-progress (test 5) ✓; 5xx release (test 6) ✓; atomic claim via unique constraint (Task 2 unique index + Task 3 create/catch) ✓; fingerprint with sorted keys (Task 1) ✓; per-user scope (unique on user_id+key) ✓; stale reclaim (middleware code + covered by 409/claim logic) ✓; wiring on 3 endpoints (Task 4) ✓; 24h TTL cleanup (Task 5) ✓; stable error codes (Global Constraints + middleware) ✓.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `fingerprint(method, path, body)` used identically in Task 1, Task 3 tests, and middleware; `IdempotencyKey` attribute names (`userId`, `idempotencyKey`, `requestHash`, `status`, `responseStatusCode`, `responseBody`) consistent across Tasks 2/3/5; `where: { userId, idempotencyKey }` shape consistent between middleware and its tests.
- **Note:** the stale-reclaim branch has no dedicated unit test (it depends on wall-clock age > 90s); it is exercised structurally by the in-progress 409 test and the claim path. A dedicated test could inject a clock, deferred as optional.
