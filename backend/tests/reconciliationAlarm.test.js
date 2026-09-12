// Unit sin-DB: la lógica de alarma de reconciliación (§5.6 del roadmap). Las
// funciones que tocan la DB (reconcileInternal/Externo) se inyectan como fakes;
// acá se prueba SÓLO la decisión de alarmar y el valor devuelto.
const { runReconciliationCheck } = require('../modules/balances/ledger/reconciliationAlarm');

function fakeLogger() {
  return { log: jest.fn(), error: jest.fn() };
}

test('libro consistente → ok true, sin alarma', async () => {
  const logger = fakeLogger();
  const res = await runReconciliationCheck({
    reconcileInternal: async () => ({ ok: true, discrepancies: [] }),
    reconcileExternal: async () => ({ ok: true, byCrypto: {} }),
    logger,
  });
  expect(res.ok).toBe(true);
  expect(logger.error).not.toHaveBeenCalled();
});

test('proyección != suma (interno) → ok false y alarma con las discrepancies', async () => {
  const logger = fakeLogger();
  const discrepancies = [{ cuentaId: 'c1', proyeccion: '5', suma: '4' }];
  const res = await runReconciliationCheck({
    reconcileInternal: async () => ({ ok: false, discrepancies }),
    reconcileExternal: async () => ({ ok: true, byCrypto: {} }),
    logger,
  });
  expect(res.ok).toBe(false);
  expect(logger.error).toHaveBeenCalledTimes(1);
  // el payload de la alarma incluye las discrepancies para el diagnóstico
  expect(logger.error.mock.calls[0].join(' ') + JSON.stringify(logger.error.mock.calls[0])).toMatch(/c1/);
});

test('el libro no cierra en cero (externo) → ok false y alarma', async () => {
  const logger = fakeLogger();
  const res = await runReconciliationCheck({
    reconcileInternal: async () => ({ ok: true, discrepancies: [] }),
    reconcileExternal: async () => ({ ok: false, byCrypto: { btc: { usuarios: '1', casa: '0', neto: '1' } } }),
    logger,
  });
  expect(res.ok).toBe(false);
  expect(logger.error).toHaveBeenCalledTimes(1);
});

test('si una reconciliación tira, la otra igual corre y ambas se evalúan (no se enmascara)', async () => {
  const logger = fakeLogger();
  const res = await runReconciliationCheck({
    reconcileInternal: async () => { throw new Error('DB caída'); },
    reconcileExternal: async () => ({ ok: false, byCrypto: { btc: { neto: '1' } } }),
    logger,
  });
  expect(res.ok).toBe(false);
  // alarma por AMBOS: el throw del interno y el desbalance del externo
  expect(logger.error).toHaveBeenCalledTimes(2);
  expect(res.interno.error).toMatch(/DB caída/);
});

test('devuelve los resultados crudos de ambas reconciliaciones', async () => {
  const interno = { ok: true, discrepancies: [] };
  const externo = { ok: true, byCrypto: { eth: { usuarios: '0', casa: '0', neto: '0' } } };
  const res = await runReconciliationCheck({
    reconcileInternal: async () => interno,
    reconcileExternal: async () => externo,
    logger: fakeLogger(),
  });
  expect(res.interno).toBe(interno);
  expect(res.externo).toBe(externo);
});
