// Outbox publisher (Fase 6.2.1): polls pending outbox events and dispatches them
// through the eventBus with at-least-once delivery + backoff. Decision logic lives
// in modules/events/outboxPublisher (unit-tested); here only scheduling + I/O.
const PeriodicJob = require('./periodicJob');
const { Op } = require('sequelize');
const { OutboxEvent } = require('../models');
const eventBus = require('../modules/events/eventBus');
const { computeRetry, publishBatch } = require('../modules/events/outboxPublisher');

const n = (v, d) => (Number(v) > 0 ? Number(v) : d);
const FREQUENCY_MS    = n(process.env.OUTBOX_PUBLISHER_INTERVAL_MS, 2000);
const MAX_ATTEMPTS    = n(process.env.OUTBOX_MAX_ATTEMPTS, 10);
const BATCH_SIZE      = n(process.env.OUTBOX_BATCH_SIZE, 100);
const BASE_BACKOFF_MS = n(process.env.OUTBOX_BASE_BACKOFF_MS, 5000);
const MAX_BACKOFF_MS  = n(process.env.OUTBOX_MAX_BACKOFF_MS, 300000);

class OutboxPublisherJob extends PeriodicJob {
  constructor() { super(FREQUENCY_MS, 'Outbox Publisher Job'); }

  async doWork() {
    const events = await OutboxEvent.findAll({
      where: { status: 'pending', availableAt: { [Op.lte]: new Date() } },
      order: [['created_at', 'ASC']],
      limit: BATCH_SIZE,
    });
    await publishBatch({
      events,
      dispatch: (ev) => eventBus.dispatch(ev),
      markDispatched: (ev) => ev.update({ status: 'dispatched', dispatchedAt: new Date() }),
      markFailed: (ev, next) => {
        if (next.status === 'failed') {
          console.error(`❌ Outbox event ${ev.id} (${ev.type}) dead-lettered after ${next.attempts} attempts: ${next.lastError}`);
        }
        return ev.update(next);
      },
      computeRetryState: (ev, err) => computeRetry(ev, err, { maxAttempts: MAX_ATTEMPTS, baseBackoffMs: BASE_BACKOFF_MS, maxBackoffMs: MAX_BACKOFF_MS, now: Date.now() }),
    });
  }
}

module.exports = new OutboxPublisherJob();
