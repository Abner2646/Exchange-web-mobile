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
});
