# Centralized Error Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A canonical error envelope + central error-handler that sanitizes unexpected errors (no raw `error.message` leak) and logs them server-side, with `AppError`/`errorCodes`/`asyncHandler` as the tools, plus the `trading` controller migrated as the worked example.

**Architecture:** Code throws `AppError(statusCode, code, message)` for known business errors; async route handlers are wrapped with `asyncHandler` so throws reach a central Express error-handler middleware. The handler returns `{ error: { code, message } }` for `AppError`, and a sanitized `500 { error: { code:'INTERNAL_ERROR', message, requestId } }` (full error logged server-side) for anything else.

**Tech Stack:** Node.js, Express, Jest + supertest, Node `crypto`.

## Global Constraints

- All new code and comments in **English**. **Conventional Commits in English.**
- Work directly on branch **`dev`**.
- Tests are **Jest**; HTTP behavior via **supertest**; models/services mocked (no real DB).
- Canonical error envelope: **`{ "error": { "code": "<STABLE_CODE>", "message": "<safe text>" } }`** — nowhere returns raw `error.message` for an unexpected error.
- Unexpected (500) errors: response carries `error.requestId` (12 hex chars from `crypto.randomBytes(6).toString('hex')`); the full error is logged server-side with that id.
- Scope of THIS plan: the mechanism + wiring + the `trading` controller. The other money-path controllers (`transaccionBlockchain`, `transferencia`, `intercambioExchange`, `transaccionesP2P`, `ofertaP2P`) are a follow-up applying the same pattern (see "Follow-up").

---

## File Structure

- Create `backend/utils/AppError.js` — the structured error class.
- Create `backend/utils/errorCodes.js` — frozen catalog of stable codes.
- Create `backend/utils/asyncHandler.js` — async route-handler wrapper.
- Create `backend/middleware/errorHandler.js` — central Express error handler.
- Modify `backend/server.js` — replace the inline handler (`:107-113`), wire the module, update the 404 (`:116-118`).
- Modify `backend/middleware/idempotency.middleware.js` — its 3 error responses to the nested envelope; and `backend/tests/idempotencyMiddleware.test.js` + `backend/tests/idempotencyRouteWiring.test.js` accordingly.
- Modify `backend/controllers/trading.controller.js` + `backend/routes/trading.routes.js` — worked migration.

---

## Task 1: AppError class

**Files:**
- Create: `backend/utils/AppError.js`
- Test: `backend/tests/appError.test.js`

**Interfaces:**
- Produces: `class AppError extends Error` with `constructor(statusCode, code, message)` setting `.statusCode`, `.code`, `.message`, `.isOperational = true`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/appError.test.js
const AppError = require('../utils/AppError');

describe('AppError', () => {
  test('sets statusCode, code, message and isOperational', () => {
    const e = new AppError(400, 'INVALID_ORDER', 'Cantidad inválida');
    expect(e).toBeInstanceOf(Error);
    expect(e.statusCode).toBe(400);
    expect(e.code).toBe('INVALID_ORDER');
    expect(e.message).toBe('Cantidad inválida');
    expect(e.isOperational).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- appError.test.js`
Expected: FAIL — `Cannot find module '../utils/AppError'`.

- [ ] **Step 3: Write minimal implementation**

```js
// backend/utils/AppError.js
// Structured, operational error. Thrown for known business failures; the central
// error handler turns it into a { error: { code, message } } response with the
// given status. isOperational=true distinguishes it from unexpected bugs.
class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    if (Error.captureStackTrace) Error.captureStackTrace(this, AppError);
  }
}

module.exports = AppError;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- appError.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add backend/utils/AppError.js backend/tests/appError.test.js
git commit -m "feat(errors): add AppError class"
```

---

## Task 2: Error code catalog

**Files:**
- Create: `backend/utils/errorCodes.js`
- Test: `backend/tests/errorCodes.test.js`

**Interfaces:**
- Produces: a frozen object exported from `backend/utils/errorCodes.js` whose keys and values are equal stable code strings. Initial codes: `INTERNAL_ERROR`, `NOT_FOUND`, the three idempotency codes, and the trading codes `TRADING_PAIR_NOT_FOUND`, `INVALID_ORDER`, `INSUFFICIENT_BALANCE`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/errorCodes.test.js
const errorCodes = require('../utils/errorCodes');

describe('errorCodes', () => {
  test('is frozen and every value equals its key', () => {
    expect(Object.isFrozen(errorCodes)).toBe(true);
    for (const [key, value] of Object.entries(errorCodes)) {
      expect(value).toBe(key);
    }
  });

  test('includes the money-path and idempotency codes this pass uses', () => {
    expect(errorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    expect(errorCodes.INSUFFICIENT_BALANCE).toBe('INSUFFICIENT_BALANCE');
    expect(errorCodes.IDEMPOTENCY_KEY_REQUIRED).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- errorCodes.test.js`
Expected: FAIL — `Cannot find module '../utils/errorCodes'`.

- [ ] **Step 3: Write minimal implementation**

```js
// backend/utils/errorCodes.js
// Stable, machine-readable error codes — the single source of truth for the
// `code` field of the error envelope. Add codes here as sites are migrated; no
// speculative codes (YAGNI).
const errorCodes = Object.freeze({
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',

  // Idempotency (already used by the idempotency middleware)
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_REQUEST_IN_PROGRESS: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',

  // Trading (Task 7)
  TRADING_PAIR_NOT_FOUND: 'TRADING_PAIR_NOT_FOUND',
  INVALID_ORDER: 'INVALID_ORDER',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
});

module.exports = errorCodes;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- errorCodes.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/utils/errorCodes.js backend/tests/errorCodes.test.js
git commit -m "feat(errors): add stable error-code catalog"
```

---

## Task 3: asyncHandler wrapper

**Files:**
- Create: `backend/utils/asyncHandler.js`
- Test: `backend/tests/asyncHandler.test.js`

**Interfaces:**
- Produces: `asyncHandler(fn) => (req, res, next) => Promise` that forwards any rejection/throw of `fn` to `next`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/asyncHandler.test.js
const asyncHandler = require('../utils/asyncHandler');

describe('asyncHandler', () => {
  test('forwards a thrown error to next', async () => {
    const err = new Error('boom');
    const handler = asyncHandler(async () => { throw err; });
    const next = jest.fn();
    await handler({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });

  test('does not call next when the handler resolves', async () => {
    const handler = asyncHandler(async (req, res) => { res.ok = true; });
    const next = jest.fn();
    const res = {};
    await handler({}, res, next);
    expect(res.ok).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- asyncHandler.test.js`
Expected: FAIL — `Cannot find module '../utils/asyncHandler'`.

- [ ] **Step 3: Write minimal implementation**

```js
// backend/utils/asyncHandler.js
// Wraps an async Express route handler so a thrown error / rejected promise is
// forwarded to next() (Express 4 does not catch async rejections on its own),
// reaching the central error handler.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- asyncHandler.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/utils/asyncHandler.js backend/tests/asyncHandler.test.js
git commit -m "feat(errors): add asyncHandler wrapper"
```

---

## Task 4: Central error-handler middleware

**Files:**
- Create: `backend/middleware/errorHandler.js`
- Test: `backend/tests/errorHandler.test.js`

**Interfaces:**
- Consumes: `AppError` (Task 1), `errorCodes` (Task 2).
- Produces: default-exported Express error middleware `(err, req, res, next)`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/errorHandler.test.js
const AppError = require('../utils/AppError');
const errorHandler = require('../middleware/errorHandler');

function mockRes() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('errorHandler', () => {
  test('AppError -> its status + { error: { code, message } }', () => {
    const res = mockRes();
    errorHandler(new AppError(400, 'INVALID_ORDER', 'Cantidad inválida'), {}, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_ORDER', message: 'Cantidad inválida' } });
  });

  test('unexpected error -> sanitized 500, logs server-side, no leak of the message', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    errorHandler(new Error('DB password is hunter2'), {}, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('Internal server error');
    expect(res.body.error.requestId).toMatch(/^[a-f0-9]{12}$/);
    expect(JSON.stringify(res.body)).not.toContain('hunter2'); // no leak
    expect(spy).toHaveBeenCalled(); // logged server-side
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- errorHandler.test.js`
Expected: FAIL — `Cannot find module '../middleware/errorHandler'`.

- [ ] **Step 3: Write minimal implementation**

```js
// backend/middleware/errorHandler.js
// Central Express error handler. Known business errors (AppError) become a
// { error: { code, message } } response with their status. Anything else is a
// bug/unexpected failure: log it in full server-side with a correlation id, and
// return a sanitized 500 that never leaks the internal message.
const crypto = require('crypto');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');

// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
module.exports = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    });
  }

  const requestId = crypto.randomBytes(6).toString('hex');
  console.error(`[${requestId}] Unhandled error:`, err);
  return res.status(500).json({
    error: { code: errorCodes.INTERNAL_ERROR, message: 'Internal server error', requestId },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix backend test -- errorHandler.test.js`
Expected: PASS (2 tests, console output clean — the spy silences the intended log).

- [ ] **Step 5: Commit**

```bash
git add backend/middleware/errorHandler.js backend/tests/errorHandler.test.js
git commit -m "feat(errors): add central error-handler middleware"
```

---

## Task 5: Wire the handler in server.js + canonical 404

**Files:**
- Modify: `backend/server.js` (inline handler `:107-113`, 404 `:116-118`)
- Test: `backend/tests/errorHandlerWiring.test.js`

**Interfaces:**
- Consumes: `errorHandler` (Task 4), `asyncHandler` (Task 3).

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/errorHandlerWiring.test.js
const request = require('supertest');
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const errorHandler = require('../middleware/errorHandler');

// Reproduces server.js's tail wiring: routes -> 404 -> errorHandler.
function buildApp() {
  const app = express();
  app.get('/boom', asyncHandler(async () => { throw new Error('secret detail'); }));
  app.get('/known', asyncHandler(async () => { throw new AppError(400, 'INVALID_ORDER', 'bad'); }));
  app.use('*', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}

test('unexpected error -> sanitized 500, no leak', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await request(buildApp()).get('/boom');
  expect(res.status).toBe(500);
  expect(res.body.error.code).toBe('INTERNAL_ERROR');
  expect(res.text).not.toContain('secret detail');
  spy.mockRestore();
});

test('AppError -> coded response', async () => {
  const res = await request(buildApp()).get('/known');
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: { code: 'INVALID_ORDER', message: 'bad' } });
});

test('unknown route -> canonical 404 envelope', async () => {
  const res = await request(buildApp()).get('/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix backend test -- errorHandlerWiring.test.js`
Expected: PASS already (the test builds its own app) — this test documents the target wiring. If it fails, fix the test imports. Then proceed to wire `server.js` so the real app matches.

> Note: this task's behavioral guarantee lives in the reusable middleware (already tested in Task 4); Step 1 pins the exact wiring shape. The `server.js` edit below makes the real server use it.

- [ ] **Step 3: Edit `server.js`**

At the top of `backend/server.js` (with the other requires), add:

```js
const errorHandler = require('./middleware/errorHandler');
```

Replace the inline error handler (currently `:107-113`):

```js
// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});
```

with:

```js
// Error handling (central handler — sanitizes unexpected errors, no leak)
app.use(errorHandler);
```

Replace the 404 handler (currently `:116-118`):

```js
// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
```

with:

```js
// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});
```

Keep the 404 handler **before** `app.use(errorHandler)` (error middleware is registered last).

- [ ] **Step 4: Run tests**

Run: `npm --prefix backend test -- errorHandlerWiring.test.js`
Expected: PASS (3 tests).
Run: `npm --prefix backend test`
Expected: full suite passes (server.js still loads; nothing imports the removed inline handler).

- [ ] **Step 5: Commit**

```bash
git add backend/server.js backend/tests/errorHandlerWiring.test.js
git commit -m "feat(errors): wire central error handler and canonical 404"
```

---

## Task 6: Idempotency middleware → nested envelope

**Files:**
- Modify: `backend/middleware/idempotency.middleware.js` (its 3 error responses)
- Modify: `backend/tests/idempotencyMiddleware.test.js`, `backend/tests/idempotencyRouteWiring.test.js`

**Interfaces:**
- Consumes: nothing new. Produces the same three error cases but in `{ error: { code, message } }` shape.

- [ ] **Step 1: Update the tests first (they pin the new shape)**

In `backend/tests/idempotencyMiddleware.test.js`, change the three error-shape assertions:
- `expect(res._json.code).toBe('IDEMPOTENCY_KEY_REQUIRED')` → `expect(res._json.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')`
- `expect(res._json.code).toBe('IDEMPOTENCY_KEY_REUSED')` → `expect(res._json.error.code).toBe('IDEMPOTENCY_KEY_REUSED')`
- `expect(res._json.code).toBe('IDEMPOTENCY_REQUEST_IN_PROGRESS')` → `expect(res._json.error.code).toBe('IDEMPOTENCY_REQUEST_IN_PROGRESS')`

In `backend/tests/idempotencyRouteWiring.test.js`, change:
- `expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED')` → `expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')`

- [ ] **Step 2: Run to verify they fail**

Run: `npm --prefix backend test -- idempotencyMiddleware.test.js idempotencyRouteWiring.test.js`
Expected: FAIL — the middleware still returns the flat shape (`res._json.error` is a string, so `.code` is undefined).

- [ ] **Step 3: Update the middleware's three error responses**

In `backend/middleware/idempotency.middleware.js`:

The missing-header response:
```js
    return res.status(400).json({
      error: 'Idempotency-Key header is required',
      code: 'IDEMPOTENCY_KEY_REQUIRED'
    });
```
→
```js
    return res.status(400).json({
      error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required' }
    });
```

The in-progress helper `inProgress(res)`:
```js
  return res.status(409).json({
    error: 'A request with this Idempotency-Key is already being processed. Retry shortly.',
    code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS'
  });
```
→
```js
  return res.status(409).json({
    error: { code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS', message: 'A request with this Idempotency-Key is already being processed. Retry shortly.' }
  });
```

The reused-key response:
```js
    return res.status(422).json({
      error: 'Idempotency-Key was already used with a different request',
      code: 'IDEMPOTENCY_KEY_REUSED'
    });
```
→
```js
    return res.status(422).json({
      error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'Idempotency-Key was already used with a different request' }
    });
```

Leave the replay path untouched (it returns the stored controller response, not an error envelope).

- [ ] **Step 4: Run tests**

Run: `npm --prefix backend test -- idempotencyMiddleware.test.js idempotencyRouteWiring.test.js`
Expected: PASS.
Run: `npm --prefix backend test`
Expected: full suite passes.

- [ ] **Step 5: Commit**

```bash
git add backend/middleware/idempotency.middleware.js backend/tests/idempotencyMiddleware.test.js backend/tests/idempotencyRouteWiring.test.js
git commit -m "refactor(errors): idempotency responses use the canonical error envelope"
```

---

## Task 7: Migrate the trading controller (worked example)

**Files:**
- Modify: `backend/controllers/trading.controller.js` (`createOrder`, `:15-175`)
- Modify: `backend/routes/trading.routes.js` (wrap `/orders` handler)
- Test: `backend/tests/tradingErrorEnvelope.test.js`

**Interfaces:**
- Consumes: `AppError` (Task 1), `errorCodes` (Task 2), `asyncHandler` (Task 3).

Context: `createOrder` currently (a) returns known business failures as `res.status(400).json({ success:false, error: <text> })` and (b) has a catch-all that leaks: `res.status(500).json({ success:false, error:'Error al crear orden', details: error.message })`. The migration converts known failures to `AppError` throws with codes and removes the leaking catch (unexpected errors propagate to the central handler → sanitized 500). `TradingController` methods do not use `this`, so `asyncHandler(tradingController.createOrder)` needs no binding.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/tradingErrorEnvelope.test.js
const request = require('supertest');
const express = require('express');

jest.mock('../models', () => ({ Order: { create: jest.fn(), findByPk: jest.fn() }, TradingPair: { findByPk: jest.fn() }, Trade: {} }));
jest.mock('../services/trading/orderBook.service', () => ({ matchOrder: jest.fn().mockResolvedValue({ matched: false, trades: [] }) }));
jest.mock('../services/trading/orderValidator.service', () => ({ validateOrder: jest.fn() }));
jest.mock('../services/trading/balanceManager.service', () => ({ checkSufficientBalance: jest.fn(), lockBalanceForOrder: jest.fn() }));
jest.mock('../services/trading/feeCalculator.service', () => ({ calculateOrderFee: jest.fn() }));
jest.mock('../services/trading/tradeExecutor.service', () => ({}));

const { TradingPair } = require('../models');
const orderValidator = require('../services/trading/orderValidator.service');
const balanceManager = require('../services/trading/balanceManager.service');
const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');
const tradingController = require('../controllers/trading.controller');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'u1' }; next(); });
  app.post('/trading/orders', asyncHandler(tradingController.createOrder));
  app.use(errorHandler);
  return app;
}

const body = { tradingPairId: 'p', orderType: 'limit', side: 'buy', quantity: '1', price: '2' };

beforeEach(() => jest.clearAllMocks());

test('insufficient balance -> 400 INSUFFICIENT_BALANCE (canonical envelope)', async () => {
  TradingPair.findByPk.mockResolvedValue({ id: 'p', status: 'active', quoteAssetId: 'q', baseAssetId: 'b' });
  orderValidator.validateOrder.mockResolvedValue({ valid: true });
  balanceManager.checkSufficientBalance.mockResolvedValue({ sufficient: false, error: 'Saldo insuficiente' });

  const res = await request(buildApp()).post('/trading/orders').send(body);
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: { code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente' } });
});

test('unexpected service throw -> sanitized 500, no leak', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  TradingPair.findByPk.mockRejectedValue(new Error('DB exploded: table orders'));

  const res = await request(buildApp()).post('/trading/orders').send(body);
  expect(res.status).toBe(500);
  expect(res.body.error.code).toBe('INTERNAL_ERROR');
  expect(res.text).not.toContain('table orders');
  spy.mockRestore();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm --prefix backend test -- tradingErrorEnvelope.test.js`
Expected: FAIL — insufficient-balance currently returns `{ success:false, error, required, available }` (not the canonical envelope), and the unexpected-throw case currently returns `{ success:false, ..., details: <message> }` leaking the message.

- [ ] **Step 3: Migrate `createOrder`**

In `backend/controllers/trading.controller.js`, add near the top requires:

```js
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
```

In `createOrder`, convert the known-business responses to `AppError` throws and delete the leaking catch. Concretely:

- The trading-pair not-found / inactive check → `throw new AppError(400, errorCodes.TRADING_PAIR_NOT_FOUND, 'Par de trading no disponible');`
- The `validation.valid === false` branch → `throw new AppError(400, errorCodes.INVALID_ORDER, validation.error);`
- The `balanceCheck.sufficient === false` branch → `throw new AppError(400, errorCodes.INSUFFICIENT_BALANCE, balanceCheck.error);`
- The `balanceLocked.success === false` branch → `throw new AppError(400, errorCodes.INSUFFICIENT_BALANCE, balanceLocked.error);`
- Remove the wrapping `try { ... } catch (error) { res.status(500).json({ success:false, error:'Error al crear orden', details: error.message }) }` — keep the body, drop the try/catch so unexpected errors propagate to the central handler.

The success response stays `res.status(201).json({ success: true, order: createdOrder, message: 'Orden creada exitosamente' })` (success envelope is out of scope; only error responses are being standardized).

- [ ] **Step 4: Wrap the route**

In `backend/routes/trading.routes.js`, add near the requires:

```js
const asyncHandler = require('../utils/asyncHandler');
```

Change the `/orders` route's final handler from `tradingController.createOrder` to `asyncHandler(tradingController.createOrder)`:

```js
  validate,
  idempotency,
  asyncHandler(tradingController.createOrder)
```

- [ ] **Step 5: Run tests**

Run: `npm --prefix backend test -- tradingErrorEnvelope.test.js`
Expected: PASS (2 tests).
Run: `npm --prefix backend test`
Expected: full suite passes.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/trading.controller.js backend/routes/trading.routes.js backend/tests/tradingErrorEnvelope.test.js
git commit -m "refactor(trading): use AppError + central handler for createOrder errors"
```

---

## Follow-up (not in this plan)

The other money-path controllers apply the **identical** Task 7 pattern (wrap routes with `asyncHandler`; convert known business `res.status(4xx).json({...error text})` to `AppError` throws with codes added to `errorCodes.js`; delete leaking `catch` blocks so unexpected errors propagate). Leak-site counts to migrate: `transaccionBlockchain` (17), `intercambioExchange` (18), `ofertaP2P` (17), `transaccionesP2P` (14), `transferencia` (9). Recommend a dedicated follow-up plan once this mechanism is merged — the central handler already sanitizes any error these controllers *propagate*, so the residual exposure is only their existing catch-and-respond sites.

---

## Self-Review (completed by plan author)

- **Spec coverage:** canonical envelope (Tasks 4/5/6/7) ✓; `AppError` (Task 1) ✓; `errorCodes` catalog (Task 2) ✓; `asyncHandler` (Task 3) ✓; central handler sanitizes + logs + requestId (Task 4) ✓; wired in server.js + canonical 404 (Task 5) ✓; idempotency envelope updated (Task 6) ✓; money-path migration — trading worked example (Task 7), the other five explicitly deferred to a follow-up (spec's "money-path now" is partially delivered; the mechanism closes propagated-error leaks app-wide, catch-and-respond sites migrate per the follow-up). **Gap flagged to the human in the execution handoff.**
- **Placeholder scan:** none — every step has concrete code/commands. Task 7 Step 3 references the specific `createOrder` branches by their guard condition rather than pasting the whole 160-line method; the transformation and exact `AppError` calls are spelled out.
- **Type consistency:** `AppError(statusCode, code, message)` used identically in Tasks 1/4/7; envelope `{ error: { code, message } }` consistent across Tasks 4/5/6/7; `errorCodes.*` names consistent between Task 2 and Task 7.
