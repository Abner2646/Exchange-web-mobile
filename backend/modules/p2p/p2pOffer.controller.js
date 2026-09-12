const { P2POffer } = require('../../models/index.js');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');
const authz = require('../../utils/authz');

// No Sequelize transactions are opened in this controller — no rollback handling needed.

// List offers with filters
const getOfertas = async (req, res) => {
  const filters = { ...req.query };
  const result = await P2POffer.getAll(filters);
  res.json(result);
};

// List active offers with filters
const getOfertasActivas = async (req, res) => {
  const filters = { ...req.query, active: true };
  const result = await P2POffer.getAll(filters);
  res.json(result);
};

// Get offer by ID
const getOfertaById = async (req, res) => {
  const { id } = req.params;
  const result = await P2POffer.getById(id);
  if (!result) throw new AppError(404, errorCodes.OFFER_NOT_FOUND, 'Offer not found');
  res.json(result);
};

// Create new offer
const createOferta = async (req, res) => {
  const userId = req.user.id;
  const { type, direccionFiat, metodosPagoIds, ...restBody } = req.body;

  if (type === 'sell' && !direccionFiat) {
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
    type,
    direccionFiat,
    metodosPagoIds,
    userId,
  };

  const nuevaOferta = await P2POffer.createOffer(ofertaData);
  res.status(201).json({
    message: 'Oferta creada exitosamente',
    data: nuevaOferta,
  });
};

// Update offer
const updateOferta = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const updateData = req.body;

  if (updateData.type === 'sell') {
    const ofertaActual = await P2POffer.findByPk(id);
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

  const updated = await P2POffer.updateOffer(id, updateData, userId);
  res.json({
    message: 'Oferta actualizada exitosamente. La fecha de publicación ha sido renovada.',
    data: updated,
  });
};

// Add payment methods to an offer
const addMetodosPago = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { metodosPagoIds } = req.body;

  if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
    throw new AppError(
      400,
      errorCodes.OFFER_PAYMENT_METHODS_REQUIRED,
      'At least one payment method (metodosPagoIds) is required'
    );
  }

  const updated = await P2POffer.addMetodosPago(id, metodosPagoIds, userId);
  res.json({
    message: 'Métodos de pago agregados exitosamente',
    data: updated,
  });
};

// Remove payment methods from an offer
const removeMetodosPago = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { metodosPagoIds } = req.body;

  if (!metodosPagoIds || !Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
    throw new AppError(
      400,
      errorCodes.OFFER_PAYMENT_METHODS_REQUIRED,
      'At least one payment method to remove (metodosPagoIds) is required'
    );
  }

  const updated = await P2POffer.removeMetodosPago(id, metodosPagoIds, userId);
  res.json({
    message: 'Métodos de pago eliminados exitosamente',
    data: updated,
  });
};

// Deactivate offer
const deleteOferta = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const oferta = await P2POffer.findByPk(id);
  if (!oferta) throw new AppError(404, errorCodes.OFFER_NOT_FOUND, 'Offer not found');

  if (!authz.canAccessResource(req.user, oferta.userId)) {
    throw new AppError(403, errorCodes.OFFER_FORBIDDEN, 'You do not have permission to delete this offer');
  }

  await P2POffer.updateStatus(id, false);
  res.json({ message: 'Oferta desactivada exitosamente' });
};

// Update offer status (admin)
const updateOfertaStatus = async (req, res) => {
  const { id } = req.params;
  const { active } = req.body;

  const updated = await P2POffer.updateStatus(id, active);

  const message = active
    ? 'Oferta activada exitosamente. La fecha de publicación ha sido renovada.'
    : 'Oferta desactivada exitosamente';

  res.json({ message, data: updated });
};

// Search offers
const searchOfertas = async (req, res) => {
  const { q: term, limit = 10 } = req.query;
  if (!term) throw new AppError(400, errorCodes.OFFER_SEARCH_TERM_REQUIRED, 'Search term is required');

  const results = await P2POffer.search(term, parseInt(limit));
  res.json(results);
};

// Get my offers
const getMyOfertas = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;

  const result = await P2POffer.getUserOfferHistory(userId, parseInt(page), parseInt(limit));
  res.json(result);
};

// Find compatible offers
const findCompatibleOffers = async (req, res) => {
  const { type, cryptoId, amount, fiatCurrency, paymentMethodId } = req.query;

  if (!type || !cryptoId || !amount || !fiatCurrency) {
    throw new AppError(
      400,
      errorCodes.OFFER_COMPATIBLE_PARAMS_REQUIRED,
      'Required query params: type, cryptoId, amount, fiatCurrency'
    );
  }

  const ofertas = await P2POffer.findCompatibleOffers(
    type,
    cryptoId,
    parseFloat(amount),
    fiatCurrency,
    paymentMethodId
  );

  res.json(ofertas);
};

// Check if an offer can be accepted
const checkOfferAcceptability = async (req, res) => {
  const { id } = req.params;
  const { amount } = req.query;

  if (!amount) throw new AppError(400, errorCodes.OFFER_CANTIDAD_REQUIRED, 'amount is required');

  const result = await P2POffer.canAcceptOffer(id, amount);
  res.json(result);
};

// Get offer statistics (admin)
const getOfertasStats = async (req, res) => {
  const stats = await P2POffer.getStats();
  res.json(stats);
};

// Toggle own offer active/inactive
const toggleMyOferta = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const oferta = await P2POffer.findByPk(id);
  if (!oferta) throw new AppError(404, errorCodes.OFFER_NOT_FOUND, 'Offer not found');

  if (oferta.userId !== userId) {
    throw new AppError(403, errorCodes.OFFER_FORBIDDEN, 'You do not have permission to modify this offer');
  }

  const updated = await P2POffer.updateStatus(id, !oferta.active);

  const message = updated.active
    ? 'Oferta activada exitosamente. La fecha de publicación ha sido renovada.'
    : 'Oferta desactivada exitosamente';

  res.json({ message, data: updated });
};

// Get offers by crypto
const getOfertasByCrypto = async (req, res) => {
  const { cryptoId } = req.params;
  const filters = { ...req.query, cryptoId };

  const result = await P2POffer.getAll(filters);
  res.json(result);
};

// Get offers by type
const getOfertasByTipo = async (req, res) => {
  const { type } = req.params;
  if (!['buy', 'sell'].includes(type)) {
    throw new AppError(400, errorCodes.OFFER_INVALID_TYPE, 'type must be "compra" or "venta"');
  }

  const filters = { ...req.query, type };
  const result = await P2POffer.getAll(filters);
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
