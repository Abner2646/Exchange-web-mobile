// Unit sin-DB: la lógica de alarma de reconciliación (§5.6 del roadmap). Las
// funciones que tocan la DB (reconciliarInterno/Externo) se inyectan como fakes;
// acá se prueba SÓLO la decisión de alarmar y el valor devuelto.
const { runReconciliationCheck } = require('../services/ledger/reconciliationAlarm');

function fakeLogger() {
  return { log: jest.fn(), error: jest.fn() };
}

test('libro consistente → ok true, sin alarma', async () => {
  const logger = fakeLogger();
  const res = await runReconciliationCheck({
    reconciliarInterno: async () => ({ ok: true, discrepancias: [] }),
    reconciliarExterno: async () => ({ ok: true, porCripto: {} }),
    logger,
  });
  expect(res.ok).toBe(true);
  expect(logger.error).not.toHaveBeenCalled();
});

test('proyección != suma (interno) → ok false y alarma con las discrepancias', async () => {
  const logger = fakeLogger();
  const discrepancias = [{ cuentaId: 'c1', proyeccion: '5', suma: '4' }];
  const res = await runReconciliationCheck({
    reconciliarInterno: async () => ({ ok: false, discrepancias }),
    reconciliarExterno: async () => ({ ok: true, porCripto: {} }),
    logger,
  });
  expect(res.ok).toBe(false);
  expect(logger.error).toHaveBeenCalledTimes(1);
  // el payload de la alarma incluye las discrepancias para el diagnóstico
  expect(logger.error.mock.calls[0].join(' ') + JSON.stringify(logger.error.mock.calls[0])).toMatch(/c1/);
});

test('el libro no cierra en cero (externo) → ok false y alarma', async () => {
  const logger = fakeLogger();
  const res = await runReconciliationCheck({
    reconciliarInterno: async () => ({ ok: true, discrepancias: [] }),
    reconciliarExterno: async () => ({ ok: false, porCripto: { btc: { usuarios: '1', casa: '0', neto: '1' } } }),
    logger,
  });
  expect(res.ok).toBe(false);
  expect(logger.error).toHaveBeenCalledTimes(1);
});

test('devuelve los resultados crudos de ambas reconciliaciones', async () => {
  const interno = { ok: true, discrepancias: [] };
  const externo = { ok: true, porCripto: { eth: { usuarios: '0', casa: '0', neto: '0' } } };
  const res = await runReconciliationCheck({
    reconciliarInterno: async () => interno,
    reconciliarExterno: async () => externo,
    logger: fakeLogger(),
  });
  expect(res.interno).toBe(interno);
  expect(res.externo).toBe(externo);
});
