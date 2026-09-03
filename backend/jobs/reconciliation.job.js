// Job de reconciliación del ledger (§5.6): periódicamente verifica que la
// proyección == suma de movimientos (interno) y que el libro cierra en cero
// (externo), y ALARMA (log de error) ante cualquier discrepancia. La decisión de
// alarmar vive en services/ledger/reconciliationAlarm (unit-testeada); acá sólo el
// scheduling. Frecuencia configurable por RECONCILIATION_INTERVAL_MS.
const recon = require('../services/ledger/reconciliation');
const { runReconciliationCheck } = require('../services/ledger/reconciliationAlarm');

const FREQUENCY_MS = Number(process.env.RECONCILIATION_INTERVAL_MS) || 15 * 60 * 1000; // 15 min

class ReconciliationJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.lastRunAt = null;
    this.lastOk = null;
  }

  start() {
    if (this.isRunning) return;
    this.run();
    this.interval = setInterval(() => this.run(), FREQUENCY_MS);
    this.isRunning = true;
    console.log('✅ Reconciliation Job started');
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.isRunning = false;
  }

  async run() {
    try {
      const res = await runReconciliationCheck({
        reconciliarInterno: recon.reconciliarInterno,
        reconciliarExterno: recon.reconciliarExterno,
      });
      this.lastOk = res.ok;
      this.lastRunAt = new Date();
    } catch (error) {
      console.error('❌ Reconciliation Job error:', error.message);
    }
  }

  getStatus() {
    return { isRunning: this.isRunning, frequencyMs: FREQUENCY_MS, lastRunAt: this.lastRunAt, lastOk: this.lastOk };
  }
}

module.exports = new ReconciliationJob();
