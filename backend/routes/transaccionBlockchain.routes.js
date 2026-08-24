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

// GET /api/transactions/my - Obtener mis transacciones
router.get('/my', rateLimitMiddleware.general, asyncHandler(transaccionBlockchainController.getMyTransactions.bind(transaccionBlockchainController)));

// GET /api/transactions/:id - Obtener transacción específica
//router.get('/:id', /*validationMiddleware.validateUUID('id'),*/ asyncHandler(transaccionBlockchainController.getTransaction.bind(transaccionBlockchainController)));

// POST /api/transactions/withdraw - Crear retiro
// Note: idempotency middleware is NOT wrapped with asyncHandler — it handles its own errors via next(err).
// Only the final controller handler is wrapped.
router.post('/withdraw', rateLimitMiddleware.withdrawal, joiValidate(transaccionBlockchainSchema.createWithdrawal), idempotency, asyncHandler(transaccionBlockchainController.createWithdrawal.bind(transaccionBlockchainController)));

// GET /api/transactions/balances - Obtener mis balances
//router.get('/balances', /*rateLimitMiddleware.general,*/ asyncHandler(transaccionBlockchainController.getMyBalances.bind(transaccionBlockchainController)));

// GET /api/transactions/deposit-address/:criptomonedaId - Obtener dirección de depósito
router.get('/deposit-address/:criptomonedaId', /*validationMiddleware.validateUUID('criptomonedaId'),*/ rateLimitMiddleware.general, asyncHandler(transaccionBlockchainController.getDepositAddress.bind(transaccionBlockchainController))); //Bien (En realidad está duplicada la ruta con una de "direccionDeposito")

// GET /api/transactions/tx/:hash - Buscar por hash
//router.get('/tx/:hash', /*validationMiddleware.validateTxHash,*/ asyncHandler(transaccionBlockchainController.getTransactionByHash.bind(transaccionBlockchainController)));

// =================== RUTAS ADMINISTRATIVAS ===================

// GET /api/admin/transactions - Todas las transacciones (admin)
//router.get('/admin/all',  /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.admin,*/ asyncHandler(transaccionBlockchainController.getAllTransactions.bind(transaccionBlockchainController)));

// GET /api/admin/transactions/pending - Transacciones pendientes
//router.get('/admin/pending', /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.admin,*/ asyncHandler(transaccionBlockchainController.getPendingTransactions.bind(transaccionBlockchainController)));

// POST /api/admin/transactions/:id/approve - Aprobar transacción
//router.post('/admin/:id/approve', /*authMiddleware.requireRole(['admin', 'super_admin']), validationMiddleware.validateUUID('id'),*/ rateLimitMiddleware.admin, asyncHandler(transaccionBlockchainController.approveTransaction.bind(transaccionBlockchainController)));

// POST /api/admin/transactions/:id/reject - Rechazar transacción
//router.post('/admin/:id/reject', /*authMiddleware.requireRole(['admin', 'super_admin']), validationMiddleware.validateUUID('id'),*/ validationMiddleware.validateRejection, rateLimitMiddleware.admin, asyncHandler(transaccionBlockchainController.rejectTransaction.bind(transaccionBlockchainController)));

// GET /api/admin/transactions/stats - Estadísticas
//router.get('/admin/stats',  /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.admin,*/ asyncHandler(transaccionBlockchainController.getTransactionStats.bind(transaccionBlockchainController)));

// =================== RUTAS DE SISTEMA ===================

// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #8): estas 3 rutas estaban
// comentadas — ahora sí llaman a algo real (BlockchainJobManager, ver el
// controller), así que tiene sentido exponerlas para disparar los jobs a
// demanda en vez de esperar al próximo intervalo.
// POST /api/system/scan-deposits - Escanear depósitos manualmente
router.post('/system/scan-deposits', requireRole(['admin', 'super_admin']), rateLimitMiddleware.system, asyncHandler(transaccionBlockchainController.scanDeposits.bind(transaccionBlockchainController)));

// POST /api/system/process-withdrawals - Procesar retiros manualmente
router.post('/system/process-withdrawals', requireRole(['admin', 'super_admin']), rateLimitMiddleware.system, asyncHandler(transaccionBlockchainController.processWithdrawals.bind(transaccionBlockchainController)));

// POST /api/system/update-confirmations - Actualizar confirmaciones
router.post('/system/update-confirmations', requireRole(['admin', 'super_admin']), rateLimitMiddleware.system, asyncHandler(transaccionBlockchainController.updateConfirmations.bind(transaccionBlockchainController)));

// GET /api/system/blockchain-status - Estado de servicios
//router.get('/system/blockchain-status',  /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.system,*/ asyncHandler(transaccionBlockchainController.getBlockchainStatus.bind(transaccionBlockchainController)));

module.exports = router;
