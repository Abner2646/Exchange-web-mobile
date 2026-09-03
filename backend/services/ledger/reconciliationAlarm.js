// Alarma de reconciliación del ledger (§5.6 del roadmap): corre las dos
// reconciliaciones y ALARMA (log de error) si alguna falla. Es la lógica pura de
// decisión — las funciones que tocan la DB se inyectan, así el job las cablea con
// reconciliation.js y los tests con fakes. Un hook de alerting real (Sentry, etc.)
// puede envolver esto más adelante sin tocar la decisión.
async function runReconciliationCheck({ reconciliarInterno, reconciliarExterno, logger = console } = {}) {
  // Independientes (allSettled): un error/throw en una reconciliación NO debe
  // impedir que la otra corra y alarme. Una que tira cuenta como fallo (ok:false).
  const [internoR, externoR] = await Promise.allSettled([reconciliarInterno(), reconciliarExterno()]);
  const interno = internoR.status === 'fulfilled' ? internoR.value : { ok: false, error: internoR.reason?.message };
  const externo = externoR.status === 'fulfilled' ? externoR.value : { ok: false, error: externoR.reason?.message };

  if (!interno.ok) {
    logger.error('[reconciliation] ALARMA: la proyección no coincide con la suma de movimientos', {
      discrepancias: interno.discrepancias, error: interno.error,
    });
  }
  if (!externo.ok) {
    logger.error('[reconciliation] ALARMA: el libro no cierra en cero por cripto', {
      porCripto: externo.porCripto, error: externo.error,
    });
  }

  const ok = interno.ok && externo.ok;
  if (ok && typeof logger.log === 'function') {
    logger.log('[reconciliation] ok — proyección == suma y el libro cierra en cero');
  }
  return { ok, interno, externo };
}

module.exports = { runReconciliationCheck };
