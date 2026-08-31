// controllers/usuario.controller.js
const { Usuario, Criptomoneda, WalletMaestra, DireccionDeposito, BalanceUsuario, Notificaciones } = require('../models/index.js');
const { Op } = require('sequelize');
const { sequelize } = require('../models/index.js');
const emailService = require('../services/email.service.js');
const userService = require('../services/user.service');

// Función helper para generar dirección única
const generarDireccionDerivada = async (walletMaestra, usuarioId, derivationIndex) => {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256')
    .update(`${walletMaestra.direccionPublica}-${usuarioId}-${derivationIndex}`)
    .digest('hex');
  
  switch (walletMaestra.criptomoneda.red) {
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
    const criptomonedasActivas = await Criptomoneda.getActive();
    
    if (criptomonedasActivas.length === 0) {
      throw new Error('No hay criptomonedas activas en el sistema');
    }

    const direccionesCreadas = [];
    const balancesCreados = [];

    for (const criptomoneda of criptomonedasActivas) {
      const walletMaestra = await WalletMaestra.getByCriptomoneda(criptomoneda.id);
      
      if (!walletMaestra) {
        console.warn(`No hay wallet maestra para ${criptomoneda.symbol}. Saltando...`);
        continue;
      }

      const derivationIndex = await DireccionDeposito.getNextDerivationIndex(walletMaestra.id);
      
      const nuevaDireccion = await generarDireccionDerivada(
        { ...walletMaestra, criptomoneda }, 
        usuario.id, 
        derivationIndex
      );

      const direccionDeposito = await DireccionDeposito.create({
        usuarioId: usuario.id,
        criptomonedaId: criptomoneda.id,
        walletMaestraId: walletMaestra.id,
        direccion: nuevaDireccion,
        derivationIndex: derivationIndex,
        activa: true
      }, { transaction });

      direccionesCreadas.push({
        criptomoneda: criptomoneda.symbol,
        direccion: nuevaDireccion
      });

      const balanceInicial = await BalanceUsuario.create({
        usuarioId: usuario.id,
        criptomonedaId: criptomoneda.id,
        balanceDisponible: 0,
        balanceBloqueado: 0
      }, { transaction });

      balancesCreados.push({
        criptomoneda: criptomoneda.symbol,
        balance: 0
      });
    }

    const mensajeBienvenida = `¡Bienvenido al Exchange! Tu cuenta ha sido creada exitosamente. 
    
Se han generado ${direccionesCreadas.length} direcciones de depósito para las siguientes criptomonedas: ${direccionesCreadas.map(d => d.criptomoneda).join(', ')}.

Para comenzar a operar:
1. Completa tu verificación KYC
2. Realiza tu primer depósito
3. ¡Comienza a intercambiar!`;
    
    const {Notificaciones} = require('../models/index.js');
    await Notificaciones.createNotification({
      usuarioId: usuario.id,
      tipo: 'sistema',
      titulo: 'Bienvenido al Exchange',
      mensaje: mensajeBienvenida,
      importante: true,
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
      notificacionEnviada: true
    };
  } catch (error) {
    throw new Error(`Error en inicialización completa: ${error.message}`);
  }
};

// Listar usuarios con filtros (admin)
const getUsuarios = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await Usuario.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener usuario por ID
const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Usuario.getById(id);
    
    if (!result) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (req.user.rol === 'normal' && req.user.id !== id) {
      const publicProfile = {
        id: result.id,
        username: result.username,
        reputacionPromedio: result.reputacionPromedio,
        totalValoraciones: result.totalValoraciones,
        kycVerificado: result.kycVerificado,
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
    const { user, codigoVerificacion } = await Usuario.createWithPassword(userData);
    
    // Generar JWT NORMAL (no temporal)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { 
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        emailVerificado: false, // ⚠️ Importante: marca como NO verificado
        kycVerificado: user.kycVerificado,
        activo: user.activo,
        reputacionPromedio: user.reputacionPromedio,
        pais: user.pais,
        dosFactoresActivado: false
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
        codigoVerificacion,
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
        rol: user.rol,
        emailVerificado: user.emailVerificado
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
    const { user, token } = await Usuario.findByCredentials(emailOrUsername, password);
    
    await user.update({ ultimoLogin: new Date() });

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        kycVerificado: user.kycVerificado,
        reputacionPromedio: user.reputacionPromedio
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
      emails: [{ value: verified.email }],
    };
    const result = await userService.findOrCreateGoogleUser(profile);

    let inicializacionResult = null;
    if (result.isNewUser) {
      inicializacionResult = await inicializarUsuarioCompleto(result, transaction);
    }

    await transaction.commit();

    const usuario = await Usuario.findByPk(result.id);
    const token = usuario.generateUpdatedJWT();

    const response = {
      message: result.isNewUser ? 'Usuario registrado con Google exitosamente' : 'Login exitoso con Google',
      user: {
        id: result.id,
        email: result.email,
        username: result.username,
        rol: result.rol,
        kycVerificado: result.kycVerificado,
        reputacionPromedio: result.reputacionPromedio,
        pais: result.pais
      },
      token,
      isNew: result.isNewUser
    };

    if (result.isNewUser && inicializacionResult) {
      response.inicializacion = {
        direccionesCreadas: inicializacionResult.direccionesCreadas.length,
        balancesCreados: inicializacionResult.balancesCreados.length,
        criptomonedas: inicializacionResult.direccionesCreadas.map(d => d.criptomoneda)
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


    const { user, token, message } = await Usuario.verifyEmail(userId, codigo);
    
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
        rol: user.rol,
        emailVerificado: user.emailVerificado,
        kycVerificado: user.kycVerificado
      },
      token // Token actualizado con emailVerificado: true
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
    

    const { user, codigo, message } = await Usuario.resendEmailVerification(userId);
    
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
    const result = await Usuario.requestPasswordReset(email);
    
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
    const result = await Usuario.verifyResetCode(email, codigo);
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
    
    const { user, token } = await Usuario.resetPasswordWithCode(email, codigo, newPassword);

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
    const usuario = await Usuario.findByPk(userId);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Alternar el estado actual
    const nuevoEstado = !usuario.dosFactoresActivado;
    
    // Actualizar en la base de datos
    const { user, token } = await Usuario.toggle2FA(userId, nuevoEstado);
    
    // Notificar por email
    await req.app.locals.emailService.notificar2FAChange(user.email, user.username, nuevoEstado);
    
    res.json({
      message: `Autenticación en dos pasos ${nuevoEstado ? 'activada' : 'desactivada'} exitosamente`,
      user,
      token,
      dosFactoresActivado: nuevoEstado
    });
  } catch (error) {
    console.error('Error en toggle2FA:', error);
    res.status(400).json({ error: error.message });
  }
};

const loginStep1 = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    const result = await Usuario.loginStep1(emailOrUsername, password);
    
    if (result.requires2FA) {
      await req.app.locals.emailService.enviarCodigo2FA(
        result.user.email,
        result.codigo2FA,
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
    const { user, token } = await Usuario.verify2FA(temporalToken, codigo);
    
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
    const { user, codigo } = await Usuario.resend2FACode(temporalToken);
    
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
    const user = await Usuario.getById(userId);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { user, token } = await Usuario.updateProfile(userId, req.body);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    const { user, token } = await Usuario.changePassword(userId, currentPassword, newPassword);

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

const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Usuario.getById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const publicProfile = {
      id: user.id,
      username: user.username,
      reputacionPromedio: user.reputacionPromedio,
      totalValoraciones: user.totalValoraciones,
      kycVerificado: user.kycVerificado,
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
    const { activo } = req.body;
    const { user, token } = await Usuario.updateStatus(id, activo);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateUsuarioRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body;
    const { user, token } = await Usuario.updateRole(id, rol);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateUsuarioKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { kycData, verified } = req.body;
    const { user, token } = await Usuario.updateKYC(id, kycData, verified);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateDailyLimit = async (req, res) => {
  try {
    const { id } = req.params;
    const { limiteDiarioUsd } = req.body;
    const { user, token } = await Usuario.updateDailyLimit(id, limiteDiarioUsd);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateUsuarioReputation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reputacionPromedio, totalValoraciones } = req.body;
    const { user, token } = await Usuario.updateReputation(id, reputacionPromedio, totalValoraciones);
    res.json({ user, token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    await Usuario.destroy({ where: { id } });
    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deactivateInactiveUsers = async (req, res) => {
  try {
    const { days } = req.body;
    const affectedRows = await Usuario.deactivateInactiveUsers(days || 365);
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
    const usuarios = await Usuario.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: `%${query}%` } },
          { email: { [Op.iLike]: `%${query}%` } }
        ],
        activo: true
      },
      attributes: ['id', 'username', 'reputacionPromedio', 'totalValoraciones', 'kycVerificado'],
      limit: 10
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUsuariosStats = async (req, res) => {
  try {
    const stats = await Usuario.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getTopTraders = async (req, res) => {
  try {
    const { limit, period } = req.query;
    const traders = await Usuario.getTopTraders(limit, period);
    res.json(traders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getDailyVolume = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const volume = await Usuario.getDailyVolume(userId);
    res.json({ userId, volume });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkTransactionLimit = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const { amount } = req.query;
    const result = await Usuario.canMakeTransaction(userId, parseFloat(amount));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMyDepositAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const direcciones = await DireccionDeposito.getByUser(userId);
    res.json(direcciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMyBalances = async (req, res) => {
  try {
    const userId = req.user.id;
    const balances = await BalanceUsuario.getByUserId(userId);
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

    const existingUser = await Usuario.findOne({
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

    const existingUser = await Usuario.findOne({
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
    
    const { user, token } = await Usuario.updateKYC(userId, kycData, false);
    
    await Notificaciones.notifyUsersByRole('admin', {
      tipo: 'kyc',
      titulo: 'Nueva solicitud de verificación KYC',
      mensaje: `El usuario ${user.username} ha enviado documentos para verificación KYC.`,
      importante: true
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
    const result = await Usuario.logout(userId);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const renewToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Usuario.findByPk(userId);
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
    
    if (req.user.rol !== 'admin' && req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo administradores pueden regenerar direcciones' });
    }
    
    const direccionActual = await DireccionDeposito.getByUserAndCrypto(userId, criptomonedaId);
    if (direccionActual) {
      await direccionActual.update({ activa: false }, { transaction });
    }
    
    const criptomoneda = await Criptomoneda.getById(criptomonedaId);
    const walletMaestra = await WalletMaestra.getByCriptomoneda(criptomonedaId);
    
    if (!walletMaestra) {
      throw new Error('No hay wallet maestra para esta criptomoneda');
    }
    
    const derivationIndex = await DireccionDeposito.getNextDerivationIndex(walletMaestra.id);
    const nuevaDireccion = await generarDireccionDerivada(
      { ...walletMaestra, criptomoneda }, 
      userId, 
      derivationIndex
    );
    
    const nuevaDireccionDeposito = await DireccionDeposito.create({
      usuarioId: userId,
      criptomonedaId: criptomonedaId,
      walletMaestraId: walletMaestra.id,
      direccion: nuevaDireccion,
      derivationIndex: derivationIndex,
      activa: true
    }, { transaction });
    
    const {Notificaciones} = require('../models/index.js');
    await Notificaciones.createNotification({
      usuarioId: userId,
      tipo: 'seguridad',
      titulo: 'Dirección de depósito regenerada',
      mensaje: `Tu dirección de depósito para ${criptomoneda.symbol} ha sido regenerada por seguridad. Nueva dirección: ${nuevaDireccion}`,
      importante: true
    }, { transaction });
    
    await transaction.commit();
    
    res.json({
      message: 'Dirección regenerada exitosamente',
      nuevaDireccion: {
        id: nuevaDireccionDeposito.id,
        criptomoneda: criptomoneda.symbol,
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
    
    const direcciones = await DireccionDeposito.getByUser(userId);
    const balances = await BalanceUsuario.getByUserId(userId);
    const notificaciones = await Notificaciones.getUserNotifications(userId, { limit: 1 });
    
    const criptomonedasActivas = await Criptomoneda.getActive();
    
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
    
    if (req.user.rol !== 'admin' && req.user.rol !== 'super_admin' && req.user.id !== userId) {
      return res.status(403).json({ error: 'Sin permisos para completar esta inicialización' });
    }
    
    const usuario = await Usuario.getById(userId);
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