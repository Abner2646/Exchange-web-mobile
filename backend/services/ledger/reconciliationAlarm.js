// Alarma de reconciliación del ledger (§5.6 del roadmap): corre las dos
// reconciliaciones y ALARMA (log de error) si alguna falla. Es la lógica pura de
// decisión — las funciones que tocan la DB se inyectan, así el job las cablea con
// reconciliation.js y los tests con fakes. Un hook de alerting real (Sentry, etc.)
// puede envolver esto más adelante sin tocar la decisión.
async function runReconciliationCheck({ reconciliarInterno, reconciliarExterno, logger = console } = {}) {
  const interno = await reconciliarInterno();
  const externo = await reconciliarExterno();

  if (!interno.ok) {
    logger.error('[reconciliation] ALARMA: la proyección no coincide con la suma de movimientos', {
      discrepancias: interno.discrepancias,
    });
  }
  if (!externo.ok) {
    logger.error('[reconciliation] ALARMA: el libro no cierra en cero por cripto', {
      porCripto: externo.porCripto,
    });
  }

  const ok = interno.ok && externo.ok;
  if (ok && typeof logger.log === 'function') {
    logger.log('[reconciliation] ok — proyección == suma y el libro cierra en cero');
  }
  return { ok, interno, externo };
}

module.exports = { runReconciliationCheck };
