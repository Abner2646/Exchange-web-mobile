// routes/categoriaReclamo.routes.js
const { Router } = require('express');
const router = Router();

// Middleware de autenticación
const { authenticateToken } = require('../middleware/authMiddleware.js');

// Importa el controlador de categorías de reclamo
const categoriaReclamoController = require('../controllers/categoriaReclamo.controller.js');

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las categorías
router.get('/', authenticateToken, categoriaReclamoController.getCategorias);

// Obtener categoría por ID
router.get('/:id', authenticateToken, categoriaReclamoController.getCategoriaById);

// Crear nueva categoría
router.post('/', authenticateToken, categoriaReclamoController.createCategoria);

// Actualizar categoría por ID
router.put('/:id', authenticateToken, categoriaReclamoController.updateCategoria);

// Eliminar categoría por ID
router.delete('/:id', authenticateToken, categoriaReclamoController.deleteCategoria);

// --------------------- RUTAS ADICIONALES --------------------- //

// Buscar categorías por término
router.get('/search/query', authenticateToken, categoriaReclamoController.searchCategorias);

// Obtener estadísticas de categorías
router.get('/admin/stats', authenticateToken, categoriaReclamoController.getCategoriaStats);

// Obtener solo categorías activas (ruta pública para formularios)
router.get('/public/active', categoriaReclamoController.getCategoriasActivas);

// Actualizar estado específico de categoría
router.patch('/:id/status', authenticateToken, categoriaReclamoController.updateCategoriaStatus);

// Alternar estado de categoría (activar/desactivar)
router.patch('/:id/toggle', authenticateToken, categoriaReclamoController.toggleCategoriaStatus);

module.exports = router;