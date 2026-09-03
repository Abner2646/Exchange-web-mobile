// routes/valoracion.routes.js
const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken, requireEmailVerified } = require('../middleware/authMiddleware.js');
const { isAdmin } = require('../middleware/adminMiddleware.js');

// Importa el controlador
const valoracionController = require('../controllers/valoraciones.controller.js');

/**
 * @openapi
 * /valoracion/me/received:
 *   get: { tags: [Valoraciones (reputación)], summary: Mis valoraciones recibidas, responses: { 200: { description: Valoraciones } } }
 * /valoracion/me/given:
 *   get: { tags: [Valoraciones (reputación)], summary: Mis valoraciones dadas, responses: { 200: { description: Valoraciones } } }
 * /valoracion/me/pending:
 *   get: { tags: [Valoraciones (reputación)], summary: Transacciones pendientes de valorar, responses: { 200: { description: Pendientes } } }
 * /valoracion/can-rate/{transaccionP2PId}/{usuarioEvaluadoId}:
 *   get:
 *     tags: [Valoraciones (reputación)]
 *     summary: Verificar si puedo valorar una transacción
 *     parameters:
 *       - { in: path, name: transaccionP2PId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: usuarioEvaluadoId, required: true, schema: { type: string, format: uuid } }
 *     responses: { 200: { description: Resultado } }
 * /valoracion/transaction/{transaccionP2PId}:
 *   get: { tags: [Valoraciones (reputación)], summary: Valoraciones de una transacción, parameters: [{ in: path, name: transaccionP2PId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Valoraciones } } }
 * /valoracion/user/{usuarioId}/stats:
 *   get: { tags: [Valoraciones (reputación)], summary: Reputación de un usuario, parameters: [{ in: path, name: usuarioId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Stats } } }
 * /valoracion/user/{usuarioId}/received:
 *   get: { tags: [Valoraciones (reputación)], summary: Valoraciones recibidas por un usuario, parameters: [{ in: path, name: usuarioId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Valoraciones } } }
 * /valoracion/user/{usuarioId}/given:
 *   get: { tags: [Valoraciones (reputación)], summary: Valoraciones dadas por un usuario, parameters: [{ in: path, name: usuarioId, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Valoraciones } } }
 * /valoracion/users/{usuario1Id}/{usuario2Id}/summary:
 *   get:
 *     tags: [Valoraciones (reputación)]
 *     summary: Resumen de valoraciones entre dos usuarios
 *     parameters:
 *       - { in: path, name: usuario1Id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: usuario2Id, required: true, schema: { type: string, format: uuid } }
 *     responses: { 200: { description: Resumen } }
 * /valoracion/top-rated:
 *   get: { tags: [Valoraciones (reputación)], summary: Top usuarios mejor valorados, responses: { 200: { description: Top } } }
 * /valoracion:
 *   get: { tags: [Valoraciones (reputación)], summary: Listar valoraciones (con filtros), responses: { 200: { description: Valoraciones } } }
 *   post:
 *     tags: [Valoraciones (reputación)]
 *     summary: Crear una valoración
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [transaccionP2PId, usuarioEvaluadoId, puntuacion], properties: { transaccionP2PId: { type: string, format: uuid }, usuarioEvaluadoId: { type: string, format: uuid }, puntuacion: { type: integer, minimum: 1, maximum: 5 }, comentario: { type: string } } }
 *     responses: { 201: { description: Valoración creada }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /valoracion/batch:
 *   post: { tags: [Valoraciones (reputación)], summary: Crear varias valoraciones (batch), responses: { 201: { description: Creadas } } }
 * /valoracion/{id}:
 *   get: { tags: [Valoraciones (reputación)], summary: Valoración por id, parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Valoración } } }
 *   put: { tags: [Valoraciones (reputación)], summary: Actualizar una valoración, parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Actualizada } } }
 *   delete: { tags: [Valoraciones (reputación)], summary: Eliminar una valoración, parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }], responses: { 200: { description: Eliminada } } }
 * /valoracion/admin/stats:
 *   get: { tags: [Valoraciones (reputación) - admin], summary: Estadísticas generales (admin), responses: { 200: { description: Stats } } }
 */

// --------------------- RUTAS ESPECÍFICAS DEL USUARIO --------------------- //

// Obtener mis valoraciones recibidas
router.get('/me/received', authenticateToken, valoracionController.getMyRatings);

// Obtener mis valoraciones dadas
router.get('/me/given', authenticateToken, valoracionController.getMyGivenRatings);

// Obtener valoraciones pendientes (transacciones sin valorar)
router.get('/me/pending', authenticateToken, valoracionController.getPendingRatings);

// --------------------- RUTAS DE CONSULTA Y ANÁLISIS --------------------- //

// Verificar si puedo valorar una transacción específica
router.get('/can-rate/:transaccionP2PId/:usuarioEvaluadoId', authenticateToken, requireEmailVerified, valoracionController.checkCanRate);

// Obtener valoraciones de una transacción específica
router.get('/transaction/:transaccionP2PId', authenticateToken, requireEmailVerified, valoracionController.getTransactionRatings);

// Obtener estadísticas de reputación de un usuario específico
router.get('/user/:usuarioId/stats', authenticateToken, valoracionController.getUserReputationStats);

// Obtener valoraciones recibidas por un usuario específico
router.get('/user/:usuarioId/received', authenticateToken, valoracionController.getUserRatings);

// Obtener valoraciones dadas por un usuario específico
router.get('/user/:usuarioId/given', authenticateToken, valoracionController.getUserGivenRatings);

// Obtener resumen de valoraciones entre dos usuarios
router.get('/users/:usuario1Id/:usuario2Id/summary', authenticateToken, valoracionController.getUsersRatingSummary);

// Obtener top usuarios mejor valorados
router.get('/top-rated', authenticateToken, valoracionController.getTopRatedUsers);

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las valoraciones (con filtros)
router.get('/', authenticateToken, valoracionController.getValoraciones);

// Obtener valoración por ID
router.get('/:id', authenticateToken, valoracionController.getValoracionById);

// Crear nueva valoración
router.post('/', authenticateToken, requireEmailVerified, valoracionController.createValoracion);

// Crear múltiples valoraciones (batch)
router.post('/batch', authenticateToken, requireEmailVerified, valoracionController.createMultipleRatings);

// Actualizar valoración por ID
router.put('/:id', authenticateToken, requireEmailVerified, valoracionController.updateValoracion);

// Eliminar valoración por ID
router.delete('/:id', authenticateToken, requireEmailVerified, valoracionController.deleteValoracion);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas generales de valoraciones (solo admin)
router.get('/admin/stats', authenticateToken, isAdmin, valoracionController.getGeneralStats);

module.exports = router;