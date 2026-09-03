// routes/criptomoneda.routes.js
// Prefijo: /criptomoneda

const { Router } = require('express');
const router = Router();

// Middleware de autenticación
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// Importa el controlador de criptomonedas
const criptomonedaController = require('../controllers/criptomoneda.controller.js');

/**
 * @openapi
 * /criptomoneda:
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
 *             required: [symbol, nombre, red, decimales]
 *             properties:
 *               symbol: { type: string, example: USDT }
 *               nombre: { type: string, example: Tether USD }
 *               red: { type: string, example: Ethereum }
 *               direccionContrato: { type: string }
 *               decimales: { type: integer, example: 6 }
 *               activa: { type: boolean }
 *     responses: { 201: { description: Creada }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /criptomoneda/{id}:
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
 * /criptomoneda/{id}/generate-icon:
 *   post:
 *     tags: [Criptomonedas - admin]
 *     summary: Generar el icono de una cripto (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Icono generado } }
 * /criptomoneda/generate-all-icons:
 *   post: { tags: [Criptomonedas - admin], summary: Generar iconos faltantes (super admin), responses: { 200: { description: OK } } }
 * /criptomoneda/search/query:
 *   get:
 *     tags: [Criptomonedas]
 *     summary: Buscar criptos por término (público)
 *     security: []
 *     parameters: [{ in: query, name: q, schema: { type: string } }]
 *     responses: { 200: { description: Resultados } }
 * /criptomoneda/symbol/{symbol}:
 *   get:
 *     tags: [Criptomonedas]
 *     summary: Cripto por símbolo (público)
 *     security: []
 *     parameters: [{ in: path, name: symbol, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Cripto } }
 * /criptomoneda/network/{network}:
 *   get:
 *     tags: [Criptomonedas]
 *     summary: Criptos por red/blockchain (público)
 *     security: []
 *     parameters: [{ in: path, name: network, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Criptos } }
 * /criptomoneda/contract/{address}:
 *   get:
 *     tags: [Criptomonedas]
 *     summary: Cripto por dirección de contrato
 *     parameters: [{ in: path, name: address, required: true, schema: { type: string } }]
 *     responses: { 200: { description: Cripto } }
 * /criptomoneda/public/active:
 *   get: { tags: [Criptomonedas], summary: Criptos activas (público, para trading), security: [], responses: { 200: { description: Criptos activas } } }
 * /criptomoneda/admin/stats:
 *   get: { tags: [Criptomonedas - admin], summary: Estadísticas (super admin), responses: { 200: { description: Stats } } }
 * /criptomoneda/{id}/status:
 *   patch:
 *     tags: [Criptomonedas - admin]
 *     summary: Actualizar el estado de una cripto (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Estado actualizado } }
 * /criptomoneda/{id}/toggle:
 *   patch:
 *     tags: [Criptomonedas - admin]
 *     summary: Activar/desactivar una cripto (super admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: OK } }
 * /criptomoneda/validate/transaction:
 *   post: { tags: [Criptomonedas - admin], summary: Validar una cripto para transacción (super admin), responses: { 200: { description: Válida } } }
 */

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las criptomonedas
router.get('/', authenticateToken, criptomonedaController.getCriptomonedas); // Bien

// Obtener criptomoneda por ID
router.get('/:id', authenticateToken, criptomonedaController.getCriptomonedaById);

// Crear nueva criptomoneda
router.post('/', authenticateToken, isSuperAdmin, criptomonedaController.createCriptomoneda); //Bien
/*
//USDT
{
  "symbol": "USDT",
  "nombre": "Tether USD",
  "red": "Ethereum",
  "direccionContrato": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  "decimales": 6,
  "activa": true
}

*/

// Actualizar criptomoneda por ID
router.put('/:id', authenticateToken, isSuperAdmin, criptomonedaController.updateCriptomoneda);

// Eliminar criptomoneda por ID
router.delete('/:id', authenticateToken, isSuperAdmin, criptomonedaController.deleteCriptomoneda);

// ----------------------- DE LOS ICONOS -------------------------
// Generar icono para una cripto específica
router.post('/:id/generate-icon', authenticateToken, isSuperAdmin, criptomonedaController.generateIconUrl);

// Generar iconos para todas las criptos sin icono
router.post('/generate-all-icons', authenticateToken, isSuperAdmin, criptomonedaController.generateAllIconUrls);

/*Lista de simbolos de Cyptolcons.org soporta (más comunes):
BTC, ETH, USDT, BNB, USDC, XRP, ADA, DOGE, SOL, DOT, MATIC, 
SHIB, TRX, AVAX, LINK, UNI, ATOM, LTC, XMR, ETC, BCH, XLM, 
ALGO, VET, ICP, FIL, APT, NEAR, HBAR, QNT, ARB, OP, IMX, 
SAND, MANA, AXS, GALA, CHZ, ENJ, FLOW, etc.
*/

// --------------------- RUTAS DE BÚSQUEDA Y CONSULTA --------------------- //

// Buscar criptomonedas por término
router.get('/search/query', /*authenticateToken,*/ criptomonedaController.searchCriptomonedas);

// Obtener criptomoneda por símbolo
router.get('/symbol/:symbol', criptomonedaController.getCriptomonedaBySymbol);

// Obtener criptomonedas por red/blockchain
router.get('/network/:network', criptomonedaController.getCriptomonedasByNetwork);

// Obtener criptomoneda por dirección de contrato
router.get('/contract/:address', authenticateToken, criptomonedaController.getCriptomonedaByContract);

// --------------------- RUTAS PÚBLICAS --------------------- //

// Obtener solo criptomonedas activas (ruta pública para trading)
router.get('/public/active', criptomonedaController.getCriptomonedasActivas);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de criptomonedas
router.get('/admin/stats', authenticateToken, isSuperAdmin, criptomonedaController.getCriptomonedaStats);

// Actualizar estado específico de criptomoneda
router.patch('/:id/status', authenticateToken, isSuperAdmin, criptomonedaController.updateCriptomonedaStatus);

// Alternar estado de criptomoneda (activar/desactivar)
router.patch('/:id/toggle', authenticateToken, isSuperAdmin, criptomonedaController.toggleCriptomonedaStatus);

// --------------------- RUTAS DE TRANSACCIONES --------------------- //

// Validar criptomoneda para transacción
router.post('/validate/transaction', authenticateToken, isSuperAdmin, criptomonedaController.validateForTransaction);

module.exports = router;