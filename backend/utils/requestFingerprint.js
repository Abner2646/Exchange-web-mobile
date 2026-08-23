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
