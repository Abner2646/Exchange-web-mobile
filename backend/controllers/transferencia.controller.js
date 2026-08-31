const { Transferencia, Usuario, Criptomoneda, BalanceUsuario, Notificaciones } = require('../models/index.js');
const { sequelize } = require('../models/index.js');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');

// Create new transfer
const createTransferencia = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const usuarioRemitenteId = req.user.id;
    const {
      usuarioDestinatarioId,
      criptomonedaId,
      cantidad,
      concepto = '',
    } = req.body;

    // Basic field validation
    if (!usuarioDestinatarioId || !criptomonedaId || !cantidad) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_INVALID_INPUT, 'Usuario destinatario, criptomoneda y cantidad son requeridos');
    }

    // Verify recipient exists and is active
    const destinatario = await Usuario.findByPk(usuarioDestinatarioId);
    if (!destinatario || !destinatario.activo) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_RESOURCE_NOT_FOUND, 'Usuario destinatario no válido');
    }

    // Verify the crypto exists and is active
    const criptomoneda = await Criptomoneda.findByPk(criptomonedaId);
    if (!criptomoneda || !criptomoneda.activa) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_RESOURCE_NOT_FOUND, 'Criptomoneda no válida');
    }

    // Check sender funds
    const tieneFondos = await BalanceUsuario.hasAvailableBalance(
      usuarioRemitenteId,
      criptomonedaId,
      cantidad
    );

    if (!tieneFondos) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.INSUFFICIENT_FUNDS, 'Fondos insuficientes para realizar la transferencia');
    }

    // Create the transfer record
    const transferencia = await Transferencia.create({
      usuarioRemitenteId,
      usuarioDestinatarioId,
      criptomonedaId,
      cantidad,
      concepto,
      estado: 'pendiente',
    }, { transaction });

    // Generate verification code
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    transferencia.codigoVerificacion = codigo;
    transferencia.expiracionCodigo = expiracion;
    await transferencia.save({ transaction });

    // Fetch sender info for email
    const remitente = await Usuario.findByPk(usuarioRemitenteId, { transaction });

    // Send verification email — failure is non-fatal
    try {
      await req.app.locals.emailService.enviarCodigoTransferencia(
        remitente.email,
        codigo,
        remitente.username,
        cantidad,
        criptomoneda.symbol,
        destinatario.username
      );
    } catch (emailError) {
      console.error('Error enviando email de verificación:', emailError);
    }

    await transaction.commit();

    res.status(201).json({
      message: 'Transferencia creada. Revisa tu email para el código de verificación.',
      data: {
        id: transferencia.id,
        cantidad,
        criptomoneda: criptomoneda.symbol,
        destinatario: destinatario.username,
        estado: transferencia.estado,
        expiracionCodigo: transferencia.expiracionCodigo,
      },
    });
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
const procesarTransferencia = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { codigoVerificacion } = req.body;
    const usuarioId = req.user.id;

    console.log(`Procesando transferencia ${id} con código: ${codigoVerificacion}`);

    if (!codigoVerificacion) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.VERIFICATION_CODE_INVALID, 'Código de verificación requerido');
    }

    // Verify transfer exists and belongs to user
    const transferencia = await Transferencia.findByPk(id, {
      include: [
        { association: 'remitente' },
        { association: 'destinatario' },
        { association: 'criptomonedaTransferencia' },
      ],
      transaction,
    });

    if (!transferencia) {
      await transaction.rollback();
      throw new AppError(404, errorCodes.TRANSFER_NOT_FOUND, 'Transferencia no encontrada');
    }

    // Verify ownership
    if (transferencia.usuarioRemitenteId !== usuarioId) {
      await transaction.rollback();
      throw new AppError(403, errorCodes.TRANSFER_FORBIDDEN, 'No tienes permiso para procesar esta transferencia');
    }

    // Verify state
    if (transferencia.estado !== 'pendiente') {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_INVALID_STATE, `La transferencia ya fue ${transferencia.estado}`);
    }

    // Verify verification code value
    if (!transferencia.codigoVerificacion ||
        transferencia.codigoVerificacion !== codigoVerificacion) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.VERIFICATION_CODE_INVALID, 'Código de verificación incorrecto');
    }

    // Verify code expiry
    if (!transferencia.expiracionCodigo || new Date() > transferencia.expiracionCodigo) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.VERIFICATION_CODE_EXPIRED, 'El código de verificación ha expirado');
    }

    // Verify both users are still active
    const remitente = await Usuario.findByPk(transferencia.usuarioRemitenteId, { transaction });
    const destinatario = await Usuario.findByPk(transferencia.usuarioDestinatarioId, { transaction });

    if (!remitente || !remitente.activo) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_RESOURCE_NOT_FOUND, 'Usuario remitente no válido');
    }

    if (!destinatario || !destinatario.activo) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.TRANSFER_RESOURCE_NOT_FOUND, 'Usuario destinatario no válido');
    }

    // Re-check sender balance
    const balanceRemitente = await BalanceUsuario.findOne({
      where: {
        userId: transferencia.usuarioRemitenteId,
        criptomonedaId: transferencia.criptomonedaId,
      },
      transaction,
    });

    const balanceDisponible = balanceRemitente ? parseFloat(balanceRemitente.balanceDisponible) : 0;
    const cantidadTransferencia = parseFloat(transferencia.cantidad);

    if (balanceDisponible < cantidadTransferencia) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.INSUFFICIENT_FUNDS, 'Fondos insuficientes para completar la transferencia');
    }

    console.log(`Ejecutando transferencia: ${cantidadTransferencia} desde ${remitente.username} hacia ${destinatario.username}`);

    // Deduct from sender
    await BalanceUsuario.updateBalance(
      transferencia.usuarioRemitenteId,
      transferencia.criptomonedaId,
      -cantidadTransferencia,
      'disponible',
      transaction
    );

    // Credit to recipient
    await BalanceUsuario.updateBalance(
      transferencia.usuarioDestinatarioId,
      transferencia.criptomonedaId,
      cantidadTransferencia,
      'disponible',
      transaction
    );

    // Mark transfer complete
    transferencia.estado = 'completada';
    transferencia.codigoVerificacion = null;
    transferencia.expiracionCodigo = null;
    await transferencia.save({ transaction });

    // Send confirmation emails — failure is non-fatal
    try {
      await req.app.locals.emailService.notificarTransferenciaCompletada(
        remitente.email,
        remitente.username,
        transferencia.cantidad,
        transferencia.criptomonedaTransferencia.symbol,
        destinatario.username,
        'enviada'
      );

      await req.app.locals.emailService.notificarTransferenciaCompletada(
        destinatario.email,
        destinatario.username,
        transferencia.cantidad,
        transferencia.criptomonedaTransferencia.symbol,
        remitente.username,
        'recibida'
      );
    } catch (emailError) {
      console.error('Error enviando emails de confirmación:', emailError);
    }

    // Create notifications — failure is non-fatal
    try {
      await Notificaciones.createNotification({
        usuarioId: transferencia.usuarioRemitenteId,
        template: 'TRANSFERENCIA_COMPLETADA_REMITENTE',
        templateData: {
          cantidad: transferencia.cantidad,
          simbolo: transferencia.criptomonedaTransferencia.symbol,
          destinatario: destinatario.username,
        },
      }, { transaction });

      await Notificaciones.createNotification({
        usuarioId: transferencia.usuarioDestinatarioId,
        template: 'TRANSFERENCIA_RECIBIDA',
        templateData: {
          cantidad: transferencia.cantidad,
          simbolo: transferencia.criptomonedaTransferencia.symbol,
          remitente: remitente.username,
        },
      }, { transaction });
    } catch (notifError) {
      console.error('Error creando notificaciones:', notifError);
    }

    await transaction.commit();

    console.log(`✅ Transferencia ${id} completada exitosamente`);

    res.json({
      message: 'Transferencia completada exitosamente',
      data: {
        id: transferencia.id,
        cantidad: transferencia.cantidad,
        criptomoneda: transferencia.criptomonedaTransferencia.symbol,
        destinatario: destinatario.username,
        estado: transferencia.estado,
        fecha: transferencia.updated_at,
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
const getMyTransferencias = async (req, res) => {
  const usuarioId = req.user.id;
  const filters = { ...req.query };

  const result = await Transferencia.getByUsuario(usuarioId, filters);
  res.json(result);
};

// Get transfer by ID
const getTransferenciaById = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  const transferencia = await Transferencia.getById(id);

  if (!transferencia) {
    throw new AppError(404, errorCodes.TRANSFER_NOT_FOUND, 'Transferencia no encontrada');
  }

  // Verify user has access to this transfer
  if (transferencia.usuarioRemitenteId !== usuarioId &&
      transferencia.usuarioDestinatarioId !== usuarioId &&
      req.user.rol === 'normal') {
    throw new AppError(403, errorCodes.TRANSFER_FORBIDDEN, 'No tienes permiso para ver esta transferencia');
  }

  res.json(transferencia);
};

// Cancel transfer
const cancelarTransferencia = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  let transferencia;
  try {
    transferencia = await Transferencia.cancelarTransferencia(id, usuarioId);
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
    await Notificaciones.createNotification({
      usuarioId,
      template: 'TRANSFERENCIA_CANCELADA',
      templateData: {
        cantidad: transferencia.cantidad,
        simbolo: transferencia.criptomoneda.symbol,
        destinatario: transferencia.destinatario.username,
      },
    });
  } catch (notifError) {
    console.error('Error creando notificación de cancelación:', notifError);
  }

  res.json({
    message: 'Transferencia cancelada exitosamente',
    data: transferencia,
  });
};

// Resend verification code
const reenviarCodigo = async (req, res) => {
  const { id } = req.params;
  const usuarioId = req.user.id;

  // Verify transfer exists and belongs to user
  const transferenciaExistente = await Transferencia.getById(id);
  if (!transferenciaExistente) {
    throw new AppError(404, errorCodes.TRANSFER_NOT_FOUND, 'Transferencia no encontrada');
  }

  if (transferenciaExistente.usuarioRemitenteId !== usuarioId) {
    throw new AppError(403, errorCodes.TRANSFER_FORBIDDEN, 'No tienes permiso para reenviar el código de esta transferencia');
  }

  const { transferencia, codigo } = await Transferencia.reenviarCodigo(id);

  // Notify by email — best-effort. reenviarCodigo already committed the new code
  // and expiry, so the whole email pipeline is non-fatal: not just the send, but
  // the lookups feeding it. If a DB hiccup made one of those lookups reject, it
  // would otherwise surface a 500 for an operation that actually succeeded — and
  // the user might retry, burning another code. Log and return success.
  try {
    const remitente = await Usuario.findByPk(usuarioId);
    const destinatario = await Usuario.findByPk(transferencia.usuarioDestinatarioId);
    const criptomoneda = await Criptomoneda.getById(transferencia.criptomonedaId);

    await req.app.locals.emailService.enviarCodigoTransferencia(
      remitente.email,
      codigo,
      remitente.username,
      transferencia.cantidad,
      criptomoneda.symbol,
      destinatario.username
    );
  } catch (emailError) {
    console.error('Error enviando email de reenvío de código:', emailError);
  }

  res.json({
    message: 'Código de verificación reenviado exitosamente',
    data: {
      id: transferencia.id,
      expiracionCodigo: transferencia.expiracionCodigo,
    },
  });
};

// Verify funds before transferring
const verificarFondos = async (req, res) => {
  const usuarioId = req.user.id;
  const { criptomonedaId, cantidad } = req.body;

  if (!criptomonedaId || !cantidad) {
    throw new AppError(400, errorCodes.TRANSFER_INVALID_INPUT, 'Criptomoneda y cantidad son requeridos');
  }

  const tieneFondos = await BalanceUsuario.hasAvailableBalance(
    usuarioId,
    criptomonedaId,
    cantidad
  );

  const criptomoneda = await Criptomoneda.getById(criptomonedaId);
  const balance = await BalanceUsuario.getByUserAndCrypto(usuarioId, criptomonedaId);

  res.json({
    tieneFondos,
    balanceDisponible: balance ? parseFloat(balance.balanceDisponible) : 0,
    cantidadSolicitada: parseFloat(cantidad),
    criptomoneda: criptomoneda.symbol,
    suficiente: tieneFondos,
  });
};

// Admin methods
const getAllTransferencias = async (req, res) => {
  const filters = { ...req.query };
  const result = await Transferencia.getAll(filters);
  res.json(result);
};

const getTransferenciaStats = async (req, res) => {
  const filters = req.query;
  const stats = await Transferencia.getStats(filters);
  res.json(stats);
};

module.exports = {
  createTransferencia,
  procesarTransferencia,
  getMyTransferencias,
  getTransferenciaById,
  cancelarTransferencia,
  reenviarCodigo,
  verificarFondos,
  getAllTransferencias,
  getTransferenciaStats,
};
