// controllers/user.controller.js
const { User, Crypto, MasterWallet, DepositAddress, UserBalance, Notification } = require('../../models/index.js');
const { Op } = require('sequelize');
const { sequelize } = require('../../models/index.js');
const emailService = require('../../services/email.service.js');
const userService = require('./user.service');
const authz = require('../../utils/authz');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');

// Traduce los errores de negocio (Error plano) de los métodos de cambio de email
// del modelo al envelope canónico AppError; lo desconocido se re-lanza (500 sanit).
function mapEmailChangeError(error) {
  if (error instanceof AppError) return error;
  const msg = error.message || '';
  if (msg.includes('Contraseña actual incorrecta')) {
    return new AppError(401, errorCodes.EMAIL_CHANGE_INVALID, 'Contraseña actual incorrecta');
  }
  if (msg.includes('OAuth') || msg.includes('inválido') || msg.includes('en uso') ||
      msg.includes('igual al actual') || msg.includes('pendiente') ||
      msg.includes('incorrecto') || msg.includes('expiró')) {
    return new AppError(400, errorCodes.EMAIL_CHANGE_INVALID, msg);
  }
  return error;
}

// Función helper para generar dirección única
const generarDireccionDerivada = async (walletMaestra, usuarioId, derivationIndex) => {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256')
    .update(`${walletMaestra.publicAddress}-${usuarioId}-${derivationIndex}`)
    .digest('hex');
  
  switch (walletMaestra.crypto.network) {
    case 'bitcoin':
      return `1${hash.substring(0, 33)}`;
    case 'ethereum':
    case 'erc20':
      return `0x${hash.substring(0, 40)}`;
    default:
      return hash.substring(0, 34);
  }
};

// Función helper para inicializar todo lo del usuario nuevo
const inicializarUsuarioCompleto = async (usuario, transaction) => {
  try {
    const criptomonedasActivas = await Crypto.getActive();
    
    if (criptomonedasActivas.length === 0) {
      throw new Error('No hay criptomonedas activas en el sistema');
    }

    const direccionesCreadas = [];
    const balancesCreados = [];

    for (const crypto of criptomonedasActivas) {
      const walletMaestra = await MasterWallet.getByCrypto(crypto.id);
      
      if (!walletMaestra) {
        console.warn(`No hay wallet maestra para ${crypto.symbol}. Saltando...`);
        continue;
      }

      const derivationIndex = await DepositAddress.getNextDerivationIndex(walletMaestra.id);
      
      const nuevaDireccion = await generarDireccionDerivada(
        { ...walletMaestra, crypto }, 
        usuario.id, 
        derivationIndex
      );

      const direccionDeposito = await DepositAddress.create({
        userId: usuario.id, // la entity usa `userId` (field user_id); `usuarioId` se ignoraba → NOT NULL
        cryptoId: crypto.id,
        masterWalletId: walletMaestra.id,
        address: nuevaDireccion,
        derivationIndex: derivationIndex,
        active: true
      }, { transaction });

      direccionesCreadas.push({
        crypto: crypto.symbol,
        direccion: nuevaDireccion
      });

      // Write-flip (Paso B): el provisioning ya NO crea filas de balance en 0. En
      // el ledger, saldo 0 == cuenta inexistente (las cuentas se crean lazy al
      // primer movimiento real); getByUserId nunca listaba los ceros. Se conserva
      // la generacion de direcciones de deposito (el verdadero entregable).
    }

    const mensajeBienvenida = `¡Bienvenido al Exchange! Tu cuenta ha sido creada exitosamente. 
    
Se han generado ${direccionesCreadas.length} direcciones de depósito para las siguientes criptomonedas: ${direccionesCreadas.map(d => d.crypto).join(', ')}.

Para comenzar a operar:
1. Completa tu verificación KYC
2. Realiza tu primer depósito
3. ¡Comienza a intercambiar!`;
    
    const {Notification} = require('../../models/index.js');
    await Notification.createNotification({
      userId: usuario.id,
      type: 'system',
      title: 'Bienvenido al Exchange',
      message: mensajeBienvenida,
      important: true,
      canales: { email: true, push: false, inApp: true },
      metadatos: {
        direccionesCreadas: direccionesCreadas.length,
        balancesCreados: balancesCreados.length,
        tipoRegistro: usuario.googleId ? 'google' : 'email'
      }
    }, { transaction });

    return {
      direccionesCreadas,
      balancesCreados,
      notificationSent: true
    };
  } catch (error) {
    throw new Error(`Error en inicialización completa: ${error.message}`);
  }
};

// Listar usuarios con filtros (admin)
const getUsuarios = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await User.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener usuario por ID
const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await User.getById(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!authz.canAccessResource(req.user, id)) {
      const publicProfile = {
        id: result.id,
        username: result.username,
        averageRating: result.averageRating,
        totalRatings: result.totalRatings,
        kycVerified: result.kycVerified,
        created_at: result.created_at
      };
      return res.json(publicProfile);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==================== REGISTRAR NUEVO USUARIO (SIN TOKEN TEMPORAL) ==================== //
const registerUsuario = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userData = req.body;
    const { user, verificationCode } = await User.createWithPassword(userData);
    
    // Generar JWT NORMAL (no temporal)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        emailVerified: false, // ⚠️ Importante: marca como NO verificado
        kycVerified: user.kycVerified,
        active: user.active,
        averageRating: user.averageRating,
        country: user.country,
        twoFactorEnabled: false
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: '7d', // Token normal con duración estándar
        issuer: 'crypto-exchange',
        audience: 'crypto-exchange-users'
      }
    );
    
    // Enviar código de verificación por email
    try {
      await req.app.locals.emailService.enviarCodigoVerificacionEmail(
        user.email,
        verificationCode,
        user.username
      );
      console.log(`✅ Código de verificación enviado a ${user.email}`);
    } catch (emailError) {
      console.error('❌ Error enviando código de verificación:', emailError);
      // NO fallar el registro si el email falla, pero informar al usuario
    }
    
    await transaction.commit();

    res.status(201).json({
      message: 'Usuario registrado exitosamente. Por favor verifica tu email.',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        emailVerified: user.emailVerified
      },
      token, // Token normal (no temporal)
      requiresEmailVerification: true
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error en registro de usuario:', error);
    res.status(400).json({ 
      error: error.message,
      details: 'Error durante el registro del usuario'
    });
  }
};

// Login de usuario (método original mantenido para compatibilidad)
const loginUsuario = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    const { user, token } = await User.findByCredentials(emailOrUsername, password);
    
    await user.update({ lastLoginAt: new Date() });

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        kycVerified: user.kycVerified,
        averageRating: user.averageRating
      },
      token
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

// Login con Google.
// The client sends a Google Identity Services id_token; we verify it server-side
// (via the injected app.locals.googleTokenVerifier) and only then trust the
// identity. Both this endpoint and the passport callback funnel into the same
// brain (userService.findOrCreateGoogleUser), so there is one Google identity
// semantics (link-by-email + force email-verified).
const loginWithGoogle = async (req, res) => {
  const { idToken } = req.body;

  // Security boundary: an unverified/forged token never reaches the DB.
  let verified;
  try {
    verified = await req.app.locals.googleTokenVerifier.verify(idToken);
  } catch (error) {
    return res.status(401).json({ error: 'Token de Google inválido' });
  }

  // Reject tokens whose email Google has NOT verified. Otherwise a validly-signed
  // token for an unverified/alias email could link to (and take over) a
  // pre-existing password account at that address via findOrCreateGoogleUser's
  // link-by-email path. Legit Gmail logins always carry email_verified:true.
  if (!verified.emailVerified) {
    return res.status(401).json({ error: 'El email de la cuenta de Google no está verificado' });
  }

  const transaction = await sequelize.transaction();

  try {
    const profile = {
      id: verified.googleId,
      displayName: verified.name,
      // verified:true here mirrors the passport profile shape; it's already
      // guaranteed by the emailVerified gate above, and findOrCreateGoogleUser
      // now enforces it as a single choke point (defense in depth).
      emails: [{ value: verified.email, verified: verified.emailVerified }],
    };
    // Pass the transaction so the user row and provisioning are atomic: a failed
    // inicializarUsuarioCompleto rolls back the user too (no orphaned account).
    const result = await userService.findOrCreateGoogleUser(profile, transaction);

    let inicializacionResult = null;
    if (result.isNewUser) {
      inicializacionResult = await inicializarUsuarioCompleto(result, transaction);
    }

    await transaction.commit();

    const usuario = await User.findByPk(result.id);
    const token = usuario.generateUpdatedJWT();

    const response = {
      message: result.isNewUser ? 'Usuario registrado con Google exitosamente' : 'Login exitoso con Google',
      user: {
        id: result.id,
        email: result.email,
        username: result.username,
        role: result.role,
        kycVerified: result.kycVerified,
        averageRating: result.averageRating,
        country: result.country
      },
      token,
      isNew: result.isNewUser
    };

    if (result.isNewUser && inicializacionResult) {
      response.inicializacion = {
        direccionesCreadas: inicializacionResult.direccionesCreadas.length,
        balancesCreados: inicializacionResult.balancesCreados.length,
        criptomonedas: inicializacionResult.direccionesCreadas.map(d => d.crypto)
      };
    }

    res.json(response);
  } catch (error) {
    await transaction.rollback();
    console.error('Error en login con Google:', error);
    res.status(400).json({
      error: error.message,
      details: 'Error durante el proceso de autenticación'
    });
  }
};

// ==================== VERIFICACIÓN DE EMAIL (VERSIÓN MEJORADA) ==================== //

// Verificar email con código 
const verifyEmail = async (req, res) => {
  try {
    // Obtener userId del usuario autenticado (req.user ya está seteado por middleware)
    const userId = req.user.id;
    const { codigo } = req.body;
    
    if (!codigo) {
      return res.status(400).json({ 
        error: 'codigo es requerido' 
      });
    }


    const { user, token, message } = await User.verifyEmail(userId, codigo);
    
    // Inicializar usuario completo después de verificar email
    const transaction = await sequelize.transaction();
    try {
      await inicializarUsuarioCompleto(user, transaction);
      await transaction.commit();
    } catch (initError) {
      await transaction.rollback();
      console.error('Error inicializando usuario:', initError);
      // No fallar la verificación si falla la inicialización
    }

    res.json({
      message,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        emailVerified: user.emailVerified,
        kycVerified: user.kycVerified
      },
      token // Token actualizado con emailVerified: true
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Reenviar código de verificación de email 
const resendVerificationEmail = async (req, res) => {
  try {
    // Obtener userId del usuario autenticado
    const userId = req.user.id;
    

    const { user, codigo, message } = await User.resendEmailVerification(userId);
    
    // Enviar código por email
    try {
      await req.app.locals.emailService.enviarCodigoVerificacionEmail(
        user.email,
        codigo,
        user.username
      );

      res.json({
        message: 'Código de verificación reenviado exitosamente',
        email: user.email
      });
    } catch (emailError) {
      console.error('Error enviando código:', emailError);
      res.status(500).json({ 
        error: 'Error al enviar el código de verificación',
        details: emailError.message
      });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ==================== RESTO DE MÉTODOS (SIN CAMBIOS) ==================== //

// Métodos de recuperación de contraseña
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const result = await User.requestPasswordReset(email);
    
    if (result.sent) {
      await req.app.locals.emailService.enviarCodigoRecuperacion(
        result.user.email,
        result.codigo,
        result.user.username
      );
    }
    
    res.json({ message: result.message });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const verifyResetCode = async (req, res) => {
  try {
    const { email, codigo } = req.body;
    const result = await User.verifyResetCode(email, codigo);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, codigo, newPassword, confirmPassword } = req.body;
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }
    
    const { user, token } = await User.resetPasswordWithCode(email, codigo, newPassword);

    await req.app.locals.emailService.notificarCambioPassword(user.email, user.username);
    
    res.json({
      message: 'Contraseña actualizada exitosamente',
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Métodos de 2FA
const toggle2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Obtener el usuario actual
    const usuario = await User.findByPk(userId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Alternar el estado actual
    const nuevoEstado = !usuario.twoFactorEnabled;
    
    // Actualizar en la base de datos
    const { user, token } = await User.toggle2FA(userId, nuevoEstado);
    
    // Notificar por email
    await req.app.locals.emailService.notificar2FAChange(user.email, user.username, nuevoEstado);
    
    res.json({
      message: `Autenticación en dos pasos ${nuevoEstado ? 'activada' : 'desactivada'} exitosamente`,
      user,
      token,
      twoFactorEnabled: nuevoEstado
    });
  } catch (error) {
    console.error('Error en toggle2FA:', error);
    res.status(400).json({ error: error.message });
  }
};

const loginStep1 = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    const result = await User.loginStep1(emailOrUsername, password);
    
    if (result.requires2FA) {
      await req.app.locals.emailService.enviarCodigo2FA(
        result.user.email,
        result.twoFactorCode,
        result.user.username
      );
      
      return res.json({
        message: 'Código de verificación enviado a tu email',
        requires2FA: true,
        temporalToken: result.temporalToken
      });
    }
    
    res.json({
      message: 'Login exitoso',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

const verify2FA = async (req, res) => {
  try {
    const { temporalToken, codigo } = req.body;
    const { user, token } = await User.verify2FA(temporalToken, codigo);
    
    res.json({
      message: 'Verificación 2FA exitosa',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const resend2FACode = async (req, res) => {
  try {
    const { temporalToken } = req.body;
    const { user, codigo } = await User.resend2FACode(temporalToken);
    
    await req.app.locals.emailService.enviarCodigo2FA(user.email, codigo, user.username);

    res.json({
      message: 'Código 2FA reenviado exitosamente'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Métodos de perfil de usuario
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.getById(userId);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { user, token } = await User.updateProfile(userId, req.body);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    const { user, token } = await User.changePassword(userId, currentPassword, newPassword);

    await req.app.locals.emailService.notificarCambioPassword(user.email, user.username);
    
    res.json({
      message: 'Contraseña actualizada exitosamente',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Radar #14 — cambio de email (acción sensible). Paso 1: solicitar. Re-auth con
// la contraseña actual; se envía un código AL email nuevo (seam). Se usa
// asyncHandler → errores tipados vía el handler central (envelope canónico).
const requestEmailChange = async (req, res) => {
  const { nuevoEmail, passwordActual } = req.body;
  if (!nuevoEmail || !passwordActual) {
    throw new AppError(400, errorCodes.EMAIL_CHANGE_INVALID, 'nuevoEmail y passwordActual son requeridos');
  }
  let result;
  try {
    result = await User.requestEmailChange(req.user.id, nuevoEmail, passwordActual);
  } catch (error) {
    throw mapEmailChangeError(error);
  }
  // Enviar el código al email NUEVO (prueba de control). Fallo no fatal.
  try {
    await req.app.locals.emailService.enviarCodigoCambioEmail(result.pendingEmail, result.codigo);
  } catch (e) {
    console.error('Error enviando código de cambio de email:', e);
  }
  res.json({ message: 'Te enviamos un código al email nuevo para confirmar el cambio.' });
};

// Paso 2: confirmar con el código enviado al email nuevo. Notifica al email viejo
// (anti-ATO) y deja el cooldown de retiros seteado (lo hace el modelo).
const confirmEmailChange = async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) {
    throw new AppError(400, errorCodes.EMAIL_CHANGE_INVALID, 'codigo es requerido');
  }
  let result;
  try {
    result = await User.confirmEmailChange(req.user.id, codigo);
  } catch (error) {
    throw mapEmailChangeError(error);
  }
  // Notificar al email VIEJO que el email cambió. Fallo no fatal.
  try {
    await req.app.locals.emailService.notificarCambioEmail(result.emailViejo, result.user.email);
  } catch (e) {
    console.error('Error notificando cambio de email al email anterior:', e);
  }
  res.json({
    message: 'Email actualizado. Por seguridad, los retiros quedan bloqueados por un período tras el cambio.',
    token: result.token,
  });
};

const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.getById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const publicProfile = {
      id: user.id,
      username: user.username,
      averageRating: user.averageRating,
      totalRatings: user.totalRatings,
      kycVerified: user.kycVerified,
      created_at: user.created_at
    };
    
    res.json(publicProfile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Métodos administrativos
const updateUsuarioStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const { user, token } = await User.updateStatus(id, active);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateUsuarioRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const { user, token } = await User.updateRole(id, role);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateUsuarioKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { kycData, verified } = req.body;
    const { user, token } = await User.updateKYC(id, kycData, verified);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateDailyLimit = async (req, res) => {
  try {
    const { id } = req.params;
    const { dailyLimitUsd } = req.body;
    const { user, token } = await User.updateDailyLimit(id, dailyLimitUsd);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateUsuarioReputation = async (req, res) => {
  try {
    const { id } = req.params;
    const { averageRating, totalRatings } = req.body;
    const { user, token } = await User.updateReputation(id, averageRating, totalRatings);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    await User.destroy({ where: { id } });
    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deactivateInactiveUsers = async (req, res) => {
  try {
    const { days } = req.body;
    const affectedRows = await User.deactivateInactiveUsers(days || 365);
    res.json({
      message: `${affectedRows} usuarios inactivos desactivados`,
      affectedRows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Otros métodos
const searchUsuarios = async (req, res) => {
  try {
    const { query } = req.query;
    const usuarios = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: `%${query}%` } },
          { email: { [Op.iLike]: `%${query}%` } }
        ],
        active: true
      },
      attributes: ['id', 'username', 'averageRating', 'totalRatings', 'kycVerified'],
      limit: 10
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUsuariosStats = async (req, res) => {
  try {
    const stats = await User.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTopTraders = async (req, res) => {
  try {
    const { limit, period } = req.query;
    const traders = await User.getTopTraders(limit, period);
    res.json(traders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDailyVolume = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const volume = await User.getDailyVolume(userId);
    res.json({ userId, volume });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkTransactionLimit = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const { amount } = req.query;
    const result = await User.canMakeTransaction(userId, parseFloat(amount));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMyDepositAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const direcciones = await DepositAddress.getByUser(userId);
    res.json(direcciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Forma UNIFICADA (2026-09-03): misma respuesta compartimentada que
// /balances/my/balances y /intercambioExchange/me/balances (getBalancesWithCompartments:
// totales de raíz Funding+Spot + desglose + objeto crypto). Antes era
// funding-only. Cambio de contrato documentado en el contract doc.
const getMyBalances = async (req, res) => {
  try {
    const userId = req.user.id;
    const balances = await UserBalance.getBalancesWithCompartments(userId);
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ error: 'Email requerido' });
    }

    const existingUser = await User.findOne({
      where: { email: email.toLowerCase() }
    });

    res.json({ 
      available: !existingUser,
      email: email.toLowerCase()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ error: 'Username requerido' });
    }

    const existingUser = await User.findOne({
      where: { username: username.toLowerCase() }
    });

    res.json({ 
      available: !existingUser,
      username: username.toLowerCase()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const requestKYCVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const kycData = req.body;
    
    const { user, token } = await User.updateKYC(userId, kycData, false);
    
    await Notification.notifyUsersByRole('admin', {
      type: 'kyc',
      title: 'Nueva solicitud de verificación KYC',
      message: `El usuario ${user.username} ha enviado documentos para verificación KYC.`,
      important: true
    });
    
    res.json({
      message: 'Documentos KYC enviados para revisión',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await User.logout(userId);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const renewToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    const token = user.generateUpdatedJWT();
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const regenerateDepositAddress = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { userId, criptomonedaId } = req.body;
    
    if (!authz.isAdmin(req.user)) {
      return res.status(403).json({ error: 'Solo administradores pueden regenerar direcciones' });
    }
    
    const direccionActual = await DepositAddress.getByUserAndCrypto(userId, criptomonedaId);
    if (direccionActual) {
      await direccionActual.update({ active: false }, { transaction });
    }
    
    const crypto = await Crypto.getById(criptomonedaId);
    const walletMaestra = await MasterWallet.getByCrypto(criptomonedaId);
    
    if (!walletMaestra) {
      throw new Error('No hay wallet maestra para esta criptomoneda');
    }
    
    const derivationIndex = await DepositAddress.getNextDerivationIndex(walletMaestra.id);
    const nuevaDireccion = await generarDireccionDerivada(
      { ...walletMaestra, crypto }, 
      userId, 
      derivationIndex
    );
    
    const nuevaDireccionDeposito = await DepositAddress.create({
      usuarioId: userId,
      criptomonedaId: criptomonedaId,
      masterWalletId: walletMaestra.id,
      direccion: nuevaDireccion,
      derivationIndex: derivationIndex,
      active: true
    }, { transaction });
    
    const {Notification} = require('../../models/index.js');
    await Notification.createNotification({
      userId: userId,
      type: 'security',
      title: 'Dirección de depósito regenerada',
      message: `Tu dirección de depósito para ${crypto.symbol} ha sido regenerada por seguridad. Nueva dirección: ${nuevaDireccion}`,
      important: true
    }, { transaction });
    
    await transaction.commit();
    
    res.json({
      message: 'Dirección regenerada exitosamente',
      nuevaDireccion: {
        id: nuevaDireccionDeposito.id,
        crypto: crypto.symbol,
        direccion: nuevaDireccion,
        direccionAnterior: direccionActual ? direccionActual.direccion : null
      }
    });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ error: error.message });
  }
};

const checkUserInitialization = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const direcciones = await DepositAddress.getByUser(userId);
    const balances = await UserBalance.getByUserId(userId);
    const notificaciones = await Notification.getUserNotifications(userId, { limit: 1 });
    
    const criptomonedasActivas = await Crypto.getActive();
    
    const estado = {
      usuarioId: userId,
      inicializacionCompleta: direcciones.length === criptomonedasActivas.length,
      direccionesCreadas: direcciones.length,
      direccionesEsperadas: criptomonedasActivas.length,
      balancesCreados: balances.length,
      notificacionesBienvenida: notificaciones.total > 0,
      criptomonedasSinDireccion: criptomonedasActivas.filter(crypto => 
        !direcciones.some(dir => dir.criptomonedaId === crypto.id)
      ).map(c => c.symbol)
    };
    
    res.json(estado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const completeUserInitialization = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { userId } = req.params;
    
    if (!authz.canAccessResource(req.user, userId)) {
      return res.status(403).json({ error: 'Sin permisos para completar esta inicialización' });
    }
    
    const usuario = await User.getById(userId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const inicializacionResult = await inicializarUsuarioCompleto(usuario, transaction);
    await transaction.commit();
    
    res.json({
      message: 'Inicialización completada exitosamente',
      usuario: {
        id: usuario.id,
        username: usuario.username
      },
      inicializacion: inicializacionResult
    });
  } catch (error) {
    await transaction.rollback();
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  // Métodos de gestión básica de usuarios
  getUsuarios,
  getUsuarioById,
  searchUsuarios,
  getUsuariosStats,
  getTopTraders,
  
  // Métodos de autenticación
  registerUsuario,
  loginUsuario,
  loginWithGoogle,
  logout,
  renewToken,
  
  // Métodos de recuperación de contraseña
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
  
  // Métodos de 2FA
  toggle2FA,
  loginStep1,
  verify2FA,
  resend2FACode,
  
  // Métodos de verificación de email (NUEVOS)
  verifyEmail,
  resendVerificationEmail,
  
  // Métodos de perfil de usuario
  updateMyProfile,
  getMyProfile,
  getPublicProfile,
  changePassword,
  requestEmailChange,
  confirmEmailChange,
  
  // Métodos de wallets y balances
  getMyDepositAddresses,
  getMyBalances,
  regenerateDepositAddress,
  checkUserInitialization,
  completeUserInitialization,
  
  // Métodos de administración (admin/super_admin)
  updateUsuarioStatus,
  updateUsuarioRole,
  updateUsuarioKYC,
  updateDailyLimit,
  updateUsuarioReputation,
  deleteUsuario,
  deactivateInactiveUsers,
  
  // Métodos de transacciones y límites
  checkTransactionLimit,
  getDailyVolume,
  
  // Métodos de verificación
  checkEmailAvailability,
  checkUsernameAvailability,
  requestKYCVerification,
  
  // Helpers exportados para uso en otros controladores
  inicializarUsuarioCompleto,
  generarDireccionDerivada
};