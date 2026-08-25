# transaccionBlockchain Migration Report
**Date:** 2026-08-24  
**Branch:** dev  
**Task:** Migrate `transaccionBlockchain.controller.js` to AppError + central error handler

---

## RED / GREEN Evidence

### RED (tests written first, before any controller change)
```
FAIL tests/transaccionBlockchainErrorEnvelope.test.js
Tests: 7 failed, 1 passed, 8 total
```
- 7 tests failing for the right reasons: controller was returning `{ success: false, message: ..., error: error.message }` format, not `{ error: { code, message } }`.
- 1 test passing immediately (joi validation short-circuit test — it tests the pre-existing joi middleware, not the controller).

### GREEN (after migration)
```
PASS tests/transaccionBlockchainErrorEnvelope.test.js
Tests: 8 passed, 8 total
```

### Full suite result
```
Test Suites: 4 skipped, 53 passed, 53 of 57 total
Tests:       10 skipped, 247 passed, 257 total
Time: 10.043 s
```
- 4 suites skipped: Postgres-dependent integration tests (no DB available in test env — pre-existing).
- 0 regressions. `withdrawalSystemRoutes.test.js` continues passing with the updated route file.

---

## Error Codes Added to `errorCodes.js`

All domain-prefixed, only codes actually used:

| Code | Status | Used in |
|------|--------|---------|
| `WITHDRAWAL_VALIDATION_FAILED` | 400 | `createWithdrawal` — validation.valid = false |
| `WITHDRAWAL_INVALID_ADDRESS` | 400 | `createWithdrawal` — blockchain address invalid |
| `TRANSACTION_NOT_FOUND` | 404 | `getTransaction`, `approveTransaction`, `rejectTransaction`, `getTransactionByHash` |
| `TRANSACTION_FORBIDDEN` | 403 | `getTransaction`, `getTransactionByHash` — non-owner non-admin |
| `TRANSACTION_INVALID_STATE` | 400 | `approveTransaction` — state != 'pendiente' |
| `DEPOSIT_CRYPTO_NOT_FOUND` | 404 | `getDepositAddress` — crypto inactive/missing |
| `DEPOSIT_ADDRESS_GENERATION_FAILED` | 500 | `getDepositAddress` — generateAddressForUser throws, or direccion empty |
| `ADMIN_FORBIDDEN` | 403 | All admin/system endpoints — rol check |

---

## Branches Converted

All 15 error-returning sites in the controller migrated:

| Method | Error sites migrated |
|--------|---------------------|
| `getMyTransactions` | 1 (unexpected 500 catch removed → propagates) |
| `getTransaction` | 3 (404, 403, unexpected 500) |
| `createWithdrawal` | 3 (400 validation, 400 bad address, unexpected 500) |
| `getMyBalances` | 1 (unexpected 500) |
| `getDepositAddress` | 4 (404 crypto, 500 generate error, 500 null address, unexpected 500) |
| `getAllTransactions` | 2 (403, unexpected 500) |
| `getPendingTransactions` | 2 (403, unexpected 500) |
| `approveTransaction` | 4 (403, 404, 400 state, unexpected 500) |
| `rejectTransaction` | 3 (403, 404, unexpected 500) |
| `getTransactionStats` | 2 (403, unexpected 500) |
| `scanDeposits` | 2 (403, unexpected 500) |
| `processWithdrawals` | 2 (403, unexpected 500) |
| `updateConfirmations` | 2 (403, unexpected 500) |
| `getBlockchainStatus` | 2 (403, unexpected 500) — inner per-network catch kept (intentional, logs errors per network) |
| `getTransactionByHash` | 3 (404, 403, unexpected 500) |

---

## Rollback Handling Notes

This controller has **no Sequelize DB transactions with explicit rollback** — all business logic (balance locking, withdrawal creation) is delegated to model-layer methods (`TransaccionBlockchain.validateWithdrawal`, `TransaccionBlockchain.createWithdrawal`, etc.) which handle their own transactions internally. No rollback logic was present in the controller, so nothing was dropped or modified. This was verified by reading the full controller before migration.

---

## Exposed Bug Fixes

**No bugs exposed that required fixes.** One pre-existing pattern noted:

- `getDepositAddress` had a nested `try/catch` that leaked `generateError.message` in the response body. This was cleaned up as part of the migration: the catch now throws `AppError(500, DEPOSIT_ADDRESS_GENERATION_FAILED, '<safe message>')` so the raw error never reaches the client. The raw message is still logged server-side via `console.error` before the throw.

---

## Route File Changes

`backend/routes/transaccionBlockchain.routes.js`:
- Added `const asyncHandler = require('../utils/asyncHandler');`
- All 6 active controller handler invocations wrapped with `asyncHandler(controller.method.bind(controller))`
- `.bind(controller)` added because `TransaccionBlockchainController` is exported as `new TransaccionBlockchainController()` (class instance) — methods reference `this` indirectly via the model imports, but binding is correct practice for class methods passed as callbacks
- `idempotency` middleware on `/withdraw` is NOT wrapped (it already calls `next(err)` on unexpected errors, reaching the central handler correctly)
- Existing middleware order preserved: `rateLimitMiddleware → joiValidate → idempotency → asyncHandler(controller)`

---

## Self-Review Checklist

- [x] All known business errors replaced with `throw new AppError(status, code, safeMessage)`
- [x] All wrapping try/catch removed — unexpected errors propagate to central handler
- [x] No raw `error.message` / `error.details` in any response
- [x] `error.message` still logged server-side via `console.error` before the throw in the one catch that's kept (address generation)
- [x] No guard or business logic weakened
- [x] `parseFloat(cantidad)` in createWithdrawal preserved (money-critical path unchanged)
- [x] Confirmation count logic preserved exactly
- [x] Inner per-network catch in `getBlockchainStatus` preserved (intentional: partial failure is reported per-network, not as a full 500)
- [x] No new codes added speculatively (YAGNI respected)
- [x] `errorCodes.js` frozen object correctly updated
- [x] TDD: RED observed before GREEN
- [x] Full suite: 0 regressions

---

## Files Changed

1. `backend/controllers/transaccionBlockchain.controller.js` — migrated (all 15 error sites)
2. `backend/routes/transaccionBlockchain.routes.js` — asyncHandler wrapping added
3. `backend/utils/errorCodes.js` — 8 new codes added
4. `backend/tests/transaccionBlockchainErrorEnvelope.test.js` — new TDD test file (8 tests)
5. `.superpowers/sdd/transaccionBlockchain-report.md` — this report
