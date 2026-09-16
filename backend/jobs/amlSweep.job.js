// Periodic AML sweep scheduler (Slice C). Mirrors reconciliation.job: a singleton
// with a re-entrancy guard so a slow pass never stacks. The sweep itself is a no-op
// when monitoring is off (checked inside runSweep), so this can always run.
const PeriodicJob = require('./periodicJob');
const amlSweep = require('../modules/aml/amlSweep');

// Clamp a un valor positivo: un env negativo/no-numérico cae al default (evita
// setInterval(-1) → tight-loop).
const parsedInterval = Number(process.env.AML_SWEEP_INTERVAL_MS);
const FREQUENCY_MS = parsedInterval > 0 ? parsedInterval : 30 * 60 * 1000; // 30 min

class AmlSweepJob extends PeriodicJob {
  constructor() {
    super(FREQUENCY_MS, 'AML Sweep Job');
    this.lastResult = null;
  }

  async doWork() {
    this.lastResult = await amlSweep.runSweep();
  }

  getStatus() {
    return { ...super.getStatus(), lastResult: this.lastResult };
  }
}

module.exports = new AmlSweepJob();
