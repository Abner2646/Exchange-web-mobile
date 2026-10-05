// Periodic oracle circuit breaker sweep (Hito 2). Runs the multi-source oracle over
// every active, externally-priced swap pair OUT of the swap hot-path: it refreshes
// currentPrice from the median and pauses pairs whose feed diverges. Singleton with
// the PeriodicJob re-entrancy guard so a slow pass (3 HTTP calls/pair) never stacks.
const PeriodicJob = require('./periodicJob');
const oracleCircuitBreaker = require('../modules/oracle/oracleCircuitBreaker.service');

// Clamp to a positive value: a negative/non-numeric env falls back to the default
// (avoids setInterval(-1) → tight loop). Default 60s — oracle prices move slowly and
// this hits 3 external APIs per pair, so a low-traffic box keeps it coarse.
const parsedInterval = Number(process.env.ORACLE_SWEEP_INTERVAL_MS);
const FREQUENCY_MS = parsedInterval > 0 ? parsedInterval : 60 * 1000; // 60s

class OracleBreakerJob extends PeriodicJob {
  constructor() {
    super(FREQUENCY_MS, 'Oracle Breaker Job');
    this.lastResult = null;
  }

  async doWork() {
    this.lastResult = await oracleCircuitBreaker.sweep();
  }

  getStatus() {
    return { ...super.getStatus(), lastResult: this.lastResult };
  }
}

module.exports = new OracleBreakerJob();
