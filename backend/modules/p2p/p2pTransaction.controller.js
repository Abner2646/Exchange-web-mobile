const { Op } = require('sequelize');
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #10): Op, Crypto y
// User se usaban en getMyTransacciones y getTransactionHistory sin estar
// importados acá — ReferenceError garantizado en las dos rutas activas
// GET /me/transacciones y GET /history/:otroUsuarioId.
const { P2PTransaction, Crypto, User } = require('../../models/index.js');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');
const authz = require('../../utils/authz');

// No controller-level Sequelize transactions in this file.
// The model methods (createTransaction, confirmPayment, completeTransaction,
// cancelTransaction) each open and manage their own Sequelize transaction
// internally — they always rollback-then-throw on failure and commit on success.
// The controller simply calls the model method; if it throws, asyncHandler
// forwards the error to the central handler. No rollback needed here.

// Traduce los errores de negocio que lanzan los métodos del modelo (plain Error
// con mensaje en español, incl. la máquina de estados) al envelope canónico
// AppError, para que un rechazo de regla de negocio devuelva su 4xx tipado y no
// un 500 sanitizado (mismo patrón que transferencia.controller.cancelTransfer).
// Lo desconocido se re-lanza tal cual → el handler central lo sanitiza a 500
// (guardrail: no filtrar internals). El match es por fragmento estable del mensaje;
// los AppError ya tipados (los que lanza este controller) pasan sin tocar.
function mapP2PModelError(error) {
  if (error instanceof AppError) return error;
  const msg = error.message || '';
  // Autorización (role/participante) → 403
  if (msg.includes('Solo el comprador') || msg.includes('Solo el vendedor') || msg.includes('No tienes permiso')) {
    return new AppError(403, errorCodes.P2P_TX_FORBIDDEN, 'No tenés permiso para esta operación sobre la transacción');
  }
  // No encontrado → 404 (oferta vs transacción)
  if (msg.includes('Oferta no encontrada')) {
    return new AppError(404, errorCodes.P2P_TX_OFFER_NOT_FOUND, 'Oferta no encontrada');
  }
  if (msg.includes('Transacción no encontrada')) {
    return new AppError(404, errorCodes.P2P_TX_NOT_FOUND, 'Transacción no encontrada');
  }
  // Reglas de negocio en la creación → 400
  if (msg.includes('no está activa')) {
    return new AppError(400, errorCodes.P2P_TX_OFFER_INACTIVE, 'La oferta no está activa');
  }
  if (msg.includes('fuera del rango')) {
    return new AppError(400, errorCodes.P2P_TX_AMOUNT_OUT_OF_RANGE, 'La cantidad está fuera del rango permitido por la oferta');
  }
  if (msg.includes('Fondos insuficientes') || msg.includes('no tiene balance')) {
    return new AppError(400, errorCodes.P2P_TX_INSUFFICIENT_FUNDS, 'El vendedor no tiene fondos suficientes para la transacción');
  }
  if (msg.includes('mismo usuario')) {
    return new AppError(400, errorCodes.P2P_TX_OWN_OFFER, 'El comprador y el vendedor no pueden ser el mismo usuario');
  }
  // Transiciones de la máquina de estados → 400
  if (msg.includes('No se puede') || msg.includes('ya está cancelada')) {
    return new AppError(400, errorCodes.P2P_TX_INVALID_STATE, 'La transacción no está en un estado válido para esta operación');
  }
  return error;
}

// List transactions with filters
const getTransacciones = async (req, res) => {
  const filters = { ...req.query };
  const result = await P2PTransaction.getAll(filters);
  res.json(result);
};

// Get transaction by ID
const getTransaccionById = async (req, res) => {
  const { id } = req.params;
  const result = await P2PTransaction.getById(id);
  if (!result) throw new AppError(404, errorCodes.P2P_TX_NOT_FOUND, 'Transaction not found');

  // Verify the requesting user has access to this transaction
  const userId = req.user.id;
  if (!authz.isAdmin(req.user) &&
      result.buyerId !== userId &&
      result.sellerId !== userId) {
    throw new AppError(403, errorCodes.P2P_TX_FORBIDDEN, 'You do not have permission to view this transaction');
  }

  res.json(result);
};

// Create new transaction (initiate P2P exchange)
const createTransaccion = async (req, res) => {
  const userId = req.user.id;
  const {
    offerId,
    amount,
    paymentMethodId
  } = req.body;

  // Fetch offer data
  const { P2POffer } = require('../../models/index.js');
  const oferta = await P2POffer.findByPk(offerId, {
    include: ['crypto']
  });

  if (!oferta) {
    throw new AppError(404, errorCodes.P2P_TX_OFFER_NOT_FOUND, 'Offer not found');
  }

  // Validate user is not accepting their own offer
  if (oferta.userId === userId) {
    throw new AppError(400, errorCodes.P2P_TX_OWN_OFFER, 'You cannot accept your own offer');
  }

  // Determine buyer and seller
  let buyerId, sellerId;
  if (oferta.type === 'sell') {
    sellerId = oferta.userId;
    buyerId = userId;
  } else {
    buyerId = oferta.userId;
    sellerId = userId;
  }

  const transaccionData = {
    offerId,
    buyerId,
    sellerId,
    cryptoId: oferta.cryptoId,
    amount,
    unitPrice: oferta.unitPrice,
    paymentMethodId
  };

  // Model opens and manages its own Sequelize transaction internally;
  // on any failure it rolls back and re-throws — no rollback needed here.
  // Business errors (inactive offer, amount out of range, insufficient seller
  // funds) are translated to their typed 4xx envelope; unknown → sanitized 500.
  let nuevaTransaccion;
  try {
    nuevaTransaccion = await P2PTransaction.createTransaction(transaccionData);
  } catch (error) {
    throw mapP2PModelError(error);
  }

  res.status(201).json({
    message: 'Transacción iniciada exitosamente. Los fondos han sido bloqueados.',
    data: nuevaTransaccion
  });
};

// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #11): updateTransaccionStatus
// y lockCryptos llamaban a P2PTransaction.updateStatus/.lockCryptos, que no
// existen en el modelo — TypeError garantizado en cualquiera de las dos
// rutas. No eran un simple typo para arreglar: el bloqueo de fondos ya pasa
// dentro de createTransaction (ver el comment "🔒 BLOQUEAR FONDOS" en
// transaccionesP2P.model.js), así que lockCryptos como paso aparte no
// corresponde a la máquina de estados real; y updateTransaccionStatus era
// una versión genérica y redundante de las transiciones específicas que ya
// existen y sí funcionan (confirm-payment, complete, cancel — cada una con
// su propia validación de negocio en el modelo). Se borran ambas funciones
// y sus rutas en vez de intentar mantenerlas vivas.

// Confirm payment (buyer)
// Model manages its own transaction internally — no rollback needed in controller.
const confirmPayment = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  let updated;
  try {
    updated = await P2PTransaction.confirmPayment(id, userId);
  } catch (error) {
    throw mapP2PModelError(error);
  }
  res.json({
    message: 'Pago confirmado exitosamente',
    data: updated
  });
};

// Complete transaction (seller)
// Model manages its own transaction internally — no rollback needed in controller.
const completeTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  let updated;
  try {
    updated = await P2PTransaction.completeTransaction(id, userId);
  } catch (error) {
    throw mapP2PModelError(error);
  }
  res.json({
    message: 'Transacción completada exitosamente',
    data: updated
  });
};

// Cancel transaction
// Model manages its own transaction internally — no rollback needed in controller.
const cancelTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  let updated;
  try {
    updated = await P2PTransaction.cancelTransaction(id, userId);
  } catch (error) {
    throw mapP2PModelError(error);
  }
  res.json({
    message: 'Transacción cancelada exitosamente',
    data: updated
  });
};

// Get my transactions
const getMyTransacciones = async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10, status } = req.query;

  const whereCondition = {
    [Op.or]: [
      { buyerId: userId },
      { sellerId: userId }
    ]
  };

  if (status && status !== 'todas') {
    whereCondition.status = status;
  }

  const { count, rows: transacciones } = await P2PTransaction.findAndCountAll({
    where: whereCondition,
    include: [
      {
        model: Crypto,
        as: 'crypto',
        attributes: ['id', 'symbol', 'name', 'iconUrl']
      },
      {
        model: User,
        as: 'buyer',
        attributes: ['id', 'username', 'averageRating']
      },
      {
        model: User,
        as: 'seller',
        attributes: ['id', 'username', 'averageRating']
      }
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit)
  });

  // Add esComprador field to each transaction
  const transaccionesConRol = transacciones.map(t => ({
    ...t.toJSON(),
    esComprador: t.buyerId === userId
  }));

  res.json({
    transacciones: transaccionesConRol,
    total: count,
    page: parseInt(page),
    limit: parseInt(limit)
  });
};

// Get pending transactions
const getPendingTransacciones = async (req, res) => {
  const userId = req.user.id;
  const result = await P2PTransaction.getPendingTransactions(userId);
  res.json(result);
};

// Get transaction statistics (admin)
const getTransaccionesStats = async (req, res) => {
  const filters = req.query;
  const stats = await P2PTransaction.getStats(filters);
  res.json(stats);
};

// Get user volume
const getUserVolume = async (req, res) => {
  const userId = req.params.userId || req.user.id;
  const { period = '30d' } = req.query;

  // Non-admin users can only view their own volume
  if (!authz.canAccessResource(req.user, userId)) {
    throw new AppError(403, errorCodes.P2P_TX_FORBIDDEN, 'You do not have permission to view this volume');
  }

  const volume = await P2PTransaction.getUserVolume(userId, period);
  res.json(volume);
};

// Check timeouts (administrative task)
const checkTimeouts = async (req, res) => {
  const canceladas = await P2PTransaction.checkTimeouts();
  res.json({
    message: `Se cancelaron ${canceladas} transacciones por timeout`,
    transaccionesCanceladas: canceladas
  });
};

// Get transactions by offer
const getTransaccionesByOferta = async (req, res) => {
  const { offerId } = req.params;
  const filters = { ...req.query, offerId };
  const result = await P2PTransaction.getAll(filters);
  res.json(result);
};

// Get transaction history with a specific user
const getTransactionHistory = async (req, res) => {
  const { otroUsuarioId } = req.params;
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;

  const filters = {
    page: parseInt(page),
    limit: parseInt(limit)
  };

  // Filter transactions where both the current user and the other user participated
  const result = await P2PTransaction.getAll({
    ...filters,
    where: {
      [Op.or]: [
        { buyerId: userId, sellerId: otroUsuarioId },
        { buyerId: otroUsuarioId, sellerId: userId }
      ]
    }
  });

  res.json(result);
};

// Force status change (admin only)
// No Sequelize transaction opened in this controller handler; findByPk and
// instance.update() each execute in their own auto-committed statement.
const forceStatusChange = async (req, res) => {
  const { id } = req.params;
  const { status, motivo } = req.body;

  // Only admin can force status changes
  if (!authz.isAdmin(req.user)) {
    throw new AppError(403, errorCodes.P2P_TX_ADMIN_REQUIRED, 'Only administrators can force status changes');
  }

  const transaccion = await P2PTransaction.findByPk(id);
  if (!transaccion) {
    throw new AppError(404, errorCodes.P2P_TX_NOT_FOUND, 'Transaction not found');
  }

  const updateData = { status };

  // Add timestamps based on new state
  switch (status) {
    case 'payment_confirmed':
      updateData.paymentConfirmedAt = new Date();
      break;
    case 'completed':
      updateData.completedAt = new Date();
      break;
  }

  await transaccion.update(updateData);

  // Register administrative action if you have a log model
  // await LogAdmin.create({
  //   adminId: req.user.id,
  //   accion: 'FORZAR_ESTADO_TRANSACCION',
  //   detalles: { transaccionId: id, estadoAnterior: transaccion.status, nuevoEstado: status, motivo }
  // });

  const updated = await P2PTransaction.getById(id);
  res.json({
    message: 'Estado forzado exitosamente',
    data: updated
  });
};

module.exports = {
  getTransacciones,
  getTransaccionById,
  createTransaccion,
  confirmPayment,
  completeTransaction,
  cancelTransaction,
  getMyTransacciones,
  getPendingTransacciones,
  getTransaccionesStats,
  getUserVolume,
  checkTimeouts,
  getTransaccionesByOferta,
  getTransactionHistory,
  forceStatusChange
};
