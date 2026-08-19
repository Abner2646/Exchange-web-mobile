// routes/parExchange.routes.js - VERSIÓN SIMPLE SIN MIDDLEWARES
//Prefijo: /parExchange

const { Router } = require('express');
const router = Router();

// Importa el controlador de pares de exchange
const parExchangeController = require('../controllers/parExchange.controller.js');
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// --------------------- RUTAS BÁSICAS SIN MIDDLEWARE --------------------- //

// ✨ NUEVA RUTA: Generar todos los pares automáticamente
router.post('/generate-all', authenticateToken, isSuperAdmin, parExchangeController.generateAllPairs); // Bien ¡EXECUTAR UNA SOLA VEZ!

// Obtener todos los pares de exchange
router.get('/', parExchangeController.getParesExchange); // Bien

// Obtener par específico por ID
router.get('/:id', parExchangeController.getParExchangeById); // Bien

// Crear nuevo par de exchange
router.post('/', isSuperAdmin, parExchangeController.createParExchange); // Bien
/*
{
"criptoBaseId":""
"criptoQuoteId":""
"comisionPorcentaje":""
"simboloExterno":""
}
*/


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
router.get('/monitoring/outdated-prices', isSuperAdmin, parExchangeController.getOutdatedPricePairs);

module.exports = router;