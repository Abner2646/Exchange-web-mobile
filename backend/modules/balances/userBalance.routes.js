// Balance usuario
// Prefijo de rutas: /balances

const express = require('express');
const router = express.Router();
const balanceUserController = require('./userBalance.controller');

// Middleware
const { authenticateToken } = require('../../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../../middleware/adminMiddleware.js');
const rateLimitMiddleware = require('../../middleware/rateLimit.middleware.js');
const idempotency = require('../../middleware/idempotency.middleware');
const requireOperatorMFA = require('../../middleware/operatorMFA.middleware');
const asyncHandler = require('../../utils/asyncHandler');

// =============== ÚTILES POR AHORA ===============
/**
 * @openapi
 * /balances/my/balances:
 *   get:
 *     tags: [Balances]
 *     summary: Mis balances (forma compartimentada aditiva)
 *     description: >
 *       Por cada cripto con cuenta, devuelve los totales de raíz (Funding + Spot),
 *       el desglose por compartimento y el objeto crypto.
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
 *             required: [cryptoId, amount, from, to]
 *             properties:
 *               cryptoId: { type: string, format: uuid }
 *               amount: { $ref: '#/components/schemas/MoneyString' }
 *               from: { type: string, enum: [funding, spot] }
 *               to: { type: string, enum: [funding, spot] }
 *     responses:
 *       200:
 *         description: Transferencia entre compartimentos completada
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// POST /api/balances/my/transfer - Transferir entre mis compartimentos (Funding↔Spot)
// Money-path → idempotencia obligatoria (mismo patrón que swap/withdraw/transferencia).
// idempotency NO se envuelve en asyncHandler (maneja sus propios errores vía next).
router.post('/my/transfer', authenticateToken, idempotency, asyncHandler(balanceUserController.transferMyCompartments));

/**
 * @openapi
 * /balances/user/{userId}/crypto/{cryptoId}:
 *   put:
 *     tags: [Balances]
 *     summary: Ajuste manual de balance (admin, operador + MFA)
 *     description: >
 *       Ajusta el balance de un usuario. Si la magnitud USD (calculada server-side) supera el umbral
 *       (`admin_balance_dual_control_usd_threshold`, default $5k) o el techo $20k, NO se aplica: se
 *       propone una acción Maker-Checker y se devuelve 202 (un checker distinto debe aprobarla con TOTP).
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: cryptoId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { $ref: '#/components/schemas/MoneyString' }
 *               type: { type: string, enum: [available, blocked], default: available }
 *     responses:
 *       200: { description: Balance ajustado inmediatamente (bajo umbral) }
 *       202:
 *         description: Ajuste grande → propuesto para doble control (pendiente de aprobación)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pending: { type: boolean, example: true }
 *                 actionId: { type: string, format: uuid }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// PUT /api/balances/user/:userId/crypto/:cryptoId - Actualizar balance
router.put('/user/:userId/crypto/:cryptoId', authenticateToken, isAdmin, requireOperatorMFA, asyncHandler(balanceUserController.updateBalance));
// {"amount": 100}

// PUT /api/reclamarBTC - Faucet de testnet (una sola vez por usuario, ver
// AUDITORIA_BACKEND.md Críticos #12). Se desactiva sola en producción
// (controller-level check) y ahora tiene rate limit.
router.put('/reclamarBTC', authenticateToken, rateLimitMiddleware.general, asyncHandler(balanceUserController.claimBtc));

/**
 * @openapi
 * /balances/testnet-faucet:
 *   post:
 *     tags: [Balances]
 *     summary: Reclamar fondos de prueba para preview y empleados (Testnet/Dev)
 *     description: Acredita saldo de prueba (USDT + BTC o token específico) a la billetera Funding del usuario autenticado. Deshabilitado en producción.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               symbol: { type: string, default: ALL, description: Símbolo del token o ALL para bundle inicial }
 *               amount: { type: string, default: "10000", description: Cantidad a acreditar }
 *     responses:
 *       200:
 *         description: Fondos de prueba acreditados exitosamente
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: No disponible en producción }
 */
router.post('/testnet-faucet', authenticateToken, rateLimitMiddleware.general, asyncHandler(balanceUserController.claimTestnetFaucet));

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

// GET /api/balances/user/:userId/crypto/:cryptoId - Balance específico usuario+crypto
router.get('/user/:userId/crypto/:cryptoId', authenticateToken, isAdmin, asyncHandler(balanceUserController.getBalanceByUserAndCrypto));

// GET /api/balances/user/:userId/crypto/:cryptoId/total - Balance total (disponible + bloqueado)
router.get('/user/:userId/crypto/:cryptoId/total', authenticateToken, isAdmin, asyncHandler(balanceUserController.getTotalBalance));

// GET /api/balances/user/:userId/crypto/:cryptoId/check - Verificar balance disponible
router.get('/user/:userId/crypto/:cryptoId/check', authenticateToken, isAdmin, asyncHandler(balanceUserController.checkAvailableBalance));

// =============== RUTAS DE MODIFICACIÓN (admin) ===============

/**
 * @openapi
 * /balances/user/{userId}/crypto/{cryptoId}/block:
 *   post:
 *     tags: [Balances]
 *     summary: Bloquear balance (admin, operador + MFA)
 *     description: Gran magnitud (USD server-side > umbral / techo $20k) → 202 doble control (Maker-Checker).
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: cryptoId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [amount], properties: { amount: { $ref: '#/components/schemas/MoneyString' } } }
 *     responses:
 *       200: { description: Balance bloqueado inmediatamente (bajo umbral) }
 *       202: { description: Bloqueo grande → propuesto para doble control (pendiente de aprobación) }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// POST /api/balances/user/:userId/crypto/:cryptoId/block - Bloquear balance
router.post('/user/:userId/crypto/:cryptoId/block', authenticateToken, isAdmin, requireOperatorMFA, asyncHandler(balanceUserController.blockBalance));

/**
 * @openapi
 * /balances/user/{userId}/crypto/{cryptoId}/unblock:
 *   post:
 *     tags: [Balances]
 *     summary: Desbloquear balance (admin, operador + MFA)
 *     description: Gran magnitud (USD server-side > umbral / techo $20k) → 202 doble control (Maker-Checker).
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: cryptoId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [amount], properties: { amount: { $ref: '#/components/schemas/MoneyString' } } }
 *     responses:
 *       200: { description: Balance desbloqueado inmediatamente (bajo umbral) }
 *       202: { description: Desbloqueo grande → propuesto para doble control (pendiente de aprobación) }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// POST /api/balances/user/:userId/crypto/:cryptoId/unblock - Desbloquear balance
router.post('/user/:userId/crypto/:cryptoId/unblock', authenticateToken, isAdmin, requireOperatorMFA, asyncHandler(balanceUserController.unblockBalance));

/**
 * @openapi
 * /balances/transfer:
 *   post:
 *     tags: [Balances]
 *     summary: Transferir balance entre usuarios (admin, operador + MFA)
 *     description: >
 *       Mueve fondos disponibles de un usuario a otro. Gran magnitud (USD server-side > umbral / techo
 *       $20k) → NO se mueve nada: se devuelve 202 y un checker distinto debe aprobar con TOTP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromUserId, toUserId, cryptoId, amount]
 *             properties:
 *               fromUserId: { type: string, format: uuid }
 *               toUserId: { type: string, format: uuid }
 *               cryptoId: { type: string, format: uuid }
 *               amount: { $ref: '#/components/schemas/MoneyString' }
 *     responses:
 *       200: { description: Transferencia completada inmediatamente (bajo umbral) }
 *       202: { description: Transferencia grande → propuesta para doble control (pendiente de aprobación) }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
// POST /api/balances/transfer - Transferir balance entre usuarios
router.post('/transfer', authenticateToken, isAdmin, requireOperatorMFA, asyncHandler(balanceUserController.transferBalance));

// RUTAS POR CRIPTOMONEDA
// GET /api/balances/crypto/:cryptoId/users - Usuarios con balance en una criptomoneda
// Fix: faltaba authenticateToken antes de isAdmin (isAdmin sin req.user rechazaba
// hasta a un admin válido → la ruta estaba de hecho rota). Agregado.
router.get('/crypto/:cryptoId/users', authenticateToken, isAdmin, asyncHandler(balanceUserController.getUsersWithBalance));

module.exports = router;
