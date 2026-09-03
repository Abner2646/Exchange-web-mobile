const express = require('express');
const router = express.Router();
const transferenciaController = require('../controllers/transferencia.controller');

// Middleware
const { authenticateToken, requireEmailVerified } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');
const idempotency = require('../middleware/idempotency.middleware');
const asyncHandler = require('../utils/asyncHandler');

// =============== RUTAS DE USUARIO AUTENTICADO ===============

/**
 * @openapi
 * /transferencia:
 *   post:
 *     tags: [Transferencias (usuario↔usuario)]
 *     summary: Crear una transferencia interna (requiere verificación por código)
 *     description: Money-path. Requiere header Idempotency-Key. Emite un código de verificación; se confirma con POST /{id}/process.
 *     parameters:
 *       - { in: header, name: Idempotency-Key, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [usuarioDestinatarioId, criptomonedaId, cantidad]
 *             properties:
 *               usuarioDestinatarioId: { type: string, format: uuid }
 *               criptomonedaId: { type: string, format: uuid }
 *               cantidad: { type: number, example: 0.5 }
 *               concepto: { type: string }
 *     responses:
 *       201: { description: Transferencia creada (pendiente de verificación) }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/', authenticateToken, requireEmailVerified, idempotency, asyncHandler(transferenciaController.createTransferencia));

/**
 * @openapi
 * /transferencia/{id}/process:
 *   post:
 *     tags: [Transferencias (usuario↔usuario)]
 *     summary: Confirmar una transferencia con el código de verificación
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [codigoVerificacion]
 *             properties:
 *               codigoVerificacion: { type: string, example: "123456" }
 *     responses:
 *       200: { description: Transferencia completada }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post('/:id/process', authenticateToken, requireEmailVerified, asyncHandler(transferenciaController.procesarTransferencia));

/**
 * @openapi
 * /transferencia/my:
 *   get:
 *     tags: [Transferencias (usuario↔usuario)]
 *     summary: Mis transferencias
 *     responses:
 *       200: { description: Lista de transferencias del usuario }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/my', authenticateToken, requireEmailVerified, asyncHandler(transferenciaController.getMyTransferencias));

/**
 * @openapi
 * /transferencia/stats:
 *   get:
 *     tags: [Transferencias (usuario↔usuario) - admin]
 *     summary: Estadísticas de transferencias (admin)
 *     responses:
 *       200: { description: Estadísticas }
 */
// NOTE: must be registered BEFORE /:id to avoid Express matching "stats" as an id param
router.get('/stats', authenticateToken, isAdmin, asyncHandler(transferenciaController.getTransferenciaStats));

/**
 * @openapi
 * /transferencia/{id}:
 *   get:
 *     tags: [Transferencias (usuario↔usuario)]
 *     summary: Obtener una transferencia por id
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Transferencia }
 *       404: { $ref: '#/components/responses/BadRequest' }
 */
router.get('/:id', authenticateToken, requireEmailVerified, asyncHandler(transferenciaController.getTransferenciaById));

/**
 * @openapi
 * /transferencia/{id}/cancel:
 *   put:
 *     tags: [Transferencias (usuario↔usuario)]
 *     summary: Cancelar una transferencia
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Transferencia cancelada }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.put('/:id/cancel', authenticateToken, requireEmailVerified, asyncHandler(transferenciaController.cancelarTransferencia));

/**
 * @openapi
 * /transferencia/{id}/resend-code:
 *   post:
 *     tags: [Transferencias (usuario↔usuario)]
 *     summary: Reenviar el código de verificación de una transferencia
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Código reenviado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post('/:id/resend-code', authenticateToken, requireEmailVerified, asyncHandler(transferenciaController.reenviarCodigo));

/**
 * @openapi
 * /transferencia/verify-funds:
 *   post:
 *     tags: [Transferencias (usuario↔usuario)]
 *     summary: Verificar fondos antes de transferir
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [criptomonedaId, cantidad]
 *             properties:
 *               criptomonedaId: { type: string, format: uuid }
 *               cantidad: { type: number, example: 0.5 }
 *     responses:
 *       200: { description: Resultado de la verificación }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post('/verify-funds', authenticateToken, requireEmailVerified, asyncHandler(transferenciaController.verificarFondos));

// =============== RUTAS ADMINISTRATIVAS ===============

/**
 * @openapi
 * /transferencia:
 *   get:
 *     tags: [Transferencias (usuario↔usuario) - admin]
 *     summary: Listar todas las transferencias (admin)
 *     responses:
 *       200: { description: Lista de transferencias }
 */
router.get('/', authenticateToken, isAdmin, asyncHandler(transferenciaController.getAllTransferencias));

module.exports = router;
