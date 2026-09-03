// routes/intercambioExchange.routes.js
// Prefijo: /intercambioExchange

const express = require('express');
const router = express.Router();
const intercambioController = require('../controllers/intercambioExchange.controller');
const { authenticateToken, requireEmailVerified } = require('../middleware/authMiddleware');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware');
const idempotency = require('../middleware/idempotency.middleware');
const asyncHandler = require('../utils/asyncHandler');

// ================================
// RUTAS PÚBLICAS
// ================================

/**
 * @openapi
 * /intercambioExchange/pairs/{parId}/price-history:
 *   get:
 *     tags: [Exchange (swap)]
 *     summary: Historial de precios de un par (público)
 *     security: []
 *     parameters:
 *       - { in: path, name: parId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: fechaDesde, schema: { type: string, format: date-time } }
 *       - { in: query, name: fechaHasta, schema: { type: string, format: date-time } }
 *       - { in: query, name: limit, schema: { type: integer, default: 1000 } }
 *       - { in: query, name: order, schema: { type: string, enum: [ASC, DESC], default: DESC } }
 *     responses:
 *       200: { description: Serie de precios }
 */
router.get('/pairs/:parId/price-history', asyncHandler(intercambioController.getPriceHistory));

/**
 * @openapi
 * /intercambioExchange/pairs/{parId}/last-price:
 *   get:
 *     tags: [Exchange (swap)]
 *     summary: Último precio de un par (público)
 *     security: []
 *     parameters:
 *       - { in: path, name: parId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Último precio }
 */
router.get('/pairs/:parId/last-price', asyncHandler(intercambioController.getLastPrice));

/**
 * @openapi
 * /intercambioExchange/pairs/{parId}/volume:
 *   get:
 *     tags: [Exchange (swap)]
 *     summary: Volumen operado de un par (público)
 *     security: []
 *     parameters:
 *       - { in: path, name: parId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: fechaDesde, schema: { type: string, format: date-time } }
 *       - { in: query, name: fechaHasta, schema: { type: string, format: date-time } }
 *       - { in: query, name: estado, schema: { type: string } }
 *     responses:
 *       200: { description: Volumen }
 */
router.get('/pairs/:parId/volume', asyncHandler(intercambioController.getVolumeByPair));

// ================================
// RUTAS AUTENTICADAS (JWT + email verificado)
// ================================
router.use(authenticateToken, requireEmailVerified);

/**
 * @openapi
 * /intercambioExchange:
 *   post:
 *     tags: [Exchange (swap)]
 *     summary: Ejecutar un swap (compra/venta contra la casa)
 *     description: Money-path. Requiere header Idempotency-Key. Debita/acredita en el compartimento indicado (funding por default).
 *     parameters:
 *       - { in: header, name: Idempotency-Key, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [parId, tipo, cantidadBase]
 *             properties:
 *               parId: { type: string, format: uuid }
 *               tipo: { type: string, enum: [compra, venta] }
 *               cantidadBase: { type: number, example: 0.5 }
 *               compartimento: { type: string, enum: [funding, spot], default: funding }
 *     responses:
 *       201: { description: Swap ejecutado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/BadRequest' }
 */
router.post('/', idempotency, asyncHandler(intercambioController.createOrder));

/**
 * @openapi
 * /intercambioExchange/calculate:
 *   post:
 *     tags: [Exchange (swap)]
 *     summary: Preview de un swap (mismo cálculo que la ejecución)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [parId, cantidadBase, tipo]
 *             properties:
 *               parId: { type: string, format: uuid }
 *               cantidadBase: { type: number, example: 0.5 }
 *               tipo: { type: string, enum: [compra, venta] }
 *     responses:
 *       200: { description: Cálculo del swap (montos como strings) }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post('/calculate', asyncHandler(intercambioController.calculateExchange));

/**
 * @openapi
 * /intercambioExchange/check-limit:
 *   post:
 *     tags: [Exchange (swap)]
 *     summary: Verificar el límite diario disponible para un monto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cantidadQuote]
 *             properties:
 *               cantidadQuote: { type: number, example: 1000.50 }
 *     responses:
 *       200: { description: Resultado del chequeo de límite }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.post('/check-limit', asyncHandler(intercambioController.checkTransactionLimit));

/**
 * @openapi
 * /intercambioExchange/me:
 *   get:
 *     tags: [Exchange (swap)]
 *     summary: Mis intercambios
 *     parameters:
 *       - { in: query, name: tipo, schema: { type: string, enum: [compra, venta] } }
 *       - { in: query, name: estado, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50 } }
 *       - { in: query, name: offset, schema: { type: integer, default: 0 } }
 *       - { in: query, name: parId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Lista de intercambios del usuario }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me', asyncHandler(intercambioController.getMyIntercambios));

/**
 * @openapi
 * /intercambioExchange/me/balances:
 *   get:
 *     tags: [Exchange (swap)]
 *     summary: Mis balances (forma compartimentada unificada)
 *     responses:
 *       200:
 *         description: Balances del usuario (misma forma que /balances/my/balances)
 *         content:
 *           application/json:
 *             schema: { type: array, items: { $ref: '#/components/schemas/BalanceEntry' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me/balances', asyncHandler(intercambioController.getMyBalances));

/**
 * @openapi
 * /intercambioExchange/me/daily-volume:
 *   get:
 *     tags: [Exchange (swap)]
 *     summary: Mi volumen diario
 *     parameters:
 *       - { in: query, name: date, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: Volumen diario }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me/daily-volume', asyncHandler(intercambioController.getMyDailyVolume));

/**
 * @openapi
 * /intercambioExchange/me/summary:
 *   get:
 *     tags: [Exchange (swap)]
 *     summary: Resumen de mi actividad de trading
 *     parameters:
 *       - { in: query, name: period, schema: { type: string, example: day } }
 *     responses:
 *       200: { description: Resumen }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/me/summary', asyncHandler(intercambioController.getMyTradingSummary));

// ================================
// RUTAS ADMINISTRATIVAS (requieren rol admin)
// ================================
router.use(isAdmin);

/**
 * @openapi
 * /intercambioExchange:
 *   get:
 *     tags: [Exchange (swap) - admin]
 *     summary: Listar todos los intercambios (admin)
 *     parameters:
 *       - { in: query, name: estado, schema: { type: string } }
 *       - { in: query, name: tipo, schema: { type: string, enum: [compra, venta] } }
 *       - { in: query, name: usuarioId, schema: { type: string, format: uuid } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50 } }
 *       - { in: query, name: offset, schema: { type: integer, default: 0 } }
 *     responses:
 *       200: { description: Lista de intercambios }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
router.get('/', asyncHandler(intercambioController.getIntercambios));

/**
 * @openapi
 * /intercambioExchange/search:
 *   get:
 *     tags: [Exchange (swap) - admin]
 *     summary: Buscar intercambios (admin)
 *     parameters:
 *       - { in: query, name: q, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *     responses:
 *       200: { description: Resultados }
 */
router.get('/search', asyncHandler(intercambioController.searchIntercambios));

/**
 * @openapi
 * /intercambioExchange/stats:
 *   get:
 *     tags: [Exchange (swap) - admin]
 *     summary: Estadísticas de intercambios (admin)
 *     responses:
 *       200: { description: Estadísticas }
 */
router.get('/stats', asyncHandler(intercambioController.getIntercambioStats));

/**
 * @openapi
 * /intercambioExchange/{id}:
 *   get:
 *     tags: [Exchange (swap) - admin]
 *     summary: Obtener un intercambio por id (admin)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Intercambio }
 *       404: { $ref: '#/components/responses/BadRequest' }
 */
router.get('/:id', asyncHandler(intercambioController.getIntercambioById));

/**
 * @openapi
 * /intercambioExchange/{id}/status:
 *   put:
 *     tags: [Exchange (swap) - admin]
 *     summary: Cambiar el estado de un intercambio (admin)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newStatus]
 *             properties:
 *               newStatus: { type: string, example: completado }
 *     responses:
 *       200: { description: Estado actualizado }
 *       400: { $ref: '#/components/responses/BadRequest' }
 */
router.put('/:id/status', asyncHandler(intercambioController.updateIntercambioStatus));

/**
 * @openapi
 * /intercambioExchange/analytics/top-traders:
 *   get:
 *     tags: [Exchange (swap) - admin]
 *     summary: Top traders (admin)
 *     parameters:
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *       - { in: query, name: period, schema: { type: string, example: 30d } }
 *     responses:
 *       200: { description: Top traders }
 */
router.get('/analytics/top-traders', asyncHandler(intercambioController.getTopTraders));

/**
 * @openapi
 * /intercambioExchange/analytics/market-summary:
 *   get:
 *     tags: [Exchange (swap) - admin]
 *     summary: Resumen de mercado (admin)
 *     parameters:
 *       - { in: query, name: parId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Resumen de mercado }
 */
router.get('/analytics/market-summary', asyncHandler(intercambioController.getMarketSummary));

/**
 * @openapi
 * /intercambioExchange/analytics/stats-by-crypto:
 *   get:
 *     tags: [Exchange (swap) - admin]
 *     summary: Estadísticas por cripto (admin)
 *     parameters:
 *       - { in: query, name: fechaDesde, schema: { type: string, format: date-time } }
 *       - { in: query, name: fechaHasta, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Estadísticas por cripto }
 */
router.get('/analytics/stats-by-crypto', asyncHandler(intercambioController.getStatsByCrypto));

module.exports = router;
