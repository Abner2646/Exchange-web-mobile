// Unit sin-DB: fija el mapa compartimento→propósitos que usa la fachada de saldos
// para leer del ledger. Cazar acá un typo de propósito evita leer la cuenta
// equivocada en producción.
const { PROPOSITOS_POR_COMPARTIMENTO } = require('../models/balanceUsuario.model');
const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');

test('funding mapea a disponible/bloqueado/pendiente', () => {
  expect(PROPOSITOS_POR_COMPARTIMENTO.funding).toEqual({
    disponible: PROPOSITOS.FUNDING_DISPONIBLE,
    bloqueado: PROPOSITOS.FUNDING_BLOQUEADO,
    pendiente: PROPOSITOS.FUNDING_PENDIENTE,
  });
});

test('spot mapea a disponible/bloqueado (sin pendiente)', () => {
  expect(PROPOSITOS_POR_COMPARTIMENTO.spot).toEqual({
    disponible: PROPOSITOS.SPOT_DISPONIBLE,
    bloqueado: PROPOSITOS.SPOT_BLOQUEADO,
    pendiente: null,
  });
});
