const { Transferencia, Usuario, Criptomoneda, BalanceUsuario, Notificaciones } = require('../models/index.js');
const emailService = require('../services/email.service.js');
const { sequelize } = require('../models/index.js');

// Crear nueva transferencia
const createTransferencia = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const usuarioRemitenteId = req.user.id;
    const { 
      usuarioDestinatarioId, 
      criptomonedaId, 
      cantidad, 
      concepto = '' 
    } = req.body;

    // Validaciones básicas
    if (!usuarioDestinatarioId || !criptomonedaId || !cantidad) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Usuario destinatario, criptomoneda y cantidad son requeridos' 
      });
    }

    // Verificar que el destinatario existe y está activo
    const destinatario = await Usuario.findByPk(usuarioDestinatarioId);
    if (!destinatario || !destinatario.activo) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Usuario destinatario no válido' });
    }

    // Verificar que la criptomoneda existe y está activa
    const criptomoneda = await Criptomoneda.findByPk(criptomonedaId);
    if (!criptomoneda || !criptomoneda.activa) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Criptomoneda no válida' });
    }

    // Verificar fondos del remitente
    const tieneFondos = await BalanceUsuario.hasAvailableBalance(
      usuarioRemitenteId, 
      criptomonedaId, 
      cantidad
    );

    if (!tieneFondos) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Fondos insuficientes para realizar la transferencia' });
    }

    // Crear transferencia usando el método directo del modelo
    const transferencia = await Transferencia.create({
      usuarioRemitenteId,
      usuarioDestinatarioId,
      criptomonedaId,
      cantidad,
      concepto,
      estado: 'pendiente'
    }, { transaction });

    // Generar código de verificación
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    
    transferencia.codigoVerificacion = codigo;
    transferencia.expiracionCodigo = expiracion;
    await transferencia.save({ transaction });

    // Obtener información del remitente
    const remitente = await Usuario.findByPk(usuarioRemitenteId, { transaction });

    // Enviar email de verificación al remitente
    try {
      await emailService.enviarCodigoTransferencia(
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

    // Crear notificación para el remitente
    try {
      await Notificaciones.createNotification({
        usuarioId: usuarioRemitenteId,
        template: 'TRANSFERENCIA_CREADA',
        templateData: {
          cantidad,
          simbolo: criptomoneda.symbol,
          destinatario: destinatario.username,
          codigo
        }
      }, { transaction });
    } catch (notifError) {
      console.error('Error creando notificación:', notifError);
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
        expiracionCodigo: transferencia.expiracionCodigo
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error en createTransferencia:', error);
    res.status(400).json({ error: error.message });
  }
};

// Procesar transferencia con código de verificación - VERSIÓN COMPATIBLE
const procesarTransferencia = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { codigoVerificacion } = req.body;
    const usuarioId = req.user.id;

    console.log(`Procesando transferencia ${id} con código: ${codigoVerificacion}`);

    if (!codigoVerificacion) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Código de verificación requerido' });
    }

    // Verificar que la transferencia existe y pertenece al usuario
    const transferencia = await Transferencia.findByPk(id, {
      include: [
        { association: 'remitente' },
        { association: 'destinatario' },
        { association: 'criptomonedaTransferencia' }
      ],
      transaction
    });

    if (!transferencia) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Transferencia no encontrada' });
    }

    // Verificar permisos
    if (transferencia.usuarioRemitenteId !== usuarioId) {
      await transaction.rollback();
      return res.status(403).json({ error: 'No tienes permiso para procesar esta transferencia' });
    }

    // Verificar estado
    if (transferencia.estado !== 'pendiente') {
      await transaction.rollback();
      return res.status(400).json({ error: `La transferencia ya fue ${transferencia.estado}` });
    }

    // Verificar código de verificación
    if (!transferencia.codigoVerificacion || 
        transferencia.codigoVerificacion !== codigoVerificacion) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Código de verificación incorrecto' });
    }

    // Verificar expiración del código
    if (!transferencia.expiracionCodigo || new Date() > transferencia.expiracionCodigo) {
      await transaction.rollback();
      return res.status(400).json({ error: 'El código de verificación ha expirado' });
    }

    // Verificar que los usuarios existen y están activos
    const remitente = await Usuario.findByPk(transferencia.usuarioRemitenteId, { transaction });
    const destinatario = await Usuario.findByPk(transferencia.usuarioDestinatarioId, { transaction });

    if (!remitente || !remitente.activo) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Usuario remitente no válido' });
    }

    if (!destinatario || !destinatario.activo) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Usuario destinatario no válido' });
    }

    // Verificar fondos del remitente
    const balanceRemitente = await BalanceUsuario.findOne({
      where: {
        userId: transferencia.usuarioRemitenteId,
        criptomonedaId: transferencia.criptomonedaId
      },
      transaction
    });

    const balanceDisponible = balanceRemitente ? parseFloat(balanceRemitente.balanceDisponible) : 0;
    const cantidadTransferencia = parseFloat(transferencia.cantidad);

    if (balanceDisponible < cantidadTransferencia) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: `Fondos insuficientes. Disponible: ${balanceDisponible}, Requerido: ${cantidadTransferencia}` 
      });
    }

    console.log(`Ejecutando transferencia: ${cantidadTransferencia} desde ${remitente.username} hacia ${destinatario.username}`);

    // ✅ CORREGIDO: Usar la firma correcta del método updateBalance
    // RESTAR del remitente
    await BalanceUsuario.updateBalance(
      transferencia.usuarioRemitenteId,
      transferencia.criptomonedaId,
      -cantidadTransferencia,
      'disponible',
      transaction  // ← Solo el objeto transaction, sin {}
    );

    // ✅ CORREGIDO: Usar la firma correcta del método updateBalance  
    // SUMAR al destinatario
    await BalanceUsuario.updateBalance(
      transferencia.usuarioDestinatarioId,
      transferencia.criptomonedaId,
      cantidadTransferencia,
      'disponible',
      transaction  // ← Solo el objeto transaction, sin {}
    );

    // Actualizar estado de la transferencia
    transferencia.estado = 'completada';
    transferencia.codigoVerificacion = null;
    transferencia.expiracionCodigo = null;
    await transferencia.save({ transaction });

    // Enviar emails de confirmación
    try {
      // Email al remitente
      await emailService.notificarTransferenciaCompletada(
        remitente.email,
        remitente.username,
        transferencia.cantidad,
        transferencia.criptomonedaTransferencia.symbol,
        destinatario.username,
        'enviada'
      );

      // Email al destinatario
      await emailService.notificarTransferenciaCompletada(
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

    // Crear notificaciones
    try {
      // Notificación para el remitente
      await Notificaciones.createNotification({
        usuarioId: transferencia.usuarioRemitenteId,
        template: 'TRANSFERENCIA_COMPLETADA_REMITENTE',
        templateData: {
          cantidad: transferencia.cantidad,
          simbolo: transferencia.criptomonedaTransferencia.symbol,
          destinatario: destinatario.username
        }
      }, { transaction });

      // Notificación para el destinatario
      await Notificaciones.createNotification({
        usuarioId: transferencia.usuarioDestinatarioId,
        template: 'TRANSFERENCIA_RECIBIDA',
        templateData: {
          cantidad: transferencia.cantidad,
          simbolo: transferencia.criptomonedaTransferencia.symbol,
          remitente: remitente.username
        }
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
        fecha: transferencia.updated_at
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error en procesarTransferencia:', error);
    res.status(400).json({ error: error.message });
  }
};

// Obtener mis transferencias
const getMyTransferencias = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const filters = { ...req.query };
    
    const result = await Transferencia.getByUsuario(usuarioId, filters);
    res.json(result);
  } catch (error) {
    console.error('Error en getMyTransferencias:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obtener transferencia por ID
const getTransferenciaById = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    
    const transferencia = await Transferencia.getById(id);
    
    if (!transferencia) {
      return res.status(404).json({ error: 'Transferencia no encontrada' });
    }

    // Verificar que el usuario tenga acceso a esta transferencia
    if (transferencia.usuarioRemitenteId !== usuarioId && 
        transferencia.usuarioDestinatarioId !== usuarioId &&
        req.user.rol === 'normal') {
      return res.status(403).json({ error: 'No tienes permiso para ver esta transferencia' });
    }

    res.json(transferencia);
  } catch (error) {
    console.error('Error en getTransferenciaById:', error);
    res.status(500).json({ error: error.message });
  }
};

// Cancelar transferencia
const cancelarTransferencia = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    
    const transferencia = await Transferencia.cancelarTransferencia(id, usuarioId);
    
    // Crear notificación de cancelación
    try {
      await Notificaciones.createNotification({
        usuarioId: usuarioId,
        template: 'TRANSFERENCIA_CANCELADA',
        templateData: {
          cantidad: transferencia.cantidad,
          simbolo: transferencia.criptomoneda.symbol,
          destinatario: transferencia.destinatario.username
        }
      });
    } catch (notifError) {
      console.error('Error creando notificación de cancelación:', notifError);
    }

    res.json({
      message: 'Transferencia cancelada exitosamente',
      data: transferencia
    });
  } catch (error) {
    console.error('Error en cancelarTransferencia:', error);
    res.status(400).json({ error: error.message });
  }
};

// Reenviar código de verificación
const reenviarCodigo = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    
    // Verificar que la transferencia existe y pertenece al usuario
    const transferenciaExistente = await Transferencia.getById(id);
    if (!transferenciaExistente) {
      return res.status(404).json({ error: 'Transferencia no encontrada' });
    }

    if (transferenciaExistente.usuarioRemitenteId !== usuarioId) {
      return res.status(403).json({ error: 'No tienes permiso para reenviar el código de esta transferencia' });
    }

    const { transferencia, codigo } = await Transferencia.reenviarCodigo(id);

    // Enviar nuevo código por email
    try {
      const remitente = await Usuario.findByPk(usuarioId);
      const destinatario = await Usuario.findByPk(transferencia.usuarioDestinatarioId);
      const criptomoneda = await Criptomoneda.getById(transferencia.criptomonedaId);

      await emailService.enviarCodigoTransferencia(
        remitente.email,
        codigo,
        remitente.username,
        transferencia.cantidad,
        criptomoneda.symbol,
        destinatario.username
      );
    } catch (emailError) {
      console.error('Error reenviando código:', emailError);
      return res.status(500).json({ error: 'Error enviando código de verificación' });
    }

    res.json({
      message: 'Código de verificación reenviado exitosamente',
      data: {
        id: transferencia.id,
        expiracionCodigo: transferencia.expiracionCodigo
      }
    });
  } catch (error) {
    console.error('Error en reenviarCodigo:', error);
    res.status(400).json({ error: error.message });
  }
};

// Verificar fondos antes de transferir
const verificarFondos = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { criptomonedaId, cantidad } = req.body;

    if (!criptomonedaId || !cantidad) {
      return res.status(400).json({ 
        error: 'Criptomoneda y cantidad son requeridos' 
      });
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
      suficiente: tieneFondos
    });
  } catch (error) {
    console.error('Error en verificarFondos:', error);
    res.status(500).json({ error: error.message });
  }
};

// Métodos administrativos
const getAllTransferencias = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await Transferencia.getAll(filters);
    res.json(result);
  } catch (error) {
    console.error('Error en getAllTransferencias:', error);
    res.status(500).json({ error: error.message });
  }
};

const getTransferenciaStats = async (req, res) => {
  try {
    const filters = req.query;
    const stats = await Transferencia.getStats(filters);
    res.json(stats);
  } catch (error) {
    console.error('Error en getTransferenciaStats:', error);
    res.status(500).json({ error: error.message });
  }
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
  getTransferenciaStats
};