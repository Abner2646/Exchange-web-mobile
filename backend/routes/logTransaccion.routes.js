// routes/logTransaccion.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación y autorización
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware.js');

// Importa el controlador de logs de transacciones
const logTransaccionController = require('../controllers/logTransaccion.controller.js');

// --------------------- RUTAS DE CONSULTA BÁSICAS --------------------- //

// Obtener todos los logs (admins) o filtrados por usuario (usuarios normales)
router.get('/', authenticateToken, logTransaccionController.getLogsTransaccion);

// Obtener log específico por ID
router.get('/:id', authenticateToken, logTransaccionController.getLogTransaccionById);

// Crear nuevo log de transacción
router.post('/', authenticateToken, logTransaccionController.createLogTransaccion);

// --------------------- RUTAS DE BÚSQUEDA --------------------- //

// Buscar logs por término
router.get('/search/query', authenticateToken, logTransaccionController.searchLogsTransaccion);

// --------------------- RUTAS POR USUARIO --------------------- //

// Obtener mis logs de transacciones (usuario autenticado)
router.get('/user/me', authenticateToken, logTransaccionController.getMyTransactionLogs);

// Obtener logs por usuario específico (solo admins)
router.get('/user/:userId', authenticateToken, requireAdmin, logTransaccionController.getLogsByUser);

// --------------------- RUTAS POR TRANSACCIÓN --------------------- //

// Obtener logs de una transacción específica
router.get('/transaction/:transaccionId', authenticateToken, logTransaccionController.getLogsByTransaction);

// Obtener timeline completo de una transacción
router.get('/transaction/:transaccionId/timeline', authenticateToken, logTransaccionController.getTransactionTimeline);

// --------------------- RUTAS POR TIPO Y ACCIÓN --------------------- //

// Obtener logs por tipo de transacción
router.get('/type/:tipoTransaccion', authenticateToken, requireAdmin, logTransaccionController.getLogsByTransactionType);

// Obtener logs por acción específica
router.get('/action/:accion', authenticateToken, requireAdmin, logTransaccionController.getLogsByAction);

// Obtener logs por rango de fechas
router.get('/date-range/query', authenticateToken, logTransaccionController.getLogsByDateRange);

// --------------------- RUTAS DE MONITOREO Y ANÁLISIS --------------------- //

// Obtener transacciones fallidas
router.get('/monitoring/failed', authenticateToken, requireAdmin, logTransaccionController.getFailedTransactions);

// Obtener actividad sospechosa
router.get('/monitoring/suspicious', authenticateToken, requireAdmin, logTransaccionController.getSuspiciousActivity);

// Dashboard de transacciones
router.get('/dashboard/overview', authenticateToken, logTransaccionController.getTransactionDashboard);

// Métricas en tiempo real
router.get('/dashboard/metrics', authenticateToken, requireAdmin, logTransaccionController.getRealTimeMetrics);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de logs
router.get('/admin/stats', authenticateToken, requireAdmin, logTransaccionController.getLogTransaccionStats);

// Exportar logs a CSV
router.get('/admin/export', authenticateToken, requireAdmin, logTransaccionController.exportLogs);

// Limpiar logs antiguos (solo admin)
router.post('/admin/clean', authenticateToken, requireAdmin, logTransaccionController.cleanOldLogs);

module.exports = router;