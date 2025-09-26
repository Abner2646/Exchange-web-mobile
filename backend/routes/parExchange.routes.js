// routes/parExchange.routes.js - VERSIÓN SIMPLE SIN MIDDLEWARES
//Prefijo: /parExchange

const { Router } = require('express');
const router = Router();

// Importa el controlador de pares de exchange
const parExchangeController = require('../controllers/parExchange.controller.js');

console.log('=== DEBUG RUTAS ===');
console.log('Controlador importado:', typeof parExchangeController);
console.log('Funciones disponibles:', Object.keys(parExchangeController || {}));

// --------------------- RUTAS BÁSICAS SIN MIDDLEWARE --------------------- //

// Obtener todos los pares de exchange
router.get('/', parExchangeController.getParesExchange); // Bien

// Obtener par específico por ID
router.get('/:id', parExchangeController.getParExchangeById); // Bien

// Crear nuevo par de exchange - SIN MIDDLEWARE
router.post('/', parExchangeController.createParExchange); // Bien

// Actualizar par por ID - SIN MIDDLEWARE
router.put('/:id', parExchangeController.updateParExchange);

// Eliminar par por ID - SIN MIDDLEWARE
router.delete('/:id', parExchangeController.deleteParExchange); // Bien

// Buscar pares por término
router.get('/search/query', parExchangeController.searchParesExchange);

// Obtener par por símbolos de criptomonedas
router.get('/symbols/:baseSymbol/:quoteSymbol', parExchangeController.getParBySymbols);

// Obtener precio actual rápido (optimizado para trading)
router.get('/price/:baseSymbol/:quoteSymbol', parExchangeController.getCurrentPrice);

// Obtener pares por criptomoneda base
router.get('/base/:criptoBaseId', parExchangeController.getParesByBaseCrypto);

// Obtener pares por criptomoneda quote
router.get('/quote/:criptoQuoteId', parExchangeController.getParesByQuoteCrypto);

// Obtener solo pares activos
router.get('/status/active', parExchangeController.getActiveExchangePairs);

// Obtener top pares por volumen
router.get('/ranking/volume', parExchangeController.getTopPairsByVolume);

// Obtener pares con comisión alta - SIN MIDDLEWARE
router.get('/monitoring/high-commission', parExchangeController.getHighCommissionPairs);

// Obtener pares con precios desactualizados - SIN MIDDLEWARE
router.get('/monitoring/outdated-prices', parExchangeController.getOutdatedPricePairs);

// Actualizar estado del par - SIN MIDDLEWARE
router.patch('/:id/status', parExchangeController.updateParStatus);

// Alternar estado del par - SIN MIDDLEWARE
router.patch('/:id/toggle', parExchangeController.toggleParStatus);

// Actualizar precio del par - SIN MIDDLEWARE
router.patch('/:id/price', parExchangeController.updateParPrice);

// Actualizar comisión del par - SIN MIDDLEWARE
router.patch('/:id/commission', parExchangeController.updateParCommission);

// Actualización masiva de precios - SIN MIDDLEWARE
router.post('/prices/bulk-update', parExchangeController.bulkUpdatePrices);

// Calcular intercambio para un par
router.post('/:id/calculate', parExchangeController.calculateExchange);

// Obtener libro de órdenes simulado
router.get('/:id/orderbook', parExchangeController.getOrderBook);

// Dashboard de exchange - SIN MIDDLEWARE
router.get('/dashboard/overview', parExchangeController.getExchangeDashboard);

// Métricas del mercado
router.get('/dashboard/market-metrics', parExchangeController.getMarketMetrics);

// Obtener estadísticas de pares - SIN MIDDLEWARE
router.get('/admin/stats', parExchangeController.getParExchangeStats);

// Exportar pares a CSV - SIN MIDDLEWARE
router.get('/admin/export', parExchangeController.exportPares);

console.log('=== RUTAS CONFIGURADAS ===');

module.exports = router;