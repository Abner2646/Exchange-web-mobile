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
