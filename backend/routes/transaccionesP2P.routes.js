// routes/transaccionP2P.routes.js

const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken, requireEmailVerified } = require('../middleware/authMiddleware.js');
const { isAdmin } = require('../middleware/adminMiddleware.js');

// <--------- Este símbolo son las rutas que nos sirven posta

// Importa el controlador
const transaccionP2PController = require('../controllers/transaccionesP2P.controller.js');

// --------------------- RUTAS ESPECÍFICAS DEL USUARIO --------------------- //

// Obtener mis transacciones
router.get('/me/transacciones', authenticateToken, requireEmailVerified, transaccionP2PController.getMyTransacciones); // <---------

// Obtener transacciones pendientes
router.get('/me/pending', authenticateToken, requireEmailVerified, transaccionP2PController.getPendingTransacciones); // <--------- 

// Obtener mi volumen de transacciones
router.get('/me/volume', authenticateToken, requireEmailVerified, transaccionP2PController.getUserVolume); 

// Obtener historial con usuario específico
router.get('/history/:otroUsuarioId', authenticateToken, requireEmailVerified, transaccionP2PController.getTransactionHistory);

// --------------------- RUTAS DE ACCIONES DE TRANSACCIÓN --------------------- //

// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #11): lock-cryptos llamaba a
// un método inexistente del modelo — el bloqueo de fondos ya pasa dentro de
// createTransaction, no es un paso aparte. Ruta eliminada.

// Confirmar pago (comprador confirma que realizó el pago)
router.patch('/:id/confirm-payment', authenticateToken, requireEmailVerified, transaccionP2PController.confirmPayment); // <---------

// Completar transacción (vendedor confirma que recibió el pago y libera cryptos)
router.patch('/:id/complete', authenticateToken, requireEmailVerified, transaccionP2PController.completeTransaction); // <---------

// Cancelar transacción
router.patch('/:id/cancel', authenticateToken, requireEmailVerified, transaccionP2PController.cancelTransaction); // <---------

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las transacciones (con filtros)
router.get('/', authenticateToken, requireEmailVerified, transaccionP2PController.getTransacciones);

// Obtener transacción por ID
router.get('/:id', authenticateToken, requireEmailVerified, transaccionP2PController.getTransaccionById);

// Crear nueva transacción (aceptar oferta)
router.post('/', authenticateToken, requireEmailVerified, transaccionP2PController.createTransaccion); // <-----

// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #11): /status llamaba a un
// método inexistente del modelo y era redundante con las transiciones
// específicas de arriba (confirm-payment/complete/cancel), que sí funcionan
// y sí validan la transición real. Ruta eliminada.

// --------------------- RUTAS POR CONTEXTO --------------------- //

// Obtener transacciones por oferta específica
router.get('/oferta/:ofertaId', authenticateToken, requireEmailVerified, transaccionP2PController.getTransaccionesByOferta);

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