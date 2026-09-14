const eventBus = require('../modules/events/eventBus');

beforeEach(() => eventBus._reset());

describe('eventBus', () => {
  test('runs all handlers registered for the event type', async () => {
    const calls = [];
    eventBus.on('A', 'h1', async (e) => calls.push(['h1', e.payload]));
    eventBus.on('A', 'h2', async (e) => calls.push(['h2', e.payload]));
    await eventBus.dispatch({ type: 'A', payload: 1 });
    expect(calls).toEqual([['h1', 1], ['h2', 1]]);
  });

  test('unknown type is a no-op', async () => {
    await expect(eventBus.dispatch({ type: 'nope', payload: 1 })).resolves.toBeUndefined();
  });

  test('a throwing handler propagates (so the publisher can retry)', async () => {
    eventBus.on('B', 'boom', async () => { throw new Error('fail'); });
    await expect(eventBus.dispatch({ type: 'B', payload: 1 })).rejects.toThrow('fail');
  });

  test('onAny handlers run for every event type', async () => {
    const seen = [];
    eventBus.onAny('audit', async (e) => seen.push(e.type));
    await eventBus.dispatch({ type: 'A', payload: 1 });
    await eventBus.dispatch({ type: 'Z', payload: 2 });
    expect(seen).toEqual(['A', 'Z']);
  });

  test('onAny handlers run BEFORE per-type handlers', async () => {
    const order = [];
    eventBus.on('A', 'typed', async () => order.push('typed'));
    eventBus.onAny('any', async () => order.push('any'));
    await eventBus.dispatch({ type: 'A', payload: 1 });
    expect(order).toEqual(['any', 'typed']);
  });

  test('a throwing onAny handler propagates', async () => {
    eventBus.onAny('boom', async () => { throw new Error('fail'); });
    await expect(eventBus.dispatch({ type: 'A', payload: 1 })).rejects.toThrow('fail');
  });
});
