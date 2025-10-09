const express = require('express');
const router = express.Router();
const transferenciaController = require('../controllers/transferencia.controller');

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
//const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// =============== RUTAS DE USUARIO AUTENTICADO ===============

// POST /api/transfers - Crear nueva transferencia
router.post('/', authenticateToken, transferenciaController.createTransferencia);
/*
{
  "usuarioDestinatarioId": "uuid-del-usuario-destinatario",
  "criptomonedaId": "uuid-de-la-criptomoneda",
  "cantidad": 0.5,
  "concepto": "Transferencia de prueba"
}
*/

// POST /api/transfers/:id/process - Procesar transferencia con código
router.post('/:id/process', authenticateToken, transferenciaController.procesarTransferencia);
/*
{
  "codigoVerificacion": "123456"
}
*/

// GET /api/transfers/my - Obtener mis transferencias
router.get('/my', authenticateToken, transferenciaController.getMyTransferencias);

// GET /api/transfers/:id - Obtener transferencia por ID
router.get('/:id', authenticateToken, transferenciaController.getTransferenciaById);

// PUT /api/transfers/:id/cancel - Cancelar transferencia
router.put('/:id/cancel', authenticateToken, transferenciaController.cancelarTransferencia);

// POST /api/transfers/:id/resend-code - Reenviar código de verificación
router.post('/:id/resend-code', authenticateToken, transferenciaController.reenviarCodigo);

// POST /api/transfers/verify-funds - Verificar fondos antes de transferir
router.post('/verify-funds', authenticateToken, transferenciaController.verificarFondos);
/*
{
  "criptomonedaId": "uuid-de-la-criptomoneda",
  "cantidad": 0.5
}
*/

// =============== RUTAS ADMINISTRATIVAS ===============

// GET /api/transfers - Obtener todas las transferencias (admin)
router.get('/', authenticateToken,/* isAdmin,*/ transferenciaController.getAllTransferencias);

// GET /api/transfers/stats - Estadísticas de transferencias (admin)
router.get('/stats', authenticateToken, /*isAdmin,*/ transferenciaController.getTransferenciaStats);

module.exports = router;