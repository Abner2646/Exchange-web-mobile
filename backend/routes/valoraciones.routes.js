// routes/valoracion.routes.js
const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin } = require('../middleware/adminMiddleware.js');

// Importa el controlador
const valoracionController = require('../controllers/valoraciones.controller.js');

// --------------------- RUTAS ESPECÍFICAS DEL USUARIO --------------------- //

// Obtener mis valoraciones recibidas
router.get('/me/received', authenticateToken, valoracionController.getMyRatings);

// Obtener mis valoraciones dadas
router.get('/me/given', authenticateToken, valoracionController.getMyGivenRatings);

// Obtener valoraciones pendientes (transacciones sin valorar)
router.get('/me/pending', authenticateToken, valoracionController.getPendingRatings);

// --------------------- RUTAS DE CONSULTA Y ANÁLISIS --------------------- //

// Verificar si puedo valorar una transacción específica
router.get('/can-rate/:transaccionP2PId/:usuarioEvaluadoId', authenticateToken, valoracionController.checkCanRate);

// Obtener valoraciones de una transacción específica
router.get('/transaction/:transaccionP2PId', authenticateToken, valoracionController.getTransactionRatings);

// Obtener estadísticas de reputación de un usuario específico
router.get('/user/:usuarioId/stats', authenticateToken, valoracionController.getUserReputationStats);

// Obtener valoraciones recibidas por un usuario específico
router.get('/user/:usuarioId/received', authenticateToken, valoracionController.getUserRatings);

// Obtener valoraciones dadas por un usuario específico
router.get('/user/:usuarioId/given', authenticateToken, valoracionController.getUserGivenRatings);

// Obtener resumen de valoraciones entre dos usuarios
router.get('/users/:usuario1Id/:usuario2Id/summary', authenticateToken, valoracionController.getUsersRatingSummary);

// Obtener top usuarios mejor valorados
router.get('/top-rated', authenticateToken, valoracionController.getTopRatedUsers);

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las valoraciones (con filtros)
router.get('/', authenticateToken, valoracionController.getValoraciones);

// Obtener valoración por ID
router.get('/:id', authenticateToken, valoracionController.getValoracionById);

// Crear nueva valoración
router.post('/', authenticateToken, valoracionController.createValoracion);

// Crear múltiples valoraciones (batch)
router.post('/batch', authenticateToken, valoracionController.createMultipleRatings);

// Actualizar valoración por ID
router.put('/:id', authenticateToken, valoracionController.updateValoracion);

// Eliminar valoración por ID
router.delete('/:id', authenticateToken, valoracionController.deleteValoracion);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas generales de valoraciones (solo admin)
router.get('/admin/stats', authenticateToken, isAdmin, valoracionController.getGeneralStats);

module.exports = router;