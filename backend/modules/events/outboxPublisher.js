// modules/events/outboxPublisher.js
// Pure retry/backoff decision + batch orchestration. No DB/bus deps — everything
// is injected, so it unit-tests without a database.

function computeRetry(event, error, { maxAttempts, baseBackoffMs, now }) {
  const attempts = event.attempts + 1;
  if (attempts >= maxAttempts) {
    return { status: 'failed', attempts, lastError: error.message };
  }
  const backoff = baseBackoffMs * 2 ** (attempts - 1);
  return { status: 'pending', attempts, lastError: error.message, availableAt: new Date(now + backoff) };
}

async function publishBatch({ events, dispatch, markDispatched, markFailed, computeRetryState }) {
  let ok = 0, failed = 0;
  for (const event of events) {
    try {
      await dispatch(event);
      await markDispatched(event);
      ok++;
    } catch (error) {
      await markFailed(event, computeRetryState(event, error));
      failed++;
    }
  }
  return { processed: events.length, ok, failed };
}

module.exports = { computeRetry, publishBatch };
