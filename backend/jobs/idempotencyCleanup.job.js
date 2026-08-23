const { IdempotencyKey, Sequelize } = require('../models');
const { Op } = Sequelize;

const TTL_MS = 24 * 60 * 60 * 1000;   // keep keys for 24h
const FREQUENCY_MS = 60 * 60 * 1000;  // sweep hourly

class IdempotencyCleanupJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    this.cleanup();
    this.interval = setInterval(() => this.cleanup(), FREQUENCY_MS);
    this.isRunning = true;
    console.log('✅ Idempotency Cleanup Job started');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
  }

  async cleanup() {
    try {
      const cutoff = new Date(Date.now() - TTL_MS);
      const deleted = await IdempotencyKey.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
      if (deleted > 0) console.log(`🧹 Idempotency cleanup: removed ${deleted} expired keys`);
    } catch (error) {
      console.error('❌ Idempotency Cleanup Job error:', error.message);
    }
  }

  getStatus() {
    return { isRunning: this.isRunning, ttlMs: TTL_MS, frequencyMs: FREQUENCY_MS };
  }
}

module.exports = new IdempotencyCleanupJob();
