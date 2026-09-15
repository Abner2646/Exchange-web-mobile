// jobs/periodicJob.js
// Base class for periodic jobs: handles the interval/re-entrancy-guard/lifecycle
// skeleton. Subclasses override doWork() and may extend getStatus().
class PeriodicJob {
  constructor(frequencyMs, name) {
    this.frequencyMs = frequencyMs;
    this.name = name;
    this.interval = null;
    this.isRunning = false;
    this._running = false; // re-entrancy guard
    this.lastRunAt = null;
    this.lastError = null;
  }

  // Subclasses must override this. Must return a Promise.
  async doWork() {
    throw new Error(`${this.name}: doWork() not implemented`);
  }

  start() {
    if (this.isRunning) return;
    this.run();
    this.interval = setInterval(() => this.run(), this.frequencyMs);
    this.isRunning = true;
    console.log(`✅ ${this.name} started`);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
  }

  async run() {
    if (this._running) {
      console.warn(`[${this.name}] previous pass still running, skipping this tick`);
      return;
    }
    this._running = true;
    this.lastRunAt = new Date();
    try {
      await this.doWork();
      this.lastError = null;
    } catch (err) {
      this.lastError = err.message;
      console.error(`❌ ${this.name} error:`, err.message);
    } finally {
      this._running = false;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      frequencyMs: this.frequencyMs,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
    };
  }
}

module.exports = PeriodicJob;
