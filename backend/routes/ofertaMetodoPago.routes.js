/*
NO necesita rutas propias. Es una tabla intermedia que se maneja automáticamente cuando trabajas con OfertaP2P.
*/

// routes/ofertaMetodoPago.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación y autorización
const { authenticateToken} = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// Importa el controlador de relaciones oferta-método de pago
const ofertaMetodoPagoController = require('../controllers/ofertaMetodoPago.controller.js');

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las relaciones oferta-método de pago
router.get('/', authenticateToken, ofertaMetodoPagoController.getOfertaMetodosPago);

// Obtener relación específica por ID
router.get('/:id', authenticateToken, ofertaMetodoPagoController.getOfertaMetodoPagoById);

// Crear nueva relación oferta-método de pago
router.post('/', authenticateToken, ofertaMetodoPagoController.createOfertaMetodoPago);

// Eliminar relación por ID
router.delete('/:id', authenticateToken, ofertaMetodoPagoController.deleteOfertaMetodoPago);

// Eliminar relación específica por oferta y método
router.delete('/oferta/:ofertaId/metodo/:metodoPagoId', authenticateToken, ofertaMetodoPagoController.deleteOfertaMetodoEspecifico);
/*
// --------------------- RUTAS POR OFERTA --------------------- //

// Obtener métodos de pago de una oferta específica
router.get('/oferta/:ofertaId/metodos', ofertaMetodoPagoController.getMetodosPagoByOferta); // <---

// Obtener relaciones completas de una oferta
router.get('/oferta/:ofertaId/completo', ofertaMetodoPagoController.getOfertaMetodosPagoCompleto);

// Obtener resumen rápido de una oferta
router.get('/oferta/:ofertaId/summary', ofertaMetodoPagoController.getOfertaSummary);

// Obtener métodos de pago disponibles para una oferta
router.get('/oferta/:ofertaId/available', authenticateToken, ofertaMetodoPagoController.getAvailableMetodos);

// Validar setup completo de oferta
router.get('/oferta/:ofertaId/validate-setup', authenticateToken, ofertaMetodoPagoController.validateOfertaSetup);

// --------------------- RUTAS POR MÉTODO DE PAGO --------------------- //

// Obtener ofertas que usan un método de pago específico
router.get('/metodo/:metodoPagoId/ofertas', ofertaMetodoPagoController.getOfertasByMetodoPago);

// --------------------- RUTAS DE GESTIÓN MASIVA --------------------- //

// Agregar múltiples métodos de pago a una oferta
router.post('/oferta/:ofertaId/add-multiple', authenticateToken, ofertaMetodoPagoController.addMultipleMetodos);

// Remover múltiples métodos de pago de una oferta
router.post('/oferta/:ofertaId/remove-multiple', authenticateToken, ofertaMetodoPagoController.removeMultipleMetodos);

// Reemplazar todos los métodos de pago de una oferta
router.put('/oferta/:ofertaId/replace-all', authenticateToken, ofertaMetodoPagoController.replaceMetodosOferta);

// Clonar métodos de pago de una oferta a otra
router.post('/clone-metodos', authenticateToken, ofertaMetodoPagoController.cloneMetodosToOferta);

// --------------------- RUTAS DE VALIDACIÓN --------------------- //

// Verificar si existe relación específica
router.get('/check/:ofertaId/:metodoPagoId', ofertaMetodoPagoController.checkRelationExists);

// Validar compatibilidad entre oferta y método de pago
router.get('/validate/:ofertaId/:metodoPagoId', ofertaMetodoPagoController.validateCompatibility);

// --------------------- RUTAS DE DASHBOARD Y ANÁLISIS --------------------- //
*/
// Dashboard de relaciones oferta-método de pago (solo admin)
//router.get('/dashboard/overview', authenticateToken, /*requireAdmin,*/ ofertaMetodoPagoController.getOfertaMetodosDashboard);

// Métricas de uso de métodos de pago
//router.get('/dashboard/usage-metrics', authenticateToken, /*requireAdmin,*/ ofertaMetodoPagoController.getMetodosUsageMetrics);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de relaciones (solo admin)
//router.get('/admin/stats', authenticateToken, /*requireAdmin,*/ ofertaMetodoPagoController.getOfertaMetodoPagoStats);

// Exportar relaciones a CSV (solo admin)
//router.get('/admin/export', authenticateToken, /*requireAdmin,*/ ofertaMetodoPagoController.exportOfertaMetodosPago);

module.exports = router;