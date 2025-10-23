// routes/intercambioExchange.routes.js
// Prefijo: /intercambioExchange

const express = require('express');
const router = express.Router();
const intercambioController = require('../controllers/intercambioExchange.controller');
const { authenticateToken, requireEmailVerified } = require('../middleware/authMiddleware');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware');

// ================================
// RUTAS PÚBLICAS
// ================================

router.get('/pairs/:parId/price-history', intercambioController.getPriceHistory);
/*
Query params:
?fechaDesde=2024-01-01T00:00:00.000Z&fechaHasta=2024-12-31T23:59:59.999Z&limit=1000&order=DESC
*/

router.get('/pairs/:parId/last-price', intercambioController.getLastPrice);
/*
Sin body ni query params
*/

router.get('/pairs/:parId/volume', intercambioController.getVolumeByPair);
/*
Query params:
?fechaDesde=2024-01-01T00:00:00.000Z&fechaHasta=2024-12-31T23:59:59.999Z&estado=completado
*/

// ================================
// RUTAS AUTENTICADAS
// ================================
router.use(authenticateToken, requireEmailVerified);

//Crear un intercambio
router.post('/', intercambioController.createOrder);
/*
{
  "parId": "123e4567-e89b-12d3-a456-426614174000",
  "tipo": "compra",
  "cantidadBase": 0.5
}
*/

router.post('/calculate', intercambioController.calculateExchange);
/*
{
  "parId": "123e4567-e89b-12d3-a456-426614174000",
  "cantidadBase": 0.5,
  "tipo": "compra"
}
*/

router.post('/check-limit', intercambioController.checkTransactionLimit);
/*
{
  "cantidadQuote": 1000.50
}
*/

router.get('/me', intercambioController.getMyIntercambios);
/*
Query params:
?tipo=compra&estado=completado&limit=50&offset=0&fechaDesde=2024-01-01T00:00:00.000Z&fechaHasta=2024-12-31T23:59:59.999Z&parId=123e4567-e89b-12d3-a456-426614174000
*/

router.get('/me/balances', intercambioController.getMyBalances);
/*
Sin body ni query params
*/

router.get('/me/daily-volume', intercambioController.getMyDailyVolume);
/*
Query params:
?date=2024-03-15
*/

router.get('/me/summary', intercambioController.getMyTradingSummary);
/*
Query params:
?period=day
*/

// ================================
// RUTAS ADMINISTRATIVAS
// ================================
//router.use(isAdmin);

router.get('/', intercambioController.getIntercambios);
/*
Query params:
?estado=completado&tipo=compra&usuarioId=123e4567-e89b-12d3-a456-426614174000&limit=50&offset=0&fechaDesde=2024-01-01T00:00:00.000Z&fechaHasta=2024-12-31T23:59:59.999Z&precioMin=40000&precioMax=50000&cantidadMin=0.1&cantidadMax=10
*/

router.get('/search', intercambioController.searchIntercambios);
/*
Query params:
?q=username&limit=10
*/

router.get('/stats', intercambioController.getIntercambioStats);
/*
Query params:
?fechaDesde=2024-01-01T00:00:00.000Z&fechaHasta=2024-12-31T23:59:59.999Z&parId=123e4567-e89b-12d3-a456-426614174000&usuarioId=123e4567-e89b-12d3-a456-426614174000
*/

router.get('/:id', intercambioController.getIntercambioById);
/*
Sin body ni query params
*/

router.put('/:id/status', intercambioController.updateIntercambioStatus);
/*
{
  "newStatus": "completado"
}
*/

router.get('/analytics/top-traders', intercambioController.getTopTraders);
/*
Query params:
?limit=10&period=30d
*/

router.get('/analytics/market-summary', intercambioController.getMarketSummary);
/*
Query params:
?parId=123e4567-e89b-12d3-a456-426614174000
*/

router.get('/analytics/stats-by-crypto', intercambioController.getStatsByCrypto);
/*
Query params:
?fechaDesde=2024-01-01T00:00:00.000Z&fechaHasta=2024-12-31T23:59:59.999Z
*/

module.exports = router;