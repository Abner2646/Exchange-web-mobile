// routes/parExchange.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación y autorización
const { authenticateToken, requireAdmin, requireSuperAdmin, apiKeyAuth } = require('../middleware/authMiddleware.js');

// Importa el controlador de pares de exchange
const parExchangeController = require('../controllers/parExchange.controller.js');

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todos los pares de exchange
router.get('/', parExchangeController.getParesExchange);

// Obtener par específico por ID
router.get('/:id', parExchangeController.getParExchangeById);

// Crear nuevo par de exchange (solo admin)
router.post('/', authenticateToken, requireAdmin, parExchangeController.createParExchange);

// Actualizar par por ID (solo admin)
router.put('/:id', authenticateToken, requireAdmin, parExchangeController.updateParExchange);

// Eliminar par por ID (solo super admin)
router.delete('/:id', authenticateToken, requireSuperAdmin, parExchangeController.deleteParExchange);

// --------------------- RUTAS DE BÚSQUEDA Y CONSULTA --------------------- //

// Buscar pares por término
router.get('/search/query', parExchangeController.searchParesExchange);

// Obtener par por símbolos de criptomonedas (con opción de tiempo real)
router.get('/symbols/:baseSymbol/:quoteSymbol', parExchangeController.getParBySymbols);

// Obtener pares por criptomoneda base
router.get('/base/:criptoBaseId', parExchangeController.getParesByBaseCrypto);

// Obtener pares por criptomoneda quote
router.get('/quote/:criptoQuoteId', parExchangeController.getParesByQuoteCrypto);

// Obtener solo pares activos
router.get('/status/active', parExchangeController.getActiveExchangePairs);

// --------------------- RUTAS DE RANKING Y ANÁLISIS --------------------- //

// Obtener top pares por volumen (ahora usa volumen real)
router.get('/ranking/volume', parExchangeController.getTopPairsByVolume);

// Obtener pares con comisión alta
router.get('/monitoring/high-commission', authenticateToken, requireAdmin, parExchangeController.getHighCommissionPairs);

// Obtener pares con precios desactualizados
router.get('/monitoring/outdated-prices', authenticateToken, requireAdmin, parExchangeController.getOutdatedPricePairs);

// --------------------- RUTAS DE GESTIÓN DE ESTADO --------------------- //

// Actualizar estado del par
router.patch('/:id/status', authenticateToken, requireAdmin, parExchangeController.updateParStatus);

// Alternar estado del par (activar/desactivar)
router.patch('/:id/toggle', authenticateToken, requireAdmin, parExchangeController.toggleParStatus);

// --------------------- RUTAS DE GESTIÓN DE PRECIOS --------------------- //

// Actualizar precio del par
router.patch('/:id/price', authenticateToken, requireAdmin, parExchangeController.updateParPrice);

// Actualizar comisión del par
router.patch('/:id/commission', authenticateToken, requireAdmin, parExchangeController.updateParCommission);

// Actualización masiva de precios (webhook/API externa)
router.post('/prices/bulk-update', apiKeyAuth, parExchangeController.bulkUpdatePrices);

// --------------------- NUEVAS RUTAS DE GESTIÓN DE PRECIOS AUTOMÁTICOS --------------------- //

// Gestionar actualización automática de precios (iniciar/detener)
router.post('/prices/auto-update', authenticateToken, requireAdmin, parExchangeController.managePriceUpdates);

// Forzar actualización manual de todos los precios
router.post('/prices/force-update', authenticateToken, requireAdmin, parExchangeController.forceUpdatePrices);

// --------------------- RUTAS DE TRADING Y CÁLCULOS --------------------- //

// Calcular intercambio para un par (mejorado con slippage y validaciones)
router.post('/:id/calculate', parExchangeController.calculateExchange);

// Obtener libro de órdenes realista
router.get('/:id/orderbook', parExchangeController.getOrderBook);

// --------------------- RUTAS DE DASHBOARD Y MÉTRICAS --------------------- //

// Dashboard de exchange (mejorado con datos de volumen real)
router.get('/dashboard/overview', authenticateToken, requireAdmin, parExchangeController.getExchangeDashboard);

// Métricas del mercado (mejorado con distribución de volumen)
router.get('/dashboard/market-metrics', parExchangeController.getMarketMetrics);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de pares (incluye stats del price service)
router.get('/admin/stats', authenticateToken, requireAdmin, parExchangeController.getParExchangeStats);

// Exportar pares a CSV (mejorado con nuevos campos)
router.get('/admin/export', authenticateToken, requireAdmin, parExchangeController.exportPares);

module.exports = router;