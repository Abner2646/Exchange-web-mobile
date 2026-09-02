// models/transaccionP2P.model.js

const initTransaccionP2P = require('./entities/transaccionP2P.entity');
const { Op } = require('sequelize');
const money = require('../utils/money');

function createTransaccionP2PModel(sequelize) {
  const TransaccionP2P = initTransaccionP2P(sequelize);

  // Estados válidos para transiciones
  const ESTADOS_VALIDOS = {
    'iniciada': ['pago_confirmado', 'cancelada'],
    'pago_confirmado': ['completada', 'cancelada'],
    'completada': [],
    'cancelada': []
  };

TransaccionP2P.createTransaction = async (data) => {
  const { 
    ofertaId, 
    compradorId, 
    vendedorId, 
    criptomonedaId, 
    cantidad, 
    precioUnitario, 
    metodoPagoId 
  } = data;

  if (compradorId === vendedorId) {
    throw new Error('El comprador y vendedor no pueden ser el mismo usuario');
  }

  const transaction = await sequelize.transaction();
  
  try {
    const { OfertaP2P } = require('./index');
    const oferta = await OfertaP2P.findByPk(ofertaId, { 
      include: ['criptomoneda'],
      transaction 
    });
    
    if (!oferta) {
      throw new Error('Oferta no encontrada');
    }

    if (!oferta.activa) {
      throw new Error('La oferta no está activa. No se pueden realizar transacciones con ofertas desactivadas.');
    }

    const cantidadNum = String(cantidad);
    const cantidadMin = String(oferta.cantidadMin);
    const cantidadMax = String(oferta.cantidadMax);

    if (money.compare(cantidadNum, cantidadMin) < 0 || money.compare(cantidadNum, cantidadMax) > 0) {
      throw new Error(
        `La cantidad ${cantidadNum} está fuera del rango permitido. ` +
        `Mínimo: ${cantidadMin}, Máximo: ${cantidadMax}`
      );
    }

    const { BalanceUsuario } = require('./index');
    const balance = await BalanceUsuario.getByUserAndCrypto(vendedorId, criptomonedaId, { transaction });
    
    if (!balance) {
      throw new Error(
        `El vendedor no tiene balance en ${oferta.criptomoneda?.symbol || 'esta criptomoneda'}. ` +
        `La transacción no puede continuar.`
      );
    }

    const balanceDisponible = String(balance.balanceDisponible);

    if (money.compare(balanceDisponible, cantidadNum) < 0) {
      throw new Error(
        `Fondos insuficientes del vendedor. ` +
        `Disponible: ${balanceDisponible} ${oferta.criptomoneda?.symbol || ''}, ` +
        `Requerido: ${cantidadNum} ${oferta.criptomoneda?.symbol || ''}`
      );
    }

    // 🔒 BLOQUEAR FONDOS — Paso D: blockBalance postea dos patas de usuario
    // (disponible→bloqueado), sin suspense.
    await BalanceUsuario.blockBalance(vendedorId, criptomonedaId, cantidadNum, transaction);

    const montoFiat = money.multiply(cantidadNum, String(precioUnitario));

    const nuevaTransaccion = await TransaccionP2P.create({
      ofertaId,
      compradorId,
      vendedorId,
      criptomonedaId,
      cantidad: cantidadNum,
      precioUnitario,
      montoFiat,
      monedaFiat: oferta.monedaFiat,
      metodoPagoId,
      estado: 'iniciada'
    }, { transaction });

    // 📧 NOTIFICAR A AMBAS PARTES
    const { Notificaciones } = require('./index');
    
    const transaccionConDatos = {
      id: nuevaTransaccion.id,
      cantidad: cantidadNum,
      criptomoneda: oferta.criptomoneda,
      montoFiat,
      monedaFiat: oferta.monedaFiat
    };

    await Notificaciones.notifyBothParties(
      compradorId,
      vendedorId,
      transaccionConDatos,
      'iniciada',
      { transaction }
    );

    await transaction.commit();
    
    return await TransaccionP2P.getById(nuevaTransaccion.id);
    
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

  // 🆕 COMPLETAR TRANSACCIÓN - TRANSFERIR FONDOS
TransaccionP2P.completeTransaction = async (id, usuarioId) => {
  const transaction = await sequelize.transaction();
  
  try {
    const transaccion = await TransaccionP2P.findByPk(id, { 
      include: ['criptomoneda'],
      transaction 
    });
    
    if (!transaccion) {
      throw new Error('Transacción no encontrada');
    }

    if (usuarioId && transaccion.vendedorId !== usuarioId) {
      throw new Error('Solo el vendedor puede completar y liberar las criptomonedas');
    }

    if (transaccion.estado !== 'pago_confirmado') {
      throw new Error(
        `No se puede completar la transacción desde el estado "${transaccion.estado}". ` +
        `El comprador debe confirmar el pago primero (estado requerido: "pago_confirmado")`
      );
    }

    const cantidad = String(transaccion.cantidad);

    // 💸 TRANSFERIR FONDOS — Paso D: un asiento P2P user↔user (cripto bloqueado
    // del vendedor → disponible del comprador), sin suspense.
    const { liquidarP2P } = require('../services/ledger/operations');
    await liquidarP2P({
      vendedorId: transaccion.vendedorId,
      compradorId: transaccion.compradorId,
      criptomonedaId: transaccion.criptomonedaId,
      cantidad,
      referencia: `p2p:${transaccion.id}`,
    }, transaction);

    await transaccion.update({
      estado: 'completada',
      fechaCompletada: new Date()
    }, { transaction });

    // 📧 NOTIFICAR A AMBAS PARTES
    const { Notificaciones } = require('./index');
    
    const transaccionConDatos = {
      id: transaccion.id,
      cantidad,
      criptomoneda: transaccion.criptomoneda,
      montoFiat: String(transaccion.montoFiat),
      monedaFiat: transaccion.monedaFiat
    };

    await Notificaciones.notifyBothParties(
      transaccion.compradorId,
      transaccion.vendedorId,
      transaccionConDatos,
      'completada',
      { transaction }
    );

    await transaction.commit();
    
    return await TransaccionP2P.getById(id);
    
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

  // 🆕 CANCELAR TRANSACCIÓN - DESBLOQUEAR FONDOS
TransaccionP2P.cancelTransaction = async (id, usuarioId) => {
  const transaction = await sequelize.transaction();
  
  try {
    const transaccion = await TransaccionP2P.findByPk(id, { 
      include: ['criptomoneda'],
      transaction 
    });
    
    if (!transaccion) {
      throw new Error('Transacción no encontrada');
    }

    if (usuarioId && 
        transaccion.compradorId !== usuarioId && 
        transaccion.vendedorId !== usuarioId) {
      throw new Error('No tienes permiso para cancelar esta transacción. Solo el comprador o vendedor pueden cancelarla.');
    }

    if (transaccion.estado === 'completada') {
      throw new Error('No se puede cancelar una transacción completada. Los fondos ya fueron transferidos.');
    }

    if (transaccion.estado === 'cancelada') {
      throw new Error('La transacción ya está cancelada');
    }

    const { BalanceUsuario } = require('./index');
    const cantidad = String(transaccion.cantidad);

    // 🔓 DESBLOQUEAR FONDOS — Paso D: unblockBalance postea dos patas de usuario
    // (bloqueado→disponible), sin suspense.
    if (transaccion.estado === 'iniciada' || transaccion.estado === 'pago_confirmado') {
      await BalanceUsuario.unblockBalance(transaccion.vendedorId, transaccion.criptomonedaId, cantidad, transaction);
    }

    await transaccion.update({
      estado: 'cancelada'
    }, { transaction });

    // 📧 NOTIFICAR A AMBAS PARTES
    const { Notificaciones } = require('./index');
    
    const transaccionConDatos = {
      id: transaccion.id,
      cantidad,
      criptomoneda: transaccion.criptomoneda,
      montoFiat: String(transaccion.montoFiat),
      monedaFiat: transaccion.monedaFiat
    };

    await Notificaciones.notifyBothParties(
      transaccion.compradorId,
      transaccion.vendedorId,
      transaccionConDatos,
      'cancelada',
      { transaction }
    );

    await transaction.commit();
    
    return await TransaccionP2P.getById(id);
    
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

  // CONFIRMAR PAGO (sin cambios en balance, solo cambio de estado)
  TransaccionP2P.confirmPayment = async (id, usuarioId) => {
    const transaction = await sequelize.transaction();
    
    try {
      const transaccion = await TransaccionP2P.findByPk(id, { 
        include: ['criptomoneda'],
        transaction 
      });
      
      if (!transaccion) {
        throw new Error('Transacción no encontrada');
      }

      if (usuarioId && transaccion.compradorId !== usuarioId) {
        throw new Error('Solo el comprador puede confirmar que realizó el pago');
      }

      if (transaccion.estado !== 'iniciada') {
        throw new Error(
          `No se puede confirmar pago desde el estado "${transaccion.estado}". ` +
          `La transacción debe estar en estado "iniciada"`
        );
      }

      await transaccion.update({
        estado: 'pago_confirmado',
        fechaPagoConfirmado: new Date()
      }, { transaction });

      // 📧 NOTIFICAR A AMBAS PARTES
      const { Notificaciones } = require('./index');
      
      const transaccionConDatos = {
        id: transaccion.id,
        cantidad: String(transaccion.cantidad),
        criptomoneda: transaccion.criptomoneda,
        montoFiat: String(transaccion.montoFiat),
        monedaFiat: transaccion.monedaFiat
      };

      await Notificaciones.notifyBothParties(
        transaccion.compradorId,
        transaccion.vendedorId,
        transaccionConDatos,
        'pago_confirmado',
        { transaction }
      );

      await transaction.commit();
      
      return await TransaccionP2P.getById(id);
      
    } catch (error) {
      if (!transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  };

  // Métodos de consulta (sin cambios)
  TransaccionP2P.getById = async (id) => {
    return await TransaccionP2P.findByPk(id, {
      include: [
        {
          association: 'oferta',
          attributes: ['id', 'tipo', 'condicionesAdicionales']
        },
        {
          association: 'comprador',
          attributes: ['id', 'username', 'email']
        },
        {
          association: 'vendedor',
          attributes: ['id', 'username', 'email']
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'nombre', 'symbol']
        },
        {
          association: 'metodoPago',
          attributes: ['id', 'nombre']
        }
      ]
    });
  };

  TransaccionP2P.getAll = async (filters = {}) => {
    const {
      estado,
      compradorId,
      vendedorId,
      criptomonedaId,
      metodoPagoId,
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

    if (estado) where.estado = estado;
    if (compradorId) where.compradorId = compradorId;
    if (vendedorId) where.vendedorId = vendedorId;
    if (criptomonedaId) where.criptomonedaId = criptomonedaId;
    if (metodoPagoId) where.metodoPagoId = metodoPagoId;

    if (fechaDesde || fechaHasta) {
      where.created_at = {};
      if (fechaDesde) where.created_at[Op.gte] = new Date(fechaDesde);
      if (fechaHasta) where.created_at[Op.lte] = new Date(fechaHasta);
    }

    if (montoMin || montoMax) {
      where.montoFiat = {};
      if (montoMin) where.montoFiat[Op.gte] = montoMin;
      if (montoMax) where.montoFiat[Op.lte] = montoMax;
    }

    const { count, rows } = await TransaccionP2P.findAndCountAll({
      where,
      include: [
        {
          association: 'oferta',
          attributes: ['id', 'tipo']
        },
        {
          association: 'comprador',
          attributes: ['id', 'username']
        },
        {
          association: 'vendedor',
          attributes: ['id', 'username']
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'nombre', 'symbol']
        },
        {
          association: 'metodoPago',
          attributes: ['id', 'nombre']
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

  TransaccionP2P.getUserTransactions = async (usuarioId, filters = {}) => {
    const { page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const where = {
      [Op.or]: [
        { compradorId: usuarioId },
        { vendedorId: usuarioId }
      ]
    };

    if (filters.estado) where.estado = filters.estado;
    if (filters.fechaDesde) where.created_at = { [Op.gte]: new Date(filters.fechaDesde) };

    const { count, rows } = await TransaccionP2P.findAndCountAll({
      where,
      include: [
        {
          association: 'oferta',
          attributes: ['id', 'tipo']
        },
        {
          association: 'comprador',
          attributes: ['id', 'username']
        },
        {
          association: 'vendedor',
          attributes: ['id', 'username']
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'nombre', 'symbol']
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

  TransaccionP2P.getPendingTransactions = async (usuarioId) => {
    return await TransaccionP2P.findAll({
      where: {
        [Op.or]: [
          { compradorId: usuarioId },
          { vendedorId: usuarioId }
        ],
        estado: { [Op.in]: ['iniciada', 'pago_confirmado'] }
      },
      include: [
        {
          association: 'oferta',
          attributes: ['id', 'tipo']
        },
        {
          association: 'comprador',
          attributes: ['id', 'username']
        },
        {
          association: 'vendedor',
          attributes: ['id', 'username']
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'symbol']
        }
      ],
      order: [['created_at', 'DESC']]
    });
  };

  TransaccionP2P.getStats = async (filters = {}) => {
    const where = {};
    
    if (filters.fechaDesde || filters.fechaHasta) {
      where.created_at = {};
      if (filters.fechaDesde) where.created_at[Op.gte] = new Date(filters.fechaDesde);
      if (filters.fechaHasta) where.created_at[Op.lte] = new Date(filters.fechaHasta);
    }

    const stats = await TransaccionP2P.findAll({
      attributes: [
        'estado',
        'monedaFiat',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('SUM', sequelize.col('montoFiat')), 'volumenTotal'],
        [sequelize.fn('AVG', sequelize.col('montoFiat')), 'montoPromedio']
      ],
      where,
      group: ['estado', 'monedaFiat'],
      raw: true
    });

    return stats;
  };

  TransaccionP2P.getUserVolume = async (usuarioId, period = '30d') => {
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

    const volume = await TransaccionP2P.findAll({
      attributes: [
        'monedaFiat',
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransacciones'],
        [sequelize.fn('SUM', sequelize.col('montoFiat')), 'volumenTotal']
      ],
      where: {
        [Op.or]: [
          { compradorId: usuarioId },
          { vendedorId: usuarioId }
        ],
        estado: 'completada',
        created_at: { [Op.gte]: fechaDesde }
      },
      group: ['monedaFiat'],
      raw: true
    });

    return volume;
  };

  TransaccionP2P.checkTimeouts = async () => {
    const timeoutHours = 24;
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() - timeoutHours);

    const timedOutTransactions = await TransaccionP2P.findAll({
      where: {
        estado: { [Op.in]: ['iniciada', 'pago_confirmado'] },
        created_at: { [Op.lt]: timeoutDate }
      }
    });

    const cancelPromises = timedOutTransactions.map(tx => 
      TransaccionP2P.cancelTransaction(tx.id, null)
    );

    await Promise.all(cancelPromises);
    return timedOutTransactions.length;
  };

 

  return TransaccionP2P;
}

module.exports = createTransaccionP2PModel;