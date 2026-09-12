const { Transfer, User, Crypto, UserBalance, Notification } = require('../../models/index.js');
const { sequelize } = require('../../models/index.js');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');
const { transferInternal } = require('./ledger/operations');
const money = require('../../utils/money');
const idempotency = require('../../middleware/idempotency.middleware');
const authz = require('../../utils/authz');

// Create new transfer
const createTransfer = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const senderId = req.user.id;
    const {
      recipientId,
      cryptoId,
      amount,
      concept = '',
    } = req.body;

    // Basic field validation
    if (!recipientId || !cryptoId || !amount) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_INVALID_INPUT, 'Usuario destinatario, criptomoneda y cantidad son requeridos');
    }

    // Verify recipient exists and is active
    const recipient = await User.findByPk(recipientId);
    if (!recipient || !recipient.active) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_RESOURCE_NOT_FOUND, 'Usuario destinatario no válido');
    }

    // Verify the crypto exists and is active
    const crypto = await Crypto.findByPk(cryptoId);
    if (!crypto || !crypto.active) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_RESOURCE_NOT_FOUND, 'Criptomoneda no válida');
    }

    // Check sender funds
    const hasFunds = await UserBalance.hasAvailableBalance(
      senderId,
      cryptoId,
      amount
    );

    if (!hasFunds) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.INSUFFICIENT_FUNDS, 'Fondos insuficientes para realizar la transferencia');
    }

    // Create the transfer record
    const transfer = await Transfer.create({
      senderId,
      recipientId,
      cryptoId,
      amount,
      concept,
      status: 'pending',
    }, { transaction });

    // Generate verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiration = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    transfer.verificationCode = code;
    transfer.codeExpiration = expiration;
    await transfer.save({ transaction });

    // Fetch sender info for email
    const sender = await User.findByPk(senderId, { transaction });

    // Send verification email — failure is non-fatal
    try {
      await req.app.locals.emailService.enviarCodigoTransferencia(
        sender.email,
        code,
        sender.username,
        amount,
        crypto.symbol,
        recipient.username
      );
    } catch (emailError) {
      console.error('Error enviando email de verificación:', emailError);
    }

    const responseBody = {
      message: 'Transferencia creada. Revisa tu email para el código de verificación.',
      data: {
        id: transfer.id,
        amount,
        crypto: crypto.symbol,
        recipient: recipient.username,
        status: transfer.status,
        codeExpiration: transfer.codeExpiration,
      },
    };
    // Hardening anti-doble-gasto: completa la key de idempotencia dentro de esta
    // transacción → commitea atómicamente con el registro de la transferencia.
    await idempotency.finalizeInTransaction(req, transaction, 201, responseBody);

    await transaction.commit();

    res.status(201).json(responseBody);
  } catch (error) {
    // Roll back only when the transaction is still open (i.e., we have not
    // already called rollback inside a known-error branch above).
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    // Re-throw so asyncHandler forwards to the central error handler.
    throw error;
  }
};

// Process transfer with verification code
const processTransfer = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { verificationCode } = req.body;
    const userId = req.user.id;

    console.log(`Procesando transferencia ${id} con código: ${verificationCode}`);

    if (!verificationCode) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.VERIFICATION_CODE_INVALID, 'Código de verificación requerido');
    }

    // Verify transfer exists and belongs to user
    const transfer = await Transfer.findByPk(id, {
      include: [
        { association: 'sender' },
        { association: 'recipient' },
        { association: 'crypto' },
      ],
      transaction,
    });

    if (!transfer) {
      await transaction.rollback();
      throw new AppError(404, errorCodes.TRANSFER_NOT_FOUND, 'Transferencia no encontrada');
    }

    // Verify ownership
    if (transfer.senderId !== userId) {
      await transaction.rollback();
      throw new AppError(403, errorCodes.TRANSFER_FORBIDDEN, 'No tienes permiso para procesar esta transferencia');
    }

    // Verify state
    if (transfer.status !== 'pending') {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_INVALID_STATE, `La transferencia ya fue ${transfer.status}`);
    }

    // Verify verification code value
    if (!transfer.verificationCode ||
        transfer.verificationCode !== verificationCode) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.VERIFICATION_CODE_INVALID, 'Código de verificación incorrecto');
    }

    // Verify code expiry
    if (!transfer.codeExpiration || new Date() > transfer.codeExpiration) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.VERIFICATION_CODE_EXPIRED, 'El código de verificación ha expirado');
    }

    // Verify both users are still active
    const sender = await User.findByPk(transfer.senderId, { transaction });
    const recipient = await User.findByPk(transfer.recipientId, { transaction });

    if (!sender || !sender.active) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_RESOURCE_NOT_FOUND, 'Usuario remitente no válido');
    }

    if (!recipient || !recipient.active) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_RESOURCE_NOT_FOUND, 'Usuario destinatario no válido');
    }

    // Re-check sender balance. Read-flip (Plan 3/4 Paso A): lee del ledger via
    // getByUserAndCrypto (devuelve objeto con availableBalance '0' si no hay cuenta).
    const senderBalance = await UserBalance.getByUserAndCrypto(
      transfer.senderId,
      transfer.cryptoId,
      { transaction }
    );

    // Comparación decimal exacta con money.compare — nunca parseFloat sobre
    // montos (regla money.js). getByUserAndCrypto siempre devuelve un objeto con
    // availableBalance '0' si no hay cuenta. El guard real sigue siendo el FOR
    // UPDATE anti-sobregiro de transferInternal; este es el early-error.
    if (money.compare(senderBalance.availableBalance, String(transfer.amount)) < 0) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.INSUFFICIENT_FUNDS, 'Fondos insuficientes para completar la transferencia');
    }

    console.log(`Ejecutando transferencia: ${transfer.amount} desde ${sender.username} hacia ${recipient.username}`);

    // Paso D: transferencia interna como UN asiento user↔user en el ledger
    // (remitente disponible −A → destinatario disponible +A). Sin suspense
    // (suma cero entre dos usuarios). Reemplaza los dos updateBalance (que
    // posteaban funding+suspense por pata).
    await transferInternal({
      remitenteId: transfer.senderId,
      destinatarioId: transfer.recipientId,
      criptomonedaId: transfer.cryptoId,
      cantidad: String(transfer.amount),
      referencia: `transferencia:${transfer.id}`,
    }, transaction);

    // Mark transfer complete
    transfer.status = 'completed';
    transfer.verificationCode = null;
    transfer.codeExpiration = null;
    await transfer.save({ transaction });

    // Send confirmation emails — failure is non-fatal
    try {
      await req.app.locals.emailService.notificarTransferenciaCompletada(
        sender.email,
        sender.username,
        transfer.amount,
        transfer.crypto.symbol,
        recipient.username,
        'enviada'
      );

      await req.app.locals.emailService.notificarTransferenciaCompletada(
        recipient.email,
        recipient.username,
        transfer.amount,
        transfer.crypto.symbol,
        sender.username,
        'recibida'
      );
    } catch (emailError) {
      console.error('Error enviando emails de confirmación:', emailError);
    }

    // Create notifications — failure is non-fatal
    try {
      await Notification.createNotification({
        userId: transfer.senderId,
        template: 'TRANSFERENCIA_COMPLETADA_REMITENTE',
        templateData: {
          cantidad: transfer.amount,
          simbolo: transfer.crypto.symbol,
          destinatario: recipient.username,
        },
      }, { transaction });

      await Notification.createNotification({
        userId: transfer.recipientId,
        template: 'TRANSFERENCIA_RECIBIDA',
        templateData: {
          cantidad: transfer.amount,
          simbolo: transfer.crypto.symbol,
          remitente: sender.username,
        },
      }, { transaction });
    } catch (notifError) {
      console.error('Error creando notificaciones:', notifError);
    }

    await transaction.commit();

    console.log(`✅ Transfer ${id} completada exitosamente`);

    res.json({
      message: 'Transferencia completada exitosamente',
      data: {
        id: transfer.id,
        amount: transfer.amount,
        crypto: transfer.crypto.symbol,
        recipient: recipient.username,
        status: transfer.status,
        date: transfer.updated_at,
      },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

// Get my transfers
const getMyTransfers = async (req, res) => {
  const userId = req.user.id;
  const filters = { ...req.query };

  const result = await Transfer.getByUser(userId, filters);
  res.json(result);
};

// Get transfer by ID
const getTransferById = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const transfer = await Transfer.getById(id);

  if (!transfer) {
    throw new AppError(404, errorCodes.TRANSFER_NOT_FOUND, 'Transferencia no encontrada');
  }

  // Verify user has access to this transfer
  if (transfer.senderId !== userId &&
      transfer.recipientId !== userId &&
      !authz.isAdmin(req.user)) {
    throw new AppError(403, errorCodes.TRANSFER_FORBIDDEN, 'No tienes permiso para ver esta transferencia');
  }

  res.json(transfer);
};

// Cancel transfer
const cancelTransfer = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  let transfer;
  try {
    transfer = await Transfer.cancelTransfer(id, userId);
  } catch (error) {
    // The model wraps all business errors into plain Error with a known prefix.
    // Translate each business case to a typed AppError so the central handler
    // returns the correct HTTP status instead of a sanitized 500.
    const msg = error.message || '';
    if (msg.includes('Transferencia no encontrada')) {
      throw new AppError(404, errorCodes.TRANSFER_NOT_FOUND, 'Transferencia no encontrada');
    }
    if (msg.includes('Solo el remitente puede cancelar')) {
      throw new AppError(403, errorCodes.TRANSFER_FORBIDDEN, 'No tienes permiso para cancelar esta transferencia');
    }
    if (msg.includes('No se puede cancelar una transferencia')) {
      throw new AppError(400, errorCodes.TRANSFER_INVALID_STATE, 'La transferencia no está en estado pendiente');
    }
    // Unknown error — re-throw so the central handler returns a sanitized 500.
    throw error;
  }

  // Create cancellation notification — failure is non-fatal
  try {
    await Notification.createNotification({
      userId: userId,
      template: 'TRANSFERENCIA_CANCELADA',
      templateData: {
        cantidad: transfer.amount,
        simbolo: transfer.crypto.symbol,
        destinatario: transfer.recipient.username,
      },
    });
  } catch (notifError) {
    console.error('Error creando notificación de cancelación:', notifError);
  }

  res.json({
    message: 'Transferencia cancelada exitosamente',
    data: transfer,
  });
};

// Resend verification code
const resendCode = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // Verify transfer exists and belongs to user
  const existingTransfer = await Transfer.getById(id);
  if (!existingTransfer) {
    throw new AppError(404, errorCodes.TRANSFER_NOT_FOUND, 'Transferencia no encontrada');
  }

  if (existingTransfer.senderId !== userId) {
    throw new AppError(403, errorCodes.TRANSFER_FORBIDDEN, 'No tienes permiso para reenviar el código de esta transferencia');
  }

  const { transfer, code } = await Transfer.resendCode(id);

  // Notify by email — best-effort. resendCode already committed the new code
  // and expiry, so the whole email pipeline is non-fatal: not just the send, but
  // the lookups feeding it. If a DB hiccup made one of those lookups reject, it
  // would otherwise surface a 500 for an operation that actually succeeded — and
  // the user might retry, burning another code. Log and return success.
  try {
    const sender = await User.findByPk(userId);
    const recipient = await User.findByPk(transfer.recipientId);
    const crypto = await Crypto.getById(transfer.cryptoId);

    await req.app.locals.emailService.enviarCodigoTransferencia(
      sender.email,
      code,
      sender.username,
      transfer.amount,
      crypto.symbol,
      recipient.username
    );
  } catch (emailError) {
    console.error('Error enviando email de reenvío de código:', emailError);
  }

  res.json({
    message: 'Código de verificación reenviado exitosamente',
    data: {
      id: transfer.id,
      codeExpiration: transfer.codeExpiration,
    },
  });
};

// Verify funds before transferring
const verifyFunds = async (req, res) => {
  const userId = req.user.id;
  const { cryptoId, amount } = req.body;

  if (!cryptoId || !amount) {
    throw new AppError(400, errorCodes.TRANSFER_INVALID_INPUT, 'Criptomoneda y cantidad son requeridos');
  }

  const hasFunds = await UserBalance.hasAvailableBalance(
    userId,
    cryptoId,
    amount
  );

  const crypto = await Crypto.getById(cryptoId);
  const balance = await UserBalance.getByUserAndCrypto(userId, cryptoId);

  res.json({
    hasFunds,
    availableBalance: balance ? parseFloat(balance.availableBalance) : 0,
    requestedAmount: parseFloat(amount),
    crypto: crypto.symbol,
    sufficient: hasFunds,
  });
};

// Admin methods
const getAllTransfers = async (req, res) => {
  const filters = { ...req.query };
  const result = await Transfer.getAll(filters);
  res.json(result);
};

const getTransferStats = async (req, res) => {
  const filters = req.query;
  const stats = await Transfer.getStats(filters);
  res.json(stats);
};

module.exports = {
  createTransfer,
  processTransfer,
  getMyTransfers,
  getTransferById,
  cancelTransfer,
  resendCode,
  verifyFunds,
  getAllTransfers,
  getTransferStats,
};
