// modules/audit/audit.routes.js
// Read-only admin surface over the hash-chained audit log (§500.06). Mounted at /audit.
// Gate: authenticated + admin. Read-only → no operator-MFA step-up (that guards WRITES).
const { Router } = require('express');
const router = Router();
const { authenticateToken } = require('../../middleware/authMiddleware');
const { isAdmin } = require('../../middleware/adminMiddleware');
const asyncHandler = require('../../utils/asyncHandler');
const controller = require('./audit.controller');

router.use(authenticateToken, isAdmin);

/**
 * @openapi
 * /audit:
 *   get:
 *     tags: [Audit - admin]
 *     summary: Listar eventos del audit log (keyset, id DESC)
 *     parameters:
 *       - { in: query, name: eventType, required: false, schema: { type: string } }
 *       - { in: query, name: aggregateId, required: false, schema: { type: string } }
 *       - { in: query, name: limit, required: false, schema: { type: integer, minimum: 1, maximum: 100 } }
 *       - { in: query, name: beforeId, required: false, schema: { type: integer }, description: cursor keyset }
 *     responses:
 *       200: { description: '{ rows, nextBeforeId }' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Requiere admin }
 * /audit/verify:
 *   get:
 *     tags: [Audit - admin]
 *     summary: Verificar integridad de la cadena de hashes (detecta tampering)
 *     responses:
 *       200: { description: '{ ok, brokenAtSeq, checked }' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { description: Requiere admin }
 */
router.get('/', asyncHandler(controller.list));
router.get('/verify', asyncHandler(controller.verify));

module.exports = router;
