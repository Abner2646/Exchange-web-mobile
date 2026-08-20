// routes/transaccionBlockchain.routes.js
const express = require('express');
const router = express.Router();
const transaccionBlockchainController = require('../controllers/transaccionBlockchain.controller');
const {authenticateToken, requireEmailVerified} = require('../middleware/authMiddleware');
// Antes apuntaba por error a rateLimit.middleware (mismo módulo que
// rateLimitMiddleware) — validateUUID nunca existió ahí, solo en
// validation.middleware.js. Ver AUDITORIA_BACKEND.md Altos #11.
const validationMiddleware = require('../middleware/validation.middleware');
const rateLimitMiddleware = require('../middleware/rateLimit.middleware');
const { joiValidate } = require('../middleware/joiValidate.middleware');
const transaccionBlockchainSchema = require('../schemas/transaccionBlockchain.schema');

// =================== RUTAS PÚBLICAS (con auth) ===================

// Aplicar autenticación y email verificado a todas las rutas
router.use(authenticateToken, requireEmailVerified);

// GET /api/transactions/my - Obtener mis transacciones
router.get('/my', /*rateLimitMiddleware.general,*/ transaccionBlockchainController.getMyTransactions);

// GET /api/transactions/:id - Obtener transacción específica
//router.get('/:id', /*validationMiddleware.validateUUID('id'),*/ transaccionBlockchainController.getTransaction);

// POST /api/transactions/withdraw - Crear retiro
router.post('/withdraw', /*rateLimitMiddleware.withdrawal,*/ joiValidate(transaccionBlockchainSchema.createWithdrawal), transaccionBlockchainController.createWithdrawal);

// GET /api/transactions/balances - Obtener mis balances
//router.get('/balances', /*rateLimitMiddleware.general,*/ transaccionBlockchainController.getMyBalances);

// GET /api/transactions/deposit-address/:criptomonedaId - Obtener dirección de depósito
router.get('/deposit-address/:criptomonedaId', /*validationMiddleware.validateUUID('criptomonedaId'), rateLimitMiddleware.general,*/ transaccionBlockchainController.getDepositAddress); //Bien (En realidad está duplicada la ruta con una de "direccionDeposito")

// GET /api/transactions/tx/:hash - Buscar por hash
//router.get('/tx/:hash', /*validationMiddleware.validateTxHash,*/ transaccionBlockchainController.getTransactionByHash);

// =================== RUTAS ADMINISTRATIVAS ===================

// GET /api/admin/transactions - Todas las transacciones (admin)
//router.get('/admin/all',  /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.admin,*/ transaccionBlockchainController.getAllTransactions);

// GET /api/admin/transactions/pending - Transacciones pendientes
//router.get('/admin/pending', /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.admin,*/ transaccionBlockchainController.getPendingTransactions);

// POST /api/admin/transactions/:id/approve - Aprobar transacción
//router.post('/admin/:id/approve', /*authMiddleware.requireRole(['admin', 'super_admin']), validationMiddleware.validateUUID('id'),*/ rateLimitMiddleware.admin, transaccionBlockchainController.approveTransaction);

// POST /api/admin/transactions/:id/reject - Rechazar transacción
//router.post('/admin/:id/reject', /*authMiddleware.requireRole(['admin', 'super_admin']), validationMiddleware.validateUUID('id'),*/ validationMiddleware.validateRejection, rateLimitMiddleware.admin, transaccionBlockchainController.rejectTransaction);

// GET /api/admin/transactions/stats - Estadísticas
//router.get('/admin/stats',  /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.admin,*/ transaccionBlockchainController.getTransactionStats);

// =================== RUTAS DE SISTEMA ===================

// POST /api/system/scan-deposits - Escanear depósitos manualmente
//router.post('/system/scan-deposits',  /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.system,*/ transaccionBlockchainController.scanDeposits);

// POST /api/system/process-withdrawals - Procesar retiros manualmente
//router.post('/system/process-withdrawals',  /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.system,*/ transaccionBlockchainController.processWithdrawals);

// POST /api/system/update-confirmations - Actualizar confirmaciones
//router.post('/system/update-confirmations',  /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.system,*/ transaccionBlockchainController.updateConfirmations);

// GET /api/system/blockchain-status - Estado de servicios
//router.get('/system/blockchain-status',  /*authMiddleware.requireRole(['admin', 'super_admin']), rateLimitMiddleware.system,*/ transaccionBlockchainController.getBlockchainStatus);

module.exports = router;