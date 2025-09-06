// routes/logAdmin.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación y autorización
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('../middleware/authMiddleware.js');

// Importa el controlador de logs de admin
const logAdminController = require('../controllers/logAdmin.controller.js');

// --------------------- RUTAS DE CONSULTA BÁSICAS --------------------- //

// Obtener todos los logs (solo admins)
router.get('/', authenticateToken, requireAdmin, logAdminController.getLogsAdmin);

// Obtener log específico por ID (solo admins)
router.get('/:id', authenticateToken, requireAdmin, logAdminController.getLogAdminById);

// Crear nuevo log (generalmente usado por el sistema)
router.post('/', authenticateToken, requireAdmin, logAdminController.createLogAdmin);

// --------------------- RUTAS DE BÚSQUEDA --------------------- //

// Buscar logs por término
router.get('/search/query', authenticateToken, requireAdmin, logAdminController.searchLogsAdmin);

// --------------------- RUTAS POR ADMIN --------------------- //

// Obtener mis logs (admin autenticado)
router.get('/admin/me', authenticateToken, requireAdmin, logAdminController.getMyLogs);

// Obtener logs por administrador específico
router.get('/admin/:adminId', authenticateToken, requireAdmin, logAdminController.getLogsByAdmin);

// --------------------- RUTAS POR ENTIDAD Y ACCIÓN --------------------- //

// Obtener logs por entidad específica
router.get('/entity/:entidadTipo/:entidadId', authenticateToken, requireAdmin, logAdminController.getLogsByEntity);

// Obtener logs por tipo de acción
router.get('/action/:accion', authenticateToken, requireAdmin, logAdminController.getLogsByAction);

// Obtener logs por rango de fechas
router.get('/date-range/query', authenticateToken, requireAdmin, logAdminController.getLogsByDateRange);

// --------------------- RUTAS DE SEGURIDAD Y AUDITORÍA --------------------- //

// Obtener actividad sospechosa
router.get('/security/suspicious', authenticateToken, requireAdmin, logAdminController.getSuspiciousActivity);

// Dashboard de actividad de admin
router.get('/dashboard/activity', authenticateToken, requireAdmin, logAdminController.getAdminActivityDashboard);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de logs
router.get('/admin/stats', authenticateToken, requireAdmin, logAdminController.getLogAdminStats);

// Exportar logs a CSV
router.get('/admin/export', authenticateToken, requireAdmin, logAdminController.exportLogs);

// Limpiar logs antiguos (solo super admin)
router.post('/admin/clean', authenticateToken, requireSuperAdmin, logAdminController.cleanOldLogs);

module.exports = router;