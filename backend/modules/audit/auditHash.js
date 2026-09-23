// modules/audit/auditHash.js
// Pure hashing for the audit-trail chain. No DB. Node built-in crypto only.
'use strict';

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
