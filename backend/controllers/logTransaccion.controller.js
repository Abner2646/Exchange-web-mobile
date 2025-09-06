const { LogTransaccion } = require('../models/index.js');

// Listar logs de transacciones
const getLogsTransaccion = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await LogTransaccion.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener log por ID
const getLogTransaccionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await LogTransaccion.getById(id);
    if (!result) return res.status(404).json({ error: 'Log de transacción no encontrado' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nuevo log de transacción
const createLogTransaccion = async (req, res) => {
  try {
    const { userId, tipoTransaccion, transaccionId, accion, detalles } = req.body;
    
    if (!userId || !tipoTransaccion || !transaccionId || !accion) {
      return res.status(400).json({ 
        error: 'Los campos userId, tipoTransaccion, transaccionId y accion son requeridos' 
      });
    }

    const nuevoLog = await LogTransaccion.createLog({
      userId,
      tipoTransaccion,
      transaccionId,
      accion,
      detalles
    });
    
    res.status(201).json({ 
      message: 'Log de transacción creado exitosamente', 
      data: nuevoLog 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar logs de transacciones
const searchLogsTransaccion = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const result = await LogTransaccion.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de logs de transacciones
const getLogTransaccionStats = async (req, res) => {
  try {
    const stats = await LogTransaccion.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener logs por usuario
const getLogsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 100 } = req.query;
    
    const logs = await LogTransaccion.getByUser(userId, limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis logs de transacciones (usuario autenticado)
const getMyTransactionLogs = async (req, res) => {
  try {
    const userId = req.user.id; // Asumiendo que el middleware de auth pone el user en req
    const { limit = 100 } = req.query;
    
    const logs = await LogTransaccion.getByUser(userId, limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener logs por transacción específica
const getLogsByTransaction = async (req, res) => {
  try {
    const { transaccionId } = req.params;
    
    const logs = await LogTransaccion.getByTransaction(transaccionId);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener timeline de una transacción
const getTransactionTimeline = async (req, res) => {
  try {
    const { transaccionId } = req.params;
    
    const timeline = await LogTransaccion.getTransactionTimeline(transaccionId);
    res.json({
      transaccionId,
      steps: timeline.length,
      timeline
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener logs por tipo de transacción
const getLogsByTransactionType = async (req, res) => {
  try {
    const { tipoTransaccion } = req.params;
    const { limit = 100 } = req.query;
    
    const logs = await LogTransaccion.getByTransactionType(tipoTransaccion, limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener logs por acción
const getLogsByAction = async (req, res) => {
  try {
    const { accion } = req.params;
    const { limit = 100 } = req.query;
    
    const logs = await LogTransaccion.getByAction(accion, limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener logs por rango de fechas
const getLogsByDateRange = async (req, res) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;
    
    if (!fechaDesde || !fechaHasta) {
      return res.status(400).json({ 
        error: 'Los parámetros fechaDesde y fechaHasta son requeridos' 
      });
    }

    const logs = await LogTransaccion.getByDateRange(fechaDesde, fechaHasta);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener transacciones fallidas
const getFailedTransactions = async (req, res) => {
  try {
    const { timeframe = '24 hours' } = req.query;
    
    const logs = await LogTransaccion.getFailedTransactions(timeframe);
    res.json({
      timeframe,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener actividad sospechosa
const getSuspiciousActivity = async (req, res) => {
  try {
    const { timeframe = '1 hour' } = req.query;
    
    const logs = await LogTransaccion.getSuspiciousActivity(timeframe);
    res.json({
      timeframe,
      count: logs.length,
      suspiciousUsers: logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Limpiar logs antiguos (solo admin)
const cleanOldLogs = async (req, res) => {
  try {
    const { daysToKeep = 90 } = req.body;
    
    // Verificar permisos de admin
    if (!req.user.rol || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.rol)) {
      return res.status(403).json({ 
        error: 'Solo administradores pueden limpiar logs' 
      });
    }

    const result = await LogTransaccion.cleanOldLogs(parseInt(daysToKeep));
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Exportar logs a CSV
const exportLogs = async (req, res) => {
  try {
    const filters = { ...req.query };
    const { logs } = await LogTransaccion.getAll({
      ...filters,
      limit: 10000 // Límite alto para export
    });
    
    // Convertir a formato CSV
    const csvHeader = 'ID,Usuario,Tipo Transaccion,Transaccion ID,Accion,Detalles,Fecha\n';
    const csvData = logs.map(log => {
      const detalles = log.detalles ? JSON.stringify(log.detalles).replace(/,/g, ' ') : '';
      return [
        log.id,
        log.user ? log.user.email : '',
        log.tipoTransaccion,
        log.transaccionId,
        log.accion,
        detalles,
        log.created_at
      ].join(',');
    }).join('\n');
    
    const csv = csvHeader + csvData;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="logs_transacciones.csv"');
    res.send(csv);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Dashboard de transacciones
const getTransactionDashboard = async (req, res) => {
  try {
    const { timeframe = '7 days' } = req.query;
    
    // Obtener estadísticas generales
    const stats = await LogTransaccion.getStats();
    
    // Transacciones fallidas recientes
    const failedTransactions = await LogTransaccion.getFailedTransactions(timeframe);
    
    // Actividad sospechosa
    const suspiciousActivity = await LogTransaccion.getSuspiciousActivity('1 hour');
    
    // Si es usuario normal, solo sus propias estadísticas
    let userSpecificData = {};
    if (!req.user.rol || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.rol)) {
      const myLogs = await LogTransaccion.getByUser(req.user.id, 10);
      userSpecificData = {
        myRecentTransactions: myLogs
      };
    }
    
    res.json({
      stats,
      failedTransactions: {
        count: failedTransactions.length,
        recent: failedTransactions.slice(0, 5)
      },
      suspiciousActivity: {
        count: suspiciousActivity.length,
        users: suspiciousActivity.slice(0, 3)
      },
      ...userSpecificData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener métricas en tiempo real
const getRealTimeMetrics = async (req, res) => {
  try {
    const last24Hours = await LogTransaccion.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.literal(`
          COUNT(CASE WHEN accion IN ('SUCCESS', 'COMPLETED', 'CONFIRMED') THEN 1 END)
        `), 'successful'],
        [sequelize.literal(`
          COUNT(CASE WHEN accion IN ('FAILED', 'ERROR', 'REJECTED', 'CANCELLED') THEN 1 END)
        `), 'failed'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('userId'))), 'uniqueUsers']
      ],
      where: {
        created_at: {
          [Op.gte]: sequelize.literal("NOW() - INTERVAL '24 hours'")
        }
      },
      raw: true
    });

    const lastHour = await LogTransaccion.count({
      where: {
        created_at: {
          [Op.gte]: sequelize.literal("NOW() - INTERVAL '1 hour'")
        }
      }
    });

    res.json({
      last24Hours: last24Hours[0] || { total: 0, successful: 0, failed: 0, uniqueUsers: 0 },
      lastHour
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getLogsTransaccion,
  getLogTransaccionById,
  createLogTransaccion,
  searchLogsTransaccion,
  getLogTransaccionStats,
  getLogsByUser,
  getMyTransactionLogs,
  getLogsByTransaction,
  getTransactionTimeline,
  getLogsByTransactionType,
  getLogsByAction,
  getLogsByDateRange,
  getFailedTransactions,
  getSuspiciousActivity,
  cleanOldLogs,
  exportLogs,
  getTransactionDashboard,
  getRealTimeMetrics
};