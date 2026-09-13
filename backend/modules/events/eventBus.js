// modules/events/eventBus.js
// In-process domain-event registry. Handlers subscribe by event type; the outbox
// publisher calls dispatch(). Deliberately dumb — durability lives in the outbox
// table, not here.
const handlers = new Map(); // type -> [{ name, fn }]

function on(type, name, fn) {
  if (!handlers.has(type)) handlers.set(type, []);
  handlers.get(type).push({ name, fn });
}

async function dispatch(event) {
  const list = handlers.get(event.type) || [];
  for (const { fn } of list) {
    await fn(event); // a throw propagates so the publisher retries the whole event
  }
}

function _reset() { handlers.clear(); }

module.exports = { on, dispatch, _reset };
