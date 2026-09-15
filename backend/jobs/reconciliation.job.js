// Job de reconciliación del ledger (§5.6): periódicamente verifica que la
// proyección == suma de movimientos (interno) y que el libro cierra en cero
// (externo), y ALARMA (log de error) ante cualquier discrepancia. La decisión de
// alarmar vive en modules/balances/ledger/reconciliationAlarm (unit-testeada); acá sólo el
// scheduling. Frecuencia configurable por RECONCILIATION_INTERVAL_MS.
const PeriodicJob = require('./periodicJob');
const recon = require('../modules/balances/ledger/reconciliation');
const { runReconciliationCheck } = require('../modules/balances/ledger/reconciliationAlarm');

// Clamp a un valor positivo: un env negativo/no-numérico cae al default (evita
// setInterval(-1) → tight-loop).
const parsedInterval = Number(process.env.RECONCILIATION_INTERVAL_MS);
const FREQUENCY_MS = parsedInterval > 0 ? parsedInterval : 15 * 60 * 1000; // 15 min

class ReconciliationJob extends PeriodicJob {
  constructor() {
    super(FREQUENCY_MS, 'Reconciliation Job');
    this.lastOk = null;
  }

  async doWork() {
    const res = await runReconciliationCheck({
      reconcileInternal: recon.reconcileInternal,
      reconcileExternal: recon.reconcileExternal,
    });
    this.lastOk = res.ok;
  }

  getStatus() {
    return { ...super.getStatus(), lastOk: this.lastOk };
  }
}

module.exports = new ReconciliationJob();
