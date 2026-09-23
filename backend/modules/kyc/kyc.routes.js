const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../../middleware/authMiddleware');
const asyncHandler = require('../../utils/asyncHandler');
const kycController = require('./kyc.controller');

/**
 * @openapi
 * /api/kyc/persona-webhook:
 *   post:
 *     tags: [KYC]
 *     summary: Webhook from Persona
 *     description: Server-to-server webhook from Persona to update user KYC status.
 *     parameters:
 *       - in: header
 *         name: persona-signature
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully processed event
 *       400:
 *         description: Malformed payload
 *       401:
 *         description: Bad signature
 *       500:
 *         description: Internal server error
 */
router.post('/persona-webhook', asyncHandler(kycController.handlePersonaWebhook));

/**
 * @openapi
 * /api/kyc/status:
 *   get:
 *     tags: [KYC]
 *     summary: Get current user KYC status
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC status
 */
router.get('/status', authenticateToken, asyncHandler(kycController.getStatus));

module.exports = router;
