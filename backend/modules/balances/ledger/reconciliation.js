const { fn, col } = require('sequelize');
const money = require('../../../utils/money');
const { LedgerAccount, LedgerMovement, LedgerBalance } = require('../../../models');
const { HOUSE_OWNER_ID } = require('./ledgerAccounts');

// Interno: para toda cuenta, la proyeccion (LedgerBalance) debe ser igual a la
// suma de sus movimientos. Si difiere, la proyeccion se desincronizo (bug).
// La suma la hace la DB (SUM ... GROUP BY accountId) en vez de traer cada
// movimiento a memoria y sumarlo en JS (antes: 1 + 2N queries; ahora: 3).
async function reconcileInternal(transaction = null) {
  const accounts = await LedgerAccount.findAll({ attributes: ['id'], raw: true, transaction });
  const sumRows = await LedgerMovement.findAll({
    attributes: ['accountId', [fn('SUM', col('amount')), 'sum']],
    group: ['accountId'], raw: true, transaction,
  });
  const balanceRows = await LedgerBalance.findAll({ attributes: ['accountId', 'balance'], raw: true, transaction });
  const sumMap = new Map(sumRows.map((r) => [r.accountId, String(r.sum)]));
  const balanceMap = new Map(balanceRows.map((r) => [r.accountId, String(r.balance)]));

  const discrepancies = [];
  for (const account of accounts) {
    const sum = sumMap.get(account.id) || '0';
    const projection = balanceMap.get(account.id) || '0';
    if (money.compare(projection, sum) !== 0) {
      discrepancies.push({ accountId: account.id, projection, sum });
    }
  }
  return { ok: discrepancies.length === 0, discrepancies };
}

// Externo: por cada cripto, la suma de TODOS los movimientos (usuarios + casa)
// debe dar 0 — el libro cierra. Se reporta usuarios vs casa por transparencia.
// La suma la hace la DB agrupando por (cripto, dueño) en vez de traer TODOS los
// movimientos a memoria (con el ledger creciendo, eso era un riesgo de OOM).
async function reconcileExternal(transaction = null) {
  // Suma en la DB agrupando por (cuenta, cripto DEL MOVIMIENTO) — nunca se traen
  // los movimientos individuales. Se agrupa por cryptoId del movimiento (no
  // el de la cuenta) a propósito: la reconciliación existe para cazar bugs de
  // escritor, incluido uno que postee un movimiento con una cripto distinta a la
  // de su cuenta; atribuir por la cripto de la cuenta ocultaría ese caso. El dueño
  // (casa/usuario) se resuelve mapeando accountId→ownerId. Sólo aparecen las
  // criptos con movimientos (igual que la versión previa por-movimiento).
  const accounts = await LedgerAccount.findAll({ attributes: ['id', 'ownerId'], raw: true, transaction });
  const ownerMap = new Map(accounts.map((c) => [c.id, c.ownerId]));
  const sumRows = await LedgerMovement.findAll({
    attributes: ['accountId', 'cryptoId', [fn('SUM', col('amount')), 'sum']],
    group: ['accountId', 'cryptoId'], raw: true, transaction,
  });

  const byCrypto = {};
  for (const r of sumRows) {
    const c = r.cryptoId;
    if (!byCrypto[c]) byCrypto[c] = { users: '0', house: '0', net: '0' };
    const sum = String(r.sum);
    if (ownerMap.get(r.accountId) === HOUSE_OWNER_ID) byCrypto[c].house = money.add(byCrypto[c].house, sum);
    else byCrypto[c].users = money.add(byCrypto[c].users, sum);
  }
  let ok = true;
  for (const c of Object.keys(byCrypto)) {
    byCrypto[c].net = money.add(byCrypto[c].users, byCrypto[c].house);
    if (money.compare(byCrypto[c].net, '0') !== 0) ok = false;
  }
  return { ok, byCrypto };
}

// (Write-flip Paso B: reconciliarConLegacy se retiró junto con el shim CDC —
// probaba paridad ledger==balances_users, que ya no aplica: el ledger es la
// única fuente de verdad. La reconciliación viva es interna (proyección==SUM) y
// externa (el libro cierra en cero).)

module.exports = { reconcileInternal, reconcileExternal };
