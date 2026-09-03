// Job de reconciliación del ledger (§5.6): periódicamente verifica que la
// proyección == suma de movimientos (interno) y que el libro cierra en cero
// (externo), y ALARMA (log de error) ante cualquier discrepancia. La decisión de
// alarmar vive en services/ledger/reconciliationAlarm (unit-testeada); acá sólo el
// scheduling. Frecuencia configurable por RECONCILIATION_INTERVAL_MS.
const recon = require('../services/ledger/reconciliation');
const { runReconciliationCheck } = require('../services/ledger/reconciliationAlarm');

// Clamp a un valor positivo: un env negativo/no-numérico cae al default (evita
// setInterval(-1) → tight-loop).
const parsedInterval = Number(process.env.RECONCILIATION_INTERVAL_MS);
const FREQUENCY_MS = parsedInterval > 0 ? parsedInterval : 15 * 60 * 1000; // 15 min

class ReconciliationJob {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.checking = false; // guard de re-entrancy (un pase escanea todo el ledger)
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
    // Si el pase anterior sigue corriendo (ledger grande, scan lento) NO apilar
    // otro — evita corridas solapadas que agotarían el pool de conexiones.
    if (this.checking) {
      console.warn('[reconciliation] pase anterior aún en curso, se saltea este tick');
      return;
    }
    this.checking = true;
    try {
      const res = await runReconciliationCheck({
        reconciliarInterno: recon.reconciliarInterno,
        reconciliarExterno: recon.reconciliarExterno,
      });
      this.lastOk = res.ok;
      this.lastRunAt = new Date();
    } catch (error) {
      console.error('❌ Reconciliation Job error:', error.message);
    } finally {
      this.checking = false;
    }
  }

  getStatus() {
    return { isRunning: this.isRunning, frequencyMs: FREQUENCY_MS, lastRunAt: this.lastRunAt, lastOk: this.lastOk };
  }
}

module.exports = new ReconciliationJob();
