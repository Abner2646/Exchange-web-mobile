// routes/intercambioExchange.routes.js
const express = require('express');
const router = express.Router();
const intercambioController = require('../controllers/intercambioExchange.controller');

// Middlewares
const { authenticate } = require('../middlewares/auth.middleware');
const { isAdmin } = require('../middlewares/admin.middleware');

// ================================
// RUTAS PÚBLICAS (información de mercado)
// ================================

// Información de precios (público para mostrar en charts)
router.get('/pairs/:parId/price-history', intercambioController.getPriceHistory);
router.get('/pairs/:parId/last-price', intercambioController.getLastPrice);
router.get('/pairs/:parId/volume', intercambioController.getVolumeByPair);

// ================================
// RUTAS PROTEGIDAS (requieren autenticación)
// ================================
router.use(authenticate);

// Operaciones del usuario actual
router.post('/', intercambioController.createOrder); // Crear orden
router.get('/me', intercambioController.getMyIntercambios); // Mis intercambios
router.get('/me/daily-volume', intercambioController.getMyDailyVolume); // Mi volumen diario
router.get('/me/summary', intercambioController.getMyTradingSummary); // Resumen de trading
router.post('/me/cancel-pending', intercambioController.cancelMyPendingOrders); // Cancelar mis órdenes pendientes
router.post('/check-limit', intercambioController.checkTransactionLimit); // Verificar límite antes de operar

// ================================
// RUTAS ADMINISTRATIVAS (solo admin/super_admin)
// ================================
router.use(isAdmin);

// Gestión de intercambios
router.get('/', intercambioController.getIntercambios); // GET /intercambios?estado=pendiente&tipo=compra&usuarioId=uuid&limit=50
router.get('/search', intercambioController.searchIntercambios); // GET /intercambios/search?q=username&limit=10
router.get('/stats', intercambioController.getIntercambioStats); // Estadísticas generales
router.get('/:id', intercambioController.getIntercambioById); // Intercambio específico

// Acciones administrativas
router.put('/:id/status', intercambioController.updateIntercambioStatus); // { newStatus: 'completado' }
router.put('/:id/complete', intercambioController.completeOrder); // Completar orden manualmente
router.put('/:id/fail', intercambioController.failOrder); // { reason: 'Fondos insuficientes' }

module.exports = router;