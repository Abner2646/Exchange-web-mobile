// routes/mensajeReclamo.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación y autorización
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware.js');

// Importa el controlador de mensajes de reclamos
const mensajeReclamoController = require('../controllers/mensajeReclamo.controller.js');

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todos los mensajes (admins) o filtrados (usuarios)
router.get('/', authenticateToken, mensajeReclamoController.getMensajesReclamo);

// Obtener mensaje específico por ID
router.get('/:id', authenticateToken, mensajeReclamoController.getMensajeReclamoById);

// Crear nuevo mensaje de reclamo
router.post('/', authenticateToken, mensajeReclamoController.createMensajeReclamo);

// Actualizar mensaje por ID (solo autor o admin)
router.put('/:id', authenticateToken, mensajeReclamoController.updateMensajeReclamo);

// Eliminar mensaje por ID (solo autor o admin)
router.delete('/:id', authenticateToken, mensajeReclamoController.deleteMensajeReclamo);

// --------------------- RUTAS DE BÚSQUEDA --------------------- //

// Buscar mensajes por término
router.get('/search/query', authenticateToken, mensajeReclamoController.searchMensajesReclamo);

// --------------------- RUTAS POR RECLAMO --------------------- //

// Obtener conversación completa de un reclamo
router.get('/reclamo/:reclamoId', authenticateToken, mensajeReclamoController.getMensajesByReclamo);

// Marcar mensajes como leídos
router.post('/reclamo/:reclamoId/mark-read', authenticateToken, mensajeReclamoController.markMessagesAsRead);

// --------------------- RUTAS POR USUARIO --------------------- //

// Obtener mis mensajes (usuario autenticado)
router.get('/user/me', authenticateToken, mensajeReclamoController.getMyMensajes);

// Obtener mensajes por autor específico (solo admin)
router.get('/user/:autorId', authenticateToken, requireAdmin, mensajeReclamoController.getMensajesByAutor);

// --------------------- RUTAS POR TIPO --------------------- //

// Obtener mensajes de administradores (solo admin)
router.get('/type/admin', authenticateToken, requireAdmin, mensajeReclamoController.getMensajesAdmin);

// Obtener mensajes de usuarios (solo admin)
router.get('/type/users', authenticateToken, requireAdmin, mensajeReclamoController.getMensajesUsuarios);

// Obtener mensajes con adjuntos (solo admin)
router.get('/type/attachments', authenticateToken, requireAdmin, mensajeReclamoController.getMensajesConAdjuntos);

// --------------------- RUTAS DE MONITOREO Y ANÁLISIS --------------------- //

// Obtener actividad reciente
router.get('/monitoring/recent', authenticateToken, requireAdmin, mensajeReclamoController.getActividadReciente);

// Dashboard de mensajes
router.get('/dashboard/overview', authenticateToken, mensajeReclamoController.getMensajesDashboard);

// Métricas de respuesta (tiempo de respuesta admin)
router.get('/dashboard/metrics', authenticateToken, requireAdmin, mensajeReclamoController.getResponseMetrics);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de mensajes
router.get('/admin/stats', authenticateToken, requireAdmin, mensajeReclamoController.getMensajeReclamoStats);

// Exportar mensajes a CSV
router.get('/admin/export', authenticateToken, requireAdmin, mensajeReclamoController.exportMensajes);

module.exports = router;