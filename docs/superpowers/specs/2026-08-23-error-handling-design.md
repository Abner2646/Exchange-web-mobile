# Centralized Error Handling — Design Spec

- **Date:** 2026-08-23
- **Phase:** Roadmap Fase 1 ("Otros errores de bajo nivel" → mensajes de error crudos al cliente)
- **Status:** Approved (design), pending implementation plan

## Problem

Controllers catch their own errors and return the raw `error.message` to the
client (e.g. `res.status(500).json({ success:false, error:'...', details: error.message })`).
This is ~726 catch/error-response sites across 20 controllers. Two problems:

1. **Security:** Sequelize/JS internal messages (schema details, constraint
   names, stack fragments) leak to the client, in every environment.
2. **"Phantom" bugs:** the real error ends up in the client response but is not
   reliably logged server-side, so failures are hard to diagnose.

There is already a global error-handler at `server.js:107`, and it *does*
sanitize (`message` only in development) — but the per-controller catches bypass
it by responding directly with `error.message`. The response envelope is also
inconsistent across the codebase (`{error}`, `{success:false, error}`,
`{error, message, details}`).

## Goal

A single canonical error envelope, a central error-handler that formats and
sanitizes every error, an `AppError` class so code can throw structured business
errors, and an `asyncHandler` wrapper so async throws reach the handler. Migrate
the money-path controllers now; the central handler stops leaks for the rest;
migrate the rest incrementally when touched.

Non-goals (deferred):
- Migrating all 20 controllers now (money-path first; rest incremental-as-touched).
- Predefining the full error-code catalog (codes are added as each site migrates).
- A full RFC 9457 `application/problem+json` implementation (the nested-object
  envelope is the pragmatic subset).
- Request-scoped correlation IDs for *all* requests (only unexpected 500s get a
  generated `requestId` in this pass).

## Canonical error envelope

Every error response, one shape:

```json
{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "Saldo insuficiente para la orden" } }
```

- `code` — stable, machine-readable string (for the frontend, i18n in Fase 7.3,
  and AI/automation reading responses).
- `message` — safe, human-facing text. **Never** the raw `error.message` of an
  unexpected error.
- Extensible: validation errors may add `error.details` (an array of
  `{ field, issue }`) without changing the shape.
- Unexpected (500) errors additionally carry `error.requestId` (see below).

The three error responses in `middleware/idempotency.middleware.js` (currently
flat `{ error, code }`) are updated to this nested shape so the backend has a
single canonical envelope.

## Components

### `backend/utils/AppError.js`
```
class AppError extends Error {
  constructor(statusCode, code, message)
  // sets: this.statusCode, this.code, this.message, this.isOperational = true
}
```
`isOperational = true` marks an expected business error (as opposed to a
programmer bug / unexpected throw). The error handler branches on
`err instanceof AppError`.

### `backend/utils/errorCodes.js`
A frozen object of stable code strings — the single source of truth. Filled as
sites migrate; this pass adds the money-path codes it uses (e.g.
`INSUFFICIENT_BALANCE`, `ORDER_NOT_FOUND`, `TRADING_PAIR_NOT_FOUND`,
`INVALID_ORDER`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_REQUEST_IN_PROGRESS`,
`IDEMPOTENCY_KEY_REUSED`, `INTERNAL_ERROR`, plus withdrawal/transfer/exchange/p2p
codes as those controllers are migrated). No speculative codes.

### `backend/utils/asyncHandler.js`
```
asyncHandler(fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
```
Express 4 does not catch rejections from async route handlers; this wrapper
routes them to `next(err)` so they reach the central handler. Route handlers on
migrated routes are wrapped with it.

### `backend/middleware/errorHandler.js`
The central Express error-handling middleware (replaces the inline one at
`server.js:107`, which is deleted and re-wired to `require` this module).

```
module.exports = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
  }
  const requestId = require('crypto').randomBytes(6).toString('hex'); // 12-hex-char correlation id
  console.error(`[${requestId}] Unhandled error:`, err);  // full error + stack, server-side
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Internal server error', requestId }
  });
};
```

The response is sanitized in every environment (no `err.message` for unexpected
errors); full detail lives in the server log, correlated by `requestId`.

## Migration (money-path controllers)

Controllers: `trading`, `transaccionBlockchain`, `transferencia`,
`intercambioExchange`, `transaccionesP2P`, `ofertaP2P`.

Per controller:
- Replace `catch (error) { res.status(...).json({ ..., details/error: error.message }) }`
  with either:
  - `throw new AppError(statusCode, code, safeMessage)` for a known business
    error (using/adding the code in `errorCodes.js`), or
  - removing the catch entirely and letting the error propagate to the central
    handler (for genuinely unexpected errors).
- Wrap the controller's route handlers with `asyncHandler` (at the route
  definition) so thrown errors reach the handler.
- Known business errors that were previously returned as `{ success:false, error }`
  (e.g. `balanceCheck` / validation results) become `AppError` throws with the
  appropriate code.

The central handler is wired globally first, so any error that propagates from a
**non-migrated** controller is already sanitized to a generic 500 — the leak is
closed for the whole app the moment the handler is in place; migration then
upgrades money-path errors from generic 500s to precise coded responses.

## Testing (TDD, Red-Green)

- `AppError`: constructor sets `statusCode`, `code`, `message`, `isOperational=true`;
  is an `instanceof Error`.
- `asyncHandler`: a wrapped handler that throws (sync and async) calls `next`
  with the error; a resolving handler does not call `next`.
- `errorHandler`: an `AppError` produces `res.status(code).json({ error: { code, message } })`;
  a plain `Error` produces status 500 with `{ error: { code:'INTERNAL_ERROR', message:'Internal server error', requestId } }`,
  does **not** include the original message, and logs the full error server-side.
- Migrated money-path endpoint (representative, via supertest with mocked
  services): a known business failure (e.g. insufficient balance) returns the
  right status + `code`; an unexpected thrown error returns the generic 500
  without leaking the message.
- Idempotency middleware: its three error responses now use the nested
  `{ error: { code, message } }` shape (update the existing tests accordingly).

## Rollout note

`server.js` currently mounts the error handler inline after the routes. The
replacement `errorHandler` must stay mounted **after** all routes, and the
error-handling middleware must be registered **last** (Express requires 4-arg
error middleware to come after normal middleware/routes). The existing 404
handler (`server.js:116`, currently `{ error: 'Route not found' }`) is updated to
the canonical envelope `{ error: { code: 'NOT_FOUND', message: 'Route not found' } }`
and stays registered before the error handler.
