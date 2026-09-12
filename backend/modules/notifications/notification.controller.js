// controllers/notificaciones.controller.js
const { Notification } = require('../../models/index.js');
const authz = require('../../utils/authz');

// Listar notificaciones con filtros (admin)
const getNotificaciones = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await Notification.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener notificación por ID
const getNotificacionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Notification.getById(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    // Verificar que el usuario tenga acceso a esta notificación
    if (!authz.canAccessResource(req.user, result.userId)) {
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
    
    const nuevaNotificacion = await Notification.createNotification(notificationData);
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
    const { notifications } = req.body;
    
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de notificaciones' });
    }

    const nuevasNotificaciones = await Notification.createBulkNotifications(notifications);
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

    const deleted = await Notification.deleteNotification(id, usuarioId);
    
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
    
    const result = await Notification.getUserNotifications(usuarioId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener contador de notificaciones no leídas
const getUnreadCount = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    
    const count = await Notification.getUnreadCount(usuarioId);
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener contador de notificaciones no leídas por tipo
const getUnreadCountByType = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    
    const counts = await Notification.getUnreadCountByType(usuarioId);
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

    const updated = await Notification.markAsRead(id, usuarioId);
    
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

    const updated = await Notification.markAsUnread(id, usuarioId);
    
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
    
    const updatedCount = await Notification.markAllAsRead(usuarioId, filters);
    
    res.json({ 
      message: 'Notification marcadas como leídas',
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
    
    const deletedCount = await Notification.deleteAllRead(usuarioId);
    
    res.json({ 
      message: 'Notification leídas eliminadas',
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
    
    const notifications = await Notification.notifyAllUsers(notificationData);
    
    res.status(201).json({
      message: `Notificación enviada a ${notifications.length} usuarios`,
      count: notifications.length
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Notificar a usuarios por role (admin)
const notifyUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const notificationData = req.body;
    
    const notifications = await Notification.notifyUsersByRole(role, notificationData);
    
    res.status(201).json({
      message: `Notificación enviada a ${notifications.length} usuarios con role ${role}`,
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
    const stats = await Notification.getStats(filters);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Limpiar notificaciones antiguas (admin)
const cleanupOldNotifications = async (req, res) => {
  try {
    const result = await Notification.cleanupOldNotifications();
    
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
    
    const deletedCount = await Notification.deleteOldNotifications(parseInt(days));
    
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
    
    const result = await Notification.getUserNotifications(usuarioId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear notificación con template
const createNotificationWithTemplate = async (req, res) => {
  try {
    const { userId, template, templateData = {} } = req.body;
    
    const notification = await Notification.createNotification({
      userId,
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
    const { userId, eventType, details = {} } = req.body;
    
    const notification = await Notification.notifySecurityEvent(userId, eventType, details);
    
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
    const { userId, transactionId, status } = req.body;
    
    const notification = await Notification.notifyTransactionUpdate(userId, transactionId, status);
    
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