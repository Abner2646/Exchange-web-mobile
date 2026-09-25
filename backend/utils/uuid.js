// utils/uuid.js
//
// Single source of truth for the UUID shape check that was copy-pasted across the
// governance, launchpad and swap controllers (each with its own identical regex).
// This exposes only the pure predicate — callers keep their own throw semantics
// (different HTTP codes / error codes / messages), so extracting the regex removes
// the duplication without coupling unrelated error handling.
//
// NOTE: intentionally version-agnostic (`[0-9a-f]{4}` in the 3rd/4th groups) to match
// the exact behavior the three controllers had. The stricter RFC-4122 v4 pattern used
// by the wallet address models is a deliberately different check and is left untouched.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(id) {
  return UUID_RE.test(String(id || ''));
}

module.exports = { UUID_RE, isUuid };
