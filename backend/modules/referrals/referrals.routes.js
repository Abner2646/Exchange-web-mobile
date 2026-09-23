const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../../middleware/authMiddleware');
const idempotency = require('../../middleware/idempotency.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const referralsController = require('./referrals.controller');

/**
 * @openapi
 * /api/referrals/summary:
 *   get:
 *     tags: [Referidos]
 *     summary: Obtener resumen de referidos y saldo pendiente
 *     description: Retorna el saldo pendiente (USDT) acumulado y la lista de emails anonimizados de los invitados.
 *     security:
 *       - bearerAuth: []
 */
router.get('/summary', authenticateToken, asyncHandler(referralsController.getSummary));

/**
 * @openapi
 * /api/referrals/claim:
 *   post:
 *     tags: [Referidos]
 *     summary: Reclamar saldo de referidos
 *     description: Money-path. Mueve el saldo pendiente de referidos a funding:disponible. Requiere Idempotency-Key.
 *     parameters:
 *       - { in: header, name: Idempotency-Key, required: true, schema: { type: string, format: uuid } }
 *     security:
 *       - bearerAuth: []
 */
router.post('/claim', authenticateToken, idempotency, asyncHandler(referralsController.claim));

module.exports = router;
