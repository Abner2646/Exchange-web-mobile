const { LogAdmin } = require('../models/index.js');

// Listar logs de admin
const getLogsAdmin = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await LogAdmin.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener log por ID
const getLogAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await LogAdmin.getById(id);
    if (!result) return res.status(404).json({ error: 'Log no encontrado' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nuevo log de admin (generalmente usado internamente)
const createLogAdmin = async (req, res) => {
  try {
    const { adminId, accion, entidadTipo, entidadId, datosAnteriores, datosNuevos } = req.body;
    
    if (!adminId || !accion) {
      return res.status(400).json({ 
        error: 'Los campos adminId y accion son requeridos' 
      });
    }

    // Extraer información del request
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const nuevoLog = await LogAdmin.createLog({
      adminId,
      accion,
      entidadTipo,
      entidadId,
      datosAnteriores,
      datosNuevos,
      ipAddress,
      userAgent
    });
    
    res.status(201).json({ 
      message: 'Log creado exitosamente', 
      data: nuevoLog 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar logs
const searchLogsAdmin = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const result = await LogAdmin.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de logs
const getLogAdminStats = async (req, res) => {
  try {
    const stats = await LogAdmin.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener logs por administrador
const getLogsByAdmin = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { limit = 100 } = req.query;
    
    const logs = await LogAdmin.getByAdmin(adminId, limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis logs (admin autenticado)
const getMyLogs = async (req, res) => {
  try {
    const adminId = req.user.id; // Asumiendo que el middleware de auth pone el user en req
    const { limit = 100 } = req.query;
    
    const logs = await LogAdmin.getByAdmin(adminId, limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener logs por entidad
const getLogsByEntity = async (req, res) => {
  try {
    const { entidadTipo, entidadId } = req.params;
    
    const logs = await LogAdmin.getByEntity(entidadTipo, entidadId);
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
    
    const logs = await LogAdmin.getByAction(accion, limit);
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

    const logs = await LogAdmin.getByDateRange(fechaDesde, fechaHasta);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener actividad sospechosa
const getSuspiciousActivity = async (req, res) => {
  try {
    const { timeframe = '24 hours' } = req.query;
    
    const logs = await LogAdmin.getSuspiciousActivity(timeframe);
    res.json({
      timeframe,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Limpiar logs antiguos (solo super admin)
const cleanOldLogs = async (req, res) => {
  try {
    const { daysToKeep = 365 } = req.body;
    
    // Verificar permisos de super admin
    if (req.user.rol !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        error: 'Solo super administradores pueden limpiar logs' 
      });
    }

    const result = await LogAdmin.cleanOldLogs(parseInt(daysToKeep));
    
    // Registrar la acción de limpieza
    await LogAdmin.logAction(
      req.user.id,
      'CLEAN_LOGS',
      'LogAdmin',
      null,
      null,
      { daysToKeep, deletedCount: result.deletedCount },
      req
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Exportar logs a CSV
const exportLogs = async (req, res) => {
  try {
    const filters = { ...req.query };
    const { logs } = await LogAdmin.getAll({
      ...filters,
      limit: 10000 // Límite alto para export
    });
    
    // Convertir a formato CSV
    const csvHeader = 'ID,Admin,Accion,Entidad Tipo,Entidad ID,IP Address,User Agent,Fecha\n';
    const csvData = logs.map(log => {
      return [
        log.id,
        log.admin ? log.admin.email : '',
        log.accion,
        log.entidadTipo || '',
        log.entidadId || '',
        log.ipAddress || '',
        (log.userAgent || '').replace(/,/g, ' '),
        log.created_at
      ].join(',');
    }).join('\n');
    
    const csv = csvHeader + csvData;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="logs_admin.csv"');
    res.send(csv);
    
    // Registrar la exportación
    await LogAdmin.logAction(
      req.user.id,
      'EXPORT_LOGS',
      'LogAdmin',
      null,
      null,
      { exportedCount: logs.length, filters },
      req
    );
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Dashboard de actividad de admin
const getAdminActivityDashboard = async (req, res) => {
  try {
    const { timeframe = '7 days' } = req.query;
    
    // Obtener estadísticas generales
    const stats = await LogAdmin.getStats();
    
    // Actividad sospechosa reciente
    const suspiciousActivity = await LogAdmin.getSuspiciousActivity(timeframe);
    
    // Logs recientes del admin actual
    const myRecentLogs = await LogAdmin.getByAdmin(req.user.id, 10);
    
    res.json({
      stats,
      suspiciousActivity: {
        count: suspiciousActivity.length,
        logs: suspiciousActivity.slice(0, 5) // Solo los 5 más recientes
      },
      myRecentActivity: myRecentLogs.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getLogsAdmin,
  getLogAdminById,
  createLogAdmin,
  searchLogsAdmin,
  getLogAdminStats,
  getLogsByAdmin,
  getMyLogs,
  getLogsByEntity,
  getLogsByAction,
  getLogsByDateRange,
  getSuspiciousActivity,
  cleanOldLogs,
  exportLogs,
  getAdminActivityDashboard
};