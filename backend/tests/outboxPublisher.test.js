const { computeRetry, publishBatch } = require('../modules/events/outboxPublisher');

describe('computeRetry', () => {
  const opts = { maxAttempts: 3, baseBackoffMs: 1000, maxBackoffMs: 1000000, now: 0 };
  test('reschedules with exponential backoff below max attempts', () => {
    expect(computeRetry({ attempts: 0 }, new Error('e'), opts))
      .toEqual({ status: 'pending', attempts: 1, lastError: 'e', availableAt: new Date(1000) });
    expect(computeRetry({ attempts: 1 }, new Error('e'), opts))
      .toEqual({ status: 'pending', attempts: 2, lastError: 'e', availableAt: new Date(2000) });
  });
  test('dead-letters at max attempts', () => {
    expect(computeRetry({ attempts: 2 }, new Error('boom'), opts))
      .toEqual({ status: 'failed', attempts: 3, lastError: 'boom' });
  });
  test('caps backoff at maxBackoffMs', () => {
    const capOpts = { maxAttempts: 10, baseBackoffMs: 1000, maxBackoffMs: 3000, now: 0 };
    // attempts=0 → raw=1000, attempts=1 → raw=2000, attempts=2 → raw=4000 (exceeds cap)
    expect(computeRetry({ attempts: 2 }, new Error('e'), capOpts))
      .toEqual({ status: 'pending', attempts: 3, lastError: 'e', availableAt: new Date(3000) });
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
