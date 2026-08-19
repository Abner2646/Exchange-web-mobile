// models/balanceUsuario.js
require('dotenv').config();

const initBalanceUser = require('./entities/balanceUsuario.entity');
const { Op } = require('sequelize');

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
  BalanceUsuario.getTotalBalance = async (userId, criptomonedaId) => {
    try {
      const balance = await BalanceUsuario.findOne({
        where: { userId, criptomonedaId }
      });
      
      if (!balance) return { disponible: 0, bloqueado: 0, total: 0 };
      
      const total = parseFloat(balance.balanceDisponible) + parseFloat(balance.balanceBloqueado);
      
      return {
        disponible: parseFloat(balance.balanceDisponible),
        bloqueado: parseFloat(balance.balanceBloqueado),
        total
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
      const currentBalance = parseFloat(balance[field]) || 0;
      const newBalance = currentBalance + parseFloat(amount);

      if (newBalance < 0) {
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

  BalanceUsuario.blockBalance = async (userId, criptomonedaId, amount) => {
    try {
      const balance = await BalanceUsuario.findOne({
        where: { userId, criptomonedaId }
      });

      if (!balance) {
        throw new Error('Balance no encontrado');
      }

      const availableBalance = parseFloat(balance.balanceDisponible);
      const amountToBlock = parseFloat(amount);

      if (availableBalance < amountToBlock) {
        throw new Error('Balance disponible insuficiente para bloquear');
      }

      balance.balanceDisponible = availableBalance - amountToBlock;
      balance.balanceBloqueado = parseFloat(balance.balanceBloqueado) + amountToBlock;
      
      await balance.save();
      return balance;
    } catch (error) {
      throw new Error(`Error al bloquear balance: ${error.message}`);
    }
  };

  BalanceUsuario.unblockBalance = async (userId, criptomonedaId, amount) => {
    try {
      const balance = await BalanceUsuario.findOne({
        where: { userId, criptomonedaId }
      });

      if (!balance) {
        throw new Error('Balance no encontrado');
      }

      const blockedBalance = parseFloat(balance.balanceBloqueado);
      const amountToUnblock = parseFloat(amount);

      if (blockedBalance < amountToUnblock) {
        throw new Error('Balance bloqueado insuficiente para desbloquear');
      }

      balance.balanceBloqueado = blockedBalance - amountToUnblock;
      balance.balanceDisponible = parseFloat(balance.balanceDisponible) + amountToUnblock;
      
      await balance.save();
      return balance;
    } catch (error) {
      throw new Error(`Error al desbloquear balance: ${error.message}`);
    }
  };

  // Métodos de validación
  BalanceUsuario.hasAvailableBalance = async (userId, criptomonedaId, amount) => {
    try {
      const balance = await BalanceUsuario.findOne({
        where: { userId, criptomonedaId }
      });

      if (!balance) return false;

      const availableBalance = parseFloat(balance.balanceDisponible);
      return availableBalance >= parseFloat(amount);
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
        const total = parseFloat(balance.balanceDisponible) + parseFloat(balance.balanceBloqueado);
        return total > 0;
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