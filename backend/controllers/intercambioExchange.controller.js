// controllers/intercambioExchange.controller.js

const { IntercambioExchange } = require('../models/index.js');

// Crear nueva orden
const createOrder = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const orderData = { ...req.body, usuarioId };
    
    const requiredFields = ['parId', 'tipo', 'cantidadBase', 'precio', 'comisionPorcentaje'];
    const missingFields = requiredFields.filter(field => !orderData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ error: `Campos requeridos: ${missingFields.join(', ')}` });
    }
    
    // Validar tipo
    if (!['compra', 'venta'].includes(orderData.tipo)) {
      return res.status(400).json({ error: 'Tipo debe ser "compra" o "venta"' });
    }
    
    const newOrder = await IntercambioExchange.createOrder(orderData);
    res.status(201).json({ 
      message: 'Orden creada exitosamente', 
      data: newOrder 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Listar intercambios
const getIntercambios = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await IntercambioExchange.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener intercambio por ID
const getIntercambioById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await IntercambioExchange.getById(id);
    if (!result) return res.status(404).json({ error: 'Intercambio no encontrado' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis intercambios
const getMyIntercambios = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const filters = { ...req.query };
    const result = await IntercambioExchange.getByUserId(usuarioId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Completar orden
const completeOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const completionData = req.body;
    
    const completed = await IntercambioExchange.completeOrder(id, completionData);
    res.json({ 
      message: 'Orden completada exitosamente', 
      data: completed 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Fallar orden
const failOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const failed = await IntercambioExchange.failOrder(id, reason);
    res.json({ 
      message: 'Orden marcada como fallida', 
      data: failed 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar estado de intercambio
const updateIntercambioStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus } = req.body;
    
    const updated = await IntercambioExchange.updateStatus(id, newStatus);
    res.json({ 
      message: 'Estado actualizado exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar intercambios
const searchIntercambios = async (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ error: 'Término de búsqueda requerido' });
    
    const results = await IntercambioExchange.search(q, parseInt(limit) || 10);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas
const getIntercambioStats = async (req, res) => {
  try {
    const filters = { ...req.query };
    const stats = await IntercambioExchange.getStats(filters);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener volumen diario del usuario
const getMyDailyVolume = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { date } = req.query;
    
    const targetDate = date ? new Date(date) : new Date();
    const volume = await IntercambioExchange.getDailyVolume(usuarioId, targetDate);
    
    res.json({ 
      date: targetDate.toISOString().split('T')[0],
      volume 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener volumen por par
const getVolumeByPair = async (req, res) => {
  try {
    const { parId } = req.params;
    const filters = { ...req.query };
    
    const volume = await IntercambioExchange.getVolumeByPair(parId, filters);
    res.json(volume);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener historial de precios
const getPriceHistory = async (req, res) => {
  try {
    const { parId } = req.params;
    const filters = { ...req.query };
    
    const history = await IntercambioExchange.getPriceHistory(parId, filters);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener último precio
const getLastPrice = async (req, res) => {
  try {
    const { parId } = req.params;
    
    const lastPrice = await IntercambioExchange.getLastPrice(parId);
    
    if (lastPrice === null) {
      return res.status(404).json({ error: 'No hay intercambios completados para este par' });
    }
    
    res.json({ 
      parId,
      lastPrice,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cancelar órdenes pendientes
const cancelMyPendingOrders = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { parId } = req.body; // Opcional: solo cancelar de un par específico
    
    const cancelledCount = await IntercambioExchange.cancelPendingOrders(usuarioId, parId);
    
    res.json({ 
      message: `${cancelledCount} órdenes canceladas`,
      cancelledCount 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Validar si el usuario puede hacer la transacción
const checkTransactionLimit = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { cantidadQuote } = req.body;
    
    if (!cantidadQuote || cantidadQuote <= 0) {
      return res.status(400).json({ error: 'Cantidad inválida' });
    }
    
    // Obtener volumen diario actual
    const dailyVolume = await IntercambioExchange.getDailyVolume(usuarioId);
    
    // Obtener límite del usuario (asumiendo que tienes acceso al modelo Usuario)
    const { Usuario } = require('../models/index.js');
    const usuario = await Usuario.findByPk(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const remainingLimit = usuario.limiteDiarioUsd - dailyVolume;
    
    if (remainingLimit < cantidadQuote) {
      return res.status(400).json({ 
        error: 'Límite diario excedido',
        dailyVolume,
        limit: usuario.limiteDiarioUsd,
        remainingLimit,
        requestedAmount: cantidadQuote
      });
    }
    
    res.json({ 
      canTransact: true,
      dailyVolume,
      limit: usuario.limiteDiarioUsd,
      remainingLimit,
      requestedAmount: cantidadQuote
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener resumen del trading del usuario
const getMyTradingSummary = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { period } = req.query; // 'day', 'week', 'month', 'year'
    
    let fechaDesde = new Date();
    
    switch (period) {
      case 'week':
        fechaDesde.setDate(fechaDesde.getDate() - 7);
        break;
      case 'month':
        fechaDesde.setMonth(fechaDesde.getMonth() - 1);
        break;
      case 'year':
        fechaDesde.setFullYear(fechaDesde.getFullYear() - 1);
        break;
      default: // 'day'
        fechaDesde.setHours(0, 0, 0, 0);
    }
    
    const filters = { 
      fechaDesde: fechaDesde.toISOString(),
      usuarioId 
    };
    
    const summary = await IntercambioExchange.getStats(filters);
    
    res.json({
      period,
      dateRange: {
        from: fechaDesde,
        to: new Date()
      },
      ...summary
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  // Operaciones básicas
  createOrder,
  getIntercambios,
  getIntercambioById,
  searchIntercambios,
  
  // Operaciones del usuario
  getMyIntercambios,
  getMyDailyVolume,
  getMyTradingSummary,
  cancelMyPendingOrders,
  checkTransactionLimit,
  
  // Operaciones administrativas
  completeOrder,
  failOrder,
  updateIntercambioStatus,
  getIntercambioStats,
  
  // Análisis de mercado
  getVolumeByPair,
  getPriceHistory,
  getLastPrice
};