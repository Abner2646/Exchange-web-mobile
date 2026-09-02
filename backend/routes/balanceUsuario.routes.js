// Balance usuario 
// Prefijo de rutas: /balances

const express = require('express');
const router = express.Router();
const balanceUserController = require('../controllers/balanceUsuario.controller');

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');
const rateLimitMiddleware = require('../middleware/rateLimit.middleware.js');

// =============== ÚTILES POR AHORA ===============
// GET /api/balances/my/balances - Obtener mis balances
router.get('/my/balances', authenticateToken, balanceUserController.getMyBalances); // Bien

// POST /api/balances/my/transfer - Transferir entre mis compartimentos (Funding↔Spot)
router.post('/my/transfer', authenticateToken, balanceUserController.transferMisCompartimentos);

// PUT /api/balances/user/:userId/crypto/:criptomonedaId - Actualizar balance
router.put('/user/:userId/crypto/:criptomonedaId', authenticateToken, isAdmin, balanceUserController.updateBalance); // Bien
// {"amount": 100}

// PUT /api/reclamarBTC - Faucet de testnet (una sola vez por usuario, ver
// AUDITORIA_BACKEND.md Críticos #12). Se desactiva sola en producción
// (controller-level check) y ahora tiene rate limit.
router.put('/reclamarBTC', authenticateToken, rateLimitMiddleware.general, balanceUserController.reclamarBtc);

// =============== NO TESTEADO ===============

// RUTAS PÚBLICAS/ADMIN
// GET /api/balances - Listar todos los balances (admin)
router.get('/', authenticateToken, isAdmin, balanceUserController.getBalances); // Bien

// GET /api/balances/stats - Estadísticas de balances (admin)
router.get('/stats', authenticateToken, isSuperAdmin, balanceUserController.getBalanceStats); // Bien

// (GET /api/balances/:id retirado en el write-flip Paso B: lectura por PK de fila
// de balances_users, sin analogo en el ledger.)

// =============== RUTAS DE USUARIO AUTENTICADO ===============

// RUTAS POR USUARIO
// GET /api/balances/user/:userId - Obtener balances de un usuario específico
router.get('/user/:userId', authenticateToken, isAdmin, balanceUserController.getBalancesByUser);

// GET /api/balances/user/:userId/crypto/:criptomonedaId - Balance específico usuario+crypto
router.get('/user/:userId/crypto/:criptomonedaId', authenticateToken, isAdmin, balanceUserController.getBalanceByUserAndCrypto);

// GET /api/balances/user/:userId/crypto/:criptomonedaId/total - Balance total (disponible + bloqueado)
router.get('/user/:userId/crypto/:criptomonedaId/total', authenticateToken, isAdmin, balanceUserController.getTotalBalance);

// GET /api/balances/user/:userId/crypto/:criptomonedaId/check - Verificar balance disponible
router.get('/user/:userId/crypto/:criptomonedaId/check', authenticateToken, isAdmin, balanceUserController.checkAvailableBalance);

// =============== RUTAS DE MODIFICACIÓN (admin) ===============

// POST /api/balances/user/:userId/crypto/:criptomonedaId/block - Bloquear balance
router.post('/user/:userId/crypto/:criptomonedaId/block', authenticateToken, isAdmin, balanceUserController.blockBalance);

// POST /api/balances/user/:userId/crypto/:criptomonedaId/unblock - Desbloquear balance
router.post('/user/:userId/crypto/:criptomonedaId/unblock', authenticateToken, isAdmin, balanceUserController.unblockBalance);

// POST /api/balances/transfer - Transferir balance entre usuarios
router.post('/transfer', authenticateToken, isAdmin, balanceUserController.transferBalance);

// RUTAS POR CRIPTOMONEDA
// GET /api/balances/crypto/:criptomonedaId/users - Usuarios con balance en una crypto
router.get('/crypto/:criptomonedaId/users', isAdmin, balanceUserController.getUsersWithBalance);

module.exports = router;