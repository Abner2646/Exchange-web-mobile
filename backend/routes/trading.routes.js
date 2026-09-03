// routes/trading.routes.js
const express = require('express');
const router = express.Router();
const tradingController = require('../controllers/trading.controller');
const tradesController = require('../controllers/trades.controller');
const tradingPairsController = require('../controllers/tradingPairs.controller');
const { authenticateToken, requireEmailVerified } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validation.middleware');
const idempotency = require('../middleware/idempotency.middleware');
const asyncHandler = require('../utils/asyncHandler');

// Rate limiting
const tradingRateLimit = require('express-rate-limit')({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Demasiadas solicitudes, intenta de nuevo más tarde'
});

// Anotaciones OpenAPI del dominio Trading (order book). Bloque único por archivo
// (swagger-jsdoc lo parsea esté donde esté) para no tocar la lógica de las rutas,
// que acá tienen cadenas de validadores express-validator. Al cambiar un endpoint,
// actualizar su path acá.
/**
 * @openapi
 * /trading/orders:
 *   post:
 *     tags: [Trading (order book)]
 *     summary: Crear una orden (market/limit/stop). Money-path — requiere Idempotency-Key.
 *     parameters:
 *       - { in: header, name: Idempotency-Key, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tradingPairId, orderType, side, quantity]
 *             properties:
 *               tradingPairId: { type: string, format: uuid }
 *               orderType: { type: string, enum: [market, limit, stop_limit, stop_market] }
 *               side: { type: string, enum: [buy, sell] }
 *               quantity: { type: number, example: 1.5 }
 *               price: { type: number, example: 45000.5 }
 *               stopPrice: { type: number }
 *               timeInForce: { type: string, enum: [GTC, IOC, FOK] }
 *               clientOrderId: { type: string }
 *     responses:
 *       201: { description: Orden creada }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Mis órdenes
 *     responses: { 200: { description: Lista de órdenes }, 401: { $ref: '#/components/responses/Unauthorized' } }
 * /trading/orders/active:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Mis órdenes activas
 *     responses: { 200: { description: Órdenes activas } }
 * /trading/orders/{orderId}:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Detalle de una orden
 *     parameters: [{ in: path, name: orderId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Orden }, 404: { $ref: '#/components/responses/BadRequest' } }
 *   delete:
 *     tags: [Trading (order book)]
 *     summary: Cancelar una orden
 *     parameters: [{ in: path, name: orderId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Orden cancelada }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /trading/orderbook/{tradingPairId}:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Order book de un par (público)
 *     security: []
 *     parameters: [{ in: path, name: tradingPairId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Order book } }
 * /trading/orderbook/{tradingPairId}/stats:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Estadísticas del order book (público)
 *     security: []
 *     parameters: [{ in: path, name: tradingPairId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Stats } }
 * /trading/spread/{tradingPairId}:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Spread de un par (público)
 *     security: []
 *     parameters: [{ in: path, name: tradingPairId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Spread } }
 * /trading/balance:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Mi balance de trading (compartimento Spot)
 *     responses: { 200: { description: Balance }, 401: { $ref: '#/components/responses/Unauthorized' } }
 * /trading/trades/{tradingPairId}:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Trades recientes de un par (público)
 *     security: []
 *     parameters: [{ in: path, name: tradingPairId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Trades recientes } }
 * /trading/trades/user/all:
 *   get: { tags: [Trading (order book)], summary: Mis trades, responses: { 200: { description: Trades del usuario } } }
 * /trading/trades/user/stats:
 *   get: { tags: [Trading (order book)], summary: Estadísticas de mis trades, responses: { 200: { description: Stats } } }
 * /trading/trades/detail/{tradeId}:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Detalle de un trade
 *     parameters: [{ in: path, name: tradeId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Trade } }
 * /trading/chart/{tradingPairId}:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Datos de gráfico (velas) de un par (público)
 *     security: []
 *     parameters:
 *       - { in: path, name: tradingPairId, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: interval, schema: { type: string, enum: [1m,5m,15m,30m,1h,4h,1d,1w] } }
 *     responses: { 200: { description: Velas } }
 * /trading/chart/{tradingPairId}/binance:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Datos de gráfico desde Binance (público)
 *     security: []
 *     parameters: [{ in: path, name: tradingPairId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Velas } }
 * /trading/stats/{tradingPairId}:
 *   get:
 *     tags: [Trading (order book)]
 *     summary: Estadísticas de un par (público)
 *     security: []
 *     parameters: [{ in: path, name: tradingPairId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Stats } }
 * /trading/volume:
 *   get: { tags: [Trading (order book)], summary: Volumen global (público), security: [], responses: { 200: { description: Volumen } } }
 * /trading/tickers:
 *   get: { tags: [Trading (order book)], summary: Tickers (público), security: [], responses: { 200: { description: Tickers } } }
 * /trading/summary:
 *   get: { tags: [Trading (order book)], summary: Resumen de mi trading, responses: { 200: { description: Resumen } } }
 * /trading/pairs:
 *   get: { tags: [Trading (pares)], summary: Listar pares (público), security: [], responses: { 200: { description: Pares } } }
 *   post:
 *     tags: [Trading (pares) - admin]
 *     summary: Crear un par de trading (super admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [symbol, baseAssetId, quoteAssetId]
 *             properties:
 *               symbol: { type: string, example: ETH/USDT }
 *               baseAssetId: { type: string, format: uuid }
 *               quoteAssetId: { type: string, format: uuid }
 *               makerFeePercent: { type: number }
 *               takerFeePercent: { type: number }
 *     responses: { 201: { description: Par creado } }
 * /trading/pairs/active:
 *   get: { tags: [Trading (pares)], summary: Pares activos (público), security: [], responses: { 200: { description: Pares activos } } }
 * /trading/pairs/top:
 *   get: { tags: [Trading (pares)], summary: Top pares (público), security: [], responses: { 200: { description: Top pares } } }
 * /trading/pairs/stats:
 *   get: { tags: [Trading (pares)], summary: Estadísticas de pares (público), security: [], responses: { 200: { description: Stats } } }
 * /trading/pairs/symbol/{symbol}:
 *   get:
 *     tags: [Trading (pares)]
 *     summary: Par por símbolo (público)
 *     security: []
 *     parameters: [{ in: path, name: symbol, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Par } }
 * /trading/pairs/{pairId}:
 *   get:
 *     tags: [Trading (pares)]
 *     summary: Detalle de un par (público)
 *     security: []
 *     parameters: [{ in: path, name: pairId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Par } }
 *   put:
 *     tags: [Trading (pares) - admin]
 *     summary: Actualizar un par (super admin)
 *     parameters: [{ in: path, name: pairId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Par actualizado } }
 * /trading/pairs/auto-create:
 *   post:
 *     tags: [Trading (pares) - admin]
 *     summary: Auto-crear pares contra stablecoins/BTC/ETH (super admin)
 *     responses: { 200: { description: Pares creados } }
 * /trading/pairs/{pairId}/status:
 *   patch:
 *     tags: [Trading (pares) - admin]
 *     summary: Cambiar el estado de un par (super admin)
 *     parameters: [{ in: path, name: pairId, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [status], properties: { status: { type: string, enum: [active, paused, delisted] } } }
 *     responses: { 200: { description: Estado actualizado } }
 */

// ================================
// RUTAS DE ÓRDENES
// ================================

router.post('/orders', // Bien
  authenticateToken,
  tradingRateLimit,
  [
    body('tradingPairId').isUUID().withMessage('Trading pair ID inválido'),
    body('orderType').isIn(['market', 'limit', 'stop_limit', 'stop_market']).withMessage('Tipo de orden inválido'),
    body('side').isIn(['buy', 'sell']).withMessage('Lado inválido'),
    body('quantity').isFloat({ gt: 0 }).withMessage('Cantidad debe ser mayor a 0'),
    body('price').optional().isFloat({ gt: 0 }).withMessage('Precio debe ser mayor a 0'),
    body('stopPrice').optional().isFloat({ gt: 0 }).withMessage('Stop price debe ser mayor a 0'),
    body('timeInForce').optional().isIn(['GTC', 'IOC', 'FOK']).withMessage('Time in force inválido')
  ],
  validate,
  idempotency,
  asyncHandler(tradingController.createOrder)
);
/*
{
  "tradingPairId": "123e4567-e89b-12d3-a456-426614174000",
  "orderType": "limit",
  "side": "buy",
  "quantity": 1.5,
  "price": 45000.50,
  "stopPrice": null,
  "timeInForce": "GTC",
  "clientOrderId": "order_123456"
}
*/

router.delete('/orders/:orderId',
  authenticateToken,
  [param('orderId').isUUID().withMessage('Order ID inválido')],
  validate,
  tradingController.cancelOrder
);

router.get('/orders', // Bien
  authenticateToken,
  tradingController.getUserOrders
);

router.get('/orders/active',
  authenticateToken,
  tradingController.getUserActiveOrders
);

router.get('/orders/:orderId',
  authenticateToken,
  [param('orderId').isUUID().withMessage('Order ID inválido')],
  validate,
  tradingController.getOrderDetail
);

// ================================
// RUTAS DE ORDER BOOK
// ================================

router.get('/orderbook/:tradingPairId',
  [param('tradingPairId').isUUID().withMessage('Trading pair ID inválido')],
  validate,
  tradingController.getOrderBook
);

router.get('/orderbook/:tradingPairId/stats',
  [param('tradingPairId').isUUID().withMessage('Trading pair ID inválido')],
  validate,
  tradingController.getOrderBookStats
);

router.get('/spread/:tradingPairId',
  [param('tradingPairId').isUUID().withMessage('Trading pair ID inválido')],
  validate,
  tradingController.getSpread
);

// ================================
// RUTAS DE BALANCE
// ================================

router.get('/balance',
  authenticateToken,
  tradingController.getTradingBalance
);

// ================================
// RUTAS DE TRADES
// ================================

router.get('/trades/:tradingPairId',
  [param('tradingPairId').isUUID().withMessage('Trading pair ID inválido')],
  validate,
  tradesController.getRecentTrades
);

router.get('/trades/user/all',
  authenticateToken,
  tradesController.getUserTrades
);

router.get('/trades/user/stats',
  authenticateToken,
  tradesController.getUserTradeStats
);

router.get('/trades/detail/:tradeId',
  authenticateToken,
  [param('tradeId').isUUID().withMessage('Trade ID inválido')],
  validate,
  tradesController.getTradeDetail
);

// ================================
// RUTAS DE GRÁFICOS
// ================================

router.get('/chart/:tradingPairId',
  [
    param('tradingPairId').isUUID().withMessage('Trading pair ID inválido'),
    query('interval').optional().isIn(['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w']).withMessage('Intervalo inválido')
  ],
  validate,
  tradesController.getChartData
);

router.get('/chart/:tradingPairId/binance',
  [param('tradingPairId').isUUID().withMessage('Trading pair ID inválido')],
  validate,
  tradesController.getBinanceChartData
);

// ================================
// RUTAS DE ESTADÍSTICAS
// ================================

router.get('/stats/:tradingPairId',
  [param('tradingPairId').isUUID().withMessage('Trading pair ID inválido')],
  validate,
  tradesController.getTradingPairStats
);

router.get('/volume',
  tradesController.getVolumeStats
);

router.get('/tickers',
  tradesController.getTickers
);

router.get('/summary',
  authenticateToken,
  tradesController.getUserTradingSummary
);

// ================================
// RUTAS DE PARES DE TRADING
// ================================

router.get('/pairs',
  tradingPairsController.getAllPairs
);

router.get('/pairs/active',
  tradingPairsController.getActivePairs
);

router.get('/pairs/top',
  tradingPairsController.getTopPairs
);

router.get('/pairs/stats',
  tradingPairsController.getPairsStats
);

router.get('/pairs/symbol/:symbol',
  [param('symbol').isString().notEmpty().withMessage('Símbolo inválido')],
  validate,
  tradingPairsController.getPairBySymbol
);

router.get('/pairs/:pairId',
  [param('pairId').isUUID().withMessage('Pair ID inválido')],
  validate,
  tradingPairsController.getPairDetail
);

// ================================
// RUTAS DE ADMIN (Gestión de Pares)
// ================================

router.post('/pairs/auto-create',
  authenticateToken,
  isSuperAdmin,
  tradingPairsController.autoCreatePairs
);
/*
POST /api/trading/pairs/auto-create

Crea automáticamente todos los pares de trading contra:
- Stablecoins (USDT, USDC, BUSD, DAI, TUSD, USDD)
- BTC
- ETH

También crea pares estratégicos entre quote assets (ETH/BTC, ETH/USDT, BTC/USDT, etc.)

Body (opcional):
{
  "dryRun": false,  // true para simular sin crear
  "customQuoteAssets": ["USDT", "BTC"],  // opcional: usar solo estas quote assets
  "skipExisting": true,  // true para no reintentrar pares existentes (default: true)
  "defaultFees": {
    "makerFeePercent": 0.1,
    "takerFeePercent": 0.15
  }
}

Response:
{
  "success": true,
  "created": 45,
  "skipped": 3,
  "errors": 0,
  "pairs": [...],
  "summary": {
    "totalPairs": 45,
    "byQuoteAsset": {
      "USDT": 15,
      "BTC": 12,
      "ETH": 10,
      ...
    }
  }
}
*/

router.post('/pairs', //Bien
  authenticateToken,
  isSuperAdmin,
  [
    body('symbol').isString().notEmpty().withMessage('Símbolo requerido'),
    body('baseAssetId').isUUID().withMessage('Base asset ID inválido'),
    body('quoteAssetId').isUUID().withMessage('Quote asset ID inválido')
  ],
  validate,
  tradingPairsController.createPair
);
/*
{
  "symbol": "ETH/USDT",
  "baseAssetId": "123e4567-e89b-12d3-a456-426614174003", // <- Lo que compro
  "quoteAssetId": "123e4567-e89b-12d3-a456-426614174004", // <- Con lo que lo compro
  "minOrderAmount": 10.00,
  "maxOrderAmount": 100000.00,
  "pricePrecision": 2,
  "quantityPrecision": 4,
  "makerFeePercent": 0.1,
  "takerFeePercent": 0.1
}
*/

router.put('/pairs/:pairId',
  authenticateToken,
  isSuperAdmin,
  [param('pairId').isUUID().withMessage('Pair ID inválido')],
  validate,
  tradingPairsController.updatePair
);
/*
{
  "minOrderAmount": 5.00,
  "maxOrderAmount": 50000.00,
  "pricePrecision": 3,
  "makerFeePercent": 0.08
}
*/

router.patch('/pairs/:pairId/status',
  authenticateToken,
  isSuperAdmin,
  [
    param('pairId').isUUID().withMessage('Pair ID inválido'),
    body('status').isIn(['active', 'paused', 'delisted']).withMessage('Estado inválido')
  ],
  validate,
  tradingPairsController.updatePairStatus
);

/*
{
  "status": "paused"
}
*/

module.exports = router;