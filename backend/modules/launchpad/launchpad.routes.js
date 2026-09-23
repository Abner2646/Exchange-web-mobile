const express = require('express');
const router = express.Router();
const launchpadController = require('./launchpad.controller');
const { authenticateToken } = require('../../middleware/authMiddleware');
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

module.exports = router;
