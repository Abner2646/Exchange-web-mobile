// routes/ofertaP2P.routes.js
const { Router } = require('express');
const router = Router();

// Middleware
const { authenticateToken, requireEmailVerified } = require('../middleware/authMiddleware.js');
const { isAdmin } = require('../middleware/adminMiddleware.js');

const asyncHandler = require('../utils/asyncHandler');
const ofertaP2PController = require('../controllers/ofertaP2P.controller.js');

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
