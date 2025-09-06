// Importaciones
const initUsuario = require('./entities/usuario.entity');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { Op } = require('sequelize');

dotenv.config();
const secretWord = process.env.JWT_SECRET;

function createUsuarioModel(sequelize) {
  const Usuario = initUsuario(sequelize);

  // Función para generar JWT actualizado
  Usuario.prototype.generateUpdatedJWT = function() {
    const payload = {
      id: this.id,
      email: this.email,
      username: this.username,
      rol: this.rol,
      kycVerificado: this.kycVerificado,
      activo: this.activo,
      reputacionPromedio: this.reputacionPromedio,
      pais: this.pais
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
      pais: userData.pais
    };

    return jwt.sign(payload, secretWord, { 
      expiresIn: '7d',
      issuer: 'crypto-exchange',
      audience: 'crypto-exchange-users'
    });
  };

  // Métodos de autenticación
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

      // Generar token actualizado
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

  Usuario.createWithPassword = async (data) => {
    const { email, username, password, pais, ...otherData } = data;

    // Validar que el email y username no existan
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

    // Validar contraseña
    if (!password || password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }

    // Hash de la contraseña
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
  };

  Usuario.createWithProvider = async (providerData) => {
    const { googleId, email, username, pais, ...otherData } = providerData;

    // Verificar si ya existe el usuario
    let user = await Usuario.findOne({
      where: { googleId }
    });

    if (user) {
      const token = user.generateUpdatedJWT();
      return { user, token, isNew: false };
    }

    // Crear nuevo usuario con proveedor
    const userData = {
      email: email.toLowerCase(),
      username: username || email.split('@')[0].toLowerCase(),
      googleId,
      pais,
      passwordHash: null, // No requiere contraseña para OAuth
      ...otherData
    };

    const newUser = await Usuario.create(userData);
    const token = newUser.generateUpdatedJWT();

    return { user: newUser, token, isNew: true };
  };

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
            association: 'evaluador',  // Este alias sí existe
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

    // Filtros básicos
    if (rol) where.rol = rol;
    if (kycVerificado !== undefined) where.kycVerificado = kycVerificado;
    if (activo !== undefined) where.activo = activo;
    if (pais) where.pais = pais;
    if (reputacionMin) where.reputacionPromedio = { [Op.gte]: reputacionMin };

    // Búsqueda por email o username
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

  // Métodos administrativos
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

  // Métodos de perfil de usuario
  Usuario.updateProfile = async (id, data) => {
    const user = await Usuario.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Campos permitidos para actualización
    const allowedFields = ['username', 'pais'];
    const updateData = {};

    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = data[key];
      }
    });

    // Validar username único si se está actualizando
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

    // Si el usuario usa OAuth, no puede cambiar contraseña
    if (!user.passwordHash) {
      throw new Error('Usuario de OAuth no puede cambiar contraseña');
    }

    // Verificar contraseña actual
    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new Error('Contraseña actual incorrecta');
    }

    // Validar nueva contraseña
    if (!newPassword || newPassword.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    }

    // Hash de la nueva contraseña
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    await user.update({ passwordHash: newPasswordHash });
    const token = user.generateUpdatedJWT();

    // Crear notificación de seguridad
    const { Notificaciones } = require('./index');
    await Notificaciones.notifySecurityEvent(id, 'cambio_password');
    
    return { user, token };
  };

  // Métodos relacionados con KYC
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

    // Crear notificación
    const { Notificaciones } = require('./index');
    const template = verified ? 'KYC_APROBADO' : 'KYC_RECHAZADO';
    await Notificaciones.createNotification({
      usuarioId: id,
      template
    });
    
    return { user, token };
  };

  // Métodos relacionados con transacciones
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

  // Métodos de estadísticas
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

  // Método para desactivar usuarios inactivos
  Usuario.deactivateInactiveUsers = async (daysSinceLogin = 365) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLogin);

    const [affectedRows] = await Usuario.update(
      { activo: false },
      {
        where: {
          activo: true,
          updated_at: { [Op.lt]: cutoffDate },
          rol: 'normal' // No desactivar admins automáticamente
        }
      }
    );

    return affectedRows;
  };

  return Usuario;
}

module.exports = createUsuarioModel;