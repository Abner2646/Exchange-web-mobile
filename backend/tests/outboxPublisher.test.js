const { computeRetry, publishBatch } = require('../modules/events/outboxPublisher');

describe('computeRetry', () => {
  const opts = { maxAttempts: 3, baseBackoffMs: 1000, now: 0 };
  test('reschedules with exponential backoff below max attempts', () => {
    expect(computeRetry({ attempts: 0 }, new Error('e'), opts))
      .toEqual({ status: 'pending', attempts: 1, lastError: 'e', availableAt: new Date(1000) });
    expect(computeRetry({ attempts: 1 }, new Error('e'), opts).availableAt).toEqual(new Date(2000));
  });
  test('dead-letters at max attempts', () => {
    expect(computeRetry({ attempts: 2 }, new Error('boom'), opts))
      .toEqual({ status: 'failed', attempts: 3, lastError: 'boom' });
  });
});

describe('publishBatch', () => {
  test('dispatches, marks dispatched on success, and a poison event does not block the rest', async () => {
    const dispatched = [], failed = [];
    const events = [
      { id: '1', type: 'ok' },
      { id: '2', type: 'boom', attempts: 0 },
      { id: '3', type: 'ok' },
    ];
    const res = await publishBatch({
      events,
      dispatch: async (e) => { if (e.type === 'boom') throw new Error('x'); },
      markDispatched: async (e) => dispatched.push(e.id),
      markFailed: async (e) => failed.push(e.id),
      computeRetryState: () => ({ status: 'pending' }),
    });
    expect(dispatched).toEqual(['1', '3']);
    expect(failed).toEqual(['2']);
    expect(res).toEqual({ processed: 3, ok: 2, failed: 1 });
  });
});
