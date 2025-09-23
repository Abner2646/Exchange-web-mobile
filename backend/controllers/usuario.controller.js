// controllers/usuario.controller.js
const { Usuario, Criptomoneda, WalletMaestra, DireccionDeposito, BalanceUsuario, Notificaciones } = require('../models/index.js');
const { Op } = require('sequelize');
const { sequelize } = require('../models/index.js');
const emailService = require('../services/email.service.js');

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

// Registrar nuevo usuario
const registerUsuario = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const userData = req.body;
    const { user, token } = await Usuario.createWithPassword(userData);
    
    // const inicializacionResult = await inicializarUsuarioCompleto(user, transaction);
    
    await transaction.commit();

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        kycVerificado: user.kycVerificado,
        pais: user.pais
      },
      token,
      inicializacion: {
        // direccionesCreadas: inicializacionResult.direccionesCreadas.length,
        // balancesCreados: inicializacionResult.balancesCreados.length,
        // criptomonedas: inicializacionResult.direccionesCreadas.map(d => d.criptomoneda)
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error en registro de usuario:', error);
    res.status(400).json({ 
      error: error.message,
      details: 'Error durante la inicialización del usuario'
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

// Login con Google
const loginWithGoogle = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { googleId, email, username, pais } = req.body;
    const { user, token, isNew } = await Usuario.createWithProvider({
      googleId,
      email,
      username,
      pais
    });

    let inicializacionResult = null;
    
    if (isNew) {
      inicializacionResult = await inicializarUsuarioCompleto(user, transaction);
    }
    
    await transaction.commit();

    const response = {
      message: isNew ? 'Usuario registrado con Google exitosamente' : 'Login exitoso con Google',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        kycVerificado: user.kycVerificado,
        reputacionPromedio: user.reputacionPromedio,
        pais: user.pais
      },
      token,
      isNew
    };

    if (isNew && inicializacionResult) {
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

// --------------------- MÉTODOS DE RECUPERACIÓN DE CONTRASEÑA --------------------- //

// Solicitar código de recuperación de contraseña
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }

    const result = await Usuario.requestPasswordReset(email);
    
    if (result.sent && result.codigo) {
      try {
        await emailService.enviarCodigoRecuperacion(
          email, 
          result.codigo, 
          result.user.username
        );
      } catch (emailError) {
        console.error('Error enviando email:', emailError);
      }
    }

    res.json({ 
      message: 'Si el email existe en nuestro sistema, recibirás un código de recuperación en tu bandeja de entrada' 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Verificar código de recuperación
const verifyResetCode = async (req, res) => {
  try {
    const { email, codigo } = req.body;
    
    if (!email || !codigo) {
      return res.status(400).json({ error: 'Email y código son requeridos' });
    }

    const result = await Usuario.verifyResetCode(email, codigo);
    
    res.json({
      message: 'Código verificado correctamente',
      valid: result.valid
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Resetear contraseña con código
const resetPassword = async (req, res) => {
  try {
    const { email, codigo, newPassword, confirmPassword } = req.body;
    
    if (!email || !codigo || !newPassword || !confirmPassword) {
      return res.status(400).json({ 
        error: 'Email, código, nueva contraseña y confirmación son requeridos' 
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    const { user, token } = await Usuario.resetPasswordWithCode(email, codigo, newPassword);
    
    try {
      await emailService.notificarCambioPassword(user.email, user.username);
    } catch (emailError) {
      console.error('Error enviando notificación:', emailError);
    }

    res.json({
      message: 'Contraseña restablecida exitosamente',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// --------------------- MÉTODOS DE AUTENTICACIÓN EN DOS PASOS --------------------- //

// Activar/desactivar autenticación en dos pasos
const toggle2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { activar, currentPassword } = req.body;
    
    if (activar === undefined) {
      return res.status(400).json({ error: 'El parámetro "activar" es requerido' });
    }

    if (!currentPassword) {
      return res.status(400).json({ error: 'Contraseña actual requerida para cambios de seguridad' });
    }

    const user = await Usuario.findByPk(userId);
    if (!user.passwordHash) {
      return res.status(400).json({ error: 'Usuarios OAuth no pueden usar 2FA por email' });
    }

    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    }

    const { user: updatedUser, token, activado } = await Usuario.toggle2FA(userId, activar);
    
    try {
      await emailService.notificar2FAChange(user.email, user.username, activado);
    } catch (emailError) {
      console.error('Error enviando notificación:', emailError);
    }

    res.json({
      message: `Autenticación en dos pasos ${activado ? 'activada' : 'desactivada'} exitosamente`,
      dosFactoresActivado: activado,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Login paso 1 - Verificar credenciales
// Login paso 1 - Verificar credenciales (ACTUALIZADO)
const loginStep1 = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    
    if (!emailOrUsername || !password) {
      return res.status(400).json({ error: 'Email/username y contraseña son requeridos' });
    }

    const result = await Usuario.loginStep1(emailOrUsername, password);
    
    if (result.loginComplete) {
      // Login sin 2FA - respuesta normal
      res.json({
        message: 'Login exitoso',
        user: {
          id: result.user.id,
          email: result.user.email,
          username: result.user.username,
          rol: result.user.rol,
          kycVerificado: result.user.kycVerificado,
          reputacionPromedio: result.user.reputacionPromedio,
          dosFactoresActivado: result.user.dosFactoresActivado
        },
        token: result.token,
        requires2FA: false
      });
    } else {
      // REQUIERE 2FA - Generar token temporal de pre-autenticación
      const { codigo } = await Usuario.generateAndSave2FACode(result.userId);
      
      // Token temporal que SOLO sirve para verificar 2FA
      const jwt = require('jsonwebtoken');
      const preAuthToken = jwt.sign(
        { 
          userId: result.userId, 
          purpose: 'pre-auth-2fa',
          email: result.email 
        }, 
        process.env.JWT_SECRET, 
        { expiresIn: '10m' }
      );
      
      try {
        await emailService.enviarCodigo2FA(result.email, codigo, result.username);
      } catch (emailError) {
        console.error('Error enviando código 2FA:', emailError);
        return res.status(500).json({ error: 'Error enviando código de verificación' });
      }

      res.json({
        message: 'Credenciales correctas. Revisa tu email para el código de verificación',
        requires2FA: true,
        preAuthToken: preAuthToken
      });
    }
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

// Verificar código 2FA y completar login (ACTUALIZADO)
const verify2FA = async (req, res) => {
  try {
    // Opción 1: Con Bearer (estándar)
    //const authHeader = req.headers['authorization'];
    //const preAuthToken = authHeader && authHeader.split(' ')[1];
    
    // Opción 2: Sin Bearer (directo)
    const preAuthToken = req.headers['authorization'];

    const { codigo } = req.body;
    
    if (!preAuthToken || !codigo) {
      return res.status(400).json({ error: 'Token de pre-autenticación y código son requeridos' });
    }

    // Verificar token temporal
    let decoded;
    try {
      const jwt = require('jsonwebtoken');
      decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Token de pre-autenticación inválido o expirado' });
    }
    
    if (decoded.purpose !== 'pre-auth-2fa') {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar código 2FA
    const { user, token } = await Usuario.verify2FACode(decoded.userId, codigo);
    
    res.json({
      message: 'Login exitoso con verificación 2FA',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        kycVerificado: user.kycVerificado,
        reputacionPromedio: user.reputacionPromedio,
        dosFactoresActivado: user.dosFactoresActivado
      },
      token
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

// Reenviar código 2FA (NUEVO - SEGURO)
const resend2FACode = async (req, res) => {
  try {
    const { preAuthToken } = req.body;
    
    if (!preAuthToken) {
      return res.status(400).json({ error: 'Token de pre-autenticación requerido' });
    }

    // Verificar token temporal
    let decoded;
    try {
      const jwt = require('jsonwebtoken');
      decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Token de pre-autenticación inválido o expirado' });
    }
    
    if (decoded.purpose !== 'pre-auth-2fa') {
      return res.status(401).json({ error: 'Token inválido para reenvío' });
    }

    // Verificar que el usuario existe y tiene 2FA activado
    const user = await Usuario.findByPk(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    if (!user.dosFactoresActivado) {
      return res.status(400).json({ error: 'Usuario no tiene 2FA activado' });
    }

    // Generar nuevo código y enviarlo
    const { codigo } = await Usuario.generateAndSave2FACode(decoded.userId);
    
    try {
      await emailService.enviarCodigo2FA(user.email, codigo, user.username);
    } catch (emailError) {
      console.error('Error enviando código 2FA:', emailError);
      return res.status(500).json({ error: 'Error enviando código de verificación' });
    }

    res.json({
      message: 'Nuevo código de verificación enviado a tu email'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --------------------- MÉTODOS EXISTENTES (mantenidos sin cambio) --------------------- //

// Actualizar perfil propio
const updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = req.body;
    
    const { user, token } = await Usuario.updateProfile(userId, updateData);
    
    res.json({
      message: 'Perfil actualizado exitosamente'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener mi perfil
const getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Usuario.getById(userId);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis direcciones de depósito
const getMyDepositAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const direcciones = await DireccionDeposito.getByUser(userId);
    
    const direccionesFormateadas = direcciones.map(addr => ({
      id: addr.id,
      criptomoneda: {
        id: addr.criptomoneda.id,
        symbol: addr.criptomoneda.symbol,
        nombre: addr.criptomoneda.nombre,
        red: addr.criptomoneda.red
      },
      direccion: addr.direccion,
      activa: addr.activa,
      created_at: addr.created_at
    }));
    
    res.json({
      direcciones: direccionesFormateadas,
      total: direccionesFormateadas.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis balances
const getMyBalances = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const balances = await BalanceUsuario.getByUserId(userId);
    
    const balancesDetallados = await Promise.all(
      balances.map(async (balance) => {
        const criptomoneda = await Criptomoneda.getById(balance.criptomonedaId);
        const totalBalance = parseFloat(balance.balanceDisponible) + parseFloat(balance.balanceBloqueado);
        
        return {
          criptomoneda: {
            id: criptomoneda.id,
            symbol: criptomoneda.symbol,
            nombre: criptomoneda.nombre,
            decimales: criptomoneda.decimales
          },
          balanceDisponible: parseFloat(balance.balanceDisponible),
          balanceBloqueado: parseFloat(balance.balanceBloqueado),
          balanceTotal: totalBalance,
          updated_at: balance.updated_at
        };
      })
    );

    const balancesConFondos = balancesDetallados.filter(
      balance => balance.balanceTotal > 0
    );
    
    res.json({
      balances: balancesConFondos,
      total: balancesConFondos.length,
      balancesCompletos: balancesDetallados.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cambiar contraseña (actualizado con notificación por email)
const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    const { user, token } = await Usuario.changePassword(userId, currentPassword, newPassword);

    try {
      await emailService.notificarCambioPassword(user.email, user.username);
    } catch (emailError) {
      console.error('Error enviando notificación:', emailError);
    }
    
    res.json({
      message: 'Contraseña cambiada exitosamente',
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Resto de métodos administrativos (sin cambios)
const updateUsuarioStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;
    
    const { user, token } = await Usuario.updateStatus(id, activo);
    
    res.json({
      message: `Usuario ${activo ? 'activado' : 'desactivado'} exitosamente`,
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateUsuarioRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body;
    
    if (req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super administradores pueden cambiar roles' });
    }
    
    const { user, token } = await Usuario.updateRole(id, rol);
    
    res.json({
      message: 'Rol actualizado exitosamente',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const searchUsuarios = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Término de búsqueda requerido' });
    }

    const results = await Usuario.search(term, parseInt(limit));
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateUsuarioKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const { kycData, verified } = req.body;
    
    const { user, token } = await Usuario.updateKYC(id, kycData, verified);
    
    res.json({
      message: `KYC ${verified ? 'aprobado' : 'actualizado'} exitosamente`,
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const checkTransactionLimit = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { amount } = req.query;
    
    if (req.user.rol !== 'admin' && userId !== req.user.id) {
      return res.status(403).json({ error: 'Sin permisos para verificar este límite' });
    }
    
    if (!amount) {
      return res.status(400).json({ error: 'Monto requerido' });
    }

    const result = await Usuario.canMakeTransaction(userId, parseFloat(amount));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateDailyLimit = async (req, res) => {
  try {
    const { id } = req.params;
    const { limiteDiarioUsd } = req.body;
    
    const { user, token } = await Usuario.updateDailyLimit(id, limiteDiarioUsd);
    
    res.json({
      message: 'Límite diario actualizado exitosamente',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getDailyVolume = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { fecha } = req.query;
    
    if (req.user.rol !== 'admin' && userId !== req.user.id) {
      return res.status(403).json({ error: 'Sin permisos para ver este volumen' });
    }
    
    const fechaConsulta = fecha ? new Date(fecha) : new Date();
    const volume = await Usuario.getDailyVolume(userId, fechaConsulta);
    
    res.json({
      usuarioId: userId,
      fecha: fechaConsulta.toISOString().split('T')[0],
      volumenDiario: volume
    });
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
    const { limit = 10, period = '30d' } = req.query;
    const topTraders = await Usuario.getTopTraders(parseInt(limit), period);
    res.json(topTraders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deactivateInactiveUsers = async (req, res) => {
  try {
    const { days = 365 } = req.query;
    const deactivatedCount = await Usuario.deactivateInactiveUsers(parseInt(days));
    
    res.json({
      message: `${deactivatedCount} usuarios desactivados por inactividad`,
      deactivatedCount,
      daysSinceLogin: parseInt(days)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateUsuarioReputation = async (req, res) => {
  try {
    const { id } = req.params;
    const { reputacionPromedio, totalValoraciones } = req.body;
    
    const { user, token } = await Usuario.updateReputation(id, reputacionPromedio, totalValoraciones);
    
    res.json({
      message: 'Reputación actualizada exitosamente',
      user,
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (req.user.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo super administradores pueden eliminar usuarios' });
    }

    if (req.user.id === id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    const user = await Usuario.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const { TransaccionP2P } = require('../models/index.js');
    const activeTransactions = await TransaccionP2P.count({
      where: {
        [Op.or]: [
          { compradorId: id },
          { vendedorId: id }
        ],
        estado: { [Op.in]: ['iniciada', 'cryptos_bloqueadas', 'pago_confirmado'] }
      }
    });

    if (activeTransactions > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar usuario con transacciones activas' 
      });
    }

    await user.update({ 
      activo: false,
      email: `deleted_${Date.now()}_${user.email}`,
      username: `deleted_${Date.now()}_${user.username}`
    });

    res.json({ message: 'Usuario eliminado (desactivado) exitosamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const renewToken = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Usuario.findByPk(userId);
    
    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    const newToken = user.generateUpdatedJWT();
    
    res.json({
      message: 'Token renovado exitosamente',
      token: newToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        rol: user.rol,
        kycVerificado: user.kycVerificado,
        reputacionPromedio: user.reputacionPromedio
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await Usuario.findByPk(id, {
      attributes: [
        'id', 
        'username', 
        'reputacionPromedio', 
        'totalValoraciones', 
        'kycVerificado', 
        'created_at'
      ]
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
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
  
  // Métodos de recuperación de contraseña (NUEVOS)
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
  
  // Métodos de 2FA (NUEVOS)
  toggle2FA,
  loginStep1,
  verify2FA,
  resend2FACode,
  
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