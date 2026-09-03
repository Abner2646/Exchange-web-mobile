const { fn, col } = require('sequelize');
const money = require('../../utils/money');
const { CuentaLedger, MovimientoLedger, SaldoLedger } = require('../../models');
const { HOUSE_OWNER_ID } = require('./ledgerAccounts');

// Interno: para toda cuenta, la proyeccion (SaldoLedger) debe ser igual a la
// suma de sus movimientos. Si difiere, la proyeccion se desincronizo (bug).
// La suma la hace la DB (SUM ... GROUP BY cuentaId) en vez de traer cada
// movimiento a memoria y sumarlo en JS (antes: 1 + 2N queries; ahora: 3).
async function reconciliarInterno(transaction = null) {
  const cuentas = await CuentaLedger.findAll({ attributes: ['id'], raw: true, transaction });
  const sumRows = await MovimientoLedger.findAll({
    attributes: ['cuentaId', [fn('SUM', col('monto')), 'suma']],
    group: ['cuentaId'], raw: true, transaction,
  });
  const saldoRows = await SaldoLedger.findAll({ attributes: ['cuentaId', 'saldo'], raw: true, transaction });
  const sumMap = new Map(sumRows.map((r) => [r.cuentaId, String(r.suma)]));
  const saldoMap = new Map(saldoRows.map((r) => [r.cuentaId, String(r.saldo)]));

  const discrepancias = [];
  for (const cuenta of cuentas) {
    const suma = sumMap.get(cuenta.id) || '0';
    const proyeccion = saldoMap.get(cuenta.id) || '0';
    if (money.compare(proyeccion, suma) !== 0) {
      discrepancias.push({ cuentaId: cuenta.id, proyeccion, suma });
    }
  }
  return { ok: discrepancias.length === 0, discrepancias };
}

// Externo: por cada cripto, la suma de TODOS los movimientos (usuarios + casa)
// debe dar 0 — el libro cierra. Se reporta usuarios vs casa por transparencia.
// La suma la hace la DB agrupando por (cripto, dueño) en vez de traer TODOS los
// movimientos a memoria (con el ledger creciendo, eso era un riesgo de OOM).
async function reconciliarExterno(transaction = null) {
  // Suma por cuenta en la DB (una fila por cuenta), y las cuentas con su (dueño,
  // cripto). El split casa/usuarios y la agregación por cripto se hace en JS sobre
  // O(cuentas) filas — nunca se traen los movimientos individuales. Cada cuenta
  // del ledger es de una sola cripto, así que su suma pertenece a esa cripto.
  const cuentas = await CuentaLedger.findAll({
    attributes: ['id', 'ownerId', 'criptomonedaId'], raw: true, transaction,
  });
  const sumRows = await MovimientoLedger.findAll({
    attributes: ['cuentaId', [fn('SUM', col('monto')), 'suma']],
    group: ['cuentaId'], raw: true, transaction,
  });
  const sumMap = new Map(sumRows.map((r) => [r.cuentaId, String(r.suma)]));

  const porCripto = {};
  for (const cuenta of cuentas) {
    const c = cuenta.criptomonedaId;
    if (!porCripto[c]) porCripto[c] = { usuarios: '0', casa: '0', neto: '0' };
    const suma = sumMap.get(cuenta.id) || '0';
    if (cuenta.ownerId === HOUSE_OWNER_ID) porCripto[c].casa = money.add(porCripto[c].casa, suma);
    else porCripto[c].usuarios = money.add(porCripto[c].usuarios, suma);
  }
  let ok = true;
  for (const c of Object.keys(porCripto)) {
    porCripto[c].neto = money.add(porCripto[c].usuarios, porCripto[c].casa);
    if (money.compare(porCripto[c].neto, '0') !== 0) ok = false;
  }
  return { ok, porCripto };
}

// (Write-flip Paso B: reconciliarConLegacy se retiró junto con el shim CDC —
// probaba paridad ledger==balances_users, que ya no aplica: el ledger es la
// única fuente de verdad. La reconciliación viva es interna (proyección==SUM) y
// externa (el libro cierra en cero).)

module.exports = { reconciliarInterno, reconciliarExterno };
