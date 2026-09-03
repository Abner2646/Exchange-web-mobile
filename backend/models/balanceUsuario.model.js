// models/balanceUsuario.js
require('dotenv').config();

const { Op } = require('sequelize');
const money = require('../utils/money');
const crypto = require('crypto');

// Mapa compartimento→propósitos por estado. Fuente única para leer saldos por
// compartimento desde la proyección del ledger. Spot no tiene 'pendiente'.
// Valores deben coincidir con PROPOSITOS en services/ledger/ledgerAccounts.js —
// el unit test balanceCompartimento.test.js los ancla contra ese módulo.
// Require de ledgerAccounts es lazy (abajo en leerCompartimento) por el ciclo
// models/index.js → ledgerAccounts → models/index.js; acá usamos los strings
// directos para que el mapa exista sin ejecutar ningún require al cargar.
const PROPOSITOS_POR_COMPARTIMENTO = {
  funding: { disponible: 'funding:disponible', bloqueado: 'funding:bloqueado', pendiente: 'funding:pendiente' },
  spot: { disponible: 'spot:disponible', bloqueado: 'spot:bloqueado', pendiente: null },
};

// Lee disponible/bloqueado/pendiente de un compartimento desde la proyección del
// ledger. Require lazy de postingService por el ciclo models↔services/ledger.
async function leerCompartimento(userId, criptomonedaId, compartimento, transaction = null) {
  const { getSaldoCuenta } = require('../services/ledger/postingService');
  const props = PROPOSITOS_POR_COMPARTIMENTO[compartimento];
  if (!props) throw new Error(`Compartimento inválido: ${compartimento}`);
  const disponible = await getSaldoCuenta({ ownerId: userId, proposito: props.disponible, criptomonedaId }, transaction);
  const bloqueado = await getSaldoCuenta({ ownerId: userId, proposito: props.bloqueado, criptomonedaId }, transaction);
  const pendiente = props.pendiente
    ? await getSaldoCuenta({ ownerId: userId, proposito: props.pendiente, criptomonedaId }, transaction)
    : '0';
  return { disponible, bloqueado, pendiente };
}

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
  // Paso D: estado PENDIENTE (depósitos detectados sin confirmar).
  const balancePendiente = await getSaldoCuenta(
    { ownerId: userId, proposito: PROPOSITOS.FUNDING_PENDIENTE, criptomonedaId }, transaction
  );
  return { balanceDisponible, balanceBloqueado, balancePendiente };
}

// Read-flip (write-flip Paso A/B): agrega la proyeccion Funding del ledger para
// las lecturas de admin. Devuelve, por (usuario, cripto) con cuenta funding, el
// disponible y bloqueado desde SaldoLedger. Require lazy por el ciclo
// models<->services/ledger.
async function agregarFundingLedger({ userId = null, criptomonedaId = null } = {}) {
  const { CuentaLedger, SaldoLedger } = require('./index');
  const { PROPOSITOS, HOUSE_OWNER_ID } = require('../services/ledger/ledgerAccounts');
  const where = { proposito: [PROPOSITOS.FUNDING_DISPONIBLE, PROPOSITOS.FUNDING_BLOQUEADO, PROPOSITOS.FUNDING_PENDIENTE] };
  if (userId) where.ownerId = userId;
  else where.ownerId = { [Op.ne]: HOUSE_OWNER_ID }; // solo cuentas de usuario
  if (criptomonedaId) where.criptomonedaId = criptomonedaId;

  const cuentas = await CuentaLedger.findAll({
    where,
    include: [{ model: SaldoLedger, as: 'saldoProyectado', attributes: ['saldo'] }],
  });

  // Colapsar disponible/bloqueado/pendiente por (ownerId, criptomonedaId).
  const porClave = new Map();
  for (const c of cuentas) {
    const clave = `${c.ownerId}:${c.criptomonedaId}`;
    if (!porClave.has(clave)) {
      porClave.set(clave, { userId: c.ownerId, criptomonedaId: c.criptomonedaId, balanceDisponible: '0', balanceBloqueado: '0', balancePendiente: '0' });
    }
    const entrada = porClave.get(clave);
    const saldo = c.saldoProyectado ? String(c.saldoProyectado.saldo) : '0';
    if (c.proposito === PROPOSITOS.FUNDING_DISPONIBLE) entrada.balanceDisponible = saldo;
    else if (c.proposito === PROPOSITOS.FUNDING_BLOQUEADO) entrada.balanceBloqueado = saldo;
    else entrada.balancePendiente = saldo;
  }
  return [...porClave.values()];
}

// Lee la proyección del ledger de UN usuario en UNA sola query (findAll + include
// saldoProyectado), evitando el N+1 de llamar getSaldoCuenta por (propósito,
// cripto). Devuelve Map: criptomonedaId → { propósito → saldo (string canónico) }.
// Scopeada a un usuario, así que la clave por-cripto no colisiona entre usuarios
// (a diferencia de agregarFundingLedger, que puede ser multi-usuario).
async function leerProyeccionUsuario(userId, propositos) {
  const { CuentaLedger, SaldoLedger } = require('./index');
  const cuentas = await CuentaLedger.findAll({
    where: { ownerId: userId, proposito: propositos },
    include: [{ model: SaldoLedger, as: 'saldoProyectado', attributes: ['saldo'] }],
  });
  const porCripto = new Map();
  for (const c of cuentas) {
    if (!porCripto.has(c.criptomonedaId)) porCripto.set(c.criptomonedaId, {});
    porCripto.get(c.criptomonedaId)[c.proposito] = c.saldoProyectado ? String(c.saldoProyectado.saldo) : '0';
  }
  return porCripto;
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
      // agregarFundingLedger ya colapsa la proyección Funding por cripto en UNA
      // sola query (findAll + include saldoProyectado) y devuelve exactamente esta
      // forma {userId, criptomonedaId, balanceDisponible/Bloqueado/Pendiente}.
      // Antes esto hacía un group + N×leerFundingDesdeLedger (N+1, ~6N queries).
      return await agregarFundingLedger({ userId });
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
      const { balanceDisponible, balanceBloqueado, balancePendiente } = await leerFundingDesdeLedger(userId, criptomonedaId, transaction);
      return {
        disponible: balanceDisponible,
        bloqueado: balanceBloqueado,
        pendiente: balancePendiente, // Paso D: depósitos detectados sin confirmar
        // total = spendable + reserved; NO incluye pendiente (aún no confirmado).
        total: money.add(balanceDisponible, balanceBloqueado)
      };
    } catch (error) {
      throw new Error(`Error al calcular balance total: ${error.message}`);
    }
  };

  // Ajuste de saldo de una sola pata contra la cuenta 'suspense'. Tras el Paso D
  // NINGÚN money-path real usa este método — todos postean asientos ricos
  // (swap/trade/depósito/retiro/transferencia/P2P). El único caller vivo es el
  // endpoint admin de ajuste manual de saldo (PUT /balances/user/:id/crypto/:id):
  // 'suspense' es acá su rol contable LEGÍTIMO y permanente (cuenta de ajustes/no
  // clasificados), no el placeholder transitorio de la migración. El guard de
  // sobregiro vive en postTransaction (FOR UPDATE); su error /sobregiro/ se
  // traduce al mensaje legacy /insuficiente/ del contrato.
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
          { ownerId: null, proposito: PROPOSITOS.SUSPENSE, criptomonedaId, monto: money.negate(monto) },
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
      const { balanceDisponible, balanceBloqueado, balancePendiente } = await leerFundingDesdeLedger(userId, criptomonedaId, options.transaction);
      return { userId, criptomonedaId, balanceDisponible, balanceBloqueado, balancePendiente };
    } catch (error) {
      throw new Error(`Error al obtener balance: ${error.message}`);
    }
  };

  // Lectura por compartimento (Spot activación): devuelve el saldo del
  // compartimento pedido. Usada por el servicio de trading (spot) y el endpoint
  // de transferencia entre compartimentos.
  BalanceUsuario.getSaldoCompartimento = async (userId, criptomonedaId, compartimento, options = {}) => {
    try {
      const { disponible, bloqueado, pendiente } = await leerCompartimento(userId, criptomonedaId, compartimento, options.transaction);
      return { userId, criptomonedaId, compartimento, disponible, bloqueado, pendiente };
    } catch (error) {
      throw new Error(`Error al obtener saldo de compartimento: ${error.message}`);
    }
  };

  // Chequeo rápido de suficiencia en un compartimento (early-error; el guard real
  // sigue siendo el FOR UPDATE de postTransaction).
  BalanceUsuario.hasAvailableEnCompartimento = async (userId, criptomonedaId, amount, compartimento, transaction = null) => {
    try {
      const { disponible } = await leerCompartimento(userId, criptomonedaId, compartimento, transaction);
      return money.compare(disponible, String(amount)) >= 0;
    } catch (error) {
      throw new Error(`Error al verificar saldo de compartimento: ${error.message}`);
    }
  };

  // Respuesta aditiva (decisión 1B): por cada cripto con cuenta en Funding o
  // Spot, devuelve los totales de raíz (suma de ambos compartimentos, compatible
  // con el frontend actual) + el desglose por compartimento.
  // Spot no tiene 'pendiente'. Require lazy de PROPOSITOS y CuentaLedger para
  // evitar el ciclo models/index.js → ledgerAccounts → models/index.js.
  BalanceUsuario.getBalancesConCompartimentos = async (userId) => {
    try {
      const { PROPOSITOS: P } = require('../services/ledger/ledgerAccounts');
      // Presentación a 8 decimales uniformes: money.add strippea trailing zeros
      // ('1' en vez de '1.00000000'), así que la suma+formato va por
      // money.format8 (único punto de esa regla de presentación).
      const fmt8 = (x) => money.format8(x);
      const sumar8 = (a, b) => money.format8(money.add(a, b));
      // UNA sola query para los 5 propósitos (antes: group + N×2 leerCompartimento,
      // cada uno con 2-3 getSaldoCuenta → ~10N queries en el endpoint más llamado).
      const porCripto = await leerProyeccionUsuario(userId, [
        P.FUNDING_DISPONIBLE, P.FUNDING_BLOQUEADO, P.FUNDING_PENDIENTE,
        P.SPOT_DISPONIBLE, P.SPOT_BLOQUEADO,
      ]);
      const salida = [];
      for (const [criptomonedaId, s] of porCripto) {
        const fd = s[P.FUNDING_DISPONIBLE] || '0';
        const fb = s[P.FUNDING_BLOQUEADO] || '0';
        const fp = s[P.FUNDING_PENDIENTE] || '0';
        const sd = s[P.SPOT_DISPONIBLE] || '0';
        const sb = s[P.SPOT_BLOQUEADO] || '0';
        salida.push({
          userId,
          criptomonedaId,
          balanceDisponible: sumar8(fd, sd),
          balanceBloqueado: sumar8(fb, sb),
          balancePendiente: fmt8(fp), // sólo Funding tiene pendiente
          compartimentos: {
            funding: { disponible: fmt8(fd), bloqueado: fmt8(fb), pendiente: fmt8(fp) },
            spot: { disponible: fmt8(sd), bloqueado: fmt8(sb) },
          },
        });
      }
      return salida;
    } catch (error) {
      throw new Error(`Error al obtener balances con compartimentos: ${error.message}`);
    }
  };

  // Lista las criptos con cuenta en el compartimento pedido (una entrada por
  // cripto). Espejo de getByUserId pero scopeado a un compartimento.
  BalanceUsuario.getByUserIdCompartimento = async (userId, compartimento) => {
    try {
      const props = PROPOSITOS_POR_COMPARTIMENTO[compartimento];
      if (!props) throw new Error(`Compartimento inválido: ${compartimento}`);
      const propositos = [props.disponible, props.bloqueado, ...(props.pendiente ? [props.pendiente] : [])];
      // UNA sola query (antes: group + N×leerCompartimento con 2-3 getSaldoCuenta).
      const porCripto = await leerProyeccionUsuario(userId, propositos);
      const salida = [];
      for (const [criptomonedaId, s] of porCripto) {
        salida.push({
          criptomonedaId,
          disponible: s[props.disponible] || '0',
          bloqueado: s[props.bloqueado] || '0',
          pendiente: props.pendiente ? (s[props.pendiente] || '0') : '0',
        });
      }
      return salida;
    } catch (error) {
      throw new Error(`Error al obtener balances de compartimento: ${error.message}`);
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
          { ownerId: userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId, monto: money.negate(monto) },
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
          { ownerId: userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId, monto: money.negate(monto) },
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

      // 3. Agregar 1 BTC al usuario — Paso D: el faucet entra desde el mundo
      // on-chain (testnet) via external_onchain → funding:disponible, sin suspense.
      const { acreditarFaucet } = require('../services/ledger/operations');
      await acreditarFaucet({
        userId,
        criptomonedaId: btc.id,
        cantidad: '1',
        referencia: `faucet:${userId}:${btc.id}`,
      }, transaction);
      const nuevoBalance = await BalanceUsuario.getByUserAndCrypto(userId, btc.id, { transaction });

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
module.exports.PROPOSITOS_POR_COMPARTIMENTO = PROPOSITOS_POR_COMPARTIMENTO;
