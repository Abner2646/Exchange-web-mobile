const { OfertaP2P } = require('../models/index.js');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');

// No Sequelize transactions are opened in this controller — no rollback handling needed.

// List offers with filters
const getOfertas = async (req, res) => {
  const filters = { ...req.query };
  const result = await OfertaP2P.getAll(filters);
  res.json(result);
};

// List active offers with filters
const getOfertasActivas = async (req, res) => {
  const filters = { ...req.query, activa: true };
  const result = await OfertaP2P.getAll(filters);
  res.json(result);
};

// Get offer by ID
const getOfertaById = async (req, res) => {
  const { id } = req.params;
  const result = await OfertaP2P.getById(id);
  if (!result) throw new AppError(404, errorCodes.OFFER_NOT_FOUND, 'Offer not found');
  res.json(result);
};

// Create new offer
const createOferta = async (req, res) => {
  const usuarioId = req.user.id;
  const { tipo, direccionFiat, metodosPagoIds, ...restBody } = req.body;

  if (tipo === 'venta' && !direccionFiat) {
    throw new AppError(
      400,
      errorCodes.OFFER_DIRECCION_FIAT_REQUIRED,
      'Payment address (direccionFiat) is required for sell offers'
    );
  }

  if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
    throw new AppError(
      400,
      errorCodes.OFFER_PAYMENT_METHODS_REQUIRED,
      'At least one payment method (metodosPagoIds) is required'
    );
  }

  const ofertaData = {
    ...restBody,
    tipo,
    direccionFiat,
    metodosPagoIds,
    usuarioId,
  };

  const nuevaOferta = await OfertaP2P.createOffer(ofertaData);
  res.status(201).json({
    message: 'Oferta creada exitosamente',
    data: nuevaOferta,
  });
};

// Update offer
const updateOferta = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;
  const updateData = req.body;

  if (updateData.tipo === 'venta') {
    const ofertaActual = await OfertaP2P.findByPk(id);
    if (ofertaActual && !updateData.direccionFiat && !ofertaActual.direccionFiat) {
      throw new AppError(
        400,
        errorCodes.OFFER_DIRECCION_FIAT_REQUIRED,
        'Payment address (direccionFiat) is required for sell offers'
      );
    }
  }

  if (updateData.metodosPagoIds !== undefined) {
    if (!Array.isArray(updateData.metodosPagoIds) || updateData.metodosPagoIds.length === 0) {
      throw new AppError(
        400,
        errorCodes.OFFER_PAYMENT_METHODS_REQUIRED,
        'At least one payment method must be kept'
      );
    }
  }

  const updated = await OfertaP2P.updateOffer(id, updateData, usuarioId);
  res.json({
    message: 'Oferta actualizada exitosamente. La fecha de publicación ha sido renovada.',
    data: updated,
  });
};

// Add payment methods to an offer
const addMetodosPago = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;
  const { metodosPagoIds } = req.body;

  if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
    throw new AppError(
      400,
      errorCodes.OFFER_PAYMENT_METHODS_REQUIRED,
      'At least one payment method (metodosPagoIds) is required'
    );
  }

  const updated = await OfertaP2P.addMetodosPago(id, metodosPagoIds, usuarioId);
  res.json({
    message: 'Métodos de pago agregados exitosamente',
    data: updated,
  });
};

// Remove payment methods from an offer
const removeMetodosPago = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;
  const { metodosPagoIds } = req.body;

  if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
    throw new AppError(
      400,
      errorCodes.OFFER_PAYMENT_METHODS_REQUIRED,
      'At least one payment method to remove (metodosPagoIds) is required'
    );
  }

  const updated = await OfertaP2P.removeMetodosPago(id, metodosPagoIds, usuarioId);
  res.json({
    message: 'Métodos de pago eliminados exitosamente',
    data: updated,
  });
};

// Deactivate offer
const deleteOferta = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  const oferta = await OfertaP2P.findByPk(id);
  if (!oferta) throw new AppError(404, errorCodes.OFFER_NOT_FOUND, 'Offer not found');

  if (oferta.usuarioId !== usuarioId && req.user.rol !== 'admin') {
    throw new AppError(403, errorCodes.OFFER_FORBIDDEN, 'You do not have permission to delete this offer');
  }

  await OfertaP2P.updateStatus(id, false);
  res.json({ message: 'Oferta desactivada exitosamente' });
};

// Update offer status (admin)
const updateOfertaStatus = async (req, res) => {
  const { id } = req.params;
  const { activa } = req.body;

  const updated = await OfertaP2P.updateStatus(id, activa);

  const message = activa
    ? 'Oferta activada exitosamente. La fecha de publicación ha sido renovada.'
    : 'Oferta desactivada exitosamente';

  res.json({ message, data: updated });
};

// Search offers
const searchOfertas = async (req, res) => {
  const { q: term, limit = 10 } = req.query;
  if (!term) throw new AppError(400, errorCodes.OFFER_SEARCH_TERM_REQUIRED, 'Search term is required');

  const results = await OfertaP2P.search(term, parseInt(limit));
  res.json(results);
};

// Get my offers
const getMyOfertas = async (req, res) => {
  const usuarioId = req.user.id;
  const { page = 1, limit = 20 } = req.query;

  const result = await OfertaP2P.getUserOfferHistory(usuarioId, parseInt(page), parseInt(limit));
  res.json(result);
};

// Find compatible offers
const findCompatibleOffers = async (req, res) => {
  const { tipo, criptomonedaId, cantidad, monedaFiat, metodoPagoId } = req.query;

  if (!tipo || !criptomonedaId || !cantidad || !monedaFiat) {
    throw new AppError(
      400,
      errorCodes.OFFER_COMPATIBLE_PARAMS_REQUIRED,
      'Required query params: tipo, criptomonedaId, cantidad, monedaFiat'
    );
  }

  const ofertas = await OfertaP2P.findCompatibleOffers(
    tipo,
    criptomonedaId,
    parseFloat(cantidad),
    monedaFiat,
    metodoPagoId
  );

  res.json(ofertas);
};

// Check if an offer can be accepted
const checkOfferAcceptability = async (req, res) => {
  const { id } = req.params;
  const { cantidad } = req.query;

  if (!cantidad) throw new AppError(400, errorCodes.OFFER_CANTIDAD_REQUIRED, 'cantidad is required');

  const result = await OfertaP2P.canAcceptOffer(id, cantidad);
  res.json(result);
};

// Get offer statistics (admin)
const getOfertasStats = async (req, res) => {
  const stats = await OfertaP2P.getStats();
  res.json(stats);
};

// Toggle own offer active/inactive
const toggleMyOferta = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  const oferta = await OfertaP2P.findByPk(id);
  if (!oferta) throw new AppError(404, errorCodes.OFFER_NOT_FOUND, 'Offer not found');

  if (oferta.usuarioId !== usuarioId) {
    throw new AppError(403, errorCodes.OFFER_FORBIDDEN, 'You do not have permission to modify this offer');
  }

  const updated = await OfertaP2P.updateStatus(id, !oferta.activa);

  const message = updated.activa
    ? 'Oferta activada exitosamente. La fecha de publicación ha sido renovada.'
    : 'Oferta desactivada exitosamente';

  res.json({ message, data: updated });
};

// Get offers by crypto
const getOfertasByCrypto = async (req, res) => {
  const { criptomonedaId } = req.params;
  const filters = { ...req.query, criptomonedaId };

  const result = await OfertaP2P.getAll(filters);
  res.json(result);
};

// Get offers by type
const getOfertasByTipo = async (req, res) => {
  const { tipo } = req.params;
  if (!['compra', 'venta'].includes(tipo)) {
    throw new AppError(400, errorCodes.OFFER_INVALID_TYPE, 'tipo must be "compra" or "venta"');
  }

  const filters = { ...req.query, tipo };
  const result = await OfertaP2P.getAll(filters);
  res.json(result);
};

module.exports = {
  getOfertas,
  getOfertasActivas,
  getOfertaById,
  createOferta,
  updateOferta,
  addMetodosPago,
  removeMetodosPago,
  deleteOferta,
  updateOfertaStatus,
  searchOfertas,
  getMyOfertas,
  findCompatibleOffers,
  checkOfferAcceptability,
  getOfertasStats,
  toggleMyOferta,
  getOfertasByCrypto,
  getOfertasByTipo,
};
