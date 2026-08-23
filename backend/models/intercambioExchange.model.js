// models/intercambioExchange.model.js

const initIntercambioExchange = require('./entities/intercambioExchange.entity');
const { Op } = require('sequelize');
const { startOfUtcDay, endOfUtcDay } = require('../utils/time');

function createIntercambioExchangeModel(sequelize) {
  const IntercambioExchange = initIntercambioExchange(sequelize);

  // Métodos de consulta básicos
  IntercambioExchange.getById = async (id) => {
    try {
      return await IntercambioExchange.findByPk(id, {
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'username', 'email', 'reputacionPromedio']
          },
          {
            model: sequelize.models.ParExchange,
            as: 'par',
            attributes: ['id', 'activo', 'comisionPorcentaje', 'precioActual'],
            include: [
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoBase',
                attributes: ['id', 'symbol', 'nombre', 'decimales']
              },
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoQuote',
                attributes: ['id', 'symbol', 'nombre', 'decimales']
              }
            ]
          }
        ]
      });
    } catch (error) {
      throw new Error(`Error al obtener intercambio por ID: ${error.message}`);
    }
  };

  IntercambioExchange.getAll = async (filters = {}) => {
    try {
      const where = {};
      
      if (filters.usuarioId) where.usuarioId = filters.usuarioId;
      if (filters.parId) where.parId = filters.parId;
      if (filters.tipo) where.tipo = filters.tipo;
      if (filters.estado) {
        if (Array.isArray(filters.estado)) {
          where.estado = { [Op.in]: filters.estado };
        } else {
          where.estado = filters.estado;
        }
      }
      
      // Filtros de fecha
      if (filters.fechaDesde) {
        where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
      }
      
      // Filtros de precio
      if (filters.precioMin) {
        where.precio = { ...where.precio, [Op.gte]: parseFloat(filters.precioMin) };
      }
      if (filters.precioMax) {
        where.precio = { ...where.precio, [Op.lte]: parseFloat(filters.precioMax) };
      }

      // Filtros de cantidad
      if (filters.cantidadMin) {
        where.cantidadBase = { ...where.cantidadBase, [Op.gte]: parseFloat(filters.cantidadMin) };
      }
      if (filters.cantidadMax) {
        where.cantidadBase = { ...where.cantidadBase, [Op.lte]: parseFloat(filters.cantidadMax) };
      }
      
      const limit = Math.min(parseInt(filters.limit) || 50, 100);
      const offset = parseInt(filters.offset) || 0;
      
      return await IntercambioExchange.findAndCountAll({
        where,
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'username', 'reputacionPromedio']
          },
          {
            model: sequelize.models.ParExchange,
            as: 'par',
            attributes: ['id', 'activo'],
            include: [
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoBase',
                attributes: ['id', 'symbol', 'nombre']
              },
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoQuote',
                attributes: ['id', 'symbol', 'nombre']
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

  IntercambioExchange.getByUserId = async (usuarioId, filters = {}) => {
    try {
      const where = { usuarioId };
      
      if (filters.tipo) where.tipo = filters.tipo;
      if (filters.estado) {
        if (Array.isArray(filters.estado)) {
          where.estado = { [Op.in]: filters.estado };
        } else {
          where.estado = filters.estado;
        }
      }
      if (filters.parId) where.parId = filters.parId;
      
      // Filtros de fecha
      if (filters.fechaDesde) {
        where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
      }
      
      const limit = Math.min(parseInt(filters.limit) || 50, 100);
      const offset = parseInt(filters.offset) || 0;
      
      return await IntercambioExchange.findAndCountAll({
        where,
        include: [
          {
            model: sequelize.models.ParExchange,
            as: 'par',
            attributes: ['id', 'activo', 'precioActual'],
            include: [
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoBase',
                attributes: ['id', 'symbol', 'nombre']
              },
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoQuote',
                attributes: ['id', 'symbol', 'nombre']
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

  IntercambioExchange.search = async (term, limit = 10) => {
    try {
      const searchLimit = Math.min(limit, 50);
      
      return await IntercambioExchange.findAll({
        where: {
          [Op.or]: [
            { '$usuario.username$': { [Op.iLike]: `%${term}%` } },
            { '$usuario.email$': { [Op.iLike]: `%${term}%` } },
            { '$par.criptoBase.symbol$': { [Op.iLike]: `%${term}%` } },
            { '$par.criptoQuote.symbol$': { [Op.iLike]: `%${term}%` } },
            // Buscar por ID si el término parece un UUID
            ...(term.length >= 8 ? [{ id: { [Op.iLike]: `%${term}%` } }] : [])
          ]
        },
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'username', 'email']
          },
          {
            model: sequelize.models.ParExchange,
            as: 'par',
            attributes: ['id', 'activo'],
            include: [
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoBase',
                attributes: ['id', 'symbol', 'nombre']
              },
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoQuote',
                attributes: ['id', 'symbol', 'nombre']
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
  IntercambioExchange.getStats = async (filters = {}) => {
    try {
      const where = {};
      
      if (filters.usuarioId) where.usuarioId = filters.usuarioId;
      if (filters.parId) where.parId = filters.parId;
      
      if (filters.fechaDesde) {
        where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
      }
      
      const total = await IntercambioExchange.count({ where });
      const completados = await IntercambioExchange.count({ 
        where: { ...where, estado: 'completado' } 
      });
      const pendientes = await IntercambioExchange.count({ 
        where: { ...where, estado: 'pendiente' } 
      });
      const fallidos = await IntercambioExchange.count({ 
        where: { ...where, estado: 'fallido' } 
      });
      
      const compras = await IntercambioExchange.count({ 
        where: { ...where, tipo: 'compra' } 
      });
      const ventas = await IntercambioExchange.count({ 
        where: { ...where, tipo: 'venta' } 
      });
      
      // Volúmenes (solo órdenes completadas)
      const whereCompleted = { ...where, estado: 'completado' };
      
      const volumenTotal = await IntercambioExchange.sum('cantidadQuote', { where: whereCompleted });
      const comisionTotal = await IntercambioExchange.sum('comisionMonto', { where: whereCompleted });
      
      // Volúmenes por tipo
      const volumenCompras = await IntercambioExchange.sum('cantidadQuote', { 
        where: { ...whereCompleted, tipo: 'compra' } 
      });
      const volumenVentas = await IntercambioExchange.sum('cantidadQuote', { 
        where: { ...whereCompleted, tipo: 'venta' } 
      });
      
      // Promedios
      const promedioCompra = compras > 0 ? await IntercambioExchange.findAll({
        where: { ...whereCompleted, tipo: 'compra' },
        attributes: [[sequelize.fn('AVG', sequelize.col('precio')), 'avgPrice']],
        raw: true
      }) : [{ avgPrice: 0 }];
      
      const promedioVenta = ventas > 0 ? await IntercambioExchange.findAll({
        where: { ...whereCompleted, tipo: 'venta' },
        attributes: [[sequelize.fn('AVG', sequelize.col('precio')), 'avgPrice']],
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

  IntercambioExchange.getDailyVolume = async (usuarioId, date = new Date(), transaction = null) => {
    try {
      // Ventana del día en UTC: created_at se guarda en UTC, así que el borde
      // del "día" del límite diario debe ser el día UTC, no el día local del
      // server (setHours desalinearía la ventana según la TZ del proceso).
      const startOfDay = startOfUtcDay(date);
      const endOfDay = endOfUtcDay(date);

      const volumen = await IntercambioExchange.sum('cantidadQuote', {
        where: {
          usuarioId,
          created_at: {
            [Op.between]: [startOfDay, endOfDay]
          },
          estado: { [Op.in]: ['completado', 'pendiente'] }
        },
        transaction
      });
      
      return parseFloat(volumen || 0);
    } catch (error) {
      throw new Error(`Error al obtener volumen diario: ${error.message}`);
    }
  };

  IntercambioExchange.getVolumeByPair = async (parId, filters = {}) => {
    try {
      const where = { parId };
      
      if (filters.fechaDesde) {
        where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
      }
      if (filters.estado) {
        where.estado = filters.estado;
      } else {
        where.estado = 'completado'; // Por defecto solo completados
      }
      
      const volumenCompras = await IntercambioExchange.sum('cantidadQuote', {
        where: { ...where, tipo: 'compra' }
      });
      
      const volumenVentas = await IntercambioExchange.sum('cantidadQuote', {
        where: { ...where, tipo: 'venta' }
      });
      
      const volumenBase = await IntercambioExchange.sum('cantidadBase', { where });
      const operaciones = await IntercambioExchange.count({ where });
      
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
  IntercambioExchange.getPriceHistory = async (parId, filters = {}) => {
    try {
      const where = { 
        parId,
        estado: 'completado'
      };
      
      if (filters.fechaDesde) {
        where.completedAt = { ...where.completedAt, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.completedAt = { ...where.completedAt, [Op.lte]: new Date(filters.fechaHasta) };
      }
      
      const limit = Math.min(parseInt(filters.limit) || 1000, 5000);
      
      const history = await IntercambioExchange.findAll({
        where,
        attributes: [
          'precio', 
          'cantidadBase', 
          'cantidadQuote', 
          'completedAt', 
          'tipo',
          'id'
        ],
        order: [['completedAt', filters.order === 'ASC' ? 'ASC' : 'DESC']],
        limit
      });
      
      return history.map(order => ({
        id: order.id,
        price: parseFloat(order.precio),
        baseAmount: parseFloat(order.cantidadBase),
        quoteAmount: parseFloat(order.cantidadQuote),
        timestamp: order.completedAt,
        type: order.tipo
      }));
    } catch (error) {
      throw new Error(`Error al obtener historial de precios: ${error.message}`);
    }
  };

  IntercambioExchange.getLastPrice = async (parId) => {
    try {
      const lastOrder = await IntercambioExchange.findOne({
        where: { 
          parId,
          estado: 'completado'
        },
        order: [['completedAt', 'DESC']]
      });
      
      return lastOrder ? parseFloat(lastOrder.precio) : null;
    } catch (error) {
      throw new Error(`Error al obtener último precio: ${error.message}`);
    }
  };

  // Métodos administrativos
  IntercambioExchange.updateStatus = async (id, newStatus) => {
    try {
      const validStatuses = ['pendiente', 'completado', 'fallido'];
      
      if (!validStatuses.includes(newStatus)) {
        throw new Error('Estado inválido. Estados válidos: ' + validStatuses.join(', '));
      }
      
      const updateData = { estado: newStatus };
      if (newStatus === 'completado') {
        updateData.completedAt = new Date();
      }
      
      const [updatedRowsCount] = await IntercambioExchange.update(updateData, { where: { id } });
      
      if (updatedRowsCount === 0) {
        throw new Error('Intercambio no encontrado');
      }
      
      return await IntercambioExchange.getById(id);
    } catch (error) {
      throw new Error(`Error al actualizar estado: ${error.message}`);
    }
  };

  // Métodos para reportes y análisis
  IntercambioExchange.getTopTraders = async (limit = 10, period = '30d') => {
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

      const topTraders = await IntercambioExchange.findAll({
        attributes: [
          'usuarioId',
          [sequelize.fn('COUNT', sequelize.col('IntercambioExchange.id')), 'totalOperaciones'],
          [sequelize.fn('SUM', sequelize.col('cantidadQuote')), 'volumenTotal'],
          [sequelize.fn('SUM', sequelize.col('comisionMonto')), 'comisionesTotales']
        ],
        include: [
          {
            model: sequelize.models.Usuario,
            as: 'usuario',
            attributes: ['id', 'username', 'reputacionPromedio']
          }
        ],
        where: {
          estado: 'completado',
          created_at: { [Op.gte]: fechaDesde }
        },
        group: ['usuarioId', 'usuario.id'],
        order: [[sequelize.fn('SUM', sequelize.col('cantidadQuote')), 'DESC']],
        limit: parseInt(limit),
        subQuery: false
      });

      return topTraders;
    } catch (error) {
      throw new Error(`Error al obtener top traders: ${error.message}`);
    }
  };

  IntercambioExchange.getMarketSummary = async (parId = null) => {
    try {
      const where = { estado: 'completado' };
      if (parId) where.parId = parId;
      
      // Obtener datos de las últimas 24 horas
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const whereRecent = { ...where, created_at: { [Op.gte]: yesterday } };
      
      const summary = await IntercambioExchange.findAll({
        attributes: [
          'parId',
          [sequelize.fn('COUNT', sequelize.col('IntercambioExchange.id')), 'operaciones24h'],
          [sequelize.fn('SUM', sequelize.col('cantidadQuote')), 'volumen24h'],
          [sequelize.fn('MIN', sequelize.col('precio')), 'precioMin24h'],
          [sequelize.fn('MAX', sequelize.col('precio')), 'precioMax24h'],
          [sequelize.fn('AVG', sequelize.col('precio')), 'precioPromedio24h']
        ],
        include: [
          {
            model: sequelize.models.ParExchange,
            as: 'par',
            attributes: ['id', 'precioActual'],
            include: [
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoBase',
                attributes: ['symbol', 'nombre']
              },
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoQuote',
                attributes: ['symbol', 'nombre']
              }
            ]
          }
        ],
        where: whereRecent,
        group: ['parId', 'par.id', 'par.criptoBase.id', 'par.criptoQuote.id'],
        order: [[sequelize.fn('SUM', sequelize.col('cantidadQuote')), 'DESC']],
        subQuery: false
      });

      return summary;
    } catch (error) {
      throw new Error(`Error al obtener resumen de mercado: ${error.message}`);
    }
  };

  // Método para obtener estadísticas por criptomoneda
  IntercambioExchange.getStatsByCrypto = async (filters = {}) => {
    try {
      const where = { estado: 'completado' };
      
      if (filters.fechaDesde) {
        where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
      }
      if (filters.fechaHasta) {
        where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
      }

      // Estadísticas por criptomoneda base
      const statsBase = await IntercambioExchange.findAll({
        attributes: [
          [sequelize.col('par.criptoBase.symbol'), 'criptoSymbol'],
          [sequelize.col('par.criptoBase.nombre'), 'criptoNombre'],
          [sequelize.fn('COUNT', sequelize.col('IntercambioExchange.id')), 'totalOperaciones'],
          [sequelize.fn('SUM', sequelize.col('cantidadBase')), 'volumenBase'],
          [sequelize.fn('SUM', sequelize.col('cantidadQuote')), 'volumenQuote'],
          [sequelize.fn('SUM', sequelize.col('comisionMonto')), 'comisionesGeneradas']
        ],
        include: [
          {
            model: sequelize.models.ParExchange,
            as: 'par',
            attributes: [],
            include: [
              {
                model: sequelize.models.Criptomoneda,
                as: 'criptoBase',
                attributes: []
              }
            ]
          }
        ],
        where,
        group: ['par.criptoBase.id'],
        order: [[sequelize.fn('SUM', sequelize.col('cantidadQuote')), 'DESC']],
        raw: true
      });

      return statsBase;
    } catch (error) {
      throw new Error(`Error al obtener estadísticas por criptomoneda: ${error.message}`);
    }
  };

  return IntercambioExchange;
}

module.exports = createIntercambioExchangeModel;