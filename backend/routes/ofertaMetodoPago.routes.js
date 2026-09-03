// routes/ofertaMetodoPago.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación y autorización
const { authenticateToken, requireEmailVerified} = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// Importa el controlador de relaciones oferta-método de pago
const ofertaMetodoPagoController = require('../controllers/ofertaMetodoPago.controller.js');

/**
 * @openapi
 * /ofertaMetodoPago:
 *   get: { tags: [Oferta↔Método de pago], summary: Listar relaciones oferta-método, responses: { 200: { description: Relaciones } } }
 *   post: { tags: [Oferta↔Método de pago], summary: Crear una relación oferta-método, responses: { 201: { description: Creada } } }
 * /ofertaMetodoPago/{id}:
 *   get: { tags: [Oferta↔Método de pago], summary: Relación por id, parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Relación } } }
 *   delete: { tags: [Oferta↔Método de pago], summary: Eliminar relación por id, parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Eliminada } } }
 * /ofertaMetodoPago/oferta/{ofertaId}/metodo/{metodoPagoId}:
 *   delete:
 *     tags: [Oferta↔Método de pago]
 *     summary: Eliminar una relación específica (oferta+método)
 *     parameters:
 *       - { in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: metodoPagoId, required: true, schema: { type: string, format: uuid } }
 *     responses: { 200: { description: Eliminada } }
 * /ofertaMetodoPago/oferta/{ofertaId}/metodos:
 *   get: { tags: [Oferta↔Método de pago], summary: Métodos de pago de una oferta (público), security: [], parameters: [{ in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Métodos } } }
 * /ofertaMetodoPago/oferta/{ofertaId}/completo:
 *   get: { tags: [Oferta↔Método de pago], summary: Relaciones completas de una oferta (público), security: [], parameters: [{ in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Relaciones } } }
 * /ofertaMetodoPago/oferta/{ofertaId}/summary:
 *   get: { tags: [Oferta↔Método de pago], summary: Resumen de una oferta (público), security: [], parameters: [{ in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Resumen } } }
 * /ofertaMetodoPago/oferta/{ofertaId}/available:
 *   get: { tags: [Oferta↔Método de pago], summary: Métodos disponibles para una oferta, parameters: [{ in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Métodos } } }
 * /ofertaMetodoPago/oferta/{ofertaId}/validate-setup:
 *   get: { tags: [Oferta↔Método de pago], summary: Validar el setup de una oferta, parameters: [{ in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Resultado } } }
 * /ofertaMetodoPago/metodo/{metodoPagoId}/ofertas:
 *   get: { tags: [Oferta↔Método de pago], summary: Ofertas que usan un método (público), security: [], parameters: [{ in: path, name: metodoPagoId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Ofertas } } }
 * /ofertaMetodoPago/oferta/{ofertaId}/add-multiple:
 *   post: { tags: [Oferta↔Método de pago], summary: Agregar varios métodos a una oferta, parameters: [{ in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: OK } } }
 * /ofertaMetodoPago/oferta/{ofertaId}/remove-multiple:
 *   post: { tags: [Oferta↔Método de pago], summary: Quitar varios métodos de una oferta, parameters: [{ in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: OK } } }
 * /ofertaMetodoPago/oferta/{ofertaId}/replace-all:
 *   put: { tags: [Oferta↔Método de pago], summary: Reemplazar todos los métodos de una oferta, parameters: [{ in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: OK } } }
 * /ofertaMetodoPago/clone-metodos:
 *   post: { tags: [Oferta↔Método de pago], summary: Clonar métodos de una oferta a otra, responses: { 200: { description: OK } } }
 * /ofertaMetodoPago/check/{ofertaId}/{metodoPagoId}:
 *   get:
 *     tags: [Oferta↔Método de pago]
 *     summary: Verificar si existe una relación (público)
 *     security: []
 *     parameters:
 *       - { in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: metodoPagoId, required: true, schema: { type: string, format: uuid } }
 *     responses: { 200: { description: Existe o no } }
 * /ofertaMetodoPago/validate/{ofertaId}/{metodoPagoId}:
 *   get:
 *     tags: [Oferta↔Método de pago]
 *     summary: Validar compatibilidad oferta-método (público)
 *     security: []
 *     parameters:
 *       - { in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: metodoPagoId, required: true, schema: { type: string, format: uuid } }
 *     responses: { 200: { description: Compatible o no } }
 * /ofertaMetodoPago/dashboard/overview:
 *   get: { tags: [Oferta↔Método de pago - admin], summary: Dashboard de relaciones (super admin), responses: { 200: { description: Dashboard } } }
 * /ofertaMetodoPago/dashboard/usage-metrics:
 *   get: { tags: [Oferta↔Método de pago - admin], summary: Métricas de uso (super admin), responses: { 200: { description: Métricas } } }
 * /ofertaMetodoPago/admin/stats:
 *   get: { tags: [Oferta↔Método de pago - admin], summary: Estadísticas (super admin), responses: { 200: { description: Stats } } }
 * /ofertaMetodoPago/admin/export:
 *   get: { tags: [Oferta↔Método de pago - admin], summary: Exportar a CSV (super admin), responses: { 200: { description: CSV } } }
 */

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las relaciones oferta-método de pago
router.get('/', authenticateToken, requireEmailVerified, ofertaMetodoPagoController.getOfertaMetodosPago);

// Obtener relación específica por ID
router.get('/:id', authenticateToken, requireEmailVerified, ofertaMetodoPagoController.getOfertaMetodoPagoById);

// Crear nueva relación oferta-método de pago
router.post('/', authenticateToken, requireEmailVerified, ofertaMetodoPagoController.createOfertaMetodoPago);

// Eliminar relación por ID
router.delete('/:id', authenticateToken, requireEmailVerified, ofertaMetodoPagoController.deleteOfertaMetodoPago);

// Eliminar relación específica por oferta y método
router.delete('/oferta/:ofertaId/metodo/:metodoPagoId', authenticateToken, requireEmailVerified, ofertaMetodoPagoController.deleteOfertaMetodoEspecifico);

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

// Dashboard de relaciones oferta-método de pago (solo admin)
router.get('/dashboard/overview', authenticateToken, isSuperAdmin, ofertaMetodoPagoController.getOfertaMetodosDashboard);

// Métricas de uso de métodos de pago
router.get('/dashboard/usage-metrics', authenticateToken, isSuperAdmin, ofertaMetodoPagoController.getMetodosUsageMetrics);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de relaciones (solo admin)
router.get('/admin/stats', authenticateToken, isSuperAdmin, ofertaMetodoPagoController.getOfertaMetodoPagoStats);

// Exportar relaciones a CSV (solo admin)
router.get('/admin/export', authenticateToken, isSuperAdmin, ofertaMetodoPagoController.exportOfertaMetodosPago);

module.exports = router;