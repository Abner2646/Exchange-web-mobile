// Balance usuario
// Prefijo de rutas: /balances

const express = require('express');
const router = express.Router();
const balanceUserController = require('../controllers/balanceUsuario.controller');

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');
const rateLimitMiddleware = require('../middleware/rateLimit.middleware.js');
const idempotency = require('../middleware/idempotency.middleware');
const asyncHandler = require('../utils/asyncHandler');

// =============== ÚTILES POR AHORA ===============
/**
 * @openapi
 * /balances/my/balances:
 *   get:
 *     tags: [Balances]
 *     summary: Mis balances (forma compartimentada aditiva)
 *     description: >
 *       Por cada cripto con cuenta, devuelve los totales de raíz (Funding + Spot),
 *       el desglose por compartimento y el objeto criptomoneda.
 *     responses:
 *       200:
 *         description: Lista de balances del usuario autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/BalanceEntry' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// GET /api/balances/my/balances - Obtener mis balances
router.get('/my/balances', authenticateToken, asyncHandler(balanceUserController.getMyBalances));

/**
 * @openapi
 * /balances/my/transfer:
 *   post:
 *     tags: [Balances]
 *     summary: Transferir entre mis compartimentos (Funding↔Spot)
 *     description: Self-service (el userId sale del token). Requiere header Idempotency-Key.
 *     parameters:
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: Clave de idempotencia (una por intención de transferencia).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [criptomonedaId, cantidad, origen, destino]
 *             properties:
 *               criptomonedaId: { type: string, format: uuid }
 *               cantidad: { $ref: '#/components/schemas/MoneyString' }
 *               origen: { type: string, enum: [funding, spot] }
 *               destino: { type: string, enum: [funding, spot] }
 *     responses:
 *       200:
 *         description: Transferencia entre compartimentos completada
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// POST /api/balances/my/transfer - Transferir entre mis compartimentos (Funding↔Spot)
// Money-path → idempotencia obligatoria (mismo patrón que swap/withdraw/transferencia).
// idempotency NO se envuelve en asyncHandler (maneja sus propios errores vía next).
router.post('/my/transfer', authenticateToken, idempotency, asyncHandler(balanceUserController.transferMisCompartimentos));

// PUT /api/balances/user/:userId/crypto/:criptomonedaId - Actualizar balance
router.put('/user/:userId/crypto/:criptomonedaId', authenticateToken, isAdmin, asyncHandler(balanceUserController.updateBalance));
// {"amount": 100}

// PUT /api/reclamarBTC - Faucet de testnet (una sola vez por usuario, ver
// AUDITORIA_BACKEND.md Críticos #12). Se desactiva sola en producción
// (controller-level check) y ahora tiene rate limit.
router.put('/reclamarBTC', authenticateToken, rateLimitMiddleware.general, asyncHandler(balanceUserController.reclamarBtc));

// =============== NO TESTEADO ===============

// RUTAS PÚBLICAS/ADMIN
// GET /api/balances - Listar todos los balances (admin)
router.get('/', authenticateToken, isAdmin, asyncHandler(balanceUserController.getBalances));

// GET /api/balances/stats - Estadísticas de balances (admin)
router.get('/stats', authenticateToken, isSuperAdmin, asyncHandler(balanceUserController.getBalanceStats));

// (GET /api/balances/:id retirado en el write-flip Paso B: lectura por PK de fila
// de balances_users, sin analogo en el ledger.)

// =============== RUTAS DE USUARIO AUTENTICADO ===============

// RUTAS POR USUARIO
// GET /api/balances/user/:userId - Obtener balances de un usuario específico
router.get('/user/:userId', authenticateToken, isAdmin, asyncHandler(balanceUserController.getBalancesByUser));

// GET /api/balances/user/:userId/crypto/:criptomonedaId - Balance específico usuario+crypto
router.get('/user/:userId/crypto/:criptomonedaId', authenticateToken, isAdmin, asyncHandler(balanceUserController.getBalanceByUserAndCrypto));

// GET /api/balances/user/:userId/crypto/:criptomonedaId/total - Balance total (disponible + bloqueado)
router.get('/user/:userId/crypto/:criptomonedaId/total', authenticateToken, isAdmin, asyncHandler(balanceUserController.getTotalBalance));

// GET /api/balances/user/:userId/crypto/:criptomonedaId/check - Verificar balance disponible
router.get('/user/:userId/crypto/:criptomonedaId/check', authenticateToken, isAdmin, asyncHandler(balanceUserController.checkAvailableBalance));

// =============== RUTAS DE MODIFICACIÓN (admin) ===============

// POST /api/balances/user/:userId/crypto/:criptomonedaId/block - Bloquear balance
router.post('/user/:userId/crypto/:criptomonedaId/block', authenticateToken, isAdmin, asyncHandler(balanceUserController.blockBalance));

// POST /api/balances/user/:userId/crypto/:criptomonedaId/unblock - Desbloquear balance
router.post('/user/:userId/crypto/:criptomonedaId/unblock', authenticateToken, isAdmin, asyncHandler(balanceUserController.unblockBalance));

// POST /api/balances/transfer - Transferir balance entre usuarios
router.post('/transfer', authenticateToken, isAdmin, asyncHandler(balanceUserController.transferBalance));

// RUTAS POR CRIPTOMONEDA
// GET /api/balances/crypto/:criptomonedaId/users - Usuarios con balance en una crypto
// Fix: faltaba authenticateToken antes de isAdmin (isAdmin sin req.user rechazaba
// hasta a un admin válido → la ruta estaba de hecho rota). Agregado.
router.get('/crypto/:criptomonedaId/users', authenticateToken, isAdmin, asyncHandler(balanceUserController.getUsersWithBalance));

module.exports = router;
