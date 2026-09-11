// models/intercambioExchange.model.js

const initIntercambioExchange = require('./swap.entity');
const { Op } = require('sequelize');
const { startOfUtcDay, endOfUtcDay } = require('../../utils/time');

function createIntercambioExchangeModel(sequelize) {
  const Swap = initIntercambioExchange(sequelize);

  // Métodos de consulta básicos
  Swap.getById = async (id) => {
    try {
      return await Swap.findByPk(id, {
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'username', 'email', 'averageRating']
          },
          {
            model: sequelize.models.SwapPair,
            as: 'pair',
            attributes: ['id', 'active', 'feePercent', 'currentPrice'],
            include: [
              {
                model: sequelize.models.Crypto,
                as: 'baseCrypto',
                attributes: ['id', 'symbol', 'name', 'decimals']
              },
              {
                model: sequelize.models.Crypto,
                as: 'quoteCrypto',
                attributes: ['id', 'symbol', 'name', 'decimals']
              }
            ]
          }
        ]
      });
    } catch (error) {
      throw new Error(`Error al obtener intercambio por ID: ${error.message}`);
    }
  };

  Swap.getAll = async (filters = {}) => {
    try {
      const where = {};
      
      if (filters.userId) where.userId = filters.userId;
      if (filters.pairId) where.pairId = filters.pairId;
      if (filters.type) where.type = filters.type;
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          where.status = { [Op.in]: filters.status };
        } else {
          where.status = filters.status;
        }
      }
      
      // Filtros de fecha
      if (filters.fechaDesde) {
        where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
      }
      
      // Filtros de price
      if (filters.precioMin) {
        where.price = { ...where.price, [Op.gte]: parseFloat(filters.precioMin) };
      }
      if (filters.precioMax) {
        where.price = { ...where.price, [Op.lte]: parseFloat(filters.precioMax) };
      }

      // Filtros de cantidad
      if (filters.cantidadMin) {
        where.baseAmount = { ...where.baseAmount, [Op.gte]: parseFloat(filters.cantidadMin) };
      }
      if (filters.cantidadMax) {
        where.baseAmount = { ...where.baseAmount, [Op.lte]: parseFloat(filters.cantidadMax) };
      }
      
      const limit = Math.min(parseInt(filters.limit) || 50, 100);
      const offset = parseInt(filters.offset) || 0;
      
      return await Swap.findAndCountAll({
        where,
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'username', 'averageRating']
          },
          {
            model: sequelize.models.SwapPair,
            as: 'pair',
            attributes: ['id', 'active'],
            include: [
              {
                model: sequelize.models.Crypto,
                as: 'baseCrypto',
                attributes: ['id', 'symbol', 'name']
              },
              {
                model: sequelize.models.Crypto,
                as: 'quoteCrypto',
                attributes: ['id', 'symbol', 'name']
              }
            ]
          }
        ],
        limit,
        offset,
        order: [['created_at', 'DESC']]
      });
    } catch (error) {
      throw new Error(`Error al obtener intercambios: ${error.message}`);
    }
  };

  Swap.getByUserId = async (userId, filters = {}) => {
    try {
      const where = { userId };
      
      if (filters.type) where.type = filters.type;
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          where.status = { [Op.in]: filters.status };
        } else {
          where.status = filters.status;
        }
      }
      if (filters.pairId) where.pairId = filters.pairId;
      
      // Filtros de fecha
      if (filters.fechaDesde) {
        where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
      }
      
      const limit = Math.min(parseInt(filters.limit) || 50, 100);
      const offset = parseInt(filters.offset) || 0;
      
      return await Swap.findAndCountAll({
        where,
        include: [
          {
            model: sequelize.models.SwapPair,
            as: 'pair',
            attributes: ['id', 'active', 'currentPrice'],
            include: [
              {
                model: sequelize.models.Crypto,
                as: 'baseCrypto',
                attributes: ['id', 'symbol', 'name']
              },
              {
                model: sequelize.models.Crypto,
                as: 'quoteCrypto',
                attributes: ['id', 'symbol', 'name']
              }
            ]
          }
        ],
        limit,
        offset,
        order: [['created_at', 'DESC']]
      });
    } catch (error) {
      throw new Error(`Error al obtener intercambios del usuario: ${error.message}`);
    }
  };

  Swap.search = async (term, limit = 10) => {
    try {
      const searchLimit = Math.min(limit, 50);
      
      return await Swap.findAll({
        where: {
          [Op.or]: [
            { '$user.username$': { [Op.iLike]: `%${term}%` } },
            { '$user.email$': { [Op.iLike]: `%${term}%` } },
            { '$par.baseCrypto.symbol$': { [Op.iLike]: `%${term}%` } },
            { '$par.quoteCrypto.symbol$': { [Op.iLike]: `%${term}%` } },
            // Buscar por ID si el término parece un UUID
            ...(term.length >= 8 ? [{ id: { [Op.iLike]: `%${term}%` } }] : [])
          ]
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'username', 'email']
          },
          {
            model: sequelize.models.SwapPair,
            as: 'pair',
            attributes: ['id', 'active'],
            include: [
              {
                model: sequelize.models.Crypto,
                as: 'baseCrypto',
                attributes: ['id', 'symbol', 'name']
              },
              {
                model: sequelize.models.Crypto,
                as: 'quoteCrypto',
                attributes: ['id', 'symbol', 'name']
              }
            ]
          }
        ],
        limit: searchLimit,
        order: [['created_at', 'DESC']]
      });
    } catch (error) {
      throw new Error(`Error en búsqueda de intercambios: ${error.message}`);
    }
  };

  // Métodos estadísticos
  Swap.getStats = async (filters = {}) => {
    try {
      const where = {};
      
      if (filters.userId) where.userId = filters.userId;
      if (filters.pairId) where.pairId = filters.pairId;
      
      if (filters.fechaDesde) {
        where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
      }
      
      const total = await Swap.count({ where });
      const completados = await Swap.count({ 
        where: { ...where, status: 'completed' } 
      });
      const pendientes = await Swap.count({ 
        where: { ...where, status: 'pending' } 
      });
      const fallidos = await Swap.count({ 
        where: { ...where, status: 'failed' } 
      });
      
      const compras = await Swap.count({ 
        where: { ...where, type: 'buy' } 
      });
      const ventas = await Swap.count({ 
        where: { ...where, type: 'sell' } 
      });
      
      // Volúmenes (solo órdenes completadas)
      const whereCompleted = { ...where, status: 'completed' };
      
      const volumenTotal = await Swap.sum('quoteAmount', { where: whereCompleted });
      const comisionTotal = await Swap.sum('feeAmount', { where: whereCompleted });
      
      // Volúmenes por type
      const volumenCompras = await Swap.sum('quoteAmount', { 
        where: { ...whereCompleted, type: 'buy' } 
      });
      const volumenVentas = await Swap.sum('quoteAmount', { 
        where: { ...whereCompleted, type: 'sell' } 
      });
      
      // Promedios
      const promedioCompra = compras > 0 ? await Swap.findAll({
        where: { ...whereCompleted, type: 'buy' },
        attributes: [[sequelize.fn('AVG', sequelize.col('price')), 'avgPrice']],
        raw: true
      }) : [{ avgPrice: 0 }];
      
      const promedioVenta = ventas > 0 ? await Swap.findAll({
        where: { ...whereCompleted, type: 'sell' },
        attributes: [[sequelize.fn('AVG', sequelize.col('price')), 'avgPrice']],
        raw: true
      }) : [{ avgPrice: 0 }];
      
      return {
        total,
        completados,
        pendientes,
        fallidos,
        compras,
        ventas,
        volumenTotal: parseFloat(volumenTotal || 0).toFixed(8),
        volumenCompras: parseFloat(volumenCompras || 0).toFixed(8),
        volumenVentas: parseFloat(volumenVentas || 0).toFixed(8),
        comisionTotal: parseFloat(comisionTotal || 0).toFixed(8),
        tasaExito: total > 0 ? ((completados / total) * 100).toFixed(2) : '0.00',
        precioPromedioCompra: parseFloat(promedioCompra[0]?.avgPrice || 0).toFixed(8),
        precioPromedioVenta: parseFloat(promedioVenta[0]?.avgPrice || 0).toFixed(8)
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  Swap.getDailyVolume = async (userId, date = new Date(), transaction = null) => {
    try {
      // Ventana del día en UTC: created_at se guarda en UTC, así que el borde
      // del "día" del límite diario debe ser el día UTC, no el día local del
      // server (setHours desalinearía la ventana según la TZ del proceso).
      const startOfDay = startOfUtcDay(date);
      const endOfDay = endOfUtcDay(date);

      const volumen = await Swap.sum('quoteAmount', {
        where: {
          userId,
          created_at: {
            [Op.between]: [startOfDay, endOfDay]
          },
          status: { [Op.in]: ['completed', 'pending'] }
        },
        transaction
      });
      
      return parseFloat(volumen || 0);
    } catch (error) {
      throw new Error(`Error al obtener volumen diario: ${error.message}`);
    }
  };

  Swap.getVolumeByPair = async (pairId, filters = {}) => {
    try {
      const where = { pairId };
      
      if (filters.fechaDesde) {
        where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
      }
      if (filters.status) {
        where.status = filters.status;
      } else {
        where.status = 'completed'; // Por defecto solo completados
      }
      
      const volumenCompras = await Swap.sum('quoteAmount', {
        where: { ...where, type: 'buy' }
      });
      
      const volumenVentas = await Swap.sum('quoteAmount', {
        where: { ...where, type: 'sell' }
      });
      
      const volumenBase = await Swap.sum('baseAmount', { where });
      const operaciones = await Swap.count({ where });
      
      return {
        volumenTotal: parseFloat((volumenCompras || 0) + (volumenVentas || 0)).toFixed(8),
        volumenCompras: parseFloat(volumenCompras || 0).toFixed(8),
        volumenVentas: parseFloat(volumenVentas || 0).toFixed(8),
        volumenBase: parseFloat(volumenBase || 0).toFixed(8),
        numeroOperaciones: operaciones
      };
    } catch (error) {
      throw new Error(`Error al obtener volumen por par: ${error.message}`);
    }
  };

  // Métodos de análisis de precios
  Swap.getPriceHistory = async (pairId, filters = {}) => {
    try {
      const where = { 
        pairId,
        status: 'completed'
      };
      
      if (filters.fechaDesde) {
        where.completedAt = { ...where.completedAt, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.completedAt = { ...where.completedAt, [Op.lte]: new Date(filters.fechaHasta) };
      }
      
      const limit = Math.min(parseInt(filters.limit) || 1000, 5000);
      
      const history = await Swap.findAll({
        where,
        attributes: [
          'price', 
          'baseAmount', 
          'quoteAmount', 
          'completedAt', 
          'type',
          'id'
        ],
        order: [['completedAt', filters.order === 'ASC' ? 'ASC' : 'DESC']],
        limit
      });
      
      return history.map(order => ({
        id: order.id,
        price: parseFloat(order.price),
        baseAmount: parseFloat(order.baseAmount),
        quoteAmount: parseFloat(order.quoteAmount),
        timestamp: order.completedAt,
        type: order.type
      }));
    } catch (error) {
      throw new Error(`Error al obtener historial de precios: ${error.message}`);
    }
  };

  Swap.getLastPrice = async (pairId) => {
    try {
      const lastOrder = await Swap.findOne({
        where: { 
          pairId,
          status: 'completed'
        },
        order: [['completedAt', 'DESC']]
      });
      
      return lastOrder ? parseFloat(lastOrder.price) : null;
    } catch (error) {
      throw new Error(`Error al obtener último price: ${error.message}`);
    }
  };

  // Métodos administrativos
  Swap.updateStatus = async (id, newStatus) => {
    try {
      const validStatuses = ['pending', 'completed', 'failed'];
      
      if (!validStatuses.includes(newStatus)) {
        throw new Error('Estado inválido. Estados válidos: ' + validStatuses.join(', '));
      }
      
      const updateData = { status: newStatus };
      if (newStatus === 'completed') {
        updateData.completedAt = new Date();
      }
      
      const [updatedRowsCount] = await Swap.update(updateData, { where: { id } });
      
      if (updatedRowsCount === 0) {
        throw new Error('Intercambio no encontrado');
      }
      
      return await Swap.getById(id);
    } catch (error) {
      throw new Error(`Error al actualizar status: ${error.message}`);
    }
  };

  // Métodos para reportes y análisis
  Swap.getTopTraders = async (limit = 10, period = '30d') => {
    try {
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
      }

      const topTraders = await Swap.findAll({
        attributes: [
          'userId',
          [sequelize.fn('COUNT', sequelize.col('Swap.id')), 'totalOperaciones'],
          [sequelize.fn('SUM', sequelize.col('quoteAmount')), 'volumenTotal'],
          [sequelize.fn('SUM', sequelize.col('feeAmount')), 'comisionesTotales']
        ],
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'username', 'averageRating']
          }
        ],
        where: {
          status: 'completed',
          created_at: { [Op.gte]: fechaDesde }
        },
        group: ['userId', 'user.id'],
        order: [[sequelize.fn('SUM', sequelize.col('quoteAmount')), 'DESC']],
        limit: parseInt(limit),
        subQuery: false
      });

      return topTraders;
    } catch (error) {
      throw new Error(`Error al obtener top traders: ${error.message}`);
    }
  };

  Swap.getMarketSummary = async (pairId = null) => {
    try {
      const where = { status: 'completed' };
      if (pairId) where.pairId = pairId;
      
      // Obtener datos de las últimas 24 horas
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const whereRecent = { ...where, created_at: { [Op.gte]: yesterday } };
      
      const summary = await Swap.findAll({
        attributes: [
          'pairId',
          [sequelize.fn('COUNT', sequelize.col('Swap.id')), 'operaciones24h'],
          [sequelize.fn('SUM', sequelize.col('quoteAmount')), 'volume24h'],
          [sequelize.fn('MIN', sequelize.col('price')), 'precioMin24h'],
          [sequelize.fn('MAX', sequelize.col('price')), 'precioMax24h'],
          [sequelize.fn('AVG', sequelize.col('price')), 'precioPromedio24h']
        ],
        include: [
          {
            model: sequelize.models.SwapPair,
            as: 'pair',
            attributes: ['id', 'currentPrice'],
            include: [
              {
                model: sequelize.models.Crypto,
                as: 'baseCrypto',
                attributes: ['symbol', 'name']
              },
              {
                model: sequelize.models.Crypto,
                as: 'quoteCrypto',
                attributes: ['symbol', 'name']
              }
            ]
          }
        ],
        where: whereRecent,
        group: ['pairId', 'pair.id', 'pair.baseCrypto.id', 'pair.quoteCrypto.id'],
        order: [[sequelize.fn('SUM', sequelize.col('quoteAmount')), 'DESC']],
        subQuery: false
      });

      return summary;
    } catch (error) {
      throw new Error(`Error al obtener resumen de mercado: ${error.message}`);
    }
  };

  // Método para obtener estadísticas por crypto
  Swap.getStatsByCrypto = async (filters = {}) => {
    try {
      const where = { status: 'completed' };
      
      if (filters.fechaDesde) {
        where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
      }

      // Estadísticas por crypto base
      const statsBase = await Swap.findAll({
        attributes: [
          [sequelize.col('pair.baseCrypto.symbol'), 'criptoSymbol'],
          [sequelize.col('pair.baseCrypto.name'), 'criptoNombre'],
          [sequelize.fn('COUNT', sequelize.col('Swap.id')), 'totalOperaciones'],
          [sequelize.fn('SUM', sequelize.col('baseAmount')), 'volumenBase'],
          [sequelize.fn('SUM', sequelize.col('quoteAmount')), 'volumenQuote'],
          [sequelize.fn('SUM', sequelize.col('feeAmount')), 'comisionesGeneradas']
        ],
        include: [
          {
            model: sequelize.models.SwapPair,
            as: 'pair',
            attributes: [],
            include: [
              {
                model: sequelize.models.Crypto,
                as: 'baseCrypto',
                attributes: []
              }
            ]
          }
        ],
        where,
        group: ['pair.baseCrypto.id'],
        order: [[sequelize.fn('SUM', sequelize.col('quoteAmount')), 'DESC']],
        raw: true
      });

      return statsBase;
    } catch (error) {
      throw new Error(`Error al obtener estadísticas por crypto: ${error.message}`);
    }
  };

  return Swap;
}

module.exports = createIntercambioExchangeModel;