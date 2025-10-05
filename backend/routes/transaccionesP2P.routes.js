// routes/transaccionP2P.routes.js

/*
⚠️ Importante: Aquí debes implementar:

Bloqueo de balance del vendedor
Validaciones de cantidad (min/max de la oferta)
Máquina de estados (validar transiciones permitidas)
*/
const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin } = require('../middleware/adminMiddleware.js');

// Importa el controlador
const transaccionP2PController = require('../controllers/transaccionesP2P.controller.js');

// --------------------- RUTAS ESPECÍFICAS DEL USUARIO --------------------- //

// Obtener mis transacciones
router.get('/me/transacciones', authenticateToken, transaccionP2PController.getMyTransacciones); // <---------

// Obtener transacciones pendientes
router.get('/me/pending', authenticateToken, transaccionP2PController.getPendingTransacciones); // <--------- 

// Obtener mi volumen de transacciones
router.get('/me/volume', authenticateToken, transaccionP2PController.getUserVolume); 

// Obtener historial con usuario específico
router.get('/history/:otroUsuarioId', authenticateToken, transaccionP2PController.getTransactionHistory);

// --------------------- RUTAS DE ACCIONES DE TRANSACCIÓN --------------------- //

// Bloquear criptomonedas (vendedor confirma que tiene los fondos)
router.patch('/:id/lock-cryptos', authenticateToken, transaccionP2PController.lockCryptos); // <---------

// Confirmar pago (comprador confirma que realizó el pago)
router.patch('/:id/confirm-payment', authenticateToken, transaccionP2PController.confirmPayment); // <---------

// Completar transacción (vendedor confirma que recibió el pago y libera cryptos)
router.patch('/:id/complete', authenticateToken, transaccionP2PController.completeTransaction); // <---------

// Cancelar transacción
router.patch('/:id/cancel', authenticateToken, transaccionP2PController.cancelTransaction); // <---------

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las transacciones (con filtros)
router.get('/', authenticateToken, transaccionP2PController.getTransacciones);

// Obtener transacción por ID
router.get('/:id', authenticateToken, transaccionP2PController.getTransaccionById);

// Crear nueva transacción (aceptar oferta)
router.post('/', authenticateToken, transaccionP2PController.createTransaccion); // <---------

// Actualizar estado de transacción (genérico)
router.patch('/:id/status', authenticateToken, transaccionP2PController.updateTransaccionStatus);

// --------------------- RUTAS POR CONTEXTO --------------------- //

// Obtener transacciones por oferta específica
router.get('/oferta/:ofertaId', authenticateToken, transaccionP2PController.getTransaccionesByOferta);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de transacciones (solo admin)
router.get('/admin/stats', authenticateToken, isAdmin, transaccionP2PController.getTransaccionesStats);

// Verificar y cancelar transacciones con timeout (solo admin)
router.post('/admin/check-timeouts', authenticateToken, isAdmin, transaccionP2PController.checkTimeouts);

// Forzar cambio de estado (solo admin) - para casos excepcionales
router.patch('/:id/force-status', authenticateToken, isAdmin, transaccionP2PController.forceStatusChange);

// Obtener volumen de usuario específico (solo admin)
router.get('/admin/user/:usuarioId/volume', authenticateToken, isAdmin, transaccionP2PController.getUserVolume);

module.exports = router;