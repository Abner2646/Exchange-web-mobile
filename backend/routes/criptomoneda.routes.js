// routes/criptomoneda.routes.js
// Prefijo: /criptomoneda

const { Router } = require('express');
const router = Router();

// Middleware de autenticación
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// Importa el controlador de criptomonedas
const criptomonedaController = require('../controllers/criptomoneda.controller.js');

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
router.get('/search/query', authenticateToken, criptomonedaController.searchCriptomonedas);

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
router.get('/admin/stats', authenticateToken, criptomonedaController.getCriptomonedaStats);

// Actualizar estado específico de criptomoneda
router.patch('/:id/status', authenticateToken, isSuperAdmin, criptomonedaController.updateCriptomonedaStatus);

// Alternar estado de criptomoneda (activar/desactivar)
router.patch('/:id/toggle', authenticateToken, isSuperAdmin, criptomonedaController.toggleCriptomonedaStatus);

// --------------------- RUTAS DE TRANSACCIONES --------------------- //

// Validar criptomoneda para transacción
router.post('/validate/transaction', authenticateToken, isSuperAdmin, criptomonedaController.validateForTransaction);

module.exports = router;