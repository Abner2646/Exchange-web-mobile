// models/balanceUsuario.js
require('dotenv').config();

const initBalanceUser = require('./entities/balanceUsuario.entity');
const { Op } = require('sequelize');

function createBalanceUserModel(sequelize) {
  const BalanceUser = initBalanceUser(sequelize);

  // Métodos de consulta básicos
  BalanceUser.getById = async (id) => {
    try {
      const balance = await BalanceUser.findByPk(id);
      return balance;
    } catch (error) {
      throw new Error(`Error al obtener balance por ID: ${error.message}`);
    }
  };

  BalanceUser.getByUserId = async (userId) => {
    try {
      const balances = await BalanceUser.findAll({
        where: { userId }
      });
      return balances;
    } catch (error) {
      throw new Error(`Error al obtener balances por usuario: ${error.message}`);
    }
  };

  BalanceUser.getByUserAndCrypto = async (userId, criptomonedaId) => {
    try {
      const balance = await BalanceUser.findOne({
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

  BalanceUser.getAll = async (filters = {}) => {
    try {
      const where = {};
      
      if (filters.userId) where.userId = filters.userId;
      if (filters.criptomonedaId) where.criptomonedaId = filters.criptomonedaId;
      if (filters.minBalance) {
        where.balanceDisponible = { [Op.gte]: filters.minBalance };
      }

      const balances = await BalanceUser.findAll({
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
  BalanceUser.getTotalBalance = async (userId, criptomonedaId) => {
    try {
      const balance = await BalanceUser.findOne({
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

  BalanceUser.updateBalance = async (userId, criptomonedaId, amount, type = 'disponible', transaction = null) => {
    try {
      const [balance] = await BalanceUser.findOrCreate({
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
  BalanceUser.getByUserAndCrypto = async (userId, criptomonedaId, options = {}) => {
    try {
      const balance = await BalanceUser.findOne({
        where: { userId, criptomonedaId },
        ...options
      });
      return balance;
    } catch (error) {
      throw new Error(`Error al obtener balance: ${error.message}`);
    }
  };

  BalanceUser.blockBalance = async (userId, criptomonedaId, amount) => {
    try {
      const balance = await BalanceUser.findOne({
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

  BalanceUser.unblockBalance = async (userId, criptomonedaId, amount) => {
    try {
      const balance = await BalanceUser.findOne({
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
  BalanceUser.hasAvailableBalance = async (userId, criptomonedaId, amount) => {
    try {
      const balance = await BalanceUser.findOne({
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
  BalanceUser.getUsersWithBalance = async (criptomonedaId, minAmount = 0) => {
    try {
      const balances = await BalanceUser.findAll({
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

  BalanceUser.getBalanceStats = async () => {
    try {
      const stats = await BalanceUser.findAll({
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

  return BalanceUser;
}

module.exports = createBalanceUserModel;