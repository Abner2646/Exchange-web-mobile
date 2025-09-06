const express = require('express');
const router = express.Router();
const balanceUserController = require('../controllers/balanceUsuario.controller');

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// RUTAS PÚBLICAS/ADMIN
// GET /api/balances - Listar todos los balances (admin)
router.get('/', isAdmin, balanceUserController.getBalances);

// GET /api/balances/stats - Estadísticas de balances (admin)
router.get('/stats', isAdmin, balanceUserController.getBalanceStats);

// GET /api/balances/:id - Obtener balance por ID (admin)
router.get('/:id', isAdmin, balanceUserController.getBalanceById);

// RUTAS DE USUARIO AUTENTICADO
// GET /api/balances/my/balances - Obtener mis balances
router.get('/my/balances', authenticateToken, balanceUserController.getMyBalances); //Bien

// RUTAS POR USUARIO
// GET /api/balances/user/:userId - Obtener balances de un usuario específico
router.get('/user/:userId', authenticateToken, balanceUserController.getBalancesByUser);

// GET /api/balances/user/:userId/crypto/:criptomonedaId - Balance específico usuario+crypto
router.get('/user/:userId/crypto/:criptomonedaId', authenticateToken, balanceUserController.getBalanceByUserAndCrypto);

// GET /api/balances/user/:userId/crypto/:criptomonedaId/total - Balance total (disponible + bloqueado)
router.get('/user/:userId/crypto/:criptomonedaId/total', authenticateToken, balanceUserController.getTotalBalance);

// GET /api/balances/user/:userId/crypto/:criptomonedaId/check - Verificar balance disponible
router.get('/user/:userId/crypto/:criptomonedaId/check', authenticateToken, balanceUserController.checkAvailableBalance);

// RUTAS DE MODIFICACIÓN
// PUT /api/balances/user/:userId/crypto/:criptomonedaId - Actualizar balance
router.put('/user/:userId/crypto/:criptomonedaId', authenticateToken, balanceUserController.updateBalance);

// POST /api/balances/user/:userId/crypto/:criptomonedaId/block - Bloquear balance
router.post('/user/:userId/crypto/:criptomonedaId/block', authenticateToken, balanceUserController.blockBalance);

// POST /api/balances/user/:userId/crypto/:criptomonedaId/unblock - Desbloquear balance
router.post('/user/:userId/crypto/:criptomonedaId/unblock', authenticateToken, balanceUserController.unblockBalance);

// POST /api/balances/transfer - Transferir balance entre usuarios
router.post('/transfer', authenticateToken, balanceUserController.transferBalance);

// RUTAS POR CRIPTOMONEDA
// GET /api/balances/crypto/:criptomonedaId/users - Usuarios con balance en una crypto
router.get('/crypto/:criptomonedaId/users', isAdmin, balanceUserController.getUsersWithBalance);

module.exports = router;