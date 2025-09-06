// routes/reclamo.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación y autorización
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware.js');

// Importa el controlador de reclamos
const reclamoController = require('../controllers/reclamo.controller.js');

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todos los reclamos (admins ven todos, usuarios solo los suyos)
router.get('/', authenticateToken, reclamoController.getReclamos);

// Obtener reclamo específico por ID
router.get('/:id', authenticateToken, reclamoController.getReclamoById);

// Crear nuevo reclamo
router.post('/', authenticateToken, reclamoController.createReclamo);

// Actualizar reclamo por ID
router.put('/:id', authenticateToken, reclamoController.updateReclamo);

// Eliminar reclamo por ID (solo admin)
router.delete('/:id', authenticateToken, requireAdmin, reclamoController.deleteReclamo);

// --------------------- RUTAS DE BÚSQUEDA --------------------- //

// Buscar reclamos por término
router.get('/search/query', authenticateToken, reclamoController.searchReclamos);

// --------------------- RUTAS POR USUARIO --------------------- //

// Obtener mis reclamos (usuario autenticado)
router.get('/user/me', authenticateToken, reclamoController.getMyReclamos);

// Obtener reclamos por usuario específico (solo admin)
router.get('/user/:userId', authenticateToken, requireAdmin, reclamoController.getReclamosByUser);

// --------------------- RUTAS DE ASIGNACIÓN (ADMIN) --------------------- //

// Obtener mis reclamos asignados (admin)
router.get('/admin/assigned-to-me', authenticateToken, requireAdmin, reclamoController.getMyAssignedReclamos);

// Obtener reclamos sin asignar
router.get('/admin/unassigned', authenticateToken, requireAdmin, reclamoController.getUnassignedReclamos);

// Obtener reclamos vencidos
router.get('/admin/overdue', authenticateToken, requireAdmin, reclamoController.getOverdueReclamos);

// Asignar reclamo a admin específico
router.post('/:id/assign', authenticateToken, requireAdmin, reclamoController.assignReclamoToAdmin);

// Auto-asignar reclamo a mí (admin)
router.post('/:id/assign-to-me', authenticateToken, requireAdmin, reclamoController.assignReclamoToMe);

// --------------------- RUTAS POR ESTADO Y PRIORIDAD --------------------- //

// Obtener reclamos por estado
router.get('/status/:estado', authenticateToken, requireAdmin, reclamoController.getReclamosByStatus);

// Obtener reclamos por prioridad
router.get('/priority/:prioridad', authenticateToken, requireAdmin, reclamoController.getReclamosByPriority);

// Actualizar estado del reclamo
router.patch('/:id/status', authenticateToken, reclamoController.updateReclamoStatus);

// Actualizar prioridad del reclamo (solo admin)
router.patch('/:id/priority', authenticateToken, requireAdmin, reclamoController.updateReclamoPriority);

// Resolver reclamo (solo admin)
router.post('/:id/resolve', authenticateToken, requireAdmin, reclamoController.resolveReclamo);

// --------------------- RUTAS DE DASHBOARD Y ANÁLISIS --------------------- //

// Dashboard de reclamos (personalizado por rol)
router.get('/dashboard/overview', authenticateToken, reclamoController.getReclamosDashboard);

// Métricas de rendimiento (solo admin)
router.get('/dashboard/metrics', authenticateToken, requireAdmin, reclamoController.getPerformanceMetrics);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de reclamos (solo admin)
router.get('/admin/stats', authenticateToken, requireAdmin, reclamoController.getReclamoStats);

// Exportar reclamos a CSV (solo admin)
router.get('/admin/export', authenticateToken, requireAdmin, reclamoController.exportReclamos);

module.exports = router;