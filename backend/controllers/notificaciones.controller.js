// controllers/notificaciones.controller.js
const { Notificaciones } = require('../models/index.js');
const authz = require('../utils/authz');

// Listar notificaciones con filtros (admin)
const getNotificaciones = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await Notificaciones.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener notificación por ID
const getNotificacionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Notificaciones.getById(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    // Verificar que el usuario tenga acceso a esta notificación
    if (!authz.canAccessResource(req.user, result.usuarioId)) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta notificación' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva notificación (admin)
const createNotificacion = async (req, res) => {
  try {
    const notificationData = req.body;
    
    const nuevaNotificacion = await Notificaciones.createNotification(notificationData);
    res.status(201).json({
      message: 'Notificación creada exitosamente',
      data: nuevaNotificacion
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Crear notificaciones masivas (admin)
const createBulkNotificaciones = async (req, res) => {
  try {
    const { notificaciones } = req.body;
    
    if (!Array.isArray(notificaciones) || notificaciones.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de notificaciones' });
    }

    const nuevasNotificaciones = await Notificaciones.createBulkNotifications(notificaciones);
    res.status(201).json({
      message: `${nuevasNotificaciones.length} notificaciones creadas exitosamente`,
      data: nuevasNotificaciones
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar notificación
const deleteNotificacion = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = authz.isAdmin(req.user) ? null : req.user.id;

    const deleted = await Notificaciones.deleteNotification(id, usuarioId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Notificación no encontrada o sin permisos' });
    }

    res.json({ message: 'Notificación eliminada exitosamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener mis notificaciones
const getMyNotificaciones = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const filters = { ...req.query };
    
    const result = await Notificaciones.getUserNotifications(usuarioId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener contador de notificaciones no leídas
const getUnreadCount = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    
    const count = await Notificaciones.getUnreadCount(usuarioId);
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener contador de notificaciones no leídas por tipo
const getUnreadCountByType = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    
    const counts = await Notificaciones.getUnreadCountByType(usuarioId);
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Marcar notificación como leída
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = authz.isAdmin(req.user) ? null : req.user.id;

    const updated = await Notificaciones.markAsRead(id, usuarioId);
    
    if (!updated) {
      return res.status(404).json({ error: 'Notificación no encontrada o sin permisos' });
    }

    res.json({ message: 'Notificación marcada como leída' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Marcar notificación como no leída
const markAsUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = authz.isAdmin(req.user) ? null : req.user.id;

    const updated = await Notificaciones.markAsUnread(id, usuarioId);
    
    if (!updated) {
      return res.status(404).json({ error: 'Notificación no encontrada o sin permisos' });
    }

    res.json({ message: 'Notificación marcada como no leída' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Marcar todas mis notificaciones como leídas
const markAllAsRead = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const filters = req.body; // Filtros opcionales (tipo, importante)
    
    const updatedCount = await Notificaciones.markAllAsRead(usuarioId, filters);
    
    res.json({ 
      message: 'Notificaciones marcadas como leídas',
      updatedCount 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar todas mis notificaciones leídas
const deleteAllRead = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    
    const deletedCount = await Notificaciones.deleteAllRead(usuarioId);
    
    res.json({ 
      message: 'Notificaciones leídas eliminadas',
      deletedCount 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Notificar a todos los usuarios (admin)
const notifyAllUsers = async (req, res) => {
  try {
    const notificationData = req.body;
    
    const notifications = await Notificaciones.notifyAllUsers(notificationData);
    
    res.status(201).json({
      message: `Notificación enviada a ${notifications.length} usuarios`,
      count: notifications.length
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Notificar a usuarios por rol (admin)
const notifyUsersByRole = async (req, res) => {
  try {
    const { rol } = req.params;
    const notificationData = req.body;
    
    const notifications = await Notificaciones.notifyUsersByRole(rol, notificationData);
    
    res.status(201).json({
      message: `Notificación enviada a ${notifications.length} usuarios con rol ${rol}`,
      count: notifications.length
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener estadísticas de notificaciones (admin)
const getNotificacionesStats = async (req, res) => {
  try {
    const filters = req.query;
    const stats = await Notificaciones.getStats(filters);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Limpiar notificaciones antiguas (admin)
const cleanupOldNotifications = async (req, res) => {
  try {
    const result = await Notificaciones.cleanupOldNotifications();
    
    res.json({
      message: 'Limpieza completada',
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar notificaciones antiguas con parámetros (admin)
const deleteOldNotifications = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const deletedCount = await Notificaciones.deleteOldNotifications(parseInt(days));
    
    res.json({
      message: `Eliminadas ${deletedCount} notificaciones antiguas`,
      deletedCount,
      daysBefore: parseInt(days)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener notificaciones de un usuario específico (admin)
const getUserNotifications = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const filters = { ...req.query };
    
    const result = await Notificaciones.getUserNotifications(usuarioId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear notificación con template
const createNotificationWithTemplate = async (req, res) => {
  try {
    const { usuarioId, template, templateData = {} } = req.body;
    
    const notification = await Notificaciones.createNotification({
      usuarioId,
      template,
      templateData
    });
    
    res.status(201).json({
      message: 'Notificación creada con template',
      data: notification
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Notificar evento de seguridad
const notifySecurityEvent = async (req, res) => {
  try {
    const { usuarioId, eventType, details = {} } = req.body;
    
    const notification = await Notificaciones.notifySecurityEvent(usuarioId, eventType, details);
    
    if (!notification) {
      return res.status(400).json({ error: 'Tipo de evento de seguridad no reconocido' });
    }
    
    res.status(201).json({
      message: 'Notificación de seguridad enviada',
      data: notification
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Notificar actualización de transacción
const notifyTransactionUpdate = async (req, res) => {
  try {
    const { usuarioId, transaccionId, estado } = req.body;
    
    const notification = await Notificaciones.notifyTransactionUpdate(usuarioId, transaccionId, estado);
    
    if (!notification) {
      return res.status(400).json({ error: 'Estado de transacción no requiere notificación' });
    }
    
    res.status(201).json({
      message: 'Notificación de transacción enviada',
      data: notification
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getNotificaciones,
  getNotificacionById,
  createNotificacion,
  createBulkNotificaciones,
  deleteNotificacion,
  getMyNotificaciones,
  getUnreadCount,
  getUnreadCountByType,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  deleteAllRead,
  notifyAllUsers,
  notifyUsersByRole,
  getNotificacionesStats,
  cleanupOldNotifications,
  deleteOldNotifications,
  getUserNotifications,
  createNotificationWithTemplate,
  notifySecurityEvent,
  notifyTransactionUpdate
};