// routes/transaccionBlockchain.routes.js
const express = require('express');
const router = express.Router();
const transaccionBlockchainController = require('../controllers/transaccionBlockchain.controller');
const {authenticateToken, requireEmailVerified, requireRole} = require('../middleware/authMiddleware');
// Antes apuntaba por error a rateLimit.middleware (mismo módulo que
// rateLimitMiddleware) — validateUUID nunca existió ahí, solo en
// validation.middleware.js. Ver AUDITORIA_BACKEND.md Altos #11.
const validationMiddleware = require('../middleware/validation.middleware');
const rateLimitMiddleware = require('../middleware/rateLimit.middleware');
const { joiValidate } = require('../middleware/joiValidate.middleware');
const transaccionBlockchainSchema = require('../schemas/transaccionBlockchain.schema');
const idempotency = require('../middleware/idempotency.middleware');
const asyncHandler = require('../utils/asyncHandler');

// =================== RUTAS PÚBLICAS (con auth) ===================

// Aplicar autenticación y email verificado a todas las rutas
router.use(authenticateToken, requireEmailVerified);

/**
 * @openapi
 * /transaccionBlockchain/my:
 *   get:
 *     tags: [Depósitos / Retiros (on-chain)]
 *     summary: Mis transacciones on-chain (depósitos y retiros)
 *     responses:
 *       200: { description: Lista de transacciones del usuario }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/my', rateLimitMiddleware.general, asyncHandler(transaccionBlockchainController.getMyTransactions.bind(transaccionBlockchainController)));

// GET /api/transactions/:id - Obtener transacción específica
//router.get('/:id', /*validationMiddleware.validateUUID('id'),*/ asyncHandler(transaccionBlockchainController.getTransaction.bind(transaccionBlockchainController)));

/**
 * @openapi
 * /transaccionBlockchain/withdraw:
 *   post:
 *     tags: [Depósitos / Retiros (on-chain)]
 *     summary: Crear un retiro on-chain
 *     description: Money-path. Bloquea el saldo y encola el retiro. Requiere header Idempotency-Key; rate-limited.
 *     parameters:
 *       - { in: header, name: Idempotency-Key, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [criptomonedaId, cantidad, direccionDestino]
 *             properties:
 *               criptomonedaId: { type: string, format: uuid }
 *               cantidad: { type: number, example: 0.1 }
 *               direccionDestino: { type: string, description: Dirección on-chain de destino }
 *     responses:
 *       201: { description: Retiro creado (encolado) }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// Note: idempotency middleware is NOT wrapped with asyncHandler — it handles its own errors via next(err).
// Only the final controller handler is wrapped.
router.post('/withdraw', rateLimitMiddleware.withdrawal, joiValidate(transaccionBlockchainSchema.createWithdrawal), idempotency, asyncHandler(transaccionBlockchainController.createWithdrawal.bind(transaccionBlockchainController)));

// GET /api/transactions/balances - Obtener mis balances
//router.get('/balances', /*rateLimitMiddleware.general,*/ asyncHandler(transaccionBlockchainController.getMyBalances.bind(transaccionBlockchainController)));

/**
 * @openapi
 * /transaccionBlockchain/deposit-address/{criptomonedaId}:
 *   get:
 *     tags: [Depósitos / Retiros (on-chain)]
 *     summary: Obtener mi dirección de depósito para una cripto
 *     parameters:
 *       - { in: path, name: criptomonedaId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Dirección de depósito }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/deposit-address/:criptomonedaId', /*validationMiddleware.validateUUID('criptomonedaId'),*/ rateLimitMiddleware.general, asyncHandler(transaccionBlockchainController.getDepositAddress.bind(transaccionBlockchainController))); //Bien (En realidad está duplicada la ruta con una de "direccionDeposito")

// GET /api/transactions/tx/:hash - Buscar por hash
//router.get('/tx/:hash', /*validationMiddleware.validateTxHash,*/ asyncHandler(transaccionBlockchainController.getTransactionByHash.bind(transaccionBlockchainController)));

// =================== RUTAS ADMINISTRATIVAS (comentadas por ahora) ===================
//router.get('/admin/all',  ...);
//router.get('/admin/pending', ...);
//router.post('/admin/:id/approve', ...);
//router.post('/admin/:id/reject', ...);
//router.get('/admin/stats',  ...);

// =================== RUTAS DE SISTEMA (admin — disparan los jobs a demanda) ===================

/**
 * @openapi
 * /transaccionBlockchain/system/scan-deposits:
 *   post:
 *     tags: [Depósitos / Retiros (on-chain) - admin]
 *     summary: Escanear depósitos on-chain manualmente (admin)
 *     responses:
 *       200: { description: Scan disparado }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.post('/system/scan-deposits', requireRole(['admin', 'super_admin']), rateLimitMiddleware.system, asyncHandler(transaccionBlockchainController.scanDeposits.bind(transaccionBlockchainController)));

/**
 * @openapi
 * /transaccionBlockchain/system/process-withdrawals:
 *   post:
 *     tags: [Depósitos / Retiros (on-chain) - admin]
 *     summary: Procesar la cola de retiros manualmente (admin)
 *     responses:
 *       200: { description: Procesamiento disparado }
 */
router.post('/system/process-withdrawals', requireRole(['admin', 'super_admin']), rateLimitMiddleware.system, asyncHandler(transaccionBlockchainController.processWithdrawals.bind(transaccionBlockchainController)));

/**
 * @openapi
 * /transaccionBlockchain/system/update-confirmations:
 *   post:
 *     tags: [Depósitos / Retiros (on-chain) - admin]
 *     summary: Actualizar confirmaciones on-chain manualmente (admin)
 *     responses:
 *       200: { description: Confirmaciones actualizadas }
 */
router.post('/system/update-confirmations', requireRole(['admin', 'super_admin']), rateLimitMiddleware.system, asyncHandler(transaccionBlockchainController.updateConfirmations.bind(transaccionBlockchainController)));

// GET /api/system/blockchain-status - Estado de servicios (comentada)
//router.get('/system/blockchain-status',  ...);

module.exports = router;
