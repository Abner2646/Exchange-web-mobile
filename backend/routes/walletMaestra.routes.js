// routes/walletMaestra.routes.js
const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin, isSuperAdmin } = require('../middleware/adminMiddleware.js');

// Importa el controlador de wallets maestras
const walletMaestraController = require('../controllers/walletMaestra.controller.js');

/**
 * @openapi
 * /walletMaestra:
 *   get: { tags: [Wallets maestras (super admin)], summary: Listar wallets maestras, responses: { 200: { description: Wallets }, 401: { $ref: '#/components/responses/Unauthorized' } } }
 *   post: { tags: [Wallets maestras (super admin)], summary: Crear una wallet maestra HD, responses: { 201: { description: Wallet creada } } }
 * /walletMaestra/{id}:
 *   get:
 *     tags: [Wallets maestras (super admin)]
 *     summary: Wallet maestra por id
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Wallet }, 404: { $ref: '#/components/responses/BadRequest' } }
 * /walletMaestra/status/active:
 *   get: { tags: [Wallets maestras (super admin)], summary: Wallets activas, responses: { 200: { description: Wallets } } }
 * /walletMaestra/balances/distribution:
 *   get: { tags: [Wallets maestras (super admin)], summary: Distribución detallada de fondos, responses: { 200: { description: Distribución } } }
 * /walletMaestra/treasury/metrics:
 *   get: { tags: [Wallets maestras (super admin)], summary: Métricas de tesorería, responses: { 200: { description: Métricas } } }
 * /walletMaestra/dashboard/overview:
 *   get: { tags: [Wallets maestras (super admin)], summary: Dashboard de wallets, responses: { 200: { description: Dashboard } } }
 * /walletMaestra/admin/stats:
 *   get: { tags: [Wallets maestras (super admin)], summary: Estadísticas de wallets, responses: { 200: { description: Stats } } }
 * /walletMaestra/admin/export:
 *   get: { tags: [Wallets maestras (super admin)], summary: Exportar wallets a CSV, responses: { 200: { description: CSV } } }
 * /walletMaestra/admin/health:
 *   get: { tags: [Wallets maestras (super admin)], summary: Health check del sistema de wallets, responses: { 200: { description: Estado } } }
 * /walletMaestra/internal/active-by-crypto/{criptomonedaId}:
 *   get:
 *     tags: [Wallets maestras (super admin)]
 *     summary: Wallet activa por cripto (servicios internos)
 *     parameters: [{ in: path, name: criptomonedaId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Wallet } }
 */

// =================== RUTAS CRUD BÁSICAS ===================

// Obtener todas las wallets maestras (solo admin)
router.get('/', authenticateToken, isSuperAdmin, walletMaestraController.getWalletsMaestras); //Bien

// Obtener wallet maestra por ID (solo admin)
router.get('/:id', authenticateToken, isSuperAdmin, walletMaestraController.getWalletMaestraById); //Bien

// Crear nueva wallet maestra HD (solo super admin)
router.post('/', authenticateToken, isSuperAdmin, walletMaestraController.createWalletMaestra);

// =================== RUTAS DE BÚSQUEDA Y CONSULTA ===================

// Obtener solo wallets activas con filtros
router.get('/status/active', authenticateToken, isSuperAdmin, walletMaestraController.getActiveWallets); //Bien

// =================== RUTAS DE BALANCE Y MONITOREO ===================

// Obtener distribución detallada de fondos (Super Admin)
router.get('/balances/distribution', authenticateToken, isSuperAdmin, walletMaestraController.getFundsDistribution); //Bien

// =================== RUTAS DE TREASURY Y OPERACIONES ===================

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

// =================== RUTAS DE INTEGRACIÓN EXTERNA ===================

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

module.exports = router;
