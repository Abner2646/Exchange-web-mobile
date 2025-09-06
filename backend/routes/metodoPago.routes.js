// routes/metodoPago.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación y autorización
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware.js');

// Importa el controlador de métodos de pago
const metodoPagoController = require('../controllers/metodoPago.controller.js');

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todos los métodos de pago
router.get('/', metodoPagoController.getMetodosPago);

// Obtener método de pago por ID
router.get('/:id', metodoPagoController.getMetodoPagoById);

// Crear nuevo método de pago (solo admin)
router.post('/', authenticateToken, requireAdmin, metodoPagoController.createMetodoPago);

// Actualizar método de pago por ID (solo admin)
router.put('/:id', authenticateToken, requireAdmin, metodoPagoController.updateMetodoPago);

// Eliminar método de pago por ID (solo admin)
router.delete('/:id', authenticateToken, requireAdmin, metodoPagoController.deleteMetodoPago);

// --------------------- RUTAS DE BÚSQUEDA --------------------- //

// Buscar métodos de pago por término
router.get('/search/query', metodoPagoController.searchMetodosPago);

// Obtener método de pago por nombre
router.get('/name/:nombre', metodoPagoController.getMetodoPagoByName);

// --------------------- RUTAS DE ESTADO --------------------- //

// Obtener métodos de pago activos
router.get('/status/active', metodoPagoController.getActiveMetodosPago);

// Obtener métodos de pago inactivos (solo admin)
router.get('/status/inactive', authenticateToken, requireAdmin, metodoPagoController.getInactiveMetodosPago);

// Verificar si método está activo
router.get('/:id/check-active', metodoPagoController.checkMetodoActive);

// Validar método de pago para uso
router.get('/:id/validate', metodoPagoController.validateMetodoPago);

// --------------------- RUTAS DE GESTIÓN DE ESTADO --------------------- //

// Actualizar estado específico de método de pago (solo admin)
router.patch('/:id/status', authenticateToken, requireAdmin, metodoPagoController.updateMetodoPagoStatus);

// Alternar estado de método de pago (solo admin)
router.patch('/:id/toggle', authenticateToken, requireAdmin, metodoPagoController.toggleMetodoPagoStatus);

// Actualización masiva de estado (solo admin)
router.patch('/bulk/status', authenticateToken, requireAdmin, metodoPagoController.bulkUpdateStatus);

// --------------------- RUTAS DE CONSULTA ESPECIALIZADA --------------------- //

// Obtener métodos populares
router.get('/ranking/popular', metodoPagoController.getPopularMetodosPago);

// Obtener métodos para formularios (solo activos, formato simple)
router.get('/forms/options', metodoPagoController.getMetodosForForm);

// Obtener resumen rápido
router.get('/summary/quick', metodoPagoController.getQuickSummary);

// --------------------- RUTAS DE DASHBOARD Y ANÁLISIS --------------------- //

// Dashboard de métodos de pago (solo admin)
router.get('/dashboard/overview', authenticateToken, requireAdmin, metodoPagoController.getMetodosPagoDashboard);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de métodos de pago (solo admin)
router.get('/admin/stats', authenticateToken, requireAdmin, metodoPagoController.getMetodoPagoStats);

// Exportar métodos de pago a CSV (solo admin)
router.get('/admin/export', authenticateToken, requireAdmin, metodoPagoController.exportMetodosPago);

module.exports = router;