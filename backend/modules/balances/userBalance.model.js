// models/balanceUsuario.js
require('dotenv').config();

const { Op } = require('sequelize');
const money = require('../../utils/money');
const crypto = require('crypto');
// Registro único compartimento→propósito (fuente de verdad en ledgerAccounts).
// ledgerAccounts ya NO requiere models al cargar (su require de models es lazy),
// así que importar COMPARTMENTS acá al tope no dispara el ciclo models↔ledger.
const { COMPARTMENTS } = require('./ledger/ledgerAccounts');

// Lee available/blocked/pending de un compartimento desde la proyección del
// ledger. Require lazy de postingService por el ciclo models↔modules/balances/ledger.
async function readCompartment(userId, cryptoId, compartment, transaction = null) {
  const props = COMPARTMENTS[compartment];
  if (!props) throw new Error(`Compartimento inválido: ${compartment}`);
  const purposes = [props.available, props.blocked, ...(props.pending ? [props.pending] : [])];
  // UNA query para los propósitos de este compartimento+cripto (antes: 2-3
  // getAccountBalance, cada uno 2 findOne → hasta 6 round-trips). Colapsa todas las
  // lecturas single-crypto (getTotalBalance/getByUserAndCrypto/block/unblock/
  // hasAvailable...) que pasan por acá.
  const byCrypto = await readUserProjection(userId, purposes, { cryptoId, transaction });
  const s = byCrypto.get(cryptoId) || {};
  return {
    available: s[props.available] || '0',
    blocked: s[props.blocked] || '0',
    pending: props.pending ? (s[props.pending] || '0') : '0',
  };
}

// Lectura del compartimento Funding con las claves balance* que esperan sus
// callers (getTotalBalance/getByUserAndCrypto/block/unblock/updateBalance/
// hasAvailableBalance). Es un alias delgado sobre readCompartment('funding')
// — antes duplicaba los tres getAccountBalance a mano.
async function readFundingFromLedger(userId, cryptoId, transaction = null) {
  const { available, blocked, pending } = await readCompartment(userId, cryptoId, 'funding', transaction);
  return { availableBalance: available, blockedBalance: blocked, pendingBalance: pending };
}

// Error de saldo insuficiente que PRESERVA code 'OVERDRAFT'. block/unblock/
// updateBalance traducen el OverdraftError de postTransaction a un mensaje legacy
// (algunos callers matchean /insuficiente/), pero deben conservar el code para que
// el controller lo mapee al envelope de dominio (BALANCE_INSUFFICIENT) sin regex.
function insufficientBalanceError(message) {
  const e = new Error(message);
  e.code = 'OVERDRAFT';
  return e;
}

// Read-flip (write-flip Paso A/B): agrega la proyeccion Funding del ledger para
// las lecturas de admin. Devuelve, por (usuario, cripto) con cuenta funding, el
// available y blocked desde LedgerBalance. Require lazy por el ciclo
// models<->modules/balances/ledger.
async function aggregateFundingLedger({ userId = null, cryptoId = null } = {}) {
  const { LedgerAccount, LedgerBalance } = require('../../models/index');
  const { PURPOSES, HOUSE_OWNER_ID } = require('./ledger/ledgerAccounts');
  const where = { purpose: [PURPOSES.FUNDING_AVAILABLE, PURPOSES.FUNDING_BLOCKED, PURPOSES.FUNDING_PENDING] };
  if (userId) where.ownerId = userId;
  else where.ownerId = { [Op.ne]: HOUSE_OWNER_ID }; // solo cuentas de usuario
  if (cryptoId) where.cryptoId = cryptoId;

  const accounts = await LedgerAccount.findAll({
    where,
    include: [{ model: LedgerBalance, as: 'projectedBalance', attributes: ['balance'] }],
  });

  // Colapsar available/blocked/pending por (ownerId, cryptoId).
  const byKey = new Map();
  for (const c of accounts) {
    const key = `${c.ownerId}:${c.cryptoId}`;
    if (!byKey.has(key)) {
      byKey.set(key, { userId: c.ownerId, criptomonedaId: c.cryptoId, availableBalance: '0', blockedBalance: '0', pendingBalance: '0' });
    }
    const entry = byKey.get(key);
    const balance = c.projectedBalance ? String(c.projectedBalance.balance) : '0';
    if (c.purpose === PURPOSES.FUNDING_AVAILABLE) entry.availableBalance = balance;
    else if (c.purpose === PURPOSES.FUNDING_BLOCKED) entry.blockedBalance = balance;
    else entry.pendingBalance = balance;
  }
  return [...byKey.values()];
}

// Lee la proyección del ledger de UN usuario en UNA sola query (findAll + include
// projectedBalance), evitando el N+1 de llamar getAccountBalance por (propósito,
// cripto). Devuelve Map: cryptoId → { propósito → balance (string canónico) }.
// Scopeada a un usuario, así que la clave por-cripto no colisiona entre usuarios
// (a diferencia de aggregateFundingLedger, que puede ser multi-usuario).
async function readUserProjection(userId, purposes, { cryptoId = null, transaction = null } = {}) {
  const { LedgerAccount, LedgerBalance } = require('../../models/index');
  const where = { ownerId: userId, purpose: purposes };
  if (cryptoId) where.cryptoId = cryptoId;
  const accounts = await LedgerAccount.findAll({
    where,
    include: [{ model: LedgerBalance, as: 'projectedBalance', attributes: ['balance'] }],
    transaction,
  });
  const byCrypto = new Map();
  for (const c of accounts) {
    if (!byCrypto.has(c.cryptoId)) byCrypto.set(c.cryptoId, {});
    byCrypto.get(c.cryptoId)[c.purpose] = c.projectedBalance ? String(c.projectedBalance.balance) : '0';
  }
  return byCrypto;
}

function createBalanceUserModel(sequelize) {
  // Paso C: UserBalance ya NO es un modelo Sequelize — la tabla balances_users
  // se eliminó. Es una FACHADA de operaciones de saldo respaldada por el ledger de
  // partida doble (los métodos postean/leen del ledger). Se conserva la API
  // estática para no tocar los ~40 call sites (swap/trading/P2P/depósitos/
  // retiros). `sequelize` se usa sólo para sequelize.models.Crypto en claimFreeBtc.
  const UserBalance = {};

  // getById se retiro en el write-flip (Paso B): leia balances_users por PK de
  // fila, que no tiene analogo en el ledger (las cuentas son (dueño, proposito,
  // cripto), no una fila por (usuario, cripto)). Era admin-only y sin tests.

  // Plan 3 (read-flip): agrega desde la proyeccion del ledger las cuentas
  // Funding del usuario (una entrada por cripto que tenga cuenta funding). Nota:
  // a diferencia del viejo (que devolvia TODA fila de balances_users, incluidas
  // las de saldo 0 que crea el provisioning), aca solo aparecen las criptos con
  // movimiento en el ledger — el mirror saltea deltas en cero. Es un cambio de
  // display aceptable (no listar saldos en 0). Devuelve objetos planos (sin la
  // asociacion .crypto, igual que el viejo findAll sin include).
  UserBalance.getByUserId = async (userId) => {
    try {
      // Guard anti-fuga: aggregateFundingLedger SIN userId devuelve TODOS los usuarios
      // (es su modo admin). Acá el scope por-usuario es obligatorio.
      if (!userId) return [];
      // aggregateFundingLedger ya colapsa la proyección Funding por cripto en UNA
      // sola query (findAll + include projectedBalance) y devuelve exactamente esta
      // forma {userId, criptomonedaId, availableBalance/blockedBalance/pendingBalance}.
      // Antes esto hacía un group + N×readFundingFromLedger (N+1, ~6N queries).
      return await aggregateFundingLedger({ userId });
    } catch (error) {
      throw new Error(`Error al obtener balances por usuario: ${error.message}`);
    }
  };

  // getByUserAndCrypto se define mas abajo (una sola vez, leyendo del ledger).

  // Read-flip (Paso B): lista desde la proyeccion Funding del ledger.
  UserBalance.getAll = async (filters = {}) => {
    try {
      let rows = await aggregateFundingLedger({ userId: filters.userId, cryptoId: filters.criptomonedaId });
      if (filters.minBalance) {
        rows = rows.filter((f) => money.compare(f.availableBalance, String(filters.minBalance)) >= 0);
      }
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      return rows.slice(offset, offset + limit);
    } catch (error) {
      throw new Error(`Error al obtener todos los balances: ${error.message}`);
    }
  };

  // Métodos de balance
  UserBalance.getTotalBalance = async (userId, criptomonedaId, transaction = null) => {
    try {
      const { availableBalance, blockedBalance, pendingBalance } = await readFundingFromLedger(userId, criptomonedaId, transaction);
      return {
        available: availableBalance,
        blocked: blockedBalance,
        pending: pendingBalance, // Paso D: depósitos detectados sin confirmar
        // total = spendable + reserved; NO incluye pending (aún no confirmado).
        total: money.add(availableBalance, blockedBalance)
      };
    } catch (error) {
      throw new Error(`Error al calcular balance total: ${error.message}`);
    }
  };

  // Ajuste de saldo de una sola pata contra la cuenta 'suspense'. Tras el Paso D
  // NINGÚN money-path real usa este método — todos postean asientos ricos
  // (swap/trade/depósito/retiro/transferencia/P2P). El único caller vivo es el
  // endpoint admin de ajuste manual de saldo (PUT /balances/user/:id/crypto/:id):
  // 'suspense' es acá su role contable LEGÍTIMO y permanente (cuenta de ajustes/no
  // clasificados), no el placeholder transitorio de la migración. El guard de
  // sobregiro vive en postTransaction (FOR UPDATE); su OverdraftError (code
  // 'OVERDRAFT') se traduce al mensaje legacy /insuficiente/ del contrato.
  UserBalance.updateBalance = async (userId, criptomonedaId, amount, type = 'available', transaction = null) => {
    const { postTransaction } = require('./ledger/postingService');
    const { PURPOSES } = require('./ledger/ledgerAccounts');
    const purpose = type === 'available' ? PURPOSES.FUNDING_AVAILABLE : PURPOSES.FUNDING_BLOCKED;
    const amt = String(amount);
    try {
      await postTransaction({
        type: 'ajuste_legacy',
        reference: `writeflip:${crypto.randomUUID()}`,
        lines: [
          { ownerId: userId, purpose, cryptoId: criptomonedaId, amount: amt },
          { ownerId: null, purpose: PURPOSES.SUSPENSE, cryptoId: criptomonedaId, amount: money.negate(amt) },
        ],
      }, transaction);
    } catch (error) {
      if (error.code === 'OVERDRAFT') {
        throw insufficientBalanceError(`Error al actualizar balance: Balance insuficiente. ${type}`);
      }
      throw new Error(`Error al actualizar balance: ${error.message}`);
    }
    const { availableBalance, blockedBalance } = await readFundingFromLedger(userId, criptomonedaId, transaction);
    return { userId, criptomonedaId, availableBalance, blockedBalance };
  };

  // Plan 3 (read-flip): lee de la PROYECCION del ledger (compartimento Funding).
  // Contrato: devuelve un objeto {userId, criptomonedaId, availableBalance,
  // blockedBalance} con '0' si la cuenta no existe — en un ledger "sin balance"
  // == "0". Es equivalente al viejo null-si-no-hay-fila para los callers que
  // chequean saldo: compare('0', amount>0) < 0 → insuficiente, igual que !balance.
  // options.transaction se respeta (P2P/transferencia lo pasan).
  UserBalance.getByUserAndCrypto = async (userId, criptomonedaId, options = {}) => {
    try {
      const { availableBalance, blockedBalance, pendingBalance } = await readFundingFromLedger(userId, criptomonedaId, options.transaction);
      return { userId, criptomonedaId, availableBalance, blockedBalance, pendingBalance };
    } catch (error) {
      throw new Error(`Error al obtener balance: ${error.message}`);
    }
  };

  // Lectura por compartimento (Spot activación): devuelve el saldo del
  // compartimento pedido. Usada por el servicio de trading (spot) y el endpoint
  // de transferencia entre compartimentos.
  UserBalance.getCompartmentBalance = async (userId, criptomonedaId, compartment, options = {}) => {
    try {
      const { available, blocked, pending } = await readCompartment(userId, criptomonedaId, compartment, options.transaction);
      return { userId, criptomonedaId, compartment, available, blocked, pending };
    } catch (error) {
      throw new Error(`Error al obtener saldo de compartimento: ${error.message}`);
    }
  };

  // Chequeo rápido de suficiencia en un compartimento (early-error; el guard real
  // sigue siendo el FOR UPDATE de postTransaction).
  UserBalance.hasAvailableInCompartment = async (userId, criptomonedaId, amount, compartment, transaction = null) => {
    try {
      const { available } = await readCompartment(userId, criptomonedaId, compartment, transaction);
      return money.compare(available, String(amount)) >= 0;
    } catch (error) {
      throw new Error(`Error al verificar saldo de compartimento: ${error.message}`);
    }
  };

  // Respuesta aditiva (decisión 1B): por cada cripto con cuenta en Funding o
  // Spot, devuelve los totales de raíz (suma de ambos compartimentos, compatible
  // con el frontend actual) + el desglose por compartimento.
  // Spot no tiene 'pending'. Require lazy de PURPOSES y LedgerAccount para
  // evitar el ciclo models/index.js → ledgerAccounts → models/index.js.
  UserBalance.getBalancesWithCompartments = async (userId) => {
    try {
      const { PURPOSES: P } = require('./ledger/ledgerAccounts');
      // Presentación a 8 decimals uniformes: money.add strippea trailing zeros
      // ('1' en vez de '1.00000000'), así que la suma+formato va por
      // money.format8 (único punto de esa regla de presentación).
      const fmt8 = (x) => money.format8(x);
      const sum8 = (a, b) => money.format8(money.add(a, b));
      // UNA sola query para los 5 propósitos (antes: group + N×2 readCompartment,
      // cada uno con 2-3 getAccountBalance → ~10N queries en el endpoint más llamado).
      const byCrypto = await readUserProjection(userId, [
        P.FUNDING_AVAILABLE, P.FUNDING_BLOCKED, P.FUNDING_PENDING,
        P.SPOT_AVAILABLE, P.SPOT_BLOCKED,
      ]);
      const output = [];
      for (const [criptomonedaId, s] of byCrypto) {
        const fd = s[P.FUNDING_AVAILABLE] || '0';
        const fb = s[P.FUNDING_BLOCKED] || '0';
        const fp = s[P.FUNDING_PENDING] || '0';
        const sd = s[P.SPOT_AVAILABLE] || '0';
        const sb = s[P.SPOT_BLOCKED] || '0';
        output.push({
          userId,
          criptomonedaId,
          availableBalance: sum8(fd, sd),
          blockedBalance: sum8(fb, sb),
          pendingBalance: fmt8(fp), // sólo Funding tiene pending
          compartments: {
            funding: { available: fmt8(fd), blocked: fmt8(fb), pending: fmt8(fp) },
            spot: { available: fmt8(sd), blocked: fmt8(sb) },
          },
        });
      }
      // Enriquecer con el objeto crypto (una query) para que ésta sea la
      // forma unificada de "mis balances" que consumen los 3 endpoints (balances/
      // intercambio/usuario), sin que cada controller re-adjunte la asociación.
      if (output.length > 0) {
        const { Crypto } = require('../../models/index');
        const cryptos = await Crypto.findAll({
          where: { id: output.map((s) => s.criptomonedaId) },
          attributes: ['id', 'symbol', 'name', 'network', 'decimals'],
        });
        const byId = new Map(cryptos.map((c) => [c.id, c]));
        for (const s of output) s.crypto = byId.get(s.criptomonedaId) || null;
      }
      return output;
    } catch (error) {
      throw new Error(`Error al obtener balances con compartimentos: ${error.message}`);
    }
  };

  // Lista las criptos con cuenta en el compartimento pedido (una entrada por
  // cripto). Espejo de getByUserId pero scopeado a un compartimento.
  UserBalance.getByUserIdCompartment = async (userId, compartment) => {
    try {
      const props = COMPARTMENTS[compartment];
      if (!props) throw new Error(`Compartimento inválido: ${compartment}`);
      const purposes = [props.available, props.blocked, ...(props.pending ? [props.pending] : [])];
      // UNA sola query (antes: group + N×readCompartment con 2-3 getAccountBalance).
      const byCrypto = await readUserProjection(userId, purposes);
      const output = [];
      for (const [criptomonedaId, s] of byCrypto) {
        output.push({
          criptomonedaId,
          available: s[props.available] || '0',
          blocked: s[props.blocked] || '0',
          pending: props.pending ? (s[props.pending] || '0') : '0',
        });
      }
      return output;
    } catch (error) {
      throw new Error(`Error al obtener balances de compartimento: ${error.message}`);
    }
  };

  // Write-flip (Paso B): bloquear = dos patas de usuario (available -A,
  // blocked +A). Suma cero sin suspense. El anti-sobregiro (Críticos #5) sigue
  // vivo pero ahora es el FOR UPDATE de postTransaction sobre la fila de
  // proyeccion (probado en ledgerPosting concurrency); ya no hay findOne+save
  // sobre balances_users. `transaction` opcional: se pasa a postTransaction.
  UserBalance.blockBalance = async (userId, criptomonedaId, amount, transaction = null) => {
    const { postTransaction } = require('./ledger/postingService');
    const { PURPOSES } = require('./ledger/ledgerAccounts');
    const amt = String(amount);
    try {
      await postTransaction({
        type: 'reserva_orden',
        reference: `block:${crypto.randomUUID()}`,
        lines: [
          { ownerId: userId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: criptomonedaId, amount: money.negate(amt) },
          { ownerId: userId, purpose: PURPOSES.FUNDING_BLOCKED, cryptoId: criptomonedaId, amount: amt },
        ],
      }, transaction);
    } catch (error) {
      if (error.code === 'OVERDRAFT') {
        throw insufficientBalanceError('Error al bloquear balance: Balance disponible insuficiente para bloquear');
      }
      throw new Error(`Error al bloquear balance: ${error.message}`);
    }
    const { availableBalance, blockedBalance } = await readFundingFromLedger(userId, criptomonedaId, transaction);
    return { userId, criptomonedaId, availableBalance, blockedBalance };
  };

  UserBalance.unblockBalance = async (userId, criptomonedaId, amount, transaction = null) => {
    const { postTransaction } = require('./ledger/postingService');
    const { PURPOSES } = require('./ledger/ledgerAccounts');
    const amt = String(amount);
    try {
      await postTransaction({
        type: 'liberacion_reserva',
        reference: `unblock:${crypto.randomUUID()}`,
        lines: [
          { ownerId: userId, purpose: PURPOSES.FUNDING_BLOCKED, cryptoId: criptomonedaId, amount: money.negate(amt) },
          { ownerId: userId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: criptomonedaId, amount: amt },
        ],
      }, transaction);
    } catch (error) {
      if (error.code === 'OVERDRAFT') {
        throw insufficientBalanceError('Error al desbloquear balance: Balance bloqueado insuficiente para desbloquear');
      }
      throw new Error(`Error al desbloquear balance: ${error.message}`);
    }
    const { availableBalance, blockedBalance } = await readFundingFromLedger(userId, criptomonedaId, transaction);
    return { userId, criptomonedaId, availableBalance, blockedBalance };
  };

  // Métodos de validación
  UserBalance.hasAvailableBalance = async (userId, criptomonedaId, amount, transaction = null) => {
    try {
      const { availableBalance } = await readFundingFromLedger(userId, criptomonedaId, transaction);
      return money.compare(availableBalance, String(amount)) >= 0;
    } catch (error) {
      throw new Error(`Error al verificar balance disponible: ${error.message}`);
    }
  };

  // Métodos administrativos (read-flip Paso B: agregan la proyeccion del ledger)
  UserBalance.getUsersWithBalance = async (criptomonedaId, minAmount = 0) => {
    try {
      const rows = await aggregateFundingLedger({ cryptoId: criptomonedaId });
      return rows
        .filter((f) => money.compare(f.availableBalance, String(minAmount)) > 0)
        .map((f) => ({ userId: f.userId, availableBalance: f.availableBalance, blockedBalance: f.blockedBalance }));
    } catch (error) {
      throw new Error(`Error al obtener usuarios con balance: ${error.message}`);
    }
  };

  UserBalance.getBalanceStats = async () => {
    try {
      const rows = await aggregateFundingLedger();
      const byCrypto = new Map();
      for (const f of rows) {
        if (!byCrypto.has(f.criptomonedaId)) {
          byCrypto.set(f.criptomonedaId, { criptomonedaId: f.criptomonedaId, totalUsers: 0, totalAvailable: '0', totalBlocked: '0' });
        }
        const s = byCrypto.get(f.criptomonedaId);
        s.totalUsers += 1;
        s.totalAvailable = money.add(s.totalAvailable, f.availableBalance);
        s.totalBlocked = money.add(s.totalBlocked, f.blockedBalance);
      }
      return [...byCrypto.values()];
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de balance: ${error.message}`);
    }
  };

  // Método para reclamar BTC (SOLO TESTNET - ELIMINAR EN PRODUCCIÓN)
  UserBalance.claimFreeBtc = async (userId, transaction = null) => {
    try {
      // 1. Verificar que el usuario NO tenga ningún balance existente.
      // Read-flip (Paso B): el "ya tiene saldo" sale de la proyeccion del ledger.
      const ledgerBalances = await UserBalance.getByUserId(userId);
      const hasBalance = ledgerBalances.some(balance => {
        const total = money.add(String(balance.availableBalance), String(balance.blockedBalance));
        return money.compare(total, '0') > 0;
      });

      // Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #12): este chequeo
      // estaba comentado — cualquier usuario podía llamar este endpoint
      // repetidas veces y acumular BTC sin límite, sin siquiera necesitar
      // scriptear nada. Reactivado: el regalo es de una sola vez.
      if (hasBalance) {
        throw new Error('Ya tienes saldo en tu cuenta. El regalo de BTC es solo para usuarios nuevos.');
      }

      // 2. Buscar el BTC en la base de datos
      const Crypto = sequelize.models.Crypto;
      const btc = await Crypto.getBySymbol('BTC');

      if (!btc) {
        throw new Error('BTC no está disponible en el sistema');
      }

      // 3. Agregar 1 BTC al usuario — Paso D: el faucet entra desde el mundo
      // on-chain (testnet) via external_onchain → funding:disponible, sin suspense.
      const { creditFaucet } = require('./ledger/operations');
      await creditFaucet({
        userId,
        criptomonedaId: btc.id,
        cantidad: '1',
        referencia: `faucet:${userId}:${btc.id}`,
      }, transaction);
      const newBalance = await UserBalance.getByUserAndCrypto(userId, btc.id, { transaction });

      return {
        success: true,
        message: '¡Felicidades! Has reclamado 1 BTC de regalo 🎉',
        balance: newBalance
      };

    } catch (error) {
      throw new Error(`Error al reclamar BTC: ${error.message}`);
    }
  };

  return UserBalance;
}

module.exports = createBalanceUserModel;
