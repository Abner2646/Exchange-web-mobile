const money = require('../../utils/money');
const { CuentaLedger, MovimientoLedger, SaldoLedger } = require('../../models');
const { HOUSE_OWNER_ID } = require('./ledgerAccounts');

// Interno: para toda cuenta, la proyeccion (SaldoLedger) debe ser igual a la
// suma de sus movimientos. Si difiere, la proyeccion se desincronizo (bug).
async function reconciliarInterno(transaction = null) {
  const cuentas = await CuentaLedger.findAll({ transaction });
  const discrepancias = [];
  for (const cuenta of cuentas) {
    const movimientos = await MovimientoLedger.findAll({ where: { cuentaId: cuenta.id }, transaction });
    let suma = '0';
    for (const m of movimientos) suma = money.add(suma, String(m.monto));
    const proy = await SaldoLedger.findOne({ where: { cuentaId: cuenta.id }, transaction });
    const proyeccion = proy ? String(proy.saldo) : '0';
    if (money.compare(proyeccion, suma) !== 0) {
      discrepancias.push({ cuentaId: cuenta.id, proyeccion, suma });
    }
  }
  return { ok: discrepancias.length === 0, discrepancias };
}

// Externo: por cada cripto, la suma de TODOS los movimientos (usuarios + casa)
// debe dar 0 — el libro cierra. Se reporta usuarios vs casa por transparencia.
async function reconciliarExterno(transaction = null) {
  const movimientos = await MovimientoLedger.findAll({
    include: [{ model: CuentaLedger, as: 'cuenta', attributes: ['ownerId'] }],
    transaction,
  });
  const porCripto = {};
  for (const m of movimientos) {
    const c = m.criptomonedaId;
    if (!porCripto[c]) porCripto[c] = { usuarios: '0', casa: '0', neto: '0' };
    const esCasa = m.cuenta.ownerId === HOUSE_OWNER_ID;
    if (esCasa) porCripto[c].casa = money.add(porCripto[c].casa, String(m.monto));
    else porCripto[c].usuarios = money.add(porCripto[c].usuarios, String(m.monto));
  }
  let ok = true;
  for (const c of Object.keys(porCripto)) {
    porCripto[c].neto = money.add(porCripto[c].usuarios, porCripto[c].casa);
    if (money.compare(porCripto[c].neto, '0') !== 0) ok = false;
  }
  return { ok, porCripto };
}

// Paridad transicional: mientras el shim CDC (balanceMirror) espeja
// balances_users al ledger, el ledger funding de cada (usuario, cripto) debe
// igualar la fila legacy. Es el gate que prueba que el shim captura el 100% de
// las escrituras. Se retira cuando la migracion por-camino elimina balances_users.
async function reconciliarConLegacy(transaction = null) {
  const { BalanceUsuario } = require('../../models');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const { getSaldoCuenta } = require('./postingService');
  const filas = await BalanceUsuario.findAll({ transaction });
  const discrepancias = [];
  for (const b of filas) {
    const disp = await getSaldoCuenta({ ownerId: b.userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: b.criptomonedaId }, transaction);
    const bloq = await getSaldoCuenta({ ownerId: b.userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: b.criptomonedaId }, transaction);
    if (money.compare(disp, String(b.balanceDisponible)) !== 0) {
      discrepancias.push({ userId: b.userId, criptomonedaId: b.criptomonedaId, campo: 'disponible', ledger: disp, legacy: String(b.balanceDisponible) });
    }
    if (money.compare(bloq, String(b.balanceBloqueado)) !== 0) {
      discrepancias.push({ userId: b.userId, criptomonedaId: b.criptomonedaId, campo: 'bloqueado', ledger: bloq, legacy: String(b.balanceBloqueado) });
    }
  }
  return { ok: discrepancias.length === 0, discrepancias };
}

module.exports = { reconciliarInterno, reconciliarExterno, reconciliarConLegacy };
