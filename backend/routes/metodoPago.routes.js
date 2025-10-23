// routes/metodoPago.routes.js
const { Router } = require('express');
const router = Router();

// Importa el controlador de métodos de pago
const metodoPagoController = require('../controllers/metodoPago.controller.js');

// Middleware de autenticación y autorización
const { authenticateToken} = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todos los métodos de pago
router.get('/', authenticateToken, metodoPagoController.getMetodosPago); //Bien
/*
Devuelve ej: 
[
    {
        "id": "cd323f9b-2392-47a1-83fd-69d3fb146a42",
        "nombre": "Mercado Pago",
        "descripcion": "Método confiable",
        "activo": true
    }
]
*/

// Obtener método de pago por ID
router.get('/:id', authenticateToken, metodoPagoController.getMetodoPagoById);

// Crear nuevo método de pago (solo super admin)
router.post('/', authenticateToken, isSuperAdmin, metodoPagoController.createMetodoPago); // Bien

// Actualizar método de pago por ID (solo super admin)
router.put('/:id', authenticateToken, isSuperAdmin, metodoPagoController.updateMetodoPago);

// Eliminar método de pago por ID (solo super admin)
router.delete('/:id', authenticateToken, isSuperAdmin, metodoPagoController.deleteMetodoPago);

// --------------------- RUTAS DE BÚSQUEDA --------------------- //

// Buscar métodos de pago por término
router.get('/search/query', authenticateToken, metodoPagoController.searchMetodosPago);

// Obtener método de pago por nombre
router.get('/name/:nombre', authenticateToken, metodoPagoController.getMetodoPagoByName);

// --------------------- RUTAS DE ESTADO --------------------- //

// Obtener métodos de pago activos
router.get('/status/active', authenticateToken, metodoPagoController.getActiveMetodosPago);

// Obtener métodos de pago inactivos (solo admin)
router.get('/status/inactive', authenticateToken, isSuperAdmin, metodoPagoController.getInactiveMetodosPago);

// Verificar si método está activo
router.get('/:id/check-active', authenticateToken, metodoPagoController.checkMetodoActive);

// Validar método de pago para uso
router.get('/:id/validate', authenticateToken, metodoPagoController.validateMetodoPago);

// --------------------- RUTAS DE GESTIÓN DE ESTADO --------------------- //

// Actualizar estado específico de método de pago (solo admin)
//router.patch('/:id/status', authenticateToken, /*requireAdmin,*/ metodoPagoController.updateMetodoPagoStatus);

// Alternar estado de método de pago (solo admin)
//router.patch('/:id/toggle', authenticateToken, /*requireAdmin,*/ metodoPagoController.toggleMetodoPagoStatus);

// Actualización masiva de estado (solo admin)
//router.patch('/bulk/status', authenticateToken, /*requireAdmin,*/ metodoPagoController.bulkUpdateStatus);

// --------------------- RUTAS DE CONSULTA ESPECIALIZADA --------------------- //

// Obtener métodos populares
//router.get('/ranking/popular', metodoPagoController.getPopularMetodosPago);

// Obtener métodos para formularios (solo activos, formato simple)
//router.get('/forms/options', metodoPagoController.getMetodosForForm);

// Obtener resumen rápido
//router.get('/summary/quick', metodoPagoController.getQuickSummary);

// --------------------- RUTAS DE DASHBOARD Y ANÁLISIS --------------------- //

// Dashboard de métodos de pago (solo admin)
//router.get('/dashboard/overview', authenticateToken, /*requireAdmin,*/ metodoPagoController.getMetodosPagoDashboard);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de métodos de pago (solo admin)
//router.get('/admin/stats', authenticateToken, /*requireAdmin,*/ metodoPagoController.getMetodoPagoStats);

// Exportar métodos de pago a CSV (solo admin)
//router.get('/admin/export', authenticateToken, /*requireAdmin,*/ metodoPagoController.exportMetodosPago);

module.exports = router;