// modules/events/registerHandlers.js
// Wires all domain-event handlers to the eventBus. Call once at app bootstrap,
// before the outbox publisher job starts.
const eventBus = require('./eventBus');
const notificationHandlers = require('../notifications/notificationEventHandlers');

let wired = false;

function registerAllHandlers() {
  if (wired) return;
  wired = true;
  notificationHandlers.register(eventBus);
}

module.exports = { registerAllHandlers };
