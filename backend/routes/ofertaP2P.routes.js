// routes/ofertaP2P.routes.js
const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken } = require('../middleware/authMiddleware.js');
const { isAdmin } = require('../middleware/adminMiddleware.js'); // Asumiendo que tienes este middleware

// Importa el controlador
const ofertaP2PController = require('../controllers/ofertaP2P.controller.js');

// --------------------- RUTAS PÚBLICAS/BÚSQUEDA --------------------- //

// Buscar ofertas compatibles (puede ser público o requerir auth según tu lógica)
router.get('/compatible', authenticateToken, ofertaP2PController.findCompatibleOffers);

// Buscar ofertas por término
router.get('/search', authenticateToken, ofertaP2PController.searchOfertas);

// Obtener ofertas por tipo (compra/venta)
router.get('/tipo/:tipo', authenticateToken, ofertaP2PController.getOfertasByTipo);

// Obtener ofertas por criptomoneda
router.get('/criptomoneda/:criptomonedaId', authenticateToken, ofertaP2PController.getOfertasByCrypto);

// --------------------- RUTAS CRUD BÁSICAS --------------------- //

// Obtener todas las ofertas activas e inactivas (con filtros)
router.get('/', authenticateToken, ofertaP2PController.getOfertas); // Bien

// Obtener todas las ofertas activas (con filtros)
router.get('/', authenticateToken, ofertaP2PController.getOfertasActivas); // <------------

// Obtener oferta por ID aunque esté desactivada
router.get('/:id', authenticateToken, ofertaP2PController.getOfertaById); // <------------

// Crear nueva oferta
router.post('/', authenticateToken, ofertaP2PController.createOferta); // Bien

// Actualizar oferta por ID
router.put('/:id', authenticateToken, ofertaP2PController.updateOferta); // Bien

// Eliminar/Desactivar oferta por ID
router.delete('/:id', authenticateToken, ofertaP2PController.deleteOferta); // <------------

// --------------------- RUTAS ESPECÍFICAS DEL USUARIO --------------------- //

// Obtener mis ofertas
router.get('/me/ofertas', authenticateToken, ofertaP2PController.getMyOfertas);

// Activar/Desactivar mi oferta
router.patch('/:id/toggle', authenticateToken, ofertaP2PController.toggleMyOferta);

// Verificar si puedo aceptar una oferta
router.get('/:id/can-accept', authenticateToken, ofertaP2PController.checkOfferAcceptability);

// --------------------- RUTAS ADMINISTRATIVAS --------------------- //

// Obtener estadísticas de ofertas (solo admin)
router.get('/admin/stats', authenticateToken, isAdmin, ofertaP2PController.getOfertasStats);

// Cambiar estado de oferta (solo admin)
router.patch('/:id/status', authenticateToken, isAdmin, ofertaP2PController.updateOfertaStatus);

module.exports = router;