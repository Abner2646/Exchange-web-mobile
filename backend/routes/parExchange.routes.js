// routes/parExchange.routes.js - VERSIÓN SIMPLE SIN MIDDLEWARES
//Prefijo: /parExchange

const { Router } = require('express');
const router = Router();

// Importa el controlador de pares de exchange
const parExchangeController = require('../controllers/parExchange.controller.js');
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

/**
 * @openapi
 * /parExchange/generate-all:
 *   post: { tags: [Pares de Exchange (swap) - admin], summary: Generar todos los pares (super admin, una sola vez), responses: { 200: { description: Pares generados } } }
 * /parExchange:
 *   get: { tags: [Pares de Exchange (swap)], summary: Listar pares de swap (público), security: [], responses: { 200: { description: Pares } } }
 *   post:
 *     tags: [Pares de Exchange (swap) - admin]
 *     summary: Crear un par de swap (super admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object, required: [criptoBaseId, criptoQuoteId], properties: { criptoBaseId: { type: string, format: uuid }, criptoQuoteId: { type: string, format: uuid }, comisionPorcentaje: { type: number }, simboloExterno: { type: string } } }
 *     responses: { 201: { description: Par creado } }
 * /parExchange/{id}:
 *   get:
 *     tags: [Pares de Exchange (swap)]
 *     summary: Par por id (público)
 *     security: []
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Par }, 404: { $ref: '#/components/responses/BadRequest' } }
 * /parExchange/search/query:
 *   get: { tags: [Pares de Exchange (swap)], summary: Buscar pares (público), security: [], parameters: [{ in: query, name: q, schema: { type: string } }], responses: { 200: { description: Resultados } } }
 * /parExchange/symbols/{baseSymbol}/{quoteSymbol}:
 *   get:
 *     tags: [Pares de Exchange (swap)]
 *     summary: Par por símbolos (público)
 *     security: []
 *     parameters:
 *       - { in: path, name: baseSymbol, required: true, schema: { type: string } }
 *       - { in: path, name: quoteSymbol, required: true, schema: { type: string } }
 *     responses: { 200: { description: Par } }
 * /parExchange/price/{baseSymbol}/{quoteSymbol}:
 *   get:
 *     tags: [Pares de Exchange (swap)]
 *     summary: Precio actual rápido (público, optimizado para trading)
 *     security: []
 *     parameters:
 *       - { in: path, name: baseSymbol, required: true, schema: { type: string } }
 *       - { in: path, name: quoteSymbol, required: true, schema: { type: string } }
 *     responses: { 200: { description: Precio } }
 * /parExchange/base/{criptoBaseId}:
 *   get:
 *     tags: [Pares de Exchange (swap)]
 *     summary: Pares por cripto base (público)
 *     security: []
 *     parameters: [{ in: path, name: criptoBaseId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Pares } }
 * /parExchange/quote/{criptoQuoteId}:
 *   get:
 *     tags: [Pares de Exchange (swap)]
 *     summary: Pares por cripto quote (público)
 *     security: []
 *     parameters: [{ in: path, name: criptoQuoteId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Pares } }
 * /parExchange/status/active:
 *   get: { tags: [Pares de Exchange (swap)], summary: Pares activos (público), security: [], responses: { 200: { description: Pares activos } } }
 * /parExchange/ranking/volume:
 *   get: { tags: [Pares de Exchange (swap)], summary: Top pares por volumen (público), security: [], responses: { 200: { description: Top pares } } }
 * /parExchange/monitoring/high-commission:
 *   get: { tags: [Pares de Exchange (swap)], summary: Pares con comisión alta (público), security: [], responses: { 200: { description: Pares } } }
 * /parExchange/monitoring/outdated-prices:
 *   get: { tags: [Pares de Exchange (swap) - admin], summary: Pares con precios desactualizados (super admin), responses: { 200: { description: Pares } } }
 */

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