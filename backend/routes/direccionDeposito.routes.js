// routes/direccionDeposito.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación
const { authenticateToken } = require('../middleware/authMiddleware.js');

// Importa el controlador de direcciones de depósito
const direccionDepositoController = require('../controllers/direccionDeposito.controller.js');

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener mis direcciones de depósito
router.get('/', authenticateToken, direccionDepositoController.getMyDirecciones); // Bien

// Obtener dirección de depósito por ID
//router.get('/:id', authenticateToken, direccionDepositoController.getDireccionDepositoById);

// Crear nueva dirección de depósito
router.post('/', authenticateToken, direccionDepositoController.createDireccionDeposito); // Bien pero en el primer intento a pesar de que las cree no las resupera, hay que hacer un GET después para recuperar las direcciones correctamente
// Para crear direcciones para TODAS las criptomonedas: {"crearParaTodasLasCriptos": true}
// Para crear dirección para una criptomoneda específica: {"walletMaestrId": "uuid-de-la-criptomoneda"} 


// Actualizar dirección de depósito por ID
//router.put('/:id', authenticateToken, direccionDepositoController.updateDireccionDeposito);

// Eliminar dirección de depósito por ID
//router.delete('/:id', authenticateToken, direccionDepositoController.deleteDireccionDeposito);

// --------------------- RUTAS DE BÚSQUEDA Y CONSULTA --------------------- //

// Buscar direcciones de depósito por término
//router.get('/search/query', authenticateToken, direccionDepositoController.searchDireccionesDeposito);

// Obtener dirección por address específico
//router.get('/address/:address', authenticateToken, direccionDepositoController.getDireccionByAddress);

// --------------------- RUTAS POR USUARIO --------------------- //

// Obtener mis direcciones de depósito (usuario autenticado)
router.get('/user/me', authenticateToken, direccionDepositoController.getMyDirecciones);

// Obtener mi dirección para una criptomoneda específica
router.get('/user/me/crypto/:criptomonedaId', authenticateToken, direccionDepositoController.getMyDireccionForCrypto);

// Obtener direcciones de depósito por usuario específico (admin)
router.get('/user/:userId', authenticateToken, direccionDepositoController.getDireccionesByUser);

// Obtener dirección específica por usuario y criptomoneda (admin)
router.get('/user/:userId/crypto/:criptomonedaId', authenticateToken, direccionDepositoController.getDireccionByUserAndCrypto);

// --------------------- RUTAS POR WALLET --------------------- //

// Obtener direcciones por wallet maestra
router.get('/wallet/:walletId', authenticateToken, direccionDepositoController.getDireccionesByWallet);

// Obtener siguiente índice de derivación para una wallet
router.get('/wallet/:walletId/next-index', authenticateToken, direccionDepositoController.getNextDerivationIndex);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de direcciones de depósito
router.get('/admin/stats', authenticateToken, direccionDepositoController.getDireccionDepositoStats);

// Actualizar estado específico de dirección de depósito
router.patch('/:id/status', authenticateToken, direccionDepositoController.updateDireccionDepositoStatus);

// Alternar estado de dirección de depósito (activar/desactivar)
router.patch('/:id/toggle', authenticateToken, direccionDepositoController.toggleDireccionDepositoStatus);

// --------------------- RUTAS DE VALIDACIÓN Y DEPÓSITOS --------------------- //

// Validar dirección para depósito
router.post('/validate/deposit', authenticateToken, direccionDepositoController.validateForDeposit);

module.exports = router;