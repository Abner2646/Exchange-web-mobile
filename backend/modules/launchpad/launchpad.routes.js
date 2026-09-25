const express = require('express');
const router = express.Router();
const launchpadController = require('./launchpad.controller');
const { authenticateToken } = require('../../middleware/authMiddleware');
const requireOperatorMFA = require('../../middleware/operatorMFA.middleware');
const idempotency = require('../../middleware/idempotency.middleware');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * @openapi
 * /api/launchpad/presales:
 *   get:
 *     summary: Listar todas las preventas
 *     tags: [Launchpad]
 *     responses:
 *       200:
 *         description: Lista de preventas
 */
router.get('/presales', asyncHandler(launchpadController.getPresales));

/**
 * @openapi
 * /api/launchpad/presales/{id}:
 *   get:
 *     summary: Obtener detalle de preventa
 *     tags: [Launchpad]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalle de preventa
 *       404:
 *         description: Preventa no encontrada
 */
router.get('/presales/:id', asyncHandler(launchpadController.getPresale));

/**
 * @openapi
 * /api/launchpad/buy:
 *   post:
 *     summary: Comprar tokens en preventa
 *     tags: [Launchpad]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - presaleId
 *               - amountUsdt
 *             properties:
 *               presaleId:
 *                 type: string
 *               amountUsdt:
 *                 type: string
 *     responses:
 *       200:
 *         description: Compra exitosa
 *       400:
 *         description: Error de validación o fondos insuficientes
 */
router.post('/buy', authenticateToken, idempotency, asyncHandler(launchpadController.buy));

/**
 * @openapi
 * /api/launchpad/presales:
 *   post:
 *     summary: Crear una nueva preventa
 *     tags: [Launchpad]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Preventa creada
 *       400:
 *         description: Error de validación
 *       403:
 *         description: No autorizado
 */
router.post('/presales', authenticateToken, requireOperatorMFA, asyncHandler(launchpadController.createPresale));

/**
 * @openapi
 * /api/launchpad/presales/{id}/activate:
 *   post:
 *     summary: Activar una preventa pendiente
 *     tags: [Launchpad]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Preventa activada
 *       400:
 *         description: Error de validación
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Preventa no encontrada
 */
router.post('/presales/:id/activate', authenticateToken, requireOperatorMFA, asyncHandler(launchpadController.activatePresale));

/**
 * @openapi
 * /api/launchpad/presales/{id}/resolve:
 *   post:
 *     summary: Resolver una preventa (completar o reembolsar)
 *     description: >
 *       Una resolución pequeña se liquida al instante (200). Una resolución grande
 *       (monto liquidado > umbral `launchpad_dual_control_usd_threshold`, techo duro $20k)
 *       queda RETENIDA bajo control dual (Maker-Checker) y devuelve 202 con el `actionId`;
 *       un checker distinto debe aprobarla con TOTP para que se liquide.
 *     tags: [Launchpad]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Preventa resuelta (liquidación inmediata)
 *       202:
 *         description: >
 *           Resolución grande retenida para control dual. Body:
 *           `{ pending: true, actionId, presale }`. Aprobar vía
 *           POST /api/governance/{actionId}/approve con TOTP (checker distinto).
 *       400:
 *         description: Error de validación
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Preventa no encontrada
 */
router.post('/presales/:id/resolve', authenticateToken, requireOperatorMFA, asyncHandler(launchpadController.resolvePresale));

module.exports = router;
