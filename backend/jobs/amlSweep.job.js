// Periodic AML sweep scheduler (Slice C). Mirrors reconciliation.job: a singleton
// with a re-entrancy guard so a slow pass never stacks. The sweep itself is a no-op
// when monitoring is off (checked inside runSweep), so this can always run.
const amlSweep = require('../modules/aml/amlSweep');

// Clamp a un valor positivo: un env negativo/no-numérico cae al default (evita
// setInterval(-1) → tight-loop).
const parsedInterval = Number(process.env.AML_SWEEP_INTERVAL_MS);
const FREQUENCY_MS = parsedInterval > 0 ? parsedInterval : 30 * 60 * 1000; // 30 min

class AmlSweepJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.sweeping = false; // re-entrancy guard (un pase escanea todas las txs recientes)
    this.lastRunAt = null;
    this.lastResult = null;
  }

  start() {
    if (this.isRunning) return;
    this.run();
    this.interval = setInterval(() => this.run(), FREQUENCY_MS);
    this.isRunning = true;
    console.log('✅ AML Sweep Job started');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
  }

  async run() {
    // Si el pase anterior sigue corriendo NO apilar otro — evita corridas solapadas
    // que agotarían el pool de conexiones.
    if (this.sweeping) {
      console.warn('[amlSweep] previous pass still running, skipping this tick');
      return;
    }
    this.sweeping = true;
    try {
      this.lastResult = await amlSweep.runSweep();
      this.lastRunAt = new Date();
    } catch (error) {
      console.error('❌ AML Sweep Job error:', error.message);
    } finally {
      this.sweeping = false;
    }
  }

  getStatus() {
    return { isRunning: this.isRunning, frequencyMs: FREQUENCY_MS, lastRunAt: this.lastRunAt, lastResult: this.lastResult };
  }
}

module.exports = new AmlSweepJob();
