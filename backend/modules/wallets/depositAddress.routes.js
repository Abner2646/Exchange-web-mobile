// Hay rutas que lógicamente deberáin tener requireEmailVerified pero no se lo puse porque capaz se llamand e forma prematura sin que el usuario esté con el mail verificado

// routes/direccionDeposito.routes.js
const { Router } = require('express');
const router = Router();

// Importa el controlador de direcciones de depósito
const direccionDepositoController = require('./depositAddress.controller.js');

// Middleware de autenticación
const { authenticateToken, requireEmailVerified } = require('../../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../../middleware/adminMiddleware.js');

/**
 * @openapi
 * /direccionDeposito:
 *   get: { tags: [Direcciones de depósito], summary: Mis direcciones de depósito, responses: { 200: { description: Direcciones }, 401: { $ref: '#/components/responses/Unauthorized' } } }
 *   post:
 *     tags: [Direcciones de depósito]
 *     summary: Crear mi(s) dirección(es) de depósito
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, properties: { crearParaTodasLasCriptos: { type: boolean }, walletMaestrId: { type: string, format: uuid } } }
 *     responses: { 201: { description: Dirección(es) creada(s) } }
 * /direccionDeposito/user/me:
 *   get: { tags: [Direcciones de depósito], summary: Mis direcciones (email verificado), responses: { 200: { description: Direcciones } } }
 * /direccionDeposito/user/me/crypto/{cryptoId}:
 *   get:
 *     tags: [Direcciones de depósito]
 *     summary: Mi dirección para una cripto (email verificado)
 *     parameters: [{ in: path, name: cryptoId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Dirección } }
 * /direccionDeposito/user/{userId}:
 *   get:
 *     tags: [Direcciones de depósito - admin]
 *     summary: Direcciones de un usuario (admin)
 *     parameters: [{ in: path, name: userId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Direcciones } }
 * /direccionDeposito/user/{userId}/crypto/{cryptoId}:
 *   get:
 *     tags: [Direcciones de depósito - admin]
 *     summary: Dirección de un usuario para una cripto (admin)
 *     parameters:
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: cryptoId, required: true, schema: { type: string, format: uuid } }
 *     responses: { 200: { description: Dirección } }
 */

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener mis direcciones de depósito
router.get('/', authenticateToken, direccionDepositoController.getMyDepositAddresses); // Bien

// Obtener dirección de depósito por ID
//router.get('/:id', authenticateToken, direccionDepositoController.getDepositAddressById);

// Crear nueva dirección de depósito
router.post('/', authenticateToken, direccionDepositoController.createDepositAddress); // Bien pero en el primer intento a pesar de que las cree no las resupera, hay que hacer un GET después para recuperar las direcciones correctamente
// Para crear direcciones para TODAS las criptomonedas: {"crearParaTodasLasCriptos": true}
// Para crear dirección para una criptomoneda específica: {"walletMaestrId": "uuid-de-la-criptomoneda"} 


// Actualizar dirección de depósito por ID
//router.put('/:id', authenticateToken, direccionDepositoController.updateDepositAddress);

// Eliminar dirección de depósito por ID
//router.delete('/:id', authenticateToken, direccionDepositoController.deleteDepositAddress);

// --------------------- RUTAS DE BÚSQUEDA Y CONSULTA --------------------- //

// Buscar direcciones de depósito por término
//router.get('/search/query', authenticateToken, direccionDepositoController.searchDepositAddresses);

// Obtener dirección por address específico
//router.get('/address/:address', authenticateToken, direccionDepositoController.getDepositAddressByAddress);

// --------------------- RUTAS POR USUARIO --------------------- //

// Obtener mis direcciones de depósito (usuario autenticado)
router.get('/user/me', authenticateToken, requireEmailVerified, requireEmailVerified, direccionDepositoController.getMyDepositAddresses);

// Obtener mi dirección para una criptomoneda específica
router.get('/user/me/crypto/:cryptoId',  authenticateToken, requireEmailVerified, direccionDepositoController.getMyDepositAddressForCrypto);

// Obtener direcciones de depósito por usuario específico (admin)
router.get('/user/:userId', authenticateToken, isAdmin, direccionDepositoController.getDepositAddressesByUser);

// Obtener dirección específica por usuario y crypto (admin)
router.get('/user/:userId/crypto/:cryptoId', authenticateToken, isAdmin, direccionDepositoController.getDepositAddressByUserAndCrypto);

// --------------------- RUTAS POR WALLET --------------------- //
/*
// Obtener direcciones por wallet maestra
router.get('/wallet/:walletId', authenticateToken, direccionDepositoController.getDepositAddressesByWallet);

// Obtener siguiente índice de derivación para una wallet
router.get('/wallet/:walletId/next-index', authenticateToken, direccionDepositoController.getNextDerivationIndex);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de direcciones de depósito
router.get('/admin/stats', authenticateToken, direccionDepositoController.getDepositAddressStats);

// Actualizar estado específico de dirección de depósito
router.patch('/:id/status', authenticateToken, direccionDepositoController.updateDepositAddressStatus);

// Alternar estado de dirección de depósito (activar/desactivar)
router.patch('/:id/toggle', authenticateToken, direccionDepositoController.toggleDepositAddressStatus);

// --------------------- RUTAS DE VALIDACIÓN Y DEPÓSITOS --------------------- //

// Validar dirección para depósito
router.post('/validate/deposit', authenticateToken, direccionDepositoController.validateForDeposit);
*/
module.exports = router;