// modules/events/registerHandlers.js
// Wires all domain-event handlers to the eventBus. Call once at app bootstrap,
// before the outbox publisher job starts.
const eventBus = require('./eventBus');
const notificationHandlers = require('../notifications/notificationEventHandlers');

function registerAllHandlers() {
  notificationHandlers.register(eventBus);
}

module.exports = { registerAllHandlers };
