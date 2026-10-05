// modules/events/registerHandlers.js
// Wires all domain-event handlers to the eventBus. Call once at app bootstrap,
// before the outbox publisher job starts.
const eventBus = require('./eventBus');
const notificationHandlers = require('../notifications/notificationEventHandlers');
const auditHandlers = require('../audit/auditConsumer');
const amlHandlers = require('../aml/amlConsumer');
const referralHandlers = require('../referrals/referralsConsumer');

let wired = false;

function registerAllHandlers() {
  if (wired) return;
  wired = true;
  notificationHandlers.register(eventBus);
  auditHandlers.register(eventBus);
  amlHandlers.register(eventBus);
  referralHandlers.register(eventBus);
}

module.exports = { registerAllHandlers };
