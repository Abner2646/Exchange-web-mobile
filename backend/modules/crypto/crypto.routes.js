// routes/crypto.routes.js
// Prefijo: /crypto

const { Router } = require('express');
const router = Router();

// Middleware de autenticación
const { authenticateToken } = require('../../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../../middleware/adminMiddleware.js');

// Importa el controlador de criptomonedas
const cryptoController = require('./crypto.controller.js');

/**
 * @openapi
 * /crypto:
 *   get: { tags: [Criptomonedas], summary: Listar criptomonedas, responses: { 200: { description: Lista } } }
 *   post:
 *     tags: [Criptomonedas - admin]
 *     summary: Crear una criptomoneda (super admin)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [symbol, name, network, decimals]
 *             properties:
 *               symbol: { type: string, example: USDT }
 *               name: { type: string, example: Tether USD }
 *               network: { type: string, example: Ethereum }
 *               contractAddress: { type: string }
 *               decimals: { type: integer, example: 6 }
 *               active: { type: boolean }
 *     responses: { 201: { description: Creada }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /crypto/{id}:
 *   get:
 *     tags: [Criptomonedas]
 *     summary: Obtener una cripto por id
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Cripto }, 404: { $ref: '#/components/responses/BadRequest' } }
 *   put:
 *     tags: [Criptomonedas - admin]
 *     summary: Actualizar una cripto (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Actualizada } }
 *   delete:
 *     tags: [Criptomonedas - admin]
 *     summary: Eliminar una cripto (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Eliminada } }
 * /crypto/{id}/generate-icon:
 *   post:
 *     tags: [Criptomonedas - admin]
 *     summary: Generar el icono de una cripto (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Icono generado } }
 * /crypto/generate-all-icons:
 *   post: { tags: [Criptomonedas - admin], summary: Generar iconos faltantes (super admin), responses: { 200: { description: OK } } }
 * /crypto/search/query:
 *   get:
 *     tags: [Criptomonedas]
 *     summary: Buscar criptos por término (público)
 *     security: []
 *     parameters: [{ in: query, name: q, schema: { type: string } }]
 *     responses: { 200: { description: Resultados } }
 * /crypto/symbol/{symbol}:
 *   get:
 *     tags: [Criptomonedas]
 *     summary: Cripto por símbolo (público)
 *     security: []
 *     parameters: [{ in: path, name: symbol, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Cripto } }
 * /crypto/network/{network}:
 *   get:
 *     tags: [Criptomonedas]
 *     summary: Criptos por network/blockchain (público)
 *     security: []
 *     parameters: [{ in: path, name: network, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Criptos } }
 * /crypto/contract/{address}:
 *   get:
 *     tags: [Criptomonedas]
 *     summary: Cripto por dirección de contrato
 *     parameters: [{ in: path, name: address, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Cripto } }
 * /crypto/public/active:
 *   get: { tags: [Criptomonedas], summary: Criptos activas (público, para trading), security: [], responses: { 200: { description: Criptos activas } } }
 * /crypto/admin/stats:
 *   get: { tags: [Criptomonedas - admin], summary: Estadísticas (super admin), responses: { 200: { description: Stats } } }
 * /crypto/{id}/status:
 *   patch:
 *     tags: [Criptomonedas - admin]
 *     summary: Actualizar el estado de una cripto (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Estado actualizado } }
 * /crypto/{id}/toggle:
 *   patch:
 *     tags: [Criptomonedas - admin]
 *     summary: Activar/desactivar una cripto (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: OK } }
 * /crypto/validate/transaction:
 *   post: { tags: [Criptomonedas - admin], summary: Validar una cripto para transacción (super admin), responses: { 200: { description: Válida } } }
 */

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las criptomonedas
router.get('/', authenticateToken, cryptoController.getCriptomonedas); // Bien

// Obtener crypto por ID
router.get('/:id', authenticateToken, cryptoController.getCriptomonedaById);

// Crear nueva crypto
router.post('/', authenticateToken, isSuperAdmin, cryptoController.createCrypto); //Bien
/*
//USDT
{
  "symbol": "USDT",
  "name": "Tether USD",
  "network": "Ethereum",
  "contractAddress": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "decimals": 6,
  "active": true
}

*/

// Actualizar crypto por ID
router.put('/:id', authenticateToken, isSuperAdmin, cryptoController.updateCriptomoneda);

// Eliminar crypto por ID
router.delete('/:id', authenticateToken, isSuperAdmin, cryptoController.deleteCriptomoneda);

// ----------------------- DE LOS ICONOS -------------------------
// Generar icono para una cripto específica
router.post('/:id/generate-icon', authenticateToken, isSuperAdmin, cryptoController.generateIconUrl);

// Generar iconos para todas las criptos sin icono
router.post('/generate-all-icons', authenticateToken, isSuperAdmin, cryptoController.generateAllIconUrls);

/*Lista de simbolos de Cyptolcons.org soporta (más comunes):
BTC, ETH, USDT, BNB, USDC, XRP, ADA, DOGE, SOL, DOT, MATIC, 
SHIB, TRX, AVAX, LINK, UNI, ATOM, LTC, XMR, ETC, BCH, XLM, 
ALGO, VET, ICP, FIL, APT, NEAR, HBAR, QNT, ARB, OP, IMX, 
SAND, MANA, AXS, GALA, CHZ, ENJ, FLOW, etc.
*/

// --------------------- RUTAS DE BÚSQUEDA Y CONSULTA --------------------- //

// Buscar criptomonedas por término
router.get('/search/query', /*authenticateToken,*/ cryptoController.searchCriptomonedas);

// Obtener crypto por símbolo
router.get('/symbol/:symbol', cryptoController.getCriptomonedaBySymbol);

// Obtener criptomonedas por network/blockchain
router.get('/network/:network', cryptoController.getCriptomonedasByNetwork);

// Obtener crypto por dirección de contrato
router.get('/contract/:address', authenticateToken, cryptoController.getCriptomonedaByContract);

// --------------------- RUTAS PÚBLICAS --------------------- //

// Obtener solo criptomonedas activas (ruta pública para trading)
router.get('/public/active', cryptoController.getCriptomonedasActivas);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de criptomonedas
router.get('/admin/stats', authenticateToken, isSuperAdmin, cryptoController.getCriptomonedaStats);

// Actualizar estado específico de crypto
router.patch('/:id/status', authenticateToken, isSuperAdmin, cryptoController.updateCriptomonedaStatus);

// Alternar estado de crypto (activar/desactivar)
router.patch('/:id/toggle', authenticateToken, isSuperAdmin, cryptoController.toggleCriptomonedaStatus);

// --------------------- RUTAS DE TRANSACCIONES --------------------- //

// Validar crypto para transacción
router.post('/validate/transaction', authenticateToken, isSuperAdmin, cryptoController.validateForTransaction);

module.exports = router;