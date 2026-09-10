// models/user.model.js - PARCHEADO
const initUser = require('./user.entity');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { Op } = require('sequelize');

dotenv.config();
const secretWord = process.env.JWT_SECRET;

function createUserModel(sequelize) {
  const User = initUser(sequelize);

// Función para generar JWT actualizado (instancia)
  User.prototype.generateUpdatedJWT = function() {
    const payload = {
      id: this.id,
      email: this.email,
      username: this.username,
      role: this.role,
      kycVerified: this.kycVerified,
      active: this.active,
      averageRating: this.averageRating,
      country: this.country,
      twoFactorEnabled: this.twoFactorEnabled || false,
      emailVerified: this.emailVerified || false,
      googleId: this.googleId || null,
    };

    return jwt.sign(payload, secretWord, { 
      expiresIn: '7d',
      issuer: 'crypto-exchange',
      audience: 'crypto-exchange-users'
    });
  };

  // Método estático para generar JWT
  User.generateUpdatedJWT = function(userData) {
    const payload = {
      id: userData.id,
      email: userData.email,
      username: userData.username,
      role: userData.role,
      kycVerified: userData.kycVerified,
      active: userData.active,
      averageRating: userData.averageRating,
      country: userData.country,
      twoFactorEnabled: userData.twoFactorEnabled || false,
      emailVerified: userData.emailVerified || false,
      googleId: userData.googleId || null,
    };

    return jwt.sign(payload, secretWord, { 
      expiresIn: '7d',
      issuer: 'crypto-exchange',
      audience: 'crypto-exchange-users'
    });
  };

  // Métodos de autenticación existentes
  User.findByCredentials = async (emailOrUsername, password) => {
    try {
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { email: emailOrUsername.toLowerCase() },
            { username: emailOrUsername.toLowerCase() }
          ],
          active: true
        }
      });

      if (!user || !user.passwordHash) {
        throw new Error('Credenciales inválidas');
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Credenciales inválidas');
      }

      const token = user.generateUpdatedJWT();
      return { user, token };
    } catch (error) {
      throw new Error('Credenciales inválidas');
    }
  };

  User.findByExternalId = async (googleId) => {
    return await User.findOne({
      where: { googleId, active: true }
    });
  };

  User.createWithPassword = async (data) => {
    const { email, username, password, country, ...otherData } = data;

    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { email: email.toLowerCase() },
          { username: username.toLowerCase() }
        ]
      }
    });

    if (existingUser) {
      throw new Error('Email o username ya están en uso');
    }

    if (!password || password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }

    // VERIFICAR SI ES EL PRIMER USUARIO
    const userCount = await User.count();
    const role = userCount === 0 ? 'super_admin' : 'normal';

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const userData = {
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      passwordHash,
      country,
      role,
      emailVerified: false,
      ...otherData
    };

    const newUser = await User.create(userData);
    
    // Generar código de verificación de email
    const codigoVerificacion = await newUser.generateEmailVerificationCode();

    return { user: newUser, codigoVerificacion };
  };

  // --------------------- MÉTODOS PARA RECUPERACIÓN DE CONTRASEÑA --------------------- //
  
  User.requestPasswordReset = async (email) => {
    const user = await User.findOne({
      where: { 
        email: email.toLowerCase(),
        active: true,
        passwordHash: { [Op.ne]: null }
      }
    });

    if (!user) {
      return { 
        message: 'Si el email existe, recibirás un código de recuperación',
        sent: false 
      };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (user.lastPasswordResetAttemptAt && 
        user.lastPasswordResetAttemptAt > oneHourAgo && 
        user.passwordResetAttempts >= 3) {
      throw new Error('Demasiados intentos. Espera 1 hora antes de intentar nuevamente');
    }

    const codigo = await user.generatePasswordResetCode();
    
    const nuevosIntentos = user.lastPasswordResetAttemptAt && 
                          user.lastPasswordResetAttemptAt > oneHourAgo ? 
                          user.passwordResetAttempts + 1 : 1;
    
    await user.update({
      passwordResetAttempts: nuevosIntentos,
      lastPasswordResetAttemptAt: new Date()
    });

    return {
      user,
      codigo,
      message: 'Código de recuperación enviado',
      sent: true
    };
  };

  User.verifyResetCode = async (email, codigo) => {
    const user = await User.findOne({
      where: { 
        email: email.toLowerCase(),
        active: true
      }
    });

    if (!user) {
      throw new Error('Código inválido o expirado');
    }

    if (!user.validatePasswordResetCode(codigo)) {
      throw new Error('Código inválido o expirado');
    }

    return { valid: true, userId: user.id };
  };

  // --------------------- MÉTODOS PARA VERIFICACIÓN DE EMAIL --------------------- //

  User.requestEmailVerification = async (userId) => {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (user.emailVerified) {
      throw new Error('Email ya verificado');
    }

    if (user.googleId) {
      throw new Error('Usuarios de Google no necesitan verificar email');
    }

    const codigo = await user.generateEmailVerificationCode();

    return {
      user,
      codigo,
      message: 'Código de verificación generado'
    };
  };

  User.verifyEmail = async (userId, codigo) => {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (user.emailVerified) {
      throw new Error('Email ya verificado');
    }

    if (!user.validateEmailVerificationCode(codigo)) {
      throw new Error('Código inválido o expirado');
    }

    await user.update({
      emailVerified: true,
      emailVerificationCode: null,
      emailVerificationCodeExpiresAt: null
    });

    const token = user.generateUpdatedJWT();

    return { user, token, message: 'Email verificado exitosamente' };
  };

  User.resendEmailVerification = async (userId) => {
    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (user.emailVerified) {
      throw new Error('Email ya verificado');
    }

    if (user.googleId) {
      throw new Error('Usuarios de Google no necesitan verificar email');
    }

    const codigo = await user.generateEmailVerificationCode();

    return {
      user,
      codigo,
      message: 'Código de verificación reenviado'
    };
  };


  User.resetPasswordWithCode = async (email, codigo, newPassword) => {
    const user = await User.findOne({
      where: { 
        email: email.toLowerCase(),
        active: true
      }
    });

    if (!user || !user.validatePasswordResetCode(codigo)) {
      throw new Error('Código inválido o expirado');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    }

    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await user.update({ 
      passwordHash: newPasswordHash,
      passwordResetCode: null,
      passwordResetCodeExpiresAt: null,
      passwordResetAttempts: 0
    });

    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  // --------------------- MÉTODOS PARA LOGOUT CON INVALIDACIÓN DE TOKENS --------------------- //

  User.logout = async (userId) => {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ lastLogoutAt: new Date() });
    
    return { 
      message: 'Logout exitoso - Tokens anteriores invalidados',
      logoutTime: new Date()
    };
  };

  User.isTokenValidAfterLogout = async (userId, tokenIssuedAt) => {
    const user = await User.findByPk(userId);
    
    if (!user) {
      return false;
    }
    
    // Si nunca hizo logout, el token es válido
    if (!user.lastLogoutAt) {
      return true;
    }
    
    // Comparar timestamp del token vs último logout
    const tokenTimestamp = tokenIssuedAt * 1000; // JWT usa segundos, JS usa milisegundos
    const logoutTimestamp = user.lastLogoutAt.getTime();
    
    // Token es válido si fue emitido DESPUÉS del logout
    return tokenTimestamp > logoutTimestamp;
  };

  // --------------------- MÉTODOS PARA AUTENTICACIÓN EN DOS PASOS --------------------- //

User.toggle2FA = async (id, nuevoEstado) => {
  const user = await User.findByPk(id);
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  await user.update({ 
    twoFactorEnabled: nuevoEstado,
    twoFactorCode: null,
    twoFactorCodeExpiresAt: null
  });

  const token = user.generateUpdatedJWT();
  return { user, token };
};

  User.generateAndSave2FACode = async (id) => {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

    await user.update({
      twoFactorCode: codigo,
      twoFactorCodeExpiresAt: expiracion
    });

    return { codigo, user };
  };

  User.verify2FACode = async (id, codigo) => {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (!user.twoFactorCode || 
        user.twoFactorCode !== codigo || 
        !user.twoFactorCodeExpiresAt || 
        new Date() > user.twoFactorCodeExpiresAt) {
      throw new Error('Código 2FA inválido o expirado');
    }

    await user.update({
      twoFactorCode: null,
      twoFactorCodeExpiresAt: null,
      lastLoginAt: new Date()
    });

    const token = user.generateUpdatedJWT();
    return { user, token };
  };

  // ============ MÉTODO CORREGIDO: loginStep1 ============
  User.loginStep1 = async (emailOrUsername, password) => {
    try {
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { email: emailOrUsername.toLowerCase() },
            { username: emailOrUsername.toLowerCase() }
          ],
          active: true
        }
      });

      if (!user || !user.passwordHash) {
        throw new Error('Credenciales inválidas');
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Credenciales inválidas');
      }

      // Si NO tiene 2FA activado, login normal
      if (!user.twoFactorEnabled) {
        await user.update({ lastLoginAt: new Date() });
        const token = user.generateUpdatedJWT();
        return { 
          user, 
          token, 
          requires2FA: false,
          loginComplete: true 
        };
      }

      // ============ NUEVO: Si tiene 2FA activado ============
      // Generar código 2FA de 6 dígitos
      const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiracion = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

      // Guardar código en la base de datos
      await user.update({
        twoFactorCode: twoFactorCode,
        twoFactorCodeExpiresAt: expiracion
      });

      // Generar token temporal (válido por 10 minutos) para verificar 2FA
      const temporalToken = jwt.sign(
        { 
          userId: user.id, 
          purpose: '2fa',
          email: user.email 
        },
        secretWord,
        { expiresIn: '10m' }
      );

      return { 
        user: {  // ⚠️ IMPORTANTE: Devolver objeto user anidado
          id: user.id,
          username: user.username,
          email: user.email
        },
        twoFactorCode: twoFactorCode,  // ⚠️ NUEVO: Código generado
        temporalToken: temporalToken,  // ⚠️ NUEVO: Token temporal
        requires2FA: true,
        loginComplete: false
      };
    } catch (error) {
      throw new Error('Credenciales inválidas');
    }
  };

  // ============ NUEVA FUNCIÓN: verify2FA ============
  User.verify2FA = async (temporalToken, codigo) => {
    // Verificar y decodificar el token temporal
    let decoded;
    try {
      decoded = jwt.verify(temporalToken, secretWord);
    } catch (error) {
      throw new Error('Token temporal inválido o expirado');
    }

    // Verificar que sea un token de 2FA
    if (decoded.purpose !== '2fa') {
      throw new Error('Token inválido');
    }

    // Buscar el usuario
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar el código 2FA
    if (!user.twoFactorCode || 
        user.twoFactorCode !== codigo || 
        !user.twoFactorCodeExpiresAt || 
        new Date() > user.twoFactorCodeExpiresAt) {
      throw new Error('Código 2FA inválido o expirado');
    }

    // Limpiar código 2FA y actualizar último login
    await user.update({
      twoFactorCode: null,
      twoFactorCodeExpiresAt: null,
      lastLoginAt: new Date()
    });

    // Generar token JWT normal
    const token = user.generateUpdatedJWT();

    return { user, token };
  };

  // ============ NUEVA FUNCIÓN: resend2FACode ============
  User.resend2FACode = async (temporalToken) => {
    // Verificar y decodificar el token temporal
    let decoded;
    try {
      decoded = jwt.verify(temporalToken, secretWord);
    } catch (error) {
      throw new Error('Token temporal inválido o expirado');
    }

    // Verificar que sea un token de 2FA
    if (decoded.purpose !== '2fa') {
      throw new Error('Token inválido');
    }

    // Buscar el usuario
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Generar nuevo código 2FA
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

    await user.update({
      twoFactorCode: codigo,
      twoFactorCodeExpiresAt: expiracion
    });

    return { user, codigo };
  };

  // Métodos de consulta y gestión existentes
  User.getById = async (id) => {
    const user = await User.findByPk(id, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        // (Paso C: se quitó el include 'balances' — BalanceUsuario ya no es un
        // modelo/asociación; los saldos se consultan por separado en GET
        // /me/balances, respaldados por la proyección del ledger.)
        {
          association: 'valoracionesRecibidas',
          limit: 5,
          order: [['created_at', 'DESC']],
          include: [{
            association: 'evaluador',
            attributes: ['id', 'username', 'averageRating']
          }]
        }
      ]
    });

    return user;
  };

  User.getAll = async (filters = {}) => {
    const {
      role,
      kycVerified,
      active,
      country,
      search,
      averageRatingMin,
      page = 1,
      limit = 20,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = filters;

    const where = {};
    const offset = (page - 1) * limit;

    if (role) where.role = role;
    if (kycVerified !== undefined) where.kycVerified = kycVerified;
    if (active !== undefined) where.active = active;
    if (country) where.country = country;
    if (averageRatingMin) where.averageRating = { [Op.gte]: averageRatingMin };

    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['passwordHash', 'kycData', 'taxId', 'legalName', 'dateOfBirth'] },
      order: [[orderBy, orderDirection]],
      limit: parseInt(limit),
      offset
    });

    return {
      users: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  };

  User.search = async (term, limit = 10) => {
    return await User.findAll({
      where: {
        [Op.or]: [
          { email: { [Op.iLike]: `%${term}%` } },
          { username: { [Op.iLike]: `%${term}%` } }
        ],
        active: true
      },
      attributes: ['id', 'email', 'username', 'averageRating', 'kycVerified'],
      limit,
      order: [['averageRating', 'DESC']]
    });
  };

  // Métodos administrativos existentes
  User.updateStatus = async (id, newStatus) => {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ active: newStatus });
    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  User.updateRole = async (id, newRole) => {
    const validRoles = ['normal', 'admin', 'super_admin'];
    if (!validRoles.includes(newRole)) {
      throw new Error('Rol inválido');
    }

    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ role: newRole });
    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  User.updateReputation = async (id, averageRating, totalRatings) => {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ 
      averageRating: parseFloat(averageRating).toFixed(2), 
      totalRatings 
    });
    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  // Métodos de perfil de usuario existentes
  User.updateProfile = async (id, data) => {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Radar #14: `username` es el handle de login — INMUTABLE por self-service
    // (no está en la whitelist). El nombre mostrado editable es `displayName`. Los
    // campos de identidad KYC (legalName/dateOfBirth/taxId) se setean por el
    // flujo de KYC (§4.7), no por edición libre de perfil. La whitelist además
    // corta cualquier mass-assignment (role, límites, flag AML no son editables acá).
    const allowedFields = ['displayName', 'country', 'state', 'locale'];
    const updateData = {};

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = data[key];
      }
    });

    await user.update(updateData);
    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  User.changePassword = async (id, currentPassword, newPassword) => {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (!user.passwordHash) {
      throw new Error('Usuario de OAuth no puede cambiar contraseña');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new Error('Contraseña actual incorrecta');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    }

    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await user.update({ passwordHash: newPasswordHash });
    const token = user.generateUpdatedJWT();

    const { Notificaciones } = require('../../models');
    await Notificaciones.notifySecurityEvent(id, 'cambio_password');
    
    return { user, token };
  };

  // Radar #14 — cambio de email (acción sensible). Paso 1: SOLICITAR.
  // Re-auth con la contraseña actual + valida que el email nuevo esté libre
  // (case-insensitive); genera un código y lo deja pendiente. El envío del código
  // AL email nuevo lo hace el controller (seam de email). Devuelve el código y el
  // email normalizado para que el controller lo mande al destino nuevo.
  User.requestEmailChange = async (id, nuevoEmail, currentPassword) => {
    const user = await User.findByPk(id);
    if (!user) throw new Error('Usuario no encontrado');
    if (!user.passwordHash) throw new Error('Usuario de OAuth no puede cambiar el email por esta vía');

    const valid = await bcrypt.compare(currentPassword || '', user.passwordHash);
    if (!valid) throw new Error('Contraseña actual incorrecta');

    const email = String(nuevoEmail || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new Error('Email nuevo inválido');
    }
    if (email === user.email.toLowerCase()) {
      throw new Error('El email nuevo es igual al actual');
    }
    const existente = await User.findOne({ where: { email }, attributes: ['id'] });
    if (existente) throw new Error('El email ya está en uso');

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await user.update({
      pendingEmail: email,
      emailChangeCode: codigo,
      emailChangeCodeExpiresAt: expiracion,
    });
    return { codigo, pendingEmail: email };
  };

  // Paso 2: CONFIRMAR con el código enviado al email nuevo. Actualiza el email, lo
  // marca verificado, limpia el pendiente, y setea el COOLDOWN de retiros (duración
  // = config de negocio Radar #13, default 24h). Devuelve el email viejo para que
  // el controller lo NOTIFIQUE (anti account-takeover).
  User.confirmEmailChange = async (id, codigo) => {
    const user = await User.findByPk(id);
    if (!user) throw new Error('Usuario no encontrado');
    if (!user.pendingEmail || !user.emailChangeCode) {
      throw new Error('No hay un cambio de email pendiente');
    }
    if (user.emailChangeCode !== String(codigo)) {
      throw new Error('Código de cambio de email incorrecto');
    }
    if (!user.emailChangeCodeExpiresAt || new Date() > user.emailChangeCodeExpiresAt) {
      throw new Error('El código de cambio de email expiró');
    }
    // Carrera: el email pudo tomarse entre solicitar y confirmar.
    const email = user.pendingEmail;
    const existente = await User.findOne({ where: { email }, attributes: ['id'] });
    if (existente && existente.id !== id) throw new Error('El email ya está en uso');

    const emailViejo = user.email;
    const businessConfig = require('../../services/config/businessConfig');
    const horas = await businessConfig.getNumber('cooldown_retiro_cambio_email_horas', 24);
    const cooldownHasta = new Date(Date.now() + horas * 60 * 60 * 1000);

    await user.update({
      email,
      emailVerified: true,
      pendingEmail: null,
      emailChangeCode: null,
      emailChangeCodeExpiresAt: null,
      withdrawalCooldownUntil: cooldownHasta,
    });
    const token = user.generateUpdatedJWT();

    return { user, emailViejo, token };
  };

  // Métodos relacionados con KYC existentes
  User.updateKYC = async (id, kycData, verified = false) => {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const updateData = {
      kycData: { ...user.kycData, ...kycData },
      kycVerified: verified
    };

    await user.update(updateData);
    const token = user.generateUpdatedJWT();

    const { Notificaciones } = require('../../models');
    const template = verified ? 'KYC_APROBADO' : 'KYC_RECHAZADO';
    await Notificaciones.createNotification({
      usuarioId: id,
      template
    });
    
    return { user, token };
  };

  // Métodos relacionados con transacciones existentes
  User.getDailyVolume = async (id, fecha = new Date()) => {
    const startOfDay = new Date(fecha);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(fecha);
    endOfDay.setHours(23, 59, 59, 999);

    const { TransaccionP2P } = require('../../models');
    
    const volume = await TransaccionP2P.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('montoFiat')), 'volumenTotal']
      ],
      where: {
        [Op.or]: [
          { compradorId: id },
          { vendedorId: id }
        ],
        estado: 'completada',
        created_at: {
          [Op.between]: [startOfDay, endOfDay]
        }
      },
      raw: true
    });

    return parseFloat(volume[0]?.volumenTotal || 0);
  };

  User.canMakeTransaction = async (id, amount) => {
    const user = await User.findByPk(id);
    if (!user) {
      return { canTransact: false, reason: 'Usuario no encontrado' };
    }

    if (!user.active) {
      return { canTransact: false, reason: 'Cuenta desactivada' };
    }

    if (!user.kycVerified && amount > 100) {
      return { canTransact: false, reason: 'KYC requerido para transacciones mayores a $100' };
    }

    const dailyVolume = await User.getDailyVolume(id);
    if (dailyVolume + amount > user.dailyLimitUsd) {
      return { 
        canTransact: false, 
        reason: `Límite diario excedido. Disponible: $${user.dailyLimitUsd - dailyVolume}` 
      };
    }

    return { canTransact: true };
  };

  User.updateDailyLimit = async (id, newLimit) => {
    const user = await User.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ dailyLimitUsd: newLimit });
    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  // Métodos de estadísticas existentes
  User.getStats = async () => {
    const stats = await User.findAll({
      attributes: [
        'role',
        'kycVerified',
        'active',
        'country',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total']
      ],
      group: ['role', 'kycVerified', 'active', 'country'],
      raw: true
    });

    return stats;
  };

  User.getTopTraders = async (limit = 10, period = '30d') => {
    const fechaDesde = new Date();
    switch (period) {
      case '7d':
        fechaDesde.setDate(fechaDesde.getDate() - 7);
        break;
      case '30d':
        fechaDesde.setDate(fechaDesde.getDate() - 30);
        break;
      case '90d':
        fechaDesde.setDate(fechaDesde.getDate() - 90);
        break;
    }

    const { TransaccionP2P } = require('../../models');

    const topTraders = await User.findAll({
      attributes: [
        'id',
        'username',
        'averageRating',
        'totalRatings',
        [sequelize.fn('COUNT', sequelize.col('transacciones.id')), 'totalTransacciones'],
        [sequelize.fn('SUM', sequelize.col('transacciones.montoFiat')), 'volumenTotal']
      ],
      include: [
        {
          model: TransaccionP2P,
          as: 'transacciones',
          attributes: [],
          where: {
            estado: 'completada',
            created_at: { [Op.gte]: fechaDesde }
          },
          required: true
        }
      ],
      group: ['User.id'],
      order: [[sequelize.fn('SUM', sequelize.col('transacciones.montoFiat')), 'DESC']],
      limit: parseInt(limit),
      subQuery: false
    });

    return topTraders;
  };

  // Método para desactivar usuarios inactivos existente
  User.deactivateInactiveUsers = async (daysSinceLogin = 365) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLogin);

    const [affectedRows] = await User.update(
      { active: false },
      {
        where: {
          active: true,
          updated_at: { [Op.lt]: cutoffDate },
          role: 'normal'
        }
      }
    );

    return affectedRows;
  };

  return User;
}

module.exports = createUserModel;