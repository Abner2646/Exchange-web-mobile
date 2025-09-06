// Importaciones
const initTransaccionP2P = require('./entities/transaccionP2P.entity');
const { Op } = require('sequelize');

function createTransaccionP2PModel(sequelize) {
  const TransaccionP2P = initTransaccionP2P(sequelize);

  // Estados válidos para transiciones
  const ESTADOS_VALIDOS = {
    'iniciada': ['cryptos_bloqueadas', 'cancelada'],
    'cryptos_bloqueadas': ['pago_confirmado', 'cancelada'],
    'pago_confirmado': ['completada', 'cancelada'],
    'completada': [],
    'cancelada': []
  };

  // Métodos de creación y validación
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

    // Validar que comprador y vendedor sean diferentes
    if (compradorId === vendedorId) {
      throw new Error('El comprador y vendedor no pueden ser el mismo usuario');
    }

    // Calcular monto fiat
    const montoFiat = parseFloat(cantidad) * parseFloat(precioUnitario);

    const transaction = await sequelize.transaction();
    
    try {
      // Obtener datos de la oferta para validaciones
      const { OfertaP2P } = require('./index');
      const oferta = await OfertaP2P.findByPk(ofertaId, { transaction });
      
      if (!oferta) {
        throw new Error('Oferta no encontrada');
      }

      if (!oferta.activa) {
        throw new Error('La oferta no está activa');
      }

      // Validar cantidad dentro del rango de la oferta
      if (parseFloat(cantidad) < parseFloat(oferta.cantidadMin) || 
          parseFloat(cantidad) > parseFloat(oferta.cantidadMax)) {
        throw new Error(`La cantidad debe estar entre ${oferta.cantidadMin} y ${oferta.cantidadMax}`);
      }

      // Crear la transacción
      const nuevaTransaccion = await TransaccionP2P.create({
        ofertaId,
        compradorId,
        vendedorId,
        criptomonedaId,
        cantidad,
        precioUnitario,
        montoFiat,
        monedaFiat: oferta.monedaFiat,
        metodoPagoId,
        estado: 'iniciada'
      }, { transaction });

      await transaction.commit();
      return await TransaccionP2P.getById(nuevaTransaccion.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  // Métodos de consulta
  TransaccionP2P.getById = async (id) => {
    return await TransaccionP2P.findByPk(id, {
      include: [
        {
          association: 'oferta',
          attributes: ['id', 'tipo', 'condicionesAdicionales']
        },
        {
          association: 'comprador',
          attributes: ['id', 'nombre', 'email', 'reputacion']
        },
        {
          association: 'vendedor',
          attributes: ['id', 'nombre', 'email', 'reputacion']
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'nombre', 'simbolo']
        },
        {
          association: 'metodoPago',
          attributes: ['id', 'nombre', 'tipo', 'detalles']
        },
        {
          association: 'valoraciones',
          attributes: ['id', 'puntuacion', 'comentario', 'usuarioEvaluadorId']
        },
        {
          association: 'reclamos',
          attributes: ['id', 'estado', 'descripcion', 'created_at']
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

    // Filtros básicos
    if (estado) where.estado = estado;
    if (compradorId) where.compradorId = compradorId;
    if (vendedorId) where.vendedorId = vendedorId;
    if (criptomonedaId) where.criptomonedaId = criptomonedaId;
    if (metodoPagoId) where.metodoPagoId = metodoPagoId;

    // Filtros de fecha
    if (fechaDesde || fechaHasta) {
      where.created_at = {};
      if (fechaDesde) where.created_at[Op.gte] = new Date(fechaDesde);
      if (fechaHasta) where.created_at[Op.lte] = new Date(fechaHasta);
    }

    // Filtros de monto
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
          attributes: ['id', 'nombre']
        },
        {
          association: 'vendedor',
          attributes: ['id', 'nombre']
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'nombre', 'simbolo']
        },
        {
          association: 'metodoPago',
          attributes: ['id', 'nombre', 'tipo']
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

  // Métodos de cambio de estado
  TransaccionP2P.updateStatus = async (id, nuevoEstado, usuarioId = null) => {
    const transaccion = await TransaccionP2P.findByPk(id);
    if (!transaccion) {
      throw new Error('Transacción no encontrada');
    }

    // Verificar que el usuario tenga permisos para cambiar el estado
    if (usuarioId && 
        transaccion.compradorId !== usuarioId && 
        transaccion.vendedorId !== usuarioId) {
      throw new Error('No tienes permiso para modificar esta transacción');
    }

    // Validar transición de estado
    if (!ESTADOS_VALIDOS[transaccion.estado].includes(nuevoEstado)) {
      throw new Error(`No se puede cambiar de estado "${transaccion.estado}" a "${nuevoEstado}"`);
    }

    const updateData = { estado: nuevoEstado };

    // Agregar timestamps según el nuevo estado
    switch (nuevoEstado) {
      case 'pago_confirmado':
        updateData.fechaPagoConfirmado = new Date();
        break;
      case 'completada':
        updateData.fechaCompletada = new Date();
        break;
    }

    await transaccion.update(updateData);
    return await TransaccionP2P.getById(id);
  };

  TransaccionP2P.lockCryptos = async (id, usuarioId) => {
    return await TransaccionP2P.updateStatus(id, 'cryptos_bloqueadas', usuarioId);
  };

  TransaccionP2P.confirmPayment = async (id, usuarioId) => {
    return await TransaccionP2P.updateStatus(id, 'pago_confirmado', usuarioId);
  };

  TransaccionP2P.completeTransaction = async (id, usuarioId) => {
    return await TransaccionP2P.updateStatus(id, 'completada', usuarioId);
  };

  TransaccionP2P.cancelTransaction = async (id, usuarioId) => {
    return await TransaccionP2P.updateStatus(id, 'cancelada', usuarioId);
  };

  // Métodos de consulta específicos
  TransaccionP2P.getUserTransactions = async (usuarioId, filters = {}) => {
    const { page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const where = {
      [Op.or]: [
        { compradorId: usuarioId },
        { vendedorId: usuarioId }
      ]
    };

    // Aplicar otros filtros si existen
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
          attributes: ['id', 'nombre']
        },
        {
          association: 'vendedor',
          attributes: ['id', 'nombre']
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'nombre', 'simbolo']
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
        estado: { [Op.in]: ['iniciada', 'cryptos_bloqueadas', 'pago_confirmado'] }
      },
      include: [
        {
          association: 'oferta',
          attributes: ['id', 'tipo']
        },
        {
          association: 'comprador',
          attributes: ['id', 'nombre']
        },
        {
          association: 'vendedor',
          attributes: ['id', 'nombre']
        },
        {
          association: 'criptomoneda',
          attributes: ['id', 'simbolo']
        }
      ],
      order: [['created_at', 'DESC']]
    });
  };

  // Métodos de estadísticas
  TransaccionP2P.getStats = async (filters = {}) => {
    const where = {};
    
    // Aplicar filtros de fecha si existen
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

  // Método para verificar timeouts
  TransaccionP2P.checkTimeouts = async () => {
    const timeoutHours = 24; // Configurable
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() - timeoutHours);

    const timedOutTransactions = await TransaccionP2P.findAll({
      where: {
        estado: { [Op.in]: ['iniciada', 'cryptos_bloqueadas'] },
        created_at: { [Op.lt]: timeoutDate }
      }
    });

    // Cancelar transacciones que han superado el timeout
    const cancelPromises = timedOutTransactions.map(tx => 
      tx.update({ estado: 'cancelada' })
    );

    await Promise.all(cancelPromises);
    return timedOutTransactions.length;
  };

  return TransaccionP2P;
}

module.exports = createTransaccionP2PModel;