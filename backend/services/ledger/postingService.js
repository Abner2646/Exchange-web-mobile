const money = require('../../utils/money');
const { sequelize, CuentaLedger, AsientoLedger, MovimientoLedger, SaldoLedger } = require('../../models');
const { resolveAccount, isCuentaUsuario, HOUSE_OWNER_ID } = require('./ledgerAccounts');

// Error tipado de sobregiro. Los callers lo distinguen por `code === 'SOBREGIRO'`
// (no por regex sobre el mensaje, que se rompe en silencio si el texto cambia)
// para traducirlo al mensaje de dominio /insuficiente/ del contrato.
class SobregiroError extends Error {
  constructor(proposito, saldo, monto) {
    super(`Sobregiro en cuenta ${proposito}: saldo ${saldo}, movimiento ${monto}`);
    this.name = 'SobregiroError';
    this.code = 'SOBREGIRO';
  }
}

// Invariante de partida doble: dentro de un asiento, la suma con signo de los
// montos debe dar 0 POR CADA cripto (un swap cruza dos criptos y cada una
// cuadra sola).
function validarSumaCero(lineas) {
  const porCripto = {};
  for (const l of lineas) {
    porCripto[l.criptomonedaId] = money.add(porCripto[l.criptomonedaId] || '0', String(l.monto));
  }
  for (const [criptomonedaId, suma] of Object.entries(porCripto)) {
    if (money.compare(suma, '0') !== 0) {
      throw new Error(`Asiento desbalanceado en cripto ${criptomonedaId}: suma ${suma}`);
    }
  }
}

// El UNICO escritor de dinero. Inserta el asiento + sus movimientos y actualiza
// la proyeccion de saldo de cada cuenta, todo en una transaccion. Idempotente
// por `referencia`. Rechaza asientos desbalanceados y sobregiros de cuentas de
// usuario.
async function postTransaction({ tipo, referencia, descripcion = null, asientoReversadoId = null, lineas }, transaction = null) {
  validarSumaCero(lineas);

  const propia = !transaction;
  const t = transaction || await sequelize.transaction();
  try {
    // Idempotencia: si ya existe un asiento con esta referencia, no se postea nada.
    const existente = await AsientoLedger.findOne({ where: { referencia }, transaction: t });
    if (existente) {
      if (propia) await t.commit();
      return existente;
    }

    const asiento = await AsientoLedger.create(
      { tipo, referencia, descripcion, asientoReversadoId }, { transaction: t }
    );

    for (const linea of lineas) {
      const cuenta = await resolveAccount(linea, t);
      await MovimientoLedger.create({
        asientoId: asiento.id,
        cuentaId: cuenta.id,
        criptomonedaId: linea.criptomonedaId,
        monto: String(linea.monto),
      }, { transaction: t });

      // Proyeccion bajo lock de fila: serializa por cuenta (anti-sobregiro).
      let saldo = await SaldoLedger.findOne({
        where: { cuentaId: cuenta.id }, transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!saldo) {
        saldo = await SaldoLedger.create({ cuentaId: cuenta.id, saldo: '0' }, { transaction: t });
      }
      const nuevo = money.add(String(saldo.saldo), String(linea.monto));
      if (isCuentaUsuario(cuenta) && money.compare(nuevo, '0') < 0) {
        throw new SobregiroError(cuenta.proposito, saldo.saldo, linea.monto);
      }
      saldo.saldo = nuevo;
      await saldo.save({ transaction: t });
    }

    if (propia) await t.commit();
    return asiento;
  } catch (error) {
    if (propia) await t.rollback();
    throw error;
  }
}

async function getSaldoCuenta({ ownerId, proposito, criptomonedaId }, transaction = null) {
  const owner = ownerId || HOUSE_OWNER_ID;
  const cuenta = await CuentaLedger.findOne({ where: { ownerId: owner, proposito, criptomonedaId }, transaction });
  if (!cuenta) return '0';
  const saldo = await SaldoLedger.findOne({ where: { cuentaId: cuenta.id }, transaction });
  return saldo ? String(saldo.saldo) : '0';
}

module.exports = { validarSumaCero, postTransaction, getSaldoCuenta, SobregiroError };
