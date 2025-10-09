// models/usuario.model.js
const initUsuario = require('./entities/usuario.entity');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { Op } = require('sequelize');

dotenv.config();
const secretWord = process.env.JWT_SECRET;

function createUsuarioModel(sequelize) {
  const Usuario = initUsuario(sequelize);

  // Función para generar JWT actualizado (instancia)
  Usuario.prototype.generateUpdatedJWT = function() {
    const payload = {
      id: this.id,
      email: this.email,
      username: this.username,
      rol: this.rol,
      kycVerificado: this.kycVerificado,
      activo: this.activo,
      reputacionPromedio: this.reputacionPromedio,
      pais: this.pais,
      dosFactoresActivado: this.dosFactoresActivado || false
    };

    return jwt.sign(payload, secretWord, { 
      expiresIn: '7d',
      issuer: 'crypto-exchange',
      audience: 'crypto-exchange-users'
    });
  };

  // Método estático para generar JWT
  Usuario.generateUpdatedJWT = function(userData) {
    const payload = {
      id: userData.id,
      email: userData.email,
      username: userData.username,
      rol: userData.rol,
      kycVerificado: userData.kycVerificado,
      activo: userData.activo,
      reputacionPromedio: userData.reputacionPromedio,
      pais: userData.pais,
      dosFactoresActivado: userData.dosFactoresActivado || false
    };

    return jwt.sign(payload, secretWord, { 
      expiresIn: '7d',
      issuer: 'crypto-exchange',
      audience: 'crypto-exchange-users'
    });
  };

  // Métodos de autenticación existentes
  Usuario.findByCredentials = async (emailOrUsername, password) => {
    try {
      const user = await Usuario.findOne({
        where: {
          [Op.or]: [
            { email: emailOrUsername.toLowerCase() },
            { username: emailOrUsername.toLowerCase() }
          ],
          activo: true
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

  Usuario.findByExternalId = async (googleId) => {
    return await Usuario.findOne({
      where: { googleId, activo: true }
    });
  };
/*// Méodo viejo, no hace super_admin al primer usuario.
  Usuario.createWithPassword = async (data) => {
    const { email, username, password, pais, ...otherData } = data;

    const existingUser = await Usuario.findOne({
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

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const userData = {
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      passwordHash,
      pais,
      ...otherData
    };

    const newUser = await Usuario.create(userData);
    const token = newUser.generateUpdatedJWT();

    return { user: newUser, token };
  };*/

  Usuario.createWithPassword = async (data) => {
    const { email, username, password, pais, ...otherData } = data;

    const existingUser = await Usuario.findOne({
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
    const userCount = await Usuario.count();
    const rol = userCount === 0 ? 'super_admin' : 'normal';

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const userData = {
      email: email.toLowerCase(),
      username: username.toLowerCase(),
      passwordHash,
      pais,
      rol, // Asignar rol según si es el primer usuario o no
      ...otherData
    };

    const newUser = await Usuario.create(userData);
    const token = newUser.generateUpdatedJWT();

    return { user: newUser, token };
  };

  Usuario.createWithProvider = async (providerData) => {
    const { googleId, email, username, pais, ...otherData } = providerData;

    let user = await Usuario.findOne({
      where: { googleId }
    });

    if (user) {
      const token = user.generateUpdatedJWT();
      return { user, token, isNew: false };
    }

    const userData = {
      email: email.toLowerCase(),
      username: username || email.split('@')[0].toLowerCase(),
      googleId,
      pais,
      passwordHash: null,
      ...otherData
    };

    const newUser = await Usuario.create(userData);
    const token = newUser.generateUpdatedJWT();

    return { user: newUser, token, isNew: true };
  };

  // --------------------- MÉTODOS PARA RECUPERACIÓN DE CONTRASEÑA --------------------- //
  
  Usuario.requestPasswordReset = async (email) => {
    const user = await Usuario.findOne({
      where: { 
        email: email.toLowerCase(),
        activo: true,
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
    if (user.ultimoIntentoRecuperacion && 
        user.ultimoIntentoRecuperacion > oneHourAgo && 
        user.intentosRecuperacion >= 3) {
      throw new Error('Demasiados intentos. Espera 1 hora antes de intentar nuevamente');
    }

    const codigo = await user.generarCodigoRecuperacion();
    
    const nuevosIntentos = user.ultimoIntentoRecuperacion && 
                          user.ultimoIntentoRecuperacion > oneHourAgo ? 
                          user.intentosRecuperacion + 1 : 1;
    
    await user.update({
      intentosRecuperacion: nuevosIntentos,
      ultimoIntentoRecuperacion: new Date()
    });

    return {
      user,
      codigo,
      message: 'Código de recuperación enviado',
      sent: true
    };
  };

  Usuario.verifyResetCode = async (email, codigo) => {
    const user = await Usuario.findOne({
      where: { 
        email: email.toLowerCase(),
        activo: true
      }
    });

    if (!user) {
      throw new Error('Código inválido o expirado');
    }

    if (!user.validarCodigoRecuperacion(codigo)) {
      throw new Error('Código inválido o expirado');
    }

    return { valid: true, userId: user.id };
  };

  Usuario.resetPasswordWithCode = async (email, codigo, newPassword) => {
    const user = await Usuario.findOne({
      where: { 
        email: email.toLowerCase(),
        activo: true
      }
    });

    if (!user || !user.validarCodigoRecuperacion(codigo)) {
      throw new Error('Código inválido o expirado');
    }

    if (!newPassword || newPassword.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    }

    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await user.update({ 
      passwordHash: newPasswordHash,
      tokenRecuperacion: null,
      tokenExpiracion: null,
      intentosRecuperacion: 0
    });

    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  // --------------------- MÉTODOS PARA LOGOUT CON INVALIDACIÓN DE TOKENS --------------------- //

  Usuario.logout = async (userId) => {
    const user = await Usuario.findByPk(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ ultimoLogout: new Date() });
    
    return { 
      message: 'Logout exitoso - Tokens anteriores invalidados',
      logoutTime: new Date()
    };
  };

  Usuario.isTokenValidAfterLogout = async (userId, tokenIssuedAt) => {
    const user = await Usuario.findByPk(userId);
    
    if (!user) {
      return false;
    }
    
    // Si nunca hizo logout, el token es válido
    if (!user.ultimoLogout) {
      return true;
    }
    
    // Comparar timestamp del token vs último logout
    const tokenTimestamp = tokenIssuedAt * 1000; // JWT usa segundos, JS usa milisegundos
    const logoutTimestamp = user.ultimoLogout.getTime();
    
    // Token es válido si fue emitido DESPUÉS del logout
    return tokenTimestamp > logoutTimestamp;
  };

  // --------------------- MÉTODOS PARA AUTENTICACIÓN EN DOS PASOS --------------------- //

  Usuario.toggle2FA = async (id, activar) => {
    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ 
      dosFactoresActivado: activar,
      codigo2FA: null,
      codigo2FAExpiracion: null
    });

    const token = user.generateUpdatedJWT();
    return { user, token, activado: activar };
  };

  Usuario.generateAndSave2FACode = async (id) => {
    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expiracion = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos

    await user.update({
      codigo2FA: codigo,
      codigo2FAExpiracion: expiracion
    });

    return { codigo, user };
  };

  Usuario.verify2FACode = async (id, codigo) => {
    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    if (!user.codigo2FA || 
        user.codigo2FA !== codigo || 
        !user.codigo2FAExpiracion || 
        new Date() > user.codigo2FAExpiracion) {
      throw new Error('Código 2FA inválido o expirado');
    }

    await user.update({
      codigo2FA: null,
      codigo2FAExpiracion: null,
      ultimoLogin: new Date()
    });

    const token = user.generateUpdatedJWT();
    return { user, token };
  };

  Usuario.loginStep1 = async (emailOrUsername, password) => {
    try {
      const user = await Usuario.findOne({
        where: {
          [Op.or]: [
            { email: emailOrUsername.toLowerCase() },
            { username: emailOrUsername.toLowerCase() }
          ],
          activo: true
        }
      });

      if (!user || !user.passwordHash) {
        throw new Error('Credenciales inválidas');
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Credenciales inválidas');
      }

      if (!user.dosFactoresActivado) {
        await user.update({ ultimoLogin: new Date() });
        const token = user.generateUpdatedJWT();
        return { 
          user, 
          token, 
          requires2FA: false,
          loginComplete: true 
        };
      }

      return { 
        userId: user.id,
        username: user.username,
        email: user.email,
        requires2FA: true,
        loginComplete: false
      };
    } catch (error) {
      throw new Error('Credenciales inválidas');
    }
  };

  // Métodos de consulta y gestión existentes
  Usuario.getById = async (id) => {
    const user = await Usuario.findByPk(id, {
      attributes: { exclude: ['passwordHash'] },
      include: [
        {
          association: 'balances',
          include: ['criptomoneda']
        },
        {
          association: 'valoracionesRecibidas',
          limit: 5,
          order: [['created_at', 'DESC']],
          include: [{
            association: 'evaluador',
            attributes: ['id', 'username', 'reputacionPromedio']
          }]
        }
      ]
    });

    return user;
  };

  Usuario.getAll = async (filters = {}) => {
    const {
      rol,
      kycVerificado,
      activo,
      pais,
      search,
      reputacionMin,
      page = 1,
      limit = 20,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = filters;

    const where = {};
    const offset = (page - 1) * limit;

    if (rol) where.rol = rol;
    if (kycVerificado !== undefined) where.kycVerificado = kycVerificado;
    if (activo !== undefined) where.activo = activo;
    if (pais) where.pais = pais;
    if (reputacionMin) where.reputacionPromedio = { [Op.gte]: reputacionMin };

    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Usuario.findAndCountAll({
      where,
      attributes: { exclude: ['passwordHash', 'kycData'] },
      order: [[orderBy, orderDirection]],
      limit: parseInt(limit),
      offset
    });

    return {
      usuarios: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  };

  Usuario.search = async (term, limit = 10) => {
    return await Usuario.findAll({
      where: {
        [Op.or]: [
          { email: { [Op.iLike]: `%${term}%` } },
          { username: { [Op.iLike]: `%${term}%` } }
        ],
        activo: true
      },
      attributes: ['id', 'email', 'username', 'reputacionPromedio', 'kycVerificado'],
      limit,
      order: [['reputacionPromedio', 'DESC']]
    });
  };

  // Métodos administrativos existentes
  Usuario.updateStatus = async (id, newStatus) => {
    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ activo: newStatus });
    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  Usuario.updateRole = async (id, newRole) => {
    const validRoles = ['normal', 'admin', 'super_admin'];
    if (!validRoles.includes(newRole)) {
      throw new Error('Rol inválido');
    }

    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ rol: newRole });
    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  Usuario.updateReputation = async (id, reputacionPromedio, totalValoraciones) => {
    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ 
      reputacionPromedio: parseFloat(reputacionPromedio).toFixed(2), 
      totalValoraciones 
    });
    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  // Métodos de perfil de usuario existentes
  Usuario.updateProfile = async (id, data) => {
    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const allowedFields = ['username', 'pais'];
    const updateData = {};

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = data[key];
      }
    });

    if (updateData.username && updateData.username !== user.username) {
      const existingUser = await Usuario.findOne({
        where: { 
          username: updateData.username.toLowerCase(),
          id: { [Op.ne]: id }
        }
      });

      if (existingUser) {
        throw new Error('Username ya está en uso');
      }
      updateData.username = updateData.username.toLowerCase();
    }

    await user.update(updateData);
    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  Usuario.changePassword = async (id, currentPassword, newPassword) => {
    const user = await Usuario.findByPk(id);
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

    const { Notificaciones } = require('./index');
    await Notificaciones.notifySecurityEvent(id, 'cambio_password');
    
    return { user, token };
  };

  // Métodos relacionados con KYC existentes
  Usuario.updateKYC = async (id, kycData, verified = false) => {
    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const updateData = {
      kycData: { ...user.kycData, ...kycData },
      kycVerificado: verified
    };

    await user.update(updateData);
    const token = user.generateUpdatedJWT();

    const { Notificaciones } = require('./index');
    const template = verified ? 'KYC_APROBADO' : 'KYC_RECHAZADO';
    await Notificaciones.createNotification({
      usuarioId: id,
      template
    });
    
    return { user, token };
  };

  // Métodos relacionados con transacciones existentes
  Usuario.getDailyVolume = async (id, fecha = new Date()) => {
    const startOfDay = new Date(fecha);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(fecha);
    endOfDay.setHours(23, 59, 59, 999);

    const { TransaccionP2P } = require('./index');
    
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

  Usuario.canMakeTransaction = async (id, amount) => {
    const user = await Usuario.findByPk(id);
    if (!user) {
      return { canTransact: false, reason: 'Usuario no encontrado' };
    }

    if (!user.activo) {
      return { canTransact: false, reason: 'Cuenta desactivada' };
    }

    if (!user.kycVerificado && amount > 100) {
      return { canTransact: false, reason: 'KYC requerido para transacciones mayores a $100' };
    }

    const dailyVolume = await Usuario.getDailyVolume(id);
    if (dailyVolume + amount > user.limiteDiarioUsd) {
      return { 
        canTransact: false, 
        reason: `Límite diario excedido. Disponible: $${user.limiteDiarioUsd - dailyVolume}` 
      };
    }

    return { canTransact: true };
  };

  Usuario.updateDailyLimit = async (id, newLimit) => {
    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    await user.update({ limiteDiarioUsd: newLimit });
    const token = user.generateUpdatedJWT();
    
    return { user, token };
  };

  // Métodos de estadísticas existentes
  Usuario.getStats = async () => {
    const stats = await Usuario.findAll({
      attributes: [
        'rol',
        'kycVerificado',
        'activo',
        'pais',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total']
      ],
      group: ['rol', 'kycVerificado', 'activo', 'pais'],
      raw: true
    });

    return stats;
  };

  Usuario.getTopTraders = async (limit = 10, period = '30d') => {
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

    const { TransaccionP2P } = require('./index');

    const topTraders = await Usuario.findAll({
      attributes: [
        'id',
        'username',
        'reputacionPromedio',
        'totalValoraciones',
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
      group: ['Usuario.id'],
      order: [[sequelize.fn('SUM', sequelize.col('transacciones.montoFiat')), 'DESC']],
      limit: parseInt(limit),
      subQuery: false
    });

    return topTraders;
  };

  // Método para desactivar usuarios inactivos existente
  Usuario.deactivateInactiveUsers = async (daysSinceLogin = 365) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLogin);

    const [affectedRows] = await Usuario.update(
      { activo: false },
      {
        where: {
          activo: true,
          updated_at: { [Op.lt]: cutoffDate },
          rol: 'normal'
        }
      }
    );

    return affectedRows;
  };

  return Usuario;
}

module.exports = createUsuarioModel;