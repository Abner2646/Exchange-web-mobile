// Unit sin-DB: fija el registro único compartimento→propósitos (COMPARTIMENTOS en
// ledgerAccounts) que usan la fachada de saldos y las operaciones del ledger.
// Cazar acá un typo de propósito evita leer/postear la cuenta equivocada.
const { COMPARTIMENTOS, PROPOSITOS } = require('../services/ledger/ledgerAccounts');

test('funding mapea a disponible/bloqueado/pendiente', () => {
  expect(COMPARTIMENTOS.funding).toEqual({
    disponible: PROPOSITOS.FUNDING_DISPONIBLE,
    bloqueado: PROPOSITOS.FUNDING_BLOQUEADO,
    pendiente: PROPOSITOS.FUNDING_PENDIENTE,
  });
});

test('spot mapea a disponible/bloqueado (sin pendiente)', () => {
  expect(COMPARTIMENTOS.spot).toEqual({
    disponible: PROPOSITOS.SPOT_DISPONIBLE,
    bloqueado: PROPOSITOS.SPOT_BLOQUEADO,
    pendiente: null,
  });
});
