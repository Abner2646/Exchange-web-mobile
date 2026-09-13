// Outbox publisher (Fase 6.2.1): polls pending outbox events and dispatches them
// through the eventBus with at-least-once delivery + backoff. Decision logic lives
// in modules/events/outboxPublisher (unit-tested); here only scheduling + I/O.
const { Op } = require('sequelize');
const { OutboxEvent } = require('../models');
const eventBus = require('../modules/events/eventBus');
const { computeRetry, publishBatch } = require('../modules/events/outboxPublisher');

const n = (v, d) => (Number(v) > 0 ? Number(v) : d);
const FREQUENCY_MS = n(process.env.OUTBOX_PUBLISHER_INTERVAL_MS, 2000);
const MAX_ATTEMPTS = n(process.env.OUTBOX_MAX_ATTEMPTS, 10);
const BATCH_SIZE = n(process.env.OUTBOX_BATCH_SIZE, 100);
const BASE_BACKOFF_MS = n(process.env.OUTBOX_BASE_BACKOFF_MS, 5000);

class OutboxPublisherJob {
  constructor() { this.interval = null; this.isRunning = false; this.publishing = false; this.lastRunAt = null; }

  start() {
    if (this.isRunning) return;
    this.run();
    this.interval = setInterval(() => this.run(), FREQUENCY_MS);
    this.isRunning = true;
    console.log('✅ Outbox Publisher Job started');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
  }

  async run() {
    if (this.publishing) return; // reentrancy guard
    this.publishing = true;
    try {
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
        computeRetryState: (ev, err) => computeRetry(ev, err, { maxAttempts: MAX_ATTEMPTS, baseBackoffMs: BASE_BACKOFF_MS, now: Date.now() }),
      });
      this.lastRunAt = new Date();
    } catch (error) {
      console.error('❌ Outbox Publisher Job error:', error.message);
    } finally {
      this.publishing = false;
    }
  }

  getStatus() { return { isRunning: this.isRunning, frequencyMs: FREQUENCY_MS, lastRunAt: this.lastRunAt }; }
}

module.exports = new OutboxPublisherJob();
