// routes/ofertaP2P.routes.js
const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken, requireEmailVerified } = require('../middleware/authMiddleware.js');
const { isAdmin } = require('../middleware/adminMiddleware.js');

const asyncHandler = require('../utils/asyncHandler');
const ofertaP2PController = require('../controllers/ofertaP2P.controller.js');

/**
 * @openapi
 * /ofertaP2P/compatible:
 *   get: { tags: [P2P ofertas], summary: Buscar ofertas compatibles, responses: { 200: { description: Ofertas } } }
 * /ofertaP2P/search:
 *   get:
 *     tags: [P2P ofertas]
 *     summary: Buscar ofertas por término
 *     parameters: [{ in: query, name: q, schema: { type: string } }]
 *     responses: { 200: { description: Ofertas } }
 * /ofertaP2P/tipo/{tipo}:
 *   get:
 *     tags: [P2P ofertas]
 *     summary: Ofertas por tipo (compra/venta)
 *     parameters: [{ in: path, name: tipo, required: true, schema: { type: string, enum: [compra, venta] } }]
 *     responses: { 200: { description: Ofertas } }
 * /ofertaP2P/criptomoneda/{criptomonedaId}:
 *   get:
 *     tags: [P2P ofertas]
 *     summary: Ofertas por cripto
 *     parameters: [{ in: path, name: criptomonedaId, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Ofertas } }
 * /ofertaP2P:
 *   get: { tags: [P2P ofertas], summary: Listar ofertas (con filtros), responses: { 200: { description: Ofertas } } }
 *   post:
 *     tags: [P2P ofertas]
 *     summary: Crear una oferta P2P
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tipo, criptomonedaId, cantidad, precio]
 *             properties:
 *               tipo: { type: string, enum: [compra, venta] }
 *               criptomonedaId: { type: string, format: uuid }
 *               cantidad: { type: number }
 *               precio: { type: number }
 *     responses: { 201: { description: Oferta creada }, 400: { $ref: '#/components/responses/BadRequest' } }
 * /ofertaP2P/activas:
 *   get: { tags: [P2P ofertas], summary: Ofertas activas, responses: { 200: { description: Ofertas activas } } }
 * /ofertaP2P/me/ofertas:
 *   get: { tags: [P2P ofertas], summary: Mis ofertas, responses: { 200: { description: Mis ofertas } } }
 * /ofertaP2P/{id}:
 *   get:
 *     tags: [P2P ofertas]
 *     summary: Obtener una oferta por id
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Oferta }, 404: { $ref: '#/components/responses/BadRequest' } }
 *   put:
 *     tags: [P2P ofertas]
 *     summary: Actualizar una oferta
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Oferta actualizada } }
 *   delete:
 *     tags: [P2P ofertas]
 *     summary: Desactivar una oferta
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Oferta desactivada } }
 * /ofertaP2P/{id}/toggle:
 *   patch:
 *     tags: [P2P ofertas]
 *     summary: Activar/desactivar mi oferta
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: OK } }
 * /ofertaP2P/{id}/can-accept:
 *   get:
 *     tags: [P2P ofertas]
 *     summary: Verificar si puedo aceptar una oferta
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Resultado } }
 * /ofertaP2P/{id}/metodos-pago:
 *   post:
 *     tags: [P2P ofertas]
 *     summary: Agregar métodos de pago a una oferta
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Métodos agregados } }
 *   delete:
 *     tags: [P2P ofertas]
 *     summary: Quitar métodos de pago de una oferta
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Métodos quitados } }
 * /ofertaP2P/admin/stats:
 *   get: { tags: [P2P ofertas - admin], summary: Estadísticas de ofertas (admin), responses: { 200: { description: Stats } } }
 * /ofertaP2P/{id}/status:
 *   patch:
 *     tags: [P2P ofertas - admin]
 *     summary: Cambiar el estado de una oferta (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Estado actualizado } }
 */

// --------------------- PUBLIC / SEARCH ROUTES ---------------------

// Find compatible offers
router.get('/compatible', authenticateToken, asyncHandler(ofertaP2PController.findCompatibleOffers));

// Search offers by term
router.get('/search', authenticateToken, asyncHandler(ofertaP2PController.searchOfertas));

// Get offers by type (compra/venta)
router.get('/tipo/:tipo', authenticateToken, asyncHandler(ofertaP2PController.getOfertasByTipo));

// Get offers by crypto
router.get('/criptomoneda/:criptomonedaId', authenticateToken, asyncHandler(ofertaP2PController.getOfertasByCrypto));

// --------------------- BASIC CRUD ROUTES ---------------------

// Get all offers (active and inactive, with filters)
router.get('/', authenticateToken, asyncHandler(ofertaP2PController.getOfertas));

// Get all active offers (with filters)
router.get('/activas', authenticateToken, asyncHandler(ofertaP2PController.getOfertasActivas));

// Get offer by ID (even if deactivated)
router.get('/:id', authenticateToken, asyncHandler(ofertaP2PController.getOfertaById));

// Create new offer
router.post('/', authenticateToken, requireEmailVerified, asyncHandler(ofertaP2PController.createOferta));

// Update offer by ID
router.put('/:id', authenticateToken, requireEmailVerified, asyncHandler(ofertaP2PController.updateOferta));

// Deactivate offer by ID
router.delete('/:id', authenticateToken, requireEmailVerified, asyncHandler(ofertaP2PController.deleteOferta));

// --------------------- USER-SPECIFIC ROUTES ---------------------

// Get my offers
router.get('/me/ofertas', authenticateToken, asyncHandler(ofertaP2PController.getMyOfertas));

// Toggle my offer active/inactive
router.patch('/:id/toggle', authenticateToken, requireEmailVerified, asyncHandler(ofertaP2PController.toggleMyOferta));

// Check if I can accept an offer
router.get('/:id/can-accept', authenticateToken, asyncHandler(ofertaP2PController.checkOfferAcceptability));

// --------------------- PAYMENT METHOD ROUTES ---------------------

// Add payment methods to an offer
router.post('/:id/metodos-pago', authenticateToken, requireEmailVerified, asyncHandler(ofertaP2PController.addMetodosPago));

// Remove payment methods from an offer
router.delete('/:id/metodos-pago', authenticateToken, requireEmailVerified, asyncHandler(ofertaP2PController.removeMetodosPago));

// --------------------- ADMIN ROUTES ---------------------

// Get offer statistics (admin only)
router.get('/admin/stats', authenticateToken, isAdmin, asyncHandler(ofertaP2PController.getOfertasStats));

// Change offer status (admin only)
router.patch('/:id/status', authenticateToken, isAdmin, asyncHandler(ofertaP2PController.updateOfertaStatus));

module.exports = router;
