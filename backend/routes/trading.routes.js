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