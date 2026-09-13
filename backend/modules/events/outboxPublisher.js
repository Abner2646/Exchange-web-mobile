// modules/events/outboxPublisher.js
// Pure retry/backoff decision + batch orchestration. No DB/bus deps — everything
// is injected, so it unit-tests without a database.

function computeRetry(event, error, { maxAttempts, baseBackoffMs, maxBackoffMs, now }) {
  const attempts = event.attempts + 1;
  if (attempts >= maxAttempts) {
    return { status: 'failed', attempts, lastError: error.message };
  }
  const backoff = Math.min(baseBackoffMs * 2 ** (attempts - 1), maxBackoffMs);
  return { status: 'pending', attempts, lastError: error.message, availableAt: new Date(now + backoff) };
}

async function publishBatch({ events, dispatch, markDispatched, markFailed, computeRetryState }) {
  let ok = 0, failed = 0;
  for (const event of events) {
    try {
      await dispatch(event);
      try {
        await markDispatched(event);
      } catch (persistErr) {
        console.error(`[outbox] markDispatched failed for event ${event.id}:`, persistErr.message);
      }
      ok++;
    } catch (error) {
      try {
        await markFailed(event, computeRetryState(event, error));
      } catch (persistErr) {
        console.error(`[outbox] markFailed failed for event ${event.id}:`, persistErr.message);
      }
      failed++;
    }
  }
  return { processed: events.length, ok, failed };
}

module.exports = { computeRetry, publishBatch };
