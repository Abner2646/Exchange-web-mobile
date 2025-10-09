// routes/notificacion.routes.js
const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// Importa el controlador
const notificacionController = require('../controllers/notificaciones.controller.js');

// --------------------- RUTAS ESPECÍFICAS DEL USUARIO --------------------- //

// Obtener mis notificaciones
router.get('/me', authenticateToken, notificacionController.getMyNotificaciones); // Bien

// Obtener contador de notificaciones no leídas
router.get('/me/unread-count', authenticateToken, notificacionController.getUnreadCount); // Bien

// Obtener contador de notificaciones no leídas por tipo
router.get('/me/unread-count/by-type', authenticateToken, notificacionController.getUnreadCountByType); // Bien

// Marcar todas mis notificaciones como leídas
router.patch('/me/mark-all-read', authenticateToken, notificacionController.markAllAsRead); // Bien

// Eliminar todas mis notificaciones leídas
router.delete('/me/read', authenticateToken, notificacionController.deleteAllRead); //

// --------------------- RUTAS DE ACCIONES INDIVIDUALES --------------------- //

// Marcar notificación como leída
router.patch('/:id/read', authenticateToken, notificacionController.markAsRead);

// Marcar notificación como no leída
router.patch('/:id/unread', authenticateToken, notificacionController.markAsUnread);

// --------------------- RUTAS CRUD BÁSICAS --------------------- //
/*
// Obtener todas las notificaciones (admin)
router.get('/', authenticateToken, isAdmin, notificacionController.getNotificaciones);

// Obtener notificación por ID
router.get('/:id', authenticateToken, notificacionController.getNotificacionById);

// Crear nueva notificación (admin)
router.post('/', authenticateToken, isAdmin, notificacionController.createNotificacion);

// Eliminar notificación
router.delete('/:id', authenticateToken, notificacionController.deleteNotificacion);

// --------------------- RUTAS DE NOTIFICACIONES MASIVAS (ADMIN) --------------------- //

// Crear notificaciones masivas
router.post('/bulk', authenticateToken, isAdmin, notificacionController.createBulkNotificaciones);

// Notificar a todos los usuarios
router.post('/notify-all', authenticateToken, isAdmin, notificacionController.notifyAllUsers);

// Notificar a usuarios por rol
router.post('/notify-role/:rol', authenticateToken, isAdmin, notificacionController.notifyUsersByRole);

// --------------------- RUTAS DE TEMPLATES Y EVENTOS --------------------- //

// Crear notificación con template
router.post('/template', authenticateToken, isAdmin, notificacionController.createNotificationWithTemplate);

// Notificar evento de seguridad
router.post('/security-event', authenticateToken, isAdmin, notificacionController.notifySecurityEvent);

// Notificar actualización de transacción
router.post('/transaction-update', authenticateToken, isAdmin, notificacionController.notifyTransactionUpdate);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de notificaciones
router.get('/admin/stats', authenticateToken, isAdmin, notificacionController.getNotificacionesStats);

// Obtener notificaciones de usuario específico
router.get('/admin/user/:usuarioId', authenticateToken, isAdmin, notificacionController.getUserNotifications);

// Limpiar notificaciones antiguas (automática)
router.post('/admin/cleanup', authenticateToken, isAdmin, notificacionController.cleanupOldNotifications);

// Eliminar notificaciones antiguas con parámetros
router.delete('/admin/old', authenticateToken, isAdmin, notificacionController.deleteOldNotifications);
*/
module.exports = router;