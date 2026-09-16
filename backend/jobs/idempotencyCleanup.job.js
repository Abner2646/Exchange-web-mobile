const PeriodicJob = require('./periodicJob');
const { IdempotencyKey, Sequelize } = require('../models');
const { Op } = Sequelize;

const TTL_MS       = 24 * 60 * 60 * 1000;  // keep keys for 24h
const FREQUENCY_MS = 60 * 60 * 1000;        // sweep hourly

class IdempotencyCleanupJob extends PeriodicJob {
  constructor() { super(FREQUENCY_MS, 'Idempotency Cleanup Job'); }

  async doWork() {
    const cutoff  = new Date(Date.now() - TTL_MS);
    const deleted = await IdempotencyKey.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
    if (deleted > 0) console.log(`🧹 Idempotency cleanup: removed ${deleted} expired keys`);
  }

  // Backward-compat alias used by existing tests.
  cleanup() { return this.run(); }

  getStatus() { return { ...super.getStatus(), ttlMs: TTL_MS }; }
}

module.exports = new IdempotencyCleanupJob();
