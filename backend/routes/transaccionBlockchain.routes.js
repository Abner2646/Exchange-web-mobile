const express = require('express');
const router = express.Router();
const transaccionBlockchain = require('../controllers/transaccionBlockchain.controller');

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// ================================
// RUTAS PÚBLICAS (con autenticación básica)
// ================================

// Validar dirección de criptomoneda
router.post('/validate-address', authenticateToken, transaccionBlockchain.validateAddress);
/*
{
  "direccion": "1A2B3C4D5E6F7G8H9I0J",
  "criptomonedaId": "uuid-btc"
}
*/

// ================================
// RUTAS DE USUARIO (autenticados)
// ================================

// Obtener mis transacciones
router.post('/me', authenticateToken, transaccionBlockchain.getMyTransacciones); // Bien (volver a checkear)
/*
{
  "tipo": "retiro",
  "estado": "completado",
  "limit": 20
}
*/

// Obtener límites de retiro disponibles
router.post('/me/withdrawal-limits', authenticateToken, transaccionBlockchain.getWithdrawalLimits);
/*
{
  "criptomonedaId": "uuid-btc"
}
*/

// Crear solicitud de retiro (procesamiento automático)
router.post('/retiros', authenticateToken, transaccionBlockchain.createRetiro);
/*
{
  "criptomonedaId": "uuid-btc",
  "cantidad": 0.5,
  "direccionDestino": "1A2B3C4D5E6F7G8H9I0J",
  "feeBlockchain": 0.0001
}
*/

// Cancelar mi retiro (solo si está pendiente)
//router.post('/cancel', authenticateToken, transaccionBlockchain.cancelRetiro);
// {"id": "tx-uuid-123"}

// Obtener transacción específica por ID
router.post('/get-by-id', authenticateToken, transaccionBlockchain.getTransaccionById);
//{"id": "tx-uuid-123"}

// Obtener transacción por hash de blockchain
router.post('/get-by-hash', authenticateToken, transaccionBlockchain.getTransaccionByHash);
//{"txHash": "sent_123abc456def"}

// ================================
// RUTAS DEL SISTEMA AUTOMÁTICO (admin)
// ================================

// Escanear blockchain manualmente para nuevos depósitos
router.post('/system/scan-deposits', authenticateToken, /*authorizeRoles(['admin', 'super_admin']),*/ transaccionBlockchain.scanBlockchainDeposits);
//{}

// Actualizar confirmaciones de todas las transacciones pendientes
router.post('/system/update-confirmations', authenticateToken, /*authorizeRoles(['admin', 'super_admin']),*/ transaccionBlockchain.updateAllConfirmations);
//{}

// Registrar depósito manualmente (casos especiales)
//router.post('/system/manual-deposit', authenticateToken, /*authorizeRoles(['admin', 'super_admin']),*/ transaccionBlockchain.registerManualDeposit);
/*
{
  "usuarioId": "user-uuid-123",
  "criptomonedaId": "uuid-btc", 
  "cantidad": 1.0,
  "txHash": "manual_abc123...",
  "direccionOrigen": "1XYZ789...",
  "direccionDestino": "1ABC123...",
  "confirmacionesRequeridas": 6
}
*/

// Forzar procesamiento de retiro específico
//router.post('/system/force-process', authenticateToken, /*authorizeRoles(['admin', 'super_admin']),*/ transaccionBlockchain.forceProcessWithdrawal);
//{"id": "tx-uuid-123"}

// ================================
// RUTAS DE ADMINISTRACIÓN
// ================================

// Obtener todas las transacciones con filtros (solo admin)
//router.post('/admin/list', authenticateToken, /*authorizeRoles(['admin', 'super_admin']),*/ transaccionBlockchain.getAllTransacciones);
/*
{
  "tipo": "deposito",
  "estado": "completado",
  "fechaDesde": "2025-01-01",
  "fechaHasta": "2025-01-02",
  "page": 1,
  "limit": 10
}
*/

// Obtener estadísticas del sistema (solo admin)
//router.post('/admin/stats', authenticateToken, /*authorizeRoles(['admin', 'super_admin']),*/ transaccionBlockchain.getSystemStats);
/*
{
  "fechaDesde": "2025-01-01",
  "fechaHasta": "2025-01-02"
}
*/

module.exports = router;