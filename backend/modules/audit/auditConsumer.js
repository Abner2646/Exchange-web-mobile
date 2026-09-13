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
