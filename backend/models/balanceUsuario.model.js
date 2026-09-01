// models/balanceUsuario.js
require('dotenv').config();

const { Op } = require('sequelize');
const money = require('../utils/money');
const crypto = require('crypto');

// Plan 3 (read-flip): las lecturas de saldo salen de la PROYECCION del ledger
// (compartimento Funding), no de balances_users. Requires lazy para evitar el
// ciclo models<->services/ledger (este modulo lo carga models/index.js). El
// mirror (Plan 2) mantiene paridad, asi que hoy los valores coinciden; el flip
// prepara el terreno para dejar de escribir balances_users por-camino.
async function leerFundingDesdeLedger(userId, criptomonedaId, transaction = null) {
  const { getSaldoCuenta } = require('../services/ledger/postingService');
  const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
  const balanceDisponible = await getSaldoCuenta(
    { ownerId: userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId }, transaction
  );
  const balanceBloqueado = await getSaldoCuenta(
    { ownerId: userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId }, transaction
  );
  return { balanceDisponible, balanceBloqueado };
}

// Read-flip (write-flip Paso A/B): agrega la proyeccion Funding del ledger para
// las lecturas de admin. Devuelve, por (usuario, cripto) con cuenta funding, el
// disponible y bloqueado desde SaldoLedger. Require lazy por el ciclo
// models<->services/ledger.
async function agregarFundingLedger({ userId = null, criptomonedaId = null } = {}) {
  const { CuentaLedger, SaldoLedger } = require('./index');
  const { PROPOSITOS, HOUSE_OWNER_ID } = require('../services/ledger/ledgerAccounts');
  const where = { proposito: [PROPOSITOS.FUNDING_DISPONIBLE, PROPOSITOS.FUNDING_BLOQUEADO] };
  if (userId) where.ownerId = userId;
  else where.ownerId = { [Op.ne]: HOUSE_OWNER_ID }; // solo cuentas de usuario
  if (criptomonedaId) where.criptomonedaId = criptomonedaId;

  const cuentas = await CuentaLedger.findAll({
    where,
    include: [{ model: SaldoLedger, as: 'saldoProyectado', attributes: ['saldo'] }],
  });

  // Colapsar disponible/bloqueado por (ownerId, criptomonedaId).
  const porClave = new Map();
  for (const c of cuentas) {
    const clave = `${c.ownerId}:${c.criptomonedaId}`;
    if (!porClave.has(clave)) {
      porClave.set(clave, { userId: c.ownerId, criptomonedaId: c.criptomonedaId, balanceDisponible: '0', balanceBloqueado: '0' });
    }
    const entrada = porClave.get(clave);
    const saldo = c.saldoProyectado ? String(c.saldoProyectado.saldo) : '0';
    if (c.proposito === PROPOSITOS.FUNDING_DISPONIBLE) entrada.balanceDisponible = saldo;
    else entrada.balanceBloqueado = saldo;
  }
  return [...porClave.values()];
}

function createBalanceUserModel(sequelize) {
  // Paso C: BalanceUsuario ya NO es un modelo Sequelize — la tabla balances_users
  // se eliminó. Es una FACHADA de operaciones de saldo respaldada por el ledger de
  // partida doble (los métodos postean/leen del ledger). Se conserva el nombre y
  // la API estática para no tocar los ~40 call sites (swap/trading/P2P/depósitos/
  // retiros); el rename a un servicio de saldos queda para Fase 6.2. `sequelize`
  // se usa sólo para sequelize.models.Criptomoneda en reclamarBtcGratis.
  const BalanceUsuario = {};

  // getById se retiro en el write-flip (Paso B): leia balances_users por PK de
  // fila, que no tiene analogo en el ledger (las cuentas son (dueño, proposito,
  // cripto), no una fila por (usuario, cripto)). Era admin-only y sin tests.

  // Plan 3 (read-flip): agrega desde la proyeccion del ledger las cuentas
  // Funding del usuario (una entrada por cripto que tenga cuenta funding). Nota:
  // a diferencia del viejo (que devolvia TODA fila de balances_users, incluidas
  // las de saldo 0 que crea el provisioning), aca solo aparecen las criptos con
  // movimiento en el ledger — el mirror saltea deltas en cero. Es un cambio de
  // display aceptable (no listar saldos en 0). Devuelve objetos planos (sin la
  // asociacion .criptomoneda, igual que el viejo findAll sin include).
  BalanceUsuario.getByUserId = async (userId) => {
    try {
      const { CuentaLedger } = require('./index');
      const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
      const cuentas = await CuentaLedger.findAll({
        where: { ownerId: userId, proposito: [PROPOSITOS.FUNDING_DISPONIBLE, PROPOSITOS.FUNDING_BLOQUEADO] },
        attributes: ['criptomonedaId'],
        group: ['criptomonedaId'],
      });
      const balances = [];
      for (const c of cuentas) {
        const { balanceDisponible, balanceBloqueado } = await leerFundingDesdeLedger(userId, c.criptomonedaId);
        balances.push({ userId, criptomonedaId: c.criptomonedaId, balanceDisponible, balanceBloqueado });
      }
      return balances;
    } catch (error) {
      throw new Error(`Error al obtener balances por usuario: ${error.message}`);
    }
  };

  // getByUserAndCrypto se define mas abajo (una sola vez, leyendo del ledger).

  // Read-flip (Paso B): lista desde la proyeccion Funding del ledger.
  BalanceUsuario.getAll = async (filters = {}) => {
    try {
      let filas = await agregarFundingLedger({ userId: filters.userId, criptomonedaId: filters.criptomonedaId });
      if (filters.minBalance) {
        filas = filas.filter((f) => money.compare(f.balanceDisponible, String(filters.minBalance)) >= 0);
      }
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      return filas.slice(offset, offset + limit);
    } catch (error) {
      throw new Error(`Error al obtener todos los balances: ${error.message}`);
    }
  };

  // Métodos de balance
  BalanceUsuario.getTotalBalance = async (userId, criptomonedaId, transaction = null) => {
    try {
      const { balanceDisponible, balanceBloqueado } = await leerFundingDesdeLedger(userId, criptomonedaId, transaction);
      return {
        disponible: balanceDisponible,
        bloqueado: balanceBloqueado,
        total: money.add(balanceDisponible, balanceBloqueado)
      };
    } catch (error) {
      throw new Error(`Error al calcular balance total: ${error.message}`);
    }
  };

  // Write-flip (Paso B): postea al ledger DIRECTO (compartimento Funding). Una
  // sola pata de usuario + contrapartida en 'suspense' para cerrar en cero (misma
  // logica que balanceMirror.espejar, ahora sin pasar por balances_users). El
  // guard de sobregiro vive en postTransaction (FOR UPDATE sobre la proyeccion);
  // se traduce su error /sobregiro/ al mensaje legacy /insuficiente/ del contrato.
  BalanceUsuario.updateBalance = async (userId, criptomonedaId, amount, type = 'disponible', transaction = null) => {
    const { postTransaction } = require('../services/ledger/postingService');
    const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
    const proposito = type === 'disponible' ? PROPOSITOS.FUNDING_DISPONIBLE : PROPOSITOS.FUNDING_BLOQUEADO;
    const monto = String(amount);
    try {
      await postTransaction({
        tipo: 'ajuste_legacy',
        referencia: `writeflip:${crypto.randomUUID()}`,
        lineas: [
          { ownerId: userId, proposito, criptomonedaId, monto },
          { ownerId: null, proposito: PROPOSITOS.SUSPENSE, criptomonedaId, monto: money.subtract('0', monto) },
        ],
      }, transaction);
    } catch (error) {
      if (/sobregiro/i.test(error.message)) {
        throw new Error(`Error al actualizar balance: Balance insuficiente. ${type}`);
      }
      throw new Error(`Error al actualizar balance: ${error.message}`);
    }
    const { balanceDisponible, balanceBloqueado } = await leerFundingDesdeLedger(userId, criptomonedaId, transaction);
    return { userId, criptomonedaId, balanceDisponible, balanceBloqueado };
  };

  // Plan 3 (read-flip): lee de la PROYECCION del ledger (compartimento Funding).
  // Contrato: devuelve un objeto {userId, criptomonedaId, balanceDisponible,
  // balanceBloqueado} con '0' si la cuenta no existe — en un ledger "sin balance"
  // == "0". Es equivalente al viejo null-si-no-hay-fila para los callers que
  // chequean saldo: compare('0', monto>0) < 0 → insuficiente, igual que !balance.
  // options.transaction se respeta (P2P/transferencia lo pasan).
  BalanceUsuario.getByUserAndCrypto = async (userId, criptomonedaId, options = {}) => {
    try {
      const { balanceDisponible, balanceBloqueado } = await leerFundingDesdeLedger(userId, criptomonedaId, options.transaction);
      return { userId, criptomonedaId, balanceDisponible, balanceBloqueado };
    } catch (error) {
      throw new Error(`Error al obtener balance: ${error.message}`);
    }
  };

  // Write-flip (Paso B): bloquear = dos patas de usuario (disponible -A,
  // bloqueado +A). Suma cero sin suspense. El anti-sobregiro (Críticos #5) sigue
  // vivo pero ahora es el FOR UPDATE de postTransaction sobre la fila de
  // proyeccion (probado en ledgerPosting concurrency); ya no hay findOne+save
  // sobre balances_users. `transaction` opcional: se pasa a postTransaction.
  BalanceUsuario.blockBalance = async (userId, criptomonedaId, amount, transaction = null) => {
    const { postTransaction } = require('../services/ledger/postingService');
    const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
    const monto = String(amount);
    try {
      await postTransaction({
        tipo: 'reserva_orden',
        referencia: `block:${crypto.randomUUID()}`,
        lineas: [
          { ownerId: userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId, monto: money.subtract('0', monto) },
          { ownerId: userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId, monto },
        ],
      }, transaction);
    } catch (error) {
      if (/sobregiro/i.test(error.message)) {
        throw new Error('Error al bloquear balance: Balance disponible insuficiente para bloquear');
      }
      throw new Error(`Error al bloquear balance: ${error.message}`);
    }
    const { balanceDisponible, balanceBloqueado } = await leerFundingDesdeLedger(userId, criptomonedaId, transaction);
    return { userId, criptomonedaId, balanceDisponible, balanceBloqueado };
  };

  BalanceUsuario.unblockBalance = async (userId, criptomonedaId, amount, transaction = null) => {
    const { postTransaction } = require('../services/ledger/postingService');
    const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
    const monto = String(amount);
    try {
      await postTransaction({
        tipo: 'liberacion_reserva',
        referencia: `unblock:${crypto.randomUUID()}`,
        lineas: [
          { ownerId: userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId, monto: money.subtract('0', monto) },
          { ownerId: userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId, monto },
        ],
      }, transaction);
    } catch (error) {
      if (/sobregiro/i.test(error.message)) {
        throw new Error('Error al desbloquear balance: Balance bloqueado insuficiente para desbloquear');
      }
      throw new Error(`Error al desbloquear balance: ${error.message}`);
    }
    const { balanceDisponible, balanceBloqueado } = await leerFundingDesdeLedger(userId, criptomonedaId, transaction);
    return { userId, criptomonedaId, balanceDisponible, balanceBloqueado };
  };

  // Métodos de validación
  BalanceUsuario.hasAvailableBalance = async (userId, criptomonedaId, amount, transaction = null) => {
    try {
      const { balanceDisponible } = await leerFundingDesdeLedger(userId, criptomonedaId, transaction);
      return money.compare(balanceDisponible, String(amount)) >= 0;
    } catch (error) {
      throw new Error(`Error al verificar balance disponible: ${error.message}`);
    }
  };

  // Métodos administrativos (read-flip Paso B: agregan la proyeccion del ledger)
  BalanceUsuario.getUsersWithBalance = async (criptomonedaId, minAmount = 0) => {
    try {
      const filas = await agregarFundingLedger({ criptomonedaId });
      return filas
        .filter((f) => money.compare(f.balanceDisponible, String(minAmount)) > 0)
        .map((f) => ({ userId: f.userId, balanceDisponible: f.balanceDisponible, balanceBloqueado: f.balanceBloqueado }));
    } catch (error) {
      throw new Error(`Error al obtener usuarios con balance: ${error.message}`);
    }
  };

  BalanceUsuario.getBalanceStats = async () => {
    try {
      const filas = await agregarFundingLedger();
      const porCripto = new Map();
      for (const f of filas) {
        if (!porCripto.has(f.criptomonedaId)) {
          porCripto.set(f.criptomonedaId, { criptomonedaId: f.criptomonedaId, totalUsers: 0, totalDisponible: '0', totalBloqueado: '0' });
        }
        const s = porCripto.get(f.criptomonedaId);
        s.totalUsers += 1;
        s.totalDisponible = money.add(s.totalDisponible, f.balanceDisponible);
        s.totalBloqueado = money.add(s.totalBloqueado, f.balanceBloqueado);
      }
      return [...porCripto.values()];
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de balance: ${error.message}`);
    }
  };

  // Método para reclamar BTC (SOLO TESTNET - ELIMINAR EN PRODUCCIÓN)
  BalanceUsuario.reclamarBtcGratis = async (userId, transaction = null) => {
    try {
      // 1. Verificar que el usuario NO tenga ningún balance existente.
      // Read-flip (Paso B): el "ya tiene saldo" sale de la proyeccion del ledger.
      const balancesLedger = await BalanceUsuario.getByUserId(userId);
      const tieneSaldo = balancesLedger.some(balance => {
        const total = money.add(String(balance.balanceDisponible), String(balance.balanceBloqueado));
        return money.compare(total, '0') > 0;
      });

      // Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #12): este chequeo
      // estaba comentado — cualquier usuario podía llamar este endpoint
      // repetidas veces y acumular BTC sin límite, sin siquiera necesitar
      // scriptear nada. Reactivado: el regalo es de una sola vez.
      if (tieneSaldo) {
        throw new Error('Ya tienes saldo en tu cuenta. El regalo de BTC es solo para usuarios nuevos.');
      }

      // 2. Buscar el BTC en la base de datos
      const Criptomoneda = sequelize.models.Criptomoneda;
      const btc = await Criptomoneda.getBySymbol('BTC');
      
      if (!btc) {
        throw new Error('BTC no está disponible en el sistema');
      }

      // 3. Agregar 1 BTC al usuario
      const nuevoBalance = await BalanceUsuario.updateBalance(
        userId, 
        btc.id, 
        1, 
        'disponible',
        transaction
      );

      return {
        success: true,
        message: '¡Felicidades! Has reclamado 1 BTC de regalo 🎉',
        balance: nuevoBalance
      };

    } catch (error) {
      throw new Error(`Error al reclamar BTC: ${error.message}`);
    }
  };

  return BalanceUsuario;
}

module.exports = createBalanceUserModel;