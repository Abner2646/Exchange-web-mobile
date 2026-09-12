// models/transaccionP2P.model.js

const initTransaccionP2P = require('./p2pTransaction.entity');
const { Op } = require('sequelize');
const money = require('../../utils/money');

function createTransaccionP2PModel(sequelize) {
  const P2PTransaction = initTransaccionP2P(sequelize);

  // Estados válidos para transiciones
  const ESTADOS_VALIDOS = {
    'initiated': ['payment_confirmed', 'cancelled'],
    'payment_confirmed': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': []
  };

P2PTransaction.createTransaction = async (data) => {
  const { 
    offerId, 
    buyerId, 
    sellerId, 
    cryptoId, 
    amount, 
    unitPrice, 
    paymentMethodId 
  } = data;

  if (buyerId === sellerId) {
    throw new Error('El comprador y vendedor no pueden ser el mismo usuario');
  }

  const transaction = await sequelize.transaction();
  
  try {
    const { P2POffer } = require('../../models/index');
    const oferta = await P2POffer.findByPk(offerId, { 
      include: ['crypto'],
      transaction 
    });
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    if (!oferta.active) {
      throw new Error('La oferta no está activa. No se pueden realizar transacciones con ofertas desactivadas.');
    }

    const cantidadNum = String(amount);
    const minAmount = String(oferta.minAmount);
    const maxAmount = String(oferta.maxAmount);

    if (money.compare(cantidadNum, minAmount) < 0 || money.compare(cantidadNum, maxAmount) > 0) {
      throw new Error(
        `La cantidad ${cantidadNum} está fuera del rango permitido. ` +
        `Mínimo: ${minAmount}, Máximo: ${maxAmount}`
      );
    }

    const { UserBalance } = require('../../models/index');
    const balance = await UserBalance.getByUserAndCrypto(sellerId, cryptoId, { transaction });
    
    if (!balance) {
      throw new Error(
        `El vendedor no tiene balance en ${oferta.crypto?.symbol || 'esta criptomoneda'}. ` +
        `La transacción no puede continuar.`
      );
    }

    const availableBalance = String(balance.availableBalance);

    if (money.compare(availableBalance, cantidadNum) < 0) {
      throw new Error(
        `Fondos insuficientes del vendedor. ` +
        `Disponible: ${availableBalance} ${oferta.crypto?.symbol || ''}, ` +
        `Requerido: ${cantidadNum} ${oferta.crypto?.symbol || ''}`
      );
    }

    // 🔒 BLOQUEAR FONDOS — Paso D: blockBalance postea dos patas de usuario
    // (disponible→bloqueado), sin suspense.
    await UserBalance.blockBalance(sellerId, cryptoId, cantidadNum, transaction);

    const fiatAmount = money.multiply(cantidadNum, String(unitPrice));

    const nuevaTransaccion = await P2PTransaction.create({
      offerId,
      buyerId,
      sellerId,
      cryptoId,
      amount: cantidadNum,
      unitPrice,
      fiatAmount,
      fiatCurrency: oferta.fiatCurrency,
      paymentMethodId,
      status: 'initiated'
    }, { transaction });

    // 📧 NOTIFICAR A AMBAS PARTES
    const { Notification } = require('../../models/index');
    
    const transaccionConDatos = {
      id: nuevaTransaccion.id,
      amount: cantidadNum,
      crypto: oferta.crypto,
      fiatAmount,
      fiatCurrency: oferta.fiatCurrency
    };

    await Notification.notifyBothParties(
      buyerId,
      sellerId,
      transaccionConDatos,
      'initiated',
      { transaction }
    );

    await transaction.commit();
    
    return await P2PTransaction.getById(nuevaTransaccion.id);
    
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

  // 🆕 COMPLETAR TRANSACCIÓN - TRANSFERIR FONDOS
P2PTransaction.completeTransaction = async (id, userId) => {
  const transaction = await sequelize.transaction();
  
  try {
    const transaccion = await P2PTransaction.findByPk(id, { 
      include: ['crypto'],
      transaction 
    });
    
    if (!transaccion) {
      throw new Error('Transacción no encontrada');
    }

    if (userId && transaccion.sellerId !== userId) {
      throw new Error('Solo el vendedor puede completar y liberar las criptomonedas');
    }

    if (transaccion.status !== 'payment_confirmed') {
      throw new Error(
        `No se puede completar la transacción desde el estado "${transaccion.status}". ` +
        `El comprador debe confirmar el pago primero (estado requerido: "payment_confirmed")`
      );
    }

    const amount = String(transaccion.amount);

    // 💸 TRANSFERIR FONDOS — Paso D: un asiento P2P user↔user (cripto bloqueado
    // del vendedor → disponible del comprador), sin suspense.
    const { settleP2P } = require('../balances/ledger/operations');
    await settleP2P({
      sellerId: transaccion.sellerId,
      buyerId: transaccion.buyerId,
      cryptoId: transaccion.cryptoId,
      amount,
      referencia: `p2p:${transaccion.id}`,
    }, transaction);

    await transaccion.update({
      status: 'completed',
      completedAt: new Date()
    }, { transaction });

    // 📧 NOTIFICAR A AMBAS PARTES
    const { Notification } = require('../../models/index');
    
    const transaccionConDatos = {
      id: transaccion.id,
      amount,
      crypto: transaccion.crypto,
      fiatAmount: String(transaccion.fiatAmount),
      fiatCurrency: transaccion.fiatCurrency
    };

    await Notification.notifyBothParties(
      transaccion.buyerId,
      transaccion.sellerId,
      transaccionConDatos,
      'completed',
      { transaction }
    );

    await transaction.commit();
    
    return await P2PTransaction.getById(id);
    
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

  // 🆕 CANCELAR TRANSACCIÓN - DESBLOQUEAR FONDOS
P2PTransaction.cancelTransaction = async (id, userId) => {
  const transaction = await sequelize.transaction();
  
  try {
    const transaccion = await P2PTransaction.findByPk(id, { 
      include: ['crypto'],
      transaction 
    });
    
    if (!transaccion) {
      throw new Error('Transacción no encontrada');
    }

    if (userId && 
        transaccion.buyerId !== userId && 
        transaccion.sellerId !== userId) {
      throw new Error('No tienes permiso para cancelar esta transacción. Solo el comprador o vendedor pueden cancelarla.');
    }

    if (transaccion.status === 'completed') {
      throw new Error('No se puede cancelar una transacción completada. Los fondos ya fueron transferidos.');
    }

    if (transaccion.status === 'cancelled') {
      throw new Error('La transacción ya está cancelada');
    }

    const { UserBalance } = require('../../models/index');
    const amount = String(transaccion.amount);

    // 🔓 DESBLOQUEAR FONDOS — Paso D: unblockBalance postea dos patas de usuario
    // (bloqueado→disponible), sin suspense.
    if (transaccion.status === 'initiated' || transaccion.status === 'payment_confirmed') {
      await UserBalance.unblockBalance(transaccion.sellerId, transaccion.cryptoId, amount, transaction);
    }

    await transaccion.update({
      status: 'cancelled'
    }, { transaction });

    // 📧 NOTIFICAR A AMBAS PARTES
    const { Notification } = require('../../models/index');
    
    const transaccionConDatos = {
      id: transaccion.id,
      amount,
      crypto: transaccion.crypto,
      fiatAmount: String(transaccion.fiatAmount),
      fiatCurrency: transaccion.fiatCurrency
    };

    await Notification.notifyBothParties(
      transaccion.buyerId,
      transaccion.sellerId,
      transaccionConDatos,
      'cancelled',
      { transaction }
    );

    await transaction.commit();
    
    return await P2PTransaction.getById(id);
    
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

  // CONFIRMAR PAGO (sin cambios en balance, solo cambio de status)
  P2PTransaction.confirmPayment = async (id, userId) => {
    const transaction = await sequelize.transaction();
    
    try {
      const transaccion = await P2PTransaction.findByPk(id, { 
        include: ['crypto'],
        transaction 
      });
      
      if (!transaccion) {
        throw new Error('Transacción no encontrada');
      }

      if (userId && transaccion.buyerId !== userId) {
        throw new Error('Solo el comprador puede confirmar que realizó el pago');
      }

      if (transaccion.status !== 'initiated') {
        throw new Error(
          `No se puede confirmar pago desde el estado "${transaccion.status}". ` +
          `La transacción debe estar en estado "initiated"`
        );
      }

      await transaccion.update({
        status: 'payment_confirmed',
        paymentConfirmedAt: new Date()
      }, { transaction });

      // 📧 NOTIFICAR A AMBAS PARTES
      const { Notification } = require('../../models/index');
      
      const transaccionConDatos = {
        id: transaccion.id,
        amount: String(transaccion.amount),
        crypto: transaccion.crypto,
        fiatAmount: String(transaccion.fiatAmount),
        fiatCurrency: transaccion.fiatCurrency
      };

      await Notification.notifyBothParties(
        transaccion.buyerId,
        transaccion.sellerId,
        transaccionConDatos,
        'payment_confirmed',
        { transaction }
      );

      await transaction.commit();
      
      return await P2PTransaction.getById(id);
      
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  };

  // Métodos de consulta (sin cambios)
  P2PTransaction.getById = async (id) => {
    return await P2PTransaction.findByPk(id, {
      include: [
        {
          association: 'offer',
          attributes: ['id', 'type', 'additionalTerms']
        },
        {
          association: 'buyer',
          attributes: ['id', 'username', 'email']
        },
        {
          association: 'seller',
          attributes: ['id', 'username', 'email']
        },
        {
          association: 'crypto',
          attributes: ['id', 'name', 'symbol']
        },
        {
          association: 'paymentMethod',
          attributes: ['id', 'name']
        }
      ]
    });
  };

  P2PTransaction.getAll = async (filters = {}) => {
    const {
      status,
      buyerId,
      sellerId,
      cryptoId,
      paymentMethodId,
      fechaDesde,
      fechaHasta,
      montoMin,
      montoMax,
      page = 1,
      limit = 20,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = filters;

    const where = {};
    const offset = (page - 1) * limit;

    if (status) where.status = status;
    if (buyerId) where.buyerId = buyerId;
    if (sellerId) where.sellerId = sellerId;
    if (cryptoId) where.cryptoId = cryptoId;
    if (paymentMethodId) where.paymentMethodId = paymentMethodId;

    if (fechaDesde || fechaHasta) {
      where.created_at = {};
      if (fechaDesde) where.created_at[Op.gte] = new Date(fechaDesde);
      if (fechaHasta) where.created_at[Op.lte] = new Date(fechaHasta);
    }

    if (montoMin || montoMax) {
      where.fiatAmount = {};
      if (montoMin) where.fiatAmount[Op.gte] = montoMin;
      if (montoMax) where.fiatAmount[Op.lte] = montoMax;
    }

    const { count, rows } = await P2PTransaction.findAndCountAll({
      where,
      include: [
        {
          association: 'offer',
          attributes: ['id', 'type']
        },
        {
          association: 'buyer',
          attributes: ['id', 'username']
        },
        {
          association: 'seller',
          attributes: ['id', 'username']
        },
        {
          association: 'crypto',
          attributes: ['id', 'name', 'symbol']
        },
        {
          association: 'paymentMethod',
          attributes: ['id', 'name']
        }
      ],
      order: [[orderBy, orderDirection]],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    return {
      transacciones: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  };

  P2PTransaction.getUserTransactions = async (userId, filters = {}) => {
    const { page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const where = {
      [Op.or]: [
        { buyerId: userId },
        { sellerId: userId }
      ]
    };

    if (filters.status) where.status = filters.status;
    if (filters.fechaDesde) where.created_at = { [Op.gte]: new Date(filters.fechaDesde) };

    const { count, rows } = await P2PTransaction.findAndCountAll({
      where,
      include: [
        {
          association: 'offer',
          attributes: ['id', 'type']
        },
        {
          association: 'buyer',
          attributes: ['id', 'username']
        },
        {
          association: 'seller',
          attributes: ['id', 'username']
        },
        {
          association: 'crypto',
          attributes: ['id', 'name', 'symbol']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    return {
      transacciones: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  };

  P2PTransaction.getPendingTransactions = async (userId) => {
    return await P2PTransaction.findAll({
      where: {
        [Op.or]: [
          { buyerId: userId },
          { sellerId: userId }
        ],
        status: { [Op.in]: ['initiated', 'payment_confirmed'] }
      },
      include: [
        {
          association: 'offer',
          attributes: ['id', 'type']
        },
        {
          association: 'buyer',
          attributes: ['id', 'username']
        },
        {
          association: 'seller',
          attributes: ['id', 'username']
        },
        {
          association: 'crypto',
          attributes: ['id', 'symbol']
        }
      ],
      order: [['created_at', 'DESC']]
    });
  };

  P2PTransaction.getStats = async (filters = {}) => {
    const where = {};
    
    if (filters.fechaDesde || filters.fechaHasta) {
      where.created_at = {};
      if (filters.fechaDesde) where.created_at[Op.gte] = new Date(filters.fechaDesde);
      if (filters.fechaHasta) where.created_at[Op.lte] = new Date(filters.fechaHasta);
    }

    const stats = await P2PTransaction.findAll({
      attributes: [
        'status',
        'fiatCurrency',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('SUM', sequelize.col('fiatAmount')), 'volumenTotal'],
        [sequelize.fn('AVG', sequelize.col('fiatAmount')), 'montoPromedio']
      ],
      where,
      group: ['status', 'fiatCurrency'],
      raw: true
    });

    return stats;
  };

  P2PTransaction.getUserVolume = async (userId, period = '30d') => {
    const fechaDesde = new Date();
    switch (period) {
      case '7d':
        fechaDesde.setDate(fechaDesde.getDate() - 7);
        break;
      case '30d':
        fechaDesde.setDate(fechaDesde.getDate() - 30);
        break;
      case '90d':
        fechaDesde.setDate(fechaDesde.getDate() - 90);
        break;
      default:
        fechaDesde.setDate(fechaDesde.getDate() - 30);
    }

    const volume = await P2PTransaction.findAll({
      attributes: [
        'fiatCurrency',
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransacciones'],
        [sequelize.fn('SUM', sequelize.col('fiatAmount')), 'volumenTotal']
      ],
      where: {
        [Op.or]: [
          { buyerId: userId },
          { sellerId: userId }
        ],
        status: 'completed',
        created_at: { [Op.gte]: fechaDesde }
      },
      group: ['fiatCurrency'],
      raw: true
    });

    return volume;
  };

  P2PTransaction.checkTimeouts = async () => {
    const timeoutHours = 24;
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() - timeoutHours);

    const timedOutTransactions = await P2PTransaction.findAll({
      where: {
        status: { [Op.in]: ['initiated', 'payment_confirmed'] },
        created_at: { [Op.lt]: timeoutDate }
      }
    });

    const cancelPromises = timedOutTransactions.map(tx => 
      P2PTransaction.cancelTransaction(tx.id, null)
    );

    await Promise.all(cancelPromises);
    return timedOutTransactions.length;
  };

 

  return P2PTransaction;
}

module.exports = createTransaccionP2PModel;