const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../../middleware/authMiddleware');
const requireOperatorMFA = require('../../middleware/operatorMFA.middleware');
const asyncHandler = require('../../utils/asyncHandler');
const governanceController = require('./governance.controller');

// Every route here is operator-only AND requires the operator to have MFA enabled
// (NYDFS Part 500 §500.12). The checker additionally proves a fresh 2FA code on approve.

/**
 * @openapi
 * /api/governance/pending:
 *   get:
 *     tags: [Governance]
 *     summary: Bandeja de acciones pendientes (Maker-Checker)
 *     security:
 *       - bearerAuth: []
 */
router.get('/pending', authenticateToken, requireOperatorMFA, asyncHandler(governanceController.listPending));

/**
 * @openapi
 * /api/governance/propose:
 *   post:
 *     tags: [Governance]
 *     summary: Proponer una acción privilegiada (Maker)
 *     description: El maker propone; un checker distinto debe autorizar con su 2FA.
 *     security:
 *       - bearerAuth: []
 */
router.post('/propose', authenticateToken, requireOperatorMFA, asyncHandler(governanceController.propose));

/**
 * @openapi
 * /api/governance/{id}/approve:
 *   post:
 *     tags: [Governance]
 *     summary: Autorizar y ejecutar una acción (Checker, con 2FA)
 *     description: >-
 *       El checker debe ser un operador distinto del maker (regla de 4 ojos) e ingresar
 *       su código 2FA. La ejecución del efecto es atómica con la autorización.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/approve', authenticateToken, requireOperatorMFA, asyncHandler(governanceController.approve));

/**
 * @openapi
 * /api/governance/{id}/reject:
 *   post:
 *     tags: [Governance]
 *     summary: Rechazar una acción pendiente
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reject', authenticateToken, requireOperatorMFA, asyncHandler(governanceController.reject));

module.exports = router;
