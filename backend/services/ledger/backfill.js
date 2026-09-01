const money = require('../../utils/money');
const { BalanceUsuario } = require('../../models');
const { postTransaction } = require('./postingService');
const { PROPOSITOS } = require('./ledgerAccounts');

// Backfill de apertura: replica cada BalanceUsuario existente como un asiento
// 'apertura' que acredita funding:disponible (+ funding:bloqueado si aplica)
// del usuario contra la cuenta de casa 'apertura'. Idempotente por referencia
// ('apertura:' + id del balance) — se puede correr N veces sin duplicar.
async function backfillSaldosDeApertura(transaction = null) {
  const balances = await BalanceUsuario.findAll({ transaction });
  let asientos = 0;

  for (const b of balances) {
    const disponible = String(b.balanceDisponible ?? '0');
    const bloqueado = String(b.balanceBloqueado ?? '0');
    const total = money.add(disponible, bloqueado);
    if (money.compare(total, '0') === 0) continue; // sin saldo, nada que abrir

    const lineas = [
      { ownerId: null, proposito: PROPOSITOS.APERTURA, criptomonedaId: b.criptomonedaId, monto: money.subtract('0', total) },
    ];
    if (money.compare(disponible, '0') > 0) {
      lineas.push({ ownerId: b.userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: b.criptomonedaId, monto: disponible });
    }
    if (money.compare(bloqueado, '0') > 0) {
      lineas.push({ ownerId: b.userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: b.criptomonedaId, monto: bloqueado });
    }

    await postTransaction({
      tipo: 'apertura',
      referencia: `apertura:${b.id}`,
      descripcion: 'Backfill de saldo inicial desde BalanceUsuario',
      lineas,
    }, transaction);
    asientos += 1;
  }

  return { asientos };
}

module.exports = { backfillSaldosDeApertura };
