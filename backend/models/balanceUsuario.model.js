// models/balanceUsuario.js
require('dotenv').config();

const initBalanceUser = require('./entities/balanceUsuario.entity');
const { Op } = require('sequelize');
const money = require('../utils/money');

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

function createBalanceUserModel(sequelize) {
  const BalanceUsuario = initBalanceUser(sequelize);

  // Métodos de consulta básicos
  BalanceUsuario.getById = async (id) => {
    try {
      const balance = await BalanceUsuario.findByPk(id);
      return balance;
    } catch (error) {
      throw new Error(`Error al obtener balance por ID: ${error.message}`);
    }
  };

  BalanceUsuario.getByUserId = async (userId) => {
    try {
      const balances = await BalanceUsuario.findAll({
        where: { userId }
      });
      return balances;
    } catch (error) {
      throw new Error(`Error al obtener balances por usuario: ${error.message}`);
    }
  };

  BalanceUsuario.getByUserAndCrypto = async (userId, criptomonedaId) => {
    try {
      const balance = await BalanceUsuario.findOne({
        where: { 
          userId,
          criptomonedaId 
        }
      });
      return balance;
    } catch (error) {
      throw new Error(`Error al obtener balance específico: ${error.message}`);
    }
  };

  BalanceUsuario.getAll = async (filters = {}) => {
    try {
      const where = {};
      
      if (filters.userId) where.userId = filters.userId;
      if (filters.criptomonedaId) where.criptomonedaId = filters.criptomonedaId;
      if (filters.minBalance) {
        where.balanceDisponible = { [Op.gte]: filters.minBalance };
      }

      const balances = await BalanceUsuario.findAll({
        where,
        limit: filters.limit || 50,
        offset: filters.offset || 0
      });

      return balances;
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

  BalanceUsuario.updateBalance = async (userId, criptomonedaId, amount, type = 'disponible', transaction = null) => {
    try {
      const [balance] = await BalanceUsuario.findOrCreate({
        where: { userId, criptomonedaId },
        defaults: {
          userId,
          criptomonedaId,
          balanceDisponible: 0,
          balanceBloqueado: 0
        },
        transaction
      });

      const field = type === 'disponible' ? 'balanceDisponible' : 'balanceBloqueado';
      const currentBalance = String(balance[field] ?? 0);
      const newBalance = money.add(currentBalance, String(amount));

      if (money.compare(newBalance, '0') < 0) {
        throw new Error(
          `Balance insuficiente. ${type === 'disponible' ? 'Disponible' : 'Bloqueado'}: ${currentBalance}, ` +
          `Operación: ${amount}, Resultado: ${newBalance}`
        );
      }

      balance[field] = newBalance;
      await balance.save({ transaction });

      return balance;
    } catch (error) {
      throw new Error(`Error al actualizar balance: ${error.message}`);
    }
  };

  // 🆕 MÉTODO PARA OBTENER BALANCE EN TRANSACCIÓN
  BalanceUsuario.getByUserAndCrypto = async (userId, criptomonedaId, options = {}) => {
    try {
      const balance = await BalanceUsuario.findOne({
        where: { userId, criptomonedaId },
        ...options
      });
      return balance;
    } catch (error) {
      throw new Error(`Error al obtener balance: ${error.message}`);
    }
  };

  // Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #5): antes esto era
  // findOne() + save() sin transacción ni lock — dos requests casi
  // simultáneas podían leer el mismo balance, las dos pasar la validación,
  // y las dos escribir (TOCTOU clásico, permitía bloquear más de lo
  // disponible). Ahora el read+check+write pasa por un único SELECT ... FOR
  // UPDATE: la segunda llamada concurrente espera a que la primera
  // transacción termine y recién ahí lee el balance ya actualizado, en vez
  // de correr en paralelo sobre el mismo dato viejo.
  //
  // `transaction` es opcional: si el caller ya tiene una abierta se suma a
  // ella (mismo patrón que WalletMaestra.updateBalance); si no, abre y
  // gestiona la suya.
  BalanceUsuario.blockBalance = async (userId, criptomonedaId, amount, transaction = null) => {
    const ownTransaction = !transaction;
    const t = transaction || await sequelize.transaction();

    try {
      const balance = await BalanceUsuario.findOne({
        where: { userId, criptomonedaId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!balance) {
        throw new Error('Balance no encontrado');
      }

      const availableBalance = String(balance.balanceDisponible);
      const amountToBlock = String(amount);

      if (money.compare(availableBalance, amountToBlock) < 0) {
        throw new Error('Balance disponible insuficiente para bloquear');
      }

      balance.balanceDisponible = money.subtract(availableBalance, amountToBlock);
      balance.balanceBloqueado = money.add(String(balance.balanceBloqueado), amountToBlock);

      await balance.save({ transaction: t });

      if (ownTransaction) await t.commit();
      return balance;
    } catch (error) {
      if (ownTransaction) await t.rollback();
      throw new Error(`Error al bloquear balance: ${error.message}`);
    }
  };

  BalanceUsuario.unblockBalance = async (userId, criptomonedaId, amount, transaction = null) => {
    const ownTransaction = !transaction;
    const t = transaction || await sequelize.transaction();

    try {
      const balance = await BalanceUsuario.findOne({
        where: { userId, criptomonedaId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });

      if (!balance) {
        throw new Error('Balance no encontrado');
      }

      const blockedBalance = String(balance.balanceBloqueado);
      const amountToUnblock = String(amount);

      if (money.compare(blockedBalance, amountToUnblock) < 0) {
        throw new Error('Balance bloqueado insuficiente para desbloquear');
      }

      balance.balanceBloqueado = money.subtract(blockedBalance, amountToUnblock);
      balance.balanceDisponible = money.add(String(balance.balanceDisponible), amountToUnblock);

      await balance.save({ transaction: t });

      if (ownTransaction) await t.commit();
      return balance;
    } catch (error) {
      if (ownTransaction) await t.rollback();
      throw new Error(`Error al desbloquear balance: ${error.message}`);
    }
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

  // Métodos administrativos
  BalanceUsuario.getUsersWithBalance = async (criptomonedaId, minAmount = 0) => {
    try {
      const balances = await BalanceUsuario.findAll({
        where: {
          criptomonedaId,
          balanceDisponible: { [Op.gt]: minAmount }
        },
        attributes: ['userId', 'balanceDisponible', 'balanceBloqueado']
      });

      return balances;
    } catch (error) {
      throw new Error(`Error al obtener usuarios con balance: ${error.message}`);
    }
  };

  BalanceUsuario.getBalanceStats = async () => {
    try {
      const stats = await BalanceUsuario.findAll({
        attributes: [
          'criptomonedaId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalUsers'],
          [sequelize.fn('SUM', sequelize.col('balance_disponible')), 'totalDisponible'],
          [sequelize.fn('SUM', sequelize.col('balance_bloqueado')), 'totalBloqueado']
        ],
        group: ['criptomonedaId']
      });

      return stats;
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de balance: ${error.message}`);
    }
  };

  // Método para reclamar BTC (SOLO TESTNET - ELIMINAR EN PRODUCCIÓN)
  BalanceUsuario.reclamarBtcGratis = async (userId, transaction = null) => {
    try {
      // 1. Verificar que el usuario NO tenga ningún balance existente
      const balancesExistentes = await BalanceUsuario.findAll({
        where: { userId }
      });

      // Si tiene algún balance con saldo > 0, no puede reclamar
      const tieneSaldo = balancesExistentes.some(balance => {
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