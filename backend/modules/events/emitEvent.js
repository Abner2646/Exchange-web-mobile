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
