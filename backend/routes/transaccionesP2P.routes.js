// routes/transaccionP2P.routes.js

const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken, requireEmailVerified } = require('../middleware/authMiddleware.js');
const { isAdmin } = require('../middleware/adminMiddleware.js');
const requireOperatorMFA = require('../middleware/operatorMFA.middleware');
const asyncHandler = require('../utils/asyncHandler');

// <--------- Este símbolo son las rutas que nos sirven posta

// Importa el controlador
const transaccionP2PController = require('../controllers/transaccionesP2P.controller.js');

/**
 * @openapi
 * /transaccionP2P/me/transacciones:
 *   get: { tags: [P2P transacciones], summary: Mis transacciones P2P, responses: { 200: { description: Lista }, 401: { $ref: '#/components/responses/Unauthorized' } } }
 * /transaccionP2P/me/pending:
 *   get: { tags: [P2P transacciones], summary: Mis transacciones P2P pendientes, responses: { 200: { description: Lista } } }
 * /transaccionP2P/me/volume:
 *   get: { tags: [P2P transacciones], summary: Mi volumen P2P, responses: { 200: { description: Volumen } } }
 * /transaccionP2P/history/{otroUsuarioId}:
 *   get:
 *     tags: [P2P transacciones]
 *     summary: Historial de transacciones con otro usuario
 *     parameters: [{ in: path, name: otroUsuarioId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Historial } }
 * /transaccionP2P/{id}/confirm-payment:
 *   patch:
 *     tags: [P2P transacciones]
 *     summary: El comprador confirma que realizó el pago fiat
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Pago confirmado }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /transaccionP2P/{id}/complete:
 *   patch:
 *     tags: [P2P transacciones]
 *     summary: El vendedor confirma la recepción y libera las cryptos
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Transacción completada }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /transaccionP2P/{id}/cancel:
 *   patch:
 *     tags: [P2P transacciones]
 *     summary: Cancelar una transacción P2P
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Cancelada }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /transaccionP2P:
 *   get: { tags: [P2P transacciones], summary: Listar transacciones (con filtros), responses: { 200: { description: Lista } } }
 *   post:
 *     tags: [P2P transacciones]
 *     summary: Crear una transacción (aceptar una oferta) — bloquea las cryptos del vendedor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [ofertaId], properties: { ofertaId: { type: string, format: uuid }, cantidad: { type: number } } }
 *     responses: { 201: { description: Transacción creada }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /transaccionP2P/{id}:
 *   get:
 *     tags: [P2P transacciones]
 *     summary: Obtener una transacción por id
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Transacción }, 404: { $ref: '#/components/responses/BadRequest' } }
 * /transaccionP2P/oferta/{ofertaId}:
 *   get:
 *     tags: [P2P transacciones]
 *     summary: Transacciones de una oferta
 *     parameters: [{ in: path, name: ofertaId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Transacciones } }
 * /transaccionP2P/admin/stats:
 *   get: { tags: [P2P transacciones - admin], summary: Estadísticas P2P (admin), responses: { 200: { description: Stats } } }
 * /transaccionP2P/admin/check-timeouts:
 *   post: { tags: [P2P transacciones - admin], summary: Cancelar transacciones vencidas (admin), responses: { 200: { description: OK } } }
 * /transaccionP2P/{id}/force-status:
 *   patch:
 *     tags: [P2P transacciones - admin]
 *     summary: Forzar cambio de estado (admin, casos excepcionales)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Estado forzado } }
 * /transaccionP2P/admin/user/{usuarioId}/volume:
 *   get:
 *     tags: [P2P transacciones - admin]
 *     summary: Volumen P2P de un usuario (admin)
 *     parameters: [{ in: path, name: usuarioId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Volumen } }
 */

// --------------------- RUTAS ESPECÍFICAS DEL USUARIO --------------------- //

// Obtener mis transacciones
router.get('/me/transacciones', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.getMyTransacciones)); // <---------

// Obtener transacciones pendientes
router.get('/me/pending', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.getPendingTransacciones)); // <---------

// Obtener mi volumen de transacciones
router.get('/me/volume', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.getUserVolume));

// Obtener historial con usuario específico
router.get('/history/:otroUsuarioId', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.getTransactionHistory));

// --------------------- RUTAS DE ACCIONES DE TRANSACCIÓN --------------------- //

// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #11): lock-cryptos llamaba a
// un método inexistente del modelo — el bloqueo de fondos ya pasa dentro de
// createTransaction, no es un paso aparte. Ruta eliminada.

// Confirmar pago (comprador confirma que realizó el pago)
router.patch('/:id/confirm-payment', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.confirmPayment)); // <---------

// Completar transacción (vendedor confirma que recibió el pago y libera cryptos)
router.patch('/:id/complete', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.completeTransaction)); // <---------

// Cancelar transacción
router.patch('/:id/cancel', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.cancelTransaction)); // <---------

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las transacciones (con filtros)
router.get('/', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.getTransacciones));

// Obtener transacción por ID
router.get('/:id', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.getTransaccionById));

// Crear nueva transacción (aceptar oferta)
router.post('/', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.createTransaccion)); // <-----

// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #11): /status llamaba a un
// método inexistente del modelo y era redundante con las transiciones
// específicas de arriba (confirm-payment/complete/cancel), que sí funcionan
// y sí validan la transición real. Ruta eliminada.

// --------------------- RUTAS POR CONTEXTO --------------------- //

// Obtener transacciones por oferta específica
router.get('/oferta/:ofertaId', authenticateToken, requireEmailVerified, asyncHandler(transaccionP2PController.getTransaccionesByOferta));

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de transacciones (solo admin)
router.get('/admin/stats', authenticateToken, isAdmin, asyncHandler(transaccionP2PController.getTransaccionesStats));

// Verificar y cancelar transacciones con timeout (solo admin)
router.post('/admin/check-timeouts', authenticateToken, isAdmin, asyncHandler(transaccionP2PController.checkTimeouts));

// Forzar cambio de estado (solo admin) - para casos excepcionales
router.patch('/:id/force-status', authenticateToken, isAdmin, requireOperatorMFA, asyncHandler(transaccionP2PController.forceStatusChange));

// Obtener volumen de usuario específico (solo admin)
router.get('/admin/user/:usuarioId/volume', authenticateToken, isAdmin, asyncHandler(transaccionP2PController.getUserVolume));

module.exports = router;
