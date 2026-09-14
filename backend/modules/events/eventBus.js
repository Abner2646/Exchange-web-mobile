// modules/events/eventBus.js
// In-process domain-event registry. Handlers subscribe by type via on(); onAny()
// subscribes to every event (used by the audit trail). The outbox publisher calls
// dispatch(). Durability lives in the outbox table, not here.
const handlers = new Map(); // type -> [{ name, fn }]
const anyHandlers = [];      // [{ name, fn }] — run for every event

function on(type, name, fn) {
  if (!handlers.has(type)) handlers.set(type, []);
  handlers.get(type).push({ name, fn });
}

function onAny(name, fn) {
  anyHandlers.push({ name, fn });
}

async function dispatch(event) {
  // any-handlers first (e.g. audit records the event before any type handler can
  // abort dispatch), then per-type handlers. A throw propagates so the publisher
  // retries the whole event.
  for (const { fn } of anyHandlers) {
    await fn(event);
  }
  const list = handlers.get(event.type) || [];
  for (const { fn } of list) {
    await fn(event);
  }
}

function _reset() { handlers.clear(); anyHandlers.length = 0; }

module.exports = { on, onAny, dispatch, _reset };
