// routes/walletMaestra.routes.js
const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// Importa el controlador de wallets maestras
const walletMaestraController = require('../controllers/walletMaestra.controller.js');

// =================== RUTAS CRUD BÁSICAS ===================

// Obtener todas las wallets maestras (solo admin)
router.get('/', authenticateToken, isSuperAdmin, walletMaestraController.getWalletsMaestras); //Bien

// Obtener wallet maestra por ID (solo admin)
router.get('/:id', authenticateToken, isSuperAdmin, walletMaestraController.getWalletMaestraById); //Bien

// Crear nueva wallet maestra HD (solo super admin)
router.post('/', authenticateToken, isSuperAdmin, walletMaestraController.createWalletMaestra);

// Crear múltiples wallets maestras (bulk creation) (solo super admin)
//router.post('/bulk', authenticateToken, isSuperAdmin, walletMaestraController.createBulkWallets);

// Actualizar wallet maestra por ID (solo admin)
//router.put('/:id', authenticateToken, isSuperAdmin, walletMaestraController.updateWalletMaestra);

// Eliminar wallet maestra por ID (solo super admin)
//router.delete('/:id', authenticateToken, isSuperAdmin, walletMaestraController.deleteWalletMaestra);

// =================== RUTAS DE BÚSQUEDA Y CONSULTA ===================

// Buscar wallets maestras por término múltiple
//router.get('/search/query', authenticateToken, isSuperAdmin, walletMaestraController.searchWalletsMaestras);

// Obtener wallet por criptomoneda específica
//router.get('/crypto/:criptomonedaId', authenticateToken, /*isSuperAdmin,*/ walletMaestraController.getWalletByCriptomoneda);

// Obtener wallet por dirección específica
//router.get('/address/:address', authenticateToken, isSuperAdmin, walletMaestraController.getWalletByAddress);

// Obtener wallet por XPUB específico (solo super admin)
//router.get('/xpub/:xpub', authenticateToken, isSuperAdmin, walletMaestraController.getWalletByXpub);

// Obtener solo wallets activas con filtros
router.get('/status/active', authenticateToken, isSuperAdmin, walletMaestraController.getActiveWallets); //Bien

// =================== RUTAS DE BALANCE Y MONITOREO ===================

// Obtener wallets con balance bajo
//router.get('/monitoring/low-balance', authenticateToken, isSuperAdmin, walletMaestraController.getLowBalanceWallets);

// Obtener wallets con balance alto
//router.get('/monitoring/high-balance', authenticateToken, isSuperAdmin, walletMaestraController.getHighBalanceWallets);

// Obtener resumen completo de todos los balances
//router.get('/balances/summary', authenticateToken, /*isSuperAdmin,*/ walletMaestraController.getBalanceSummary);

// Obtener distribución detallada de fondos (Super Admin)
router.get('/balances/distribution', authenticateToken, isSuperAdmin, walletMaestraController.getFundsDistribution); //Bien

// =================== RUTAS DE GESTIÓN DE ESTADO ===================

// Actualizar estado de wallet (activar/desactivar)
//router.patch('/:id/status', authenticateToken, /*isSuperAdmin,*/ walletMaestraController.updateWalletStatus); //"error": "El campo activa debe ser un valor booleano"

// Alternar estado de wallet
//router.patch('/:id/toggle', authenticateToken, isSuperAdmin, walletMaestraController.toggleWalletStatus);

// =================== RUTAS DE GESTIÓN DE BALANCES ===================

// Actualizar balance específico
//router.patch('/:id/balance', authenticateToken, isSuperAdmin, walletMaestraController.updateWalletBalance);

// Sumar al balance
//router.post('/:id/balance/add', authenticateToken, isSuperAdmin, walletMaestraController.addToBalance);

// Restar del balance
//router.post('/:id/balance/subtract', authenticateToken, isSuperAdmin, walletMaestraController.subtractFromBalance);

// =================== RUTAS DE SINCRONIZACIÓN CON BLOCKCHAIN ===================

// Sincronizar balance individual con blockchain
//router.post('/:id/sync', authenticateToken, /*isSuperAdmin,*/ walletMaestraController.syncBalance);

// Sincronizar todos los balances (webhook o batch)
//router.post('/sync/all', apiKeyAuth, walletMaestraController.syncAllBalances);

// =================== RUTAS DE TREASURY Y OPERACIONES ===================

// Consolidar fondos entre wallets
//router.post('/operations/consolidate', authenticateToken, isSuperAdmin, walletMaestraController.consolidateFunds);

// Métricas completas de tesorería
router.get('/treasury/metrics', authenticateToken, isSuperAdmin, walletMaestraController.getTreasuryMetrics); // Bien

// =================== RUTAS DE DASHBOARD Y ANÁLISIS ===================

// Dashboard completo de wallets maestras
router.get('/dashboard/overview', authenticateToken, isSuperAdmin, walletMaestraController.getWalletsDashboard); //Bien

// =================== RUTAS ADMINISTRATIVAS ===================

// Obtener estadísticas detalladas de wallets maestras
router.get('/admin/stats', authenticateToken, isSuperAdmin, walletMaestraController.getWalletMaestraStats); // Bien

// Exportar wallets a CSV con metadatos
router.get('/admin/export', authenticateToken, isSuperAdmin, walletMaestraController.exportWallets); // Bien

// Health check del sistema de wallets maestras
router.get('/admin/health', authenticateToken, isSuperAdmin, walletMaestraController.healthCheck); // Bien

// =================== RUTAS ESPECÍFICAS PARA HD WALLETS ===================

// Validar XPUB para una red específica
//router.post('/validation/xpub', authenticateToken, isSuperAdmin, walletMaestraController.validateXpub);

// Obtener siguiente índice de derivación disponible
//router.get('/:id/derivation/next-index', authenticateToken, isSuperAdmin, walletMaestraController.getNextDerivationIndex);

// =================== RUTAS DE INTEGRACIÓN EXTERNA ===================

// Webhook para actualización de balances desde blockchain watchers
//router.post('/webhooks/balance-update', apiKeyAuth, walletMaestraController.syncAllBalances);

// API para servicios internos (menor autenticación)
router.get('/internal/active-by-crypto/:criptomonedaId', authenticateToken, isSuperAdmin, walletMaestraController.getWalletByCriptomoneda);

// =================== MIDDLEWARE DE VALIDACIÓN DE RUTAS ===================

// Middleware para validar UUIDs en parámetros
router.param('id', (req, res, next, id) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(id)) {
    return res.status(400).json({
      success: false,
      error: 'ID debe ser un UUID válido',
      code: 'INVALID_UUID_FORMAT'
    });
  }
  
  next();
});

// Middleware para validar criptomonedaId en rutas
router.param('criptomonedaId', (req, res, next, criptomonedaId) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(criptomonedaId)) {
    return res.status(400).json({
      success: false,
      error: 'criptomonedaId debe ser un UUID válido',
      code: 'INVALID_CRYPTO_ID_FORMAT'
    });
  }
  
  next();
});

// Middleware para validar direcciones en rutas
router.param('address', (req, res, next, address) => {
  if (!address || address.length < 10 || address.length > 255) {
    return res.status(400).json({
      success: false,
      error: 'Dirección debe tener entre 10 y 255 caracteres',
      code: 'INVALID_ADDRESS_FORMAT'
    });
  }
  
  next();
});

// Middleware para rate limiting en rutas sensibles (opcional)
const rateLimit = require('express-rate-limit');

const heavyOperationsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 requests por ventana por IP
  message: {
    success: false,
    error: 'Demasiadas operaciones pesadas. Intenta nuevamente en 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

// Aplicar rate limiting a operaciones pesadas
router.use('/operations/consolidate', heavyOperationsLimiter);
router.use('/sync/all', heavyOperationsLimiter);
router.use('/bulk', heavyOperationsLimiter);

module.exports = router;