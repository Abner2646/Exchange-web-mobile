// Unit sin-DB: fija el registro único compartimento→propósitos (COMPARTMENTS en
// ledgerAccounts) que usan la fachada de saldos y las operaciones del ledger.
// Cazar acá un typo de propósito evita leer/postear la cuenta equivocada.
const { COMPARTMENTS, PURPOSES } = require('../modules/balances/ledger/ledgerAccounts');

test('funding mapea a disponible/bloqueado/pendiente', () => {
  expect(COMPARTMENTS.funding).toEqual({
    available: PURPOSES.FUNDING_AVAILABLE,
    blocked: PURPOSES.FUNDING_BLOCKED,
    pending: PURPOSES.FUNDING_PENDING,
  });
});

test('spot mapea a disponible/bloqueado (sin pendiente)', () => {
  expect(COMPARTMENTS.spot).toEqual({
    available: PURPOSES.SPOT_AVAILABLE,
    blocked: PURPOSES.SPOT_BLOCKED,
    pending: null,
  });
});
