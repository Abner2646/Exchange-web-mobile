// Importaciones
const initNotificacion = require('./entities/notificaciones.entity');
const { Op } = require('sequelize');

function createNotificacionModel(sequelize) {
  const Notificacion = initNotificacion(sequelize);

  // Templates de notificaciones predefinidas
  const NOTIFICATION_TEMPLATES = {
    // Seguridad
    'LOGIN_SOSPECHOSO': {
      tipo: 'seguridad',
      titulo: 'Inicio de sesión desde ubicación desconocida',
      mensaje: 'Se detectó un inicio de sesión desde una ubicación no reconocida. Si no fuiste tú, cambia tu contraseña inmediatamente.',
      importante: true
    },
    'CAMBIO_PASSWORD': {
      tipo: 'seguridad',
      titulo: 'Contraseña actualizada exitosamente',
      mensaje: 'Tu contraseña ha sido cambiada exitosamente. Si no realizaste este cambio, contacta inmediatamente a soporte.',
      importante: true
    },
    
    // Transacciones P2P
    'P2P_NUEVA_TRANSACCION': {
      tipo: 'p2p',
      titulo: 'Nueva transacción P2P iniciada',
      mensaje: 'Se ha iniciado una nueva transacción P2P. Verifica los detalles y procede según corresponda.',
      importante: false
    },
    'P2P_PAGO_CONFIRMADO': {
      tipo: 'p2p',
      titulo: 'Pago confirmado en transacción P2P',
      mensaje: 'El comprador ha confirmado el pago. Verifica la recepción y libera las criptomonedas.',
      importante: true
    },
    'P2P_TRANSACCION_COMPLETADA': {
      tipo: 'p2p',
      titulo: 'Transacción P2P completada',
      mensaje: 'Tu transacción P2P ha sido completada exitosamente.',
      importante: false
    },
    
    // KYC
    'KYC_APROBADO': {
      tipo: 'kyc',
      titulo: 'Verificación KYC aprobada',
      mensaje: 'Tu proceso de verificación KYC ha sido aprobado. Ahora puedes acceder a todas las funcionalidades.',
      importante: true
    },
    'KYC_RECHAZADO': {
      tipo: 'kyc',
      titulo: 'Verificación KYC rechazada',
      mensaje: 'Tu proceso de verificación KYC ha sido rechazado. Revisa los documentos y vuelve a intentarlo.',
      importante: true
    },
    
    // Sistema
    'MANTENIMIENTO_PROGRAMADO': {
      tipo: 'sistema',
      titulo: 'Mantenimiento programado',
      mensaje: 'El sistema estará en mantenimiento. Durante este tiempo no podrás realizar transacciones.',
      importante: true
    }
  };

  // Métodos de creación
  Notificacion.createNotification = async (data) => {
    const { 
      usuarioId, 
      tipo, 
      titulo, 
      mensaje, 
      importante = false,
      template = null,
      templateData = {}
    } = data;

    let finalData = { usuarioId, tipo, titulo, mensaje, importante };

    // Si se usa un template, aplicar los datos
    if (template && NOTIFICATION_TEMPLATES[template]) {
      const templateInfo = NOTIFICATION_TEMPLATES[template];
      finalData = {
        usuarioId,
        tipo: templateInfo.tipo,
        titulo: templateInfo.titulo,
        mensaje: templateInfo.mensaje.replace(/\{(\w+)\}/g, (match, key) => templateData[key] || match),
        importante: templateInfo.importante
      };
    }

    // Marcar como enviada inmediatamente
    finalData.fechaEnviada = new Date();

    return await Notificacion.create(finalData);
  };

  Notificacion.createBulkNotifications = async (notifications) => {
    const notificationsWithDate = notifications.map(notif => ({
      ...notif,
      fechaEnviada: new Date()
    }));

    return await Notificacion.bulkCreate(notificationsWithDate);
  };

  // Métodos de consulta
  Notificacion.getById = async (id) => {
    return await Notificacion.findByPk(id, {
      include: [
        {
          association: 'usuario',
          attributes: ['id', 'nombre', 'email']
        }
      ]
    });
  };

  Notificacion.getAll = async (filters = {}) => {
    const {
      usuarioId,
      tipo,
      leida,
      importante,
      fechaDesde,
      fechaHasta,
      page = 1,
      limit = 20,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = filters;

    const where = {};
    const offset = (page - 1) * limit;

    // Filtros básicos
    if (usuarioId) where.usuarioId = usuarioId;
    if (tipo) where.tipo = tipo;
    if (leida !== undefined) where.leida = leida;
    if (importante !== undefined) where.importante = importante;

    // Filtros de fecha
    if (fechaDesde || fechaHasta) {
      where.created_at = {};
      if (fechaDesde) where.created_at[Op.gte] = new Date(fechaDesde);
      if (fechaHasta) where.created_at[Op.lte] = new Date(fechaHasta);
    }

    const { count, rows } = await Notificacion.findAndCountAll({
      where,
      include: [
        {
          association: 'usuario',
          attributes: ['id', 'nombre']
        }
      ],
      order: [[orderBy, orderDirection]],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    return {
      notificaciones: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  };

  // Métodos específicos del usuario
  Notificacion.getUserNotifications = async (usuarioId, filters = {}) => {
    const { 
      page = 1, 
      limit = 20, 
      leida, 
      tipo, 
      importante,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = filters;
    
    const where = { usuarioId };
    const offset = (page - 1) * limit;

    if (leida !== undefined) where.leida = leida;
    if (tipo) where.tipo = tipo;
    if (importante !== undefined) where.importante = importante;

    const { count, rows } = await Notificacion.findAndCountAll({
      where,
      order: [[orderBy, orderDirection]],
      limit: parseInt(limit),
      offset
    });

    return {
      notificaciones: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  };

  Notificacion.getUnreadCount = async (usuarioId) => {
    return await Notificacion.count({
      where: {
        usuarioId,
        leida: false
      }
    });
  };

  Notificacion.getUnreadCountByType = async (usuarioId) => {
    const counts = await Notificacion.findAll({
      attributes: [
        'tipo',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        usuarioId,
        leida: false
      },
      group: ['tipo'],
      raw: true
    });

    return counts.reduce((acc, item) => {
      acc[item.tipo] = parseInt(item.count);
      return acc;
    }, {});
  };

  // Métodos de actualización
  Notificacion.markAsRead = async (id, usuarioId = null) => {
    const where = { id };
    if (usuarioId) where.usuarioId = usuarioId;

    const [affectedRows] = await Notificacion.update(
      { leida: true },
      { where }
    );

    return affectedRows > 0;
  };

  Notificacion.markAllAsRead = async (usuarioId, filters = {}) => {
    const where = { usuarioId, leida: false };
    
    if (filters.tipo) where.tipo = filters.tipo;
    if (filters.importante !== undefined) where.importante = filters.importante;

    const [affectedRows] = await Notificacion.update(
      { leida: true },
      { where }
    );

    return affectedRows;
  };

  Notificacion.markAsUnread = async (id, usuarioId = null) => {
    const where = { id };
    if (usuarioId) where.usuarioId = usuarioId;

    const [affectedRows] = await Notificacion.update(
      { leida: false },
      { where }
    );

    return affectedRows > 0;
  };

  // Métodos de eliminación
  Notificacion.deleteNotification = async (id, usuarioId = null) => {
    const where = { id };
    if (usuarioId) where.usuarioId = usuarioId;

    const affectedRows = await Notificacion.destroy({ where });
    return affectedRows > 0;
  };

  Notificacion.deleteAllRead = async (usuarioId) => {
    const affectedRows = await Notificacion.destroy({
      where: {
        usuarioId,
        leida: true,
        importante: false // No eliminar las importantes aunque estén leídas
      }
    });

    return affectedRows;
  };

  Notificacion.deleteOldNotifications = async (daysBefore = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBefore);

    const affectedRows = await Notificacion.destroy({
      where: {
        created_at: { [Op.lt]: cutoffDate },
        leida: true,
        importante: false
      }
    });

    return affectedRows;
  };

  // Métodos de notificaciones masivas
  Notificacion.notifyAllUsers = async (notificationData) => {
    const { Usuario } = require('./index');
    
    const users = await Usuario.findAll({
      attributes: ['id'],
      where: { activo: true } // Solo usuarios activos
    });

    const notifications = users.map(user => ({
      ...notificationData,
      usuarioId: user.id,
      fechaEnviada: new Date()
    }));

    return await Notificacion.bulkCreate(notifications);
  };

  Notificacion.notifyUsersByRole = async (rol, notificationData) => {
    const { Usuario } = require('./index');
    
    const users = await Usuario.findAll({
      attributes: ['id'],
      where: { 
        rol,
        activo: true
      }
    });

    const notifications = users.map(user => ({
      ...notificationData,
      usuarioId: user.id,
      fechaEnviada: new Date()
    }));

    return await Notificacion.bulkCreate(notifications);
  };

  // Métodos de estadísticas
  Notificacion.getStats = async (filters = {}) => {
    const where = {};
    
    if (filters.fechaDesde || filters.fechaHasta) {
      where.created_at = {};
      if (filters.fechaDesde) where.created_at[Op.gte] = new Date(filters.fechaDesde);
      if (filters.fechaHasta) where.created_at[Op.lte] = new Date(filters.fechaHasta);
    }

    const stats = await Notificacion.findAll({
      attributes: [
        'tipo',
        'importante',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN leida = true THEN 1 END')), 'leidas'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN leida = false THEN 1 END')), 'noLeidas']
      ],
      where,
      group: ['tipo', 'importante'],
      raw: true
    });

    return stats;
  };

  // Métodos para templates específicos
  Notificacion.notifyTransactionUpdate = async (usuarioId, transaccionId, estado) => {
    const templates = {
      'cryptos_bloqueadas': 'P2P_NUEVA_TRANSACCION',
      'pago_confirmado': 'P2P_PAGO_CONFIRMADO',
      'completada': 'P2P_TRANSACCION_COMPLETADA'
    };

    const template = templates[estado];
    if (!template) return null;

    return await Notificacion.createNotification({
      usuarioId,
      template,
      templateData: { transaccionId }
    });
  };

  Notificacion.notifySecurityEvent = async (usuarioId, eventType, details = {}) => {
    const templates = {
      'login_sospechoso': 'LOGIN_SOSPECHOSO',
      'cambio_password': 'CAMBIO_PASSWORD'
    };

    const template = templates[eventType];
    if (!template) return null;

    return await Notificacion.createNotification({
      usuarioId,
      template,
      templateData: details
    });
  };

  // Método para limpiar notificaciones antiguas (tarea programada)
  Notificacion.cleanupOldNotifications = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Eliminar notificaciones normales leídas de más de 30 días
    const normalDeleted = await Notificacion.destroy({
      where: {
        created_at: { [Op.lt]: thirtyDaysAgo },
        leida: true,
        importante: false
      }
    });

    // Eliminar notificaciones importantes leídas de más de 90 días
    const importantDeleted = await Notificacion.destroy({
      where: {
        created_at: { [Op.lt]: ninetyDaysAgo },
        leida: true,
        importante: true
      }
    });

    return {
      normalDeleted,
      importantDeleted,
      total: normalDeleted + importantDeleted
    };
  };

  return Notificacion;
}

module.exports = createNotificacionModel;