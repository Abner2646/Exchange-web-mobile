// Importaciones
const initIntercambioExchange = require('./entities/intercambioExchange.entity');
const { Op } = require('sequelize');

function createIntercambioExchangeModel(sequelize) {
  const IntercambioExchange = initIntercambioExchange(sequelize);

  // Métodos de creación
  IntercambioExchange.createOrder = async (orderData) => {
    const { usuarioId, parId, tipo, cantidadBase, precio, comisionPorcentaje } = orderData;
    
    // Calcular cantidad quote y comisión
    const cantidadQuote = cantidadBase * precio;
    const comisionMonto = cantidadQuote * (comisionPorcentaje / 100);
    
    return await IntercambioExchange.create({
      usuarioId,
      parId,
      tipo,
      cantidadBase,
      cantidadQuote,
      precio,
      comisionMonto,
      comisionPorcentaje,
      estado: 'pendiente'
    });
  };

  IntercambioExchange.completeOrder = async (id, completionData = {}) => {
    const intercambio = await IntercambioExchange.findByPk(id);
    
    if (!intercambio) {
      throw new Error('Intercambio no encontrado');
    }
    
    if (intercambio.estado !== 'pendiente') {
      throw new Error('Solo se pueden completar órdenes pendientes');
    }
    
    const [updatedRowsCount] = await IntercambioExchange.update(
      { 
        estado: 'completado',
        completedAt: new Date(),
        ...completionData
      },
      { where: { id } }
    );
    
    if (updatedRowsCount === 0) {
      throw new Error('Error al completar la orden');
    }
    
    return await IntercambioExchange.findByPk(id);
  };

  IntercambioExchange.failOrder = async (id, reason) => {
    const [updatedRowsCount] = await IntercambioExchange.update(
      { estado: 'fallido' },
      { where: { id } }
    );
    
    if (updatedRowsCount === 0) {
      throw new Error('Intercambio no encontrado');
    }
    
    return await IntercambioExchange.findByPk(id);
  };

  // Métodos de consulta
  IntercambioExchange.getById = async (id) => {
    return await IntercambioExchange.findByPk(id, {
      include: [
        {
          model: sequelize.models.Usuario,
          as: 'usuario',
          attributes: ['id', 'username', 'email']
        },
        {
          model: sequelize.models.ParExchange,
          as: 'par',
          attributes: ['id', 'simbolo', 'nombre']
        }
      ]
    });
  };

  IntercambioExchange.getAll = async (filters = {}) => {
    const where = {};
    
    if (filters.usuarioId) where.usuarioId = filters.usuarioId;
    if (filters.parId) where.parId = filters.parId;
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.estado) where.estado = filters.estado;
    
    // Filtros de fecha
    if (filters.fechaDesde) {
      where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
    }
    if (filters.fechaHasta) {
      where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
    }
    
    // Filtros de precio
    if (filters.precioMin) {
      where.precio = { ...where.precio, [Op.gte]: filters.precioMin };
    }
    if (filters.precioMax) {
      where.precio = { ...where.precio, [Op.lte]: filters.precioMax };
    }
    
    return await IntercambioExchange.findAndCountAll({
      where,
      include: [
        {
          model: sequelize.models.Usuario,
          as: 'usuario',
          attributes: ['id', 'username']
        },
        {
          model: sequelize.models.ParExchange,
          as: 'par',
          attributes: ['id', 'simbolo', 'nombre']
        }
      ],
      limit: parseInt(filters.limit) || 50,
      offset: parseInt(filters.offset) || 0,
      order: [['created_at', 'DESC']]
    });
  };

  IntercambioExchange.getByUserId = async (usuarioId, filters = {}) => {
    const where = { usuarioId };
    
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.estado) where.estado = filters.estado;
    if (filters.parId) where.parId = filters.parId;
    
    return await IntercambioExchange.findAndCountAll({
      where,
      include: [
        {
          model: sequelize.models.ParExchange,
          as: 'par',
          attributes: ['id', 'simbolo', 'nombre']
        }
      ],
      limit: parseInt(filters.limit) || 50,
      offset: parseInt(filters.offset) || 0,
      order: [['created_at', 'DESC']]
    });
  };

  IntercambioExchange.search = async (term, limit = 10) => {
    return await IntercambioExchange.findAll({
      where: {
        [Op.or]: [
          { '$usuario.username$': { [Op.iLike]: `%${term}%` } },
          { '$usuario.email$': { [Op.iLike]: `%${term}%` } },
          { '$par.simbolo$': { [Op.iLike]: `%${term}%` } },
          { id: { [Op.iLike]: `%${term}%` } }
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
          attributes: ['id', 'simbolo', 'nombre']
        }
      ],
      limit
    });
  };

  // Métodos estadísticos
  IntercambioExchange.getStats = async (filters = {}) => {
    const where = {};
    
    if (filters.fechaDesde) {
      where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
    }
    if (filters.fechaHasta) {
      where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
    }
    if (filters.parId) where.parId = filters.parId;
    
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
    
    // Volúmenes
    const volumenTotal = await IntercambioExchange.sum('cantidadQuote', { where });
    const comisionTotal = await IntercambioExchange.sum('comisionMonto', { where });
    
    return {
      total,
      completados,
      pendientes,
      fallidos,
      compras,
      ventas,
      volumenTotal: volumenTotal || 0,
      comisionTotal: comisionTotal || 0,
      tasaExito: total > 0 ? ((completados / total) * 100).toFixed(2) : 0
    };
  };

  IntercambioExchange.getDailyVolume = async (usuarioId, date = new Date()) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const volumen = await IntercambioExchange.sum('cantidadQuote', {
      where: {
        usuarioId,
        created_at: {
          [Op.between]: [startOfDay, endOfDay]
        },
        estado: ['completado', 'pendiente'] // No contar los fallidos
      }
    });
    
    return volumen || 0;
  };

  IntercambioExchange.getVolumeByPair = async (parId, filters = {}) => {
    const where = { parId };
    
    if (filters.fechaDesde) {
      where.created_at = { ...where.created_at, [Op.gte]: new Date(filters.fechaDesde) };
    }
    if (filters.fechaHasta) {
      where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.fechaHasta) };
    }
    if (filters.estado) where.estado = filters.estado;
    
    const volumenCompras = await IntercambioExchange.sum('cantidadQuote', {
      where: { ...where, tipo: 'compra' }
    });
    
    const volumenVentas = await IntercambioExchange.sum('cantidadQuote', {
      where: { ...where, tipo: 'venta' }
    });
    
    return {
      volumenTotal: (volumenCompras || 0) + (volumenVentas || 0),
      volumenCompras: volumenCompras || 0,
      volumenVentas: volumenVentas || 0
    };
  };

  // Métodos de análisis de precios
  IntercambioExchange.getPriceHistory = async (parId, filters = {}) => {
    const where = { 
      parId,
      estado: 'completado'
    };
    
    if (filters.fechaDesde) {
      where.completed_at = { ...where.completed_at, [Op.gte]: new Date(filters.fechaDesde) };
    }
    if (filters.fechaHasta) {
      where.completed_at = { ...where.completed_at, [Op.lte]: new Date(filters.fechaHasta) };
    }
    
    return await IntercambioExchange.findAll({
      where,
      attributes: ['precio', 'cantidadBase', 'cantidadQuote', 'completed_at', 'tipo'],
      order: [['completed_at', 'ASC']],
      limit: parseInt(filters.limit) || 1000
    });
  };

  IntercambioExchange.getLastPrice = async (parId) => {
    const lastOrder = await IntercambioExchange.findOne({
      where: { 
        parId,
        estado: 'completado'
      },
      order: [['completed_at', 'DESC']]
    });
    
    return lastOrder ? lastOrder.precio : null;
  };

  // Métodos administrativos
  IntercambioExchange.updateStatus = async (id, newStatus) => {
    const validStatuses = ['pendiente', 'completado', 'fallido'];
    
    if (!validStatuses.includes(newStatus)) {
      throw new Error('Estado inválido');
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
  };

  IntercambioExchange.cancelPendingOrders = async (usuarioId, parId = null) => {
    const where = { 
      usuarioId,
      estado: 'pendiente'
    };
    
    if (parId) where.parId = parId;
    
    const [updatedRowsCount] = await IntercambioExchange.update(
      { estado: 'fallido' },
      { where }
    );
    
    return updatedRowsCount;
  };

  return IntercambioExchange;
}

module.exports = createIntercambioExchangeModel;