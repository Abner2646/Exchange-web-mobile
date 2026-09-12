// models/notificaciones.model.js
const initNotification = require('./notification.entity');
const { Op } = require('sequelize');

function createNotificacionModel(sequelize) {
  const Notification = initNotification(sequelize);

  // Templates de notificaciones predefinidas
  const NOTIFICATION_TEMPLATES = {
    // Seguridad
    'LOGIN_SOSPECHOSO': {
      type: 'security',
      title: 'Inicio de sesión desde ubicación desconocida',
      message: 'Se detectó un inicio de sesión desde una ubicación no reconocida. Si no fuiste tú, cambia tu contraseña inmediatamente.',
      important: true
    },
    'CAMBIO_PASSWORD': {
      type: 'security',
      title: 'Contraseña actualizada exitosamente',
      message: 'Tu contraseña ha sido cambiada exitosamente. Si no realizaste este cambio, contacta inmediatamente a soporte.',
      important: true
    },
    
    // 🆕 Transacciones P2P - CORREGIDO
    'P2P_TRANSACCION_INICIADA': {
      type: 'p2p',
      title: 'Nueva transacción P2P iniciada',
      message: 'Se ha iniciado una transacción P2P por {amount} {symbol}. Los fondos han sido bloqueados. ID: {transactionId}',
      important: true
    },
    'P2P_FONDOS_BLOQUEADOS_VENDEDOR': {
      type: 'p2p',
      title: 'Fondos bloqueados en transacción P2P',
      message: 'Se han bloqueado {amount} {symbol} de tu balance para la transacción #{transactionId}. El comprador debe realizar el pago.',
      important: true
    },
    'P2P_NUEVA_TRANSACCION_COMPRADOR': {
      type: 'p2p',
      title: 'Transacción P2P iniciada - Realiza el pago',
      message: 'Has iniciado la compra de {amount} {symbol}. Realiza la transferencia de {fiatAmount} {fiatCurrency} y confirma el pago. ID: {transactionId}',
      important: true
    },
    'P2P_PAGO_CONFIRMADO_VENDEDOR': {
      type: 'p2p',
      title: 'El comprador confirmó el pago',
      message: 'El comprador ha confirmado el pago de {fiatAmount} {fiatCurrency}. Verifica la recepción y libera las criptomonedas. ID: {transactionId}',
      important: true
    },
    'P2P_PAGO_CONFIRMADO_COMPRADOR': {
      type: 'p2p',
      title: 'Pago confirmado - Esperando liberación',
      message: 'Has confirmado el pago. El vendedor verificará la recepción y liberará {amount} {symbol}. ID: {transactionId}',
      important: false
    },
    'P2P_TRANSACCION_COMPLETADA_VENDEDOR': {
      type: 'p2p',
      title: 'Transacción P2P completada',
      message: 'Has liberado {amount} {symbol} al comprador. La transacción está completa. ID: {transactionId}',
      important: false
    },
    'P2P_TRANSACCION_COMPLETADA_COMPRADOR': {
      type: 'p2p',
      title: 'Criptomonedas recibidas',
      message: 'Has recibido {amount} {symbol} en tu wallet. La transacción está completa. ID: {transactionId}',
      important: false
    },
    'P2P_TRANSACCION_CANCELADA': {
      type: 'p2p',
      title: 'Transacción P2P cancelada',
      message: 'La transacción #{transactionId} ha sido cancelada. Los fondos han sido desbloqueados.',
      important: true
    },
    
    // KYC
    'KYC_APROBADO': {
      type: 'kyc',
      title: 'Verificación KYC aprobada',
      message: 'Tu proceso de verificación KYC ha sido aprobado. Ahora puedes acceder a todas las funcionalidades.',
      important: true
    },
    'KYC_RECHAZADO': {
      type: 'kyc',
      title: 'Verificación KYC rechazada',
      message: 'Tu proceso de verificación KYC ha sido rechazado. Revisa los documentos y vuelve a intentarlo.',
      important: true
    },
    
    // Sistema
    'MANTENIMIENTO_PROGRAMADO': {
      type: 'system',
      title: 'Mantenimiento programado',
      message: 'El sistema estará en mantenimiento. Durante este tiempo no podrás realizar transacciones.',
      important: true
    },

    // TRANSFERENCIAS
    'TRANSFERENCIA_CREADA': {
      type: 'transaction',
      title: 'Transferencia creada - Verifica con código',
      message: 'Has creado una transferencia de {amount} {symbol} a {destinatario}. Usa el código enviado a tu email para verificarla.',
      important: true
    },
    'TRANSFERENCIA_COMPLETADA_REMITENTE': {
      type: 'transaction', 
      title: 'Transferencia completada',
      message: 'Has transferido {amount} {symbol} a {destinatario} exitosamente.',
      important: false
    },
    'TRANSFERENCIA_RECIBIDA': {
      type: 'transaction',
      title: 'Fondos recibidos', 
      message: 'Has recibido {amount} {symbol} de {remitente}.',
      important: false
    },
    'TRANSFERENCIA_CANCELADA': {
      type: 'transaction',
      title: 'Transferencia cancelada',
      message: 'Has cancelado la transferencia de {amount} {symbol} a {destinatario}.',
      important: false
    }
  };

  // Métodos de creación
  Notification.createNotification = async (data) => {
    const { 
      userId, 
      type, 
      title, 
      message, 
      important = false,
      template = null,
      templateData = {}
    } = data;

    let finalData = { userId, type, title, message, important };

    // Si se usa un template, aplicar los datos
    if (template && NOTIFICATION_TEMPLATES[template]) {
      const templateInfo = NOTIFICATION_TEMPLATES[template];
      finalData = {
        userId,
        type: templateInfo.type,
        title: templateInfo.title,
        message: templateInfo.message.replace(/\{(\w+)\}/g, (match, key) => templateData[key] || match),
        important: templateInfo.important
      };
    }

    // Marcar como enviada inmediatamente
    finalData.sentAt = new Date();

    return await Notification.create(finalData);
  };

  Notification.createBulkNotifications = async (notifications) => {
    const notificationsWithDate = notifications.map(notif => ({
      ...notif,
      sentAt: new Date()
    }));

    return await Notification.bulkCreate(notificationsWithDate);
  };

  // Métodos de consulta
  Notification.getById = async (id) => {
    return await Notification.findByPk(id, {
      include: [
        {
          association: 'usuario',
          attributes: ['id', 'name', 'email']
        }
      ]
    });
  };

  Notification.getAll = async (filters = {}) => {
    const {
      userId,
      type,
      read,
      important,
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
    if (userId) where.userId = userId;
    if (type) where.type = type;
    if (read !== undefined) where.read = read;
    if (important !== undefined) where.important = important;

    // Filtros de fecha
    if (fechaDesde || fechaHasta) {
      where.created_at = {};
      if (fechaDesde) where.created_at[Op.gte] = new Date(fechaDesde);
      if (fechaHasta) where.created_at[Op.lte] = new Date(fechaHasta);
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      include: [
        {
          association: 'usuario',
          attributes: ['id', 'name']
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
  Notification.getUserNotifications = async (userId, filters = {}) => {
    const { 
      page = 1, 
      limit = 20, 
      read, 
      type, 
      important,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = filters;
    
    const where = { userId };
    const offset = (page - 1) * limit;

    if (read !== undefined) where.read = read;
    if (type) where.type = type;
    if (important !== undefined) where.important = important;

    const { count, rows } = await Notification.findAndCountAll({
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

  Notification.getUnreadCount = async (userId) => {
    return await Notification.count({
      where: {
        userId,
        read: false
      }
    });
  };

  Notification.getUnreadCountByType = async (userId) => {
    const counts = await Notification.findAll({
      attributes: [
        'type',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: {
        userId,
        read: false
      },
      group: ['type'],
      raw: true
    });

    return counts.reduce((acc, item) => {
      acc[item.type] = parseInt(item.count);
      return acc;
    }, {});
  };

  // Métodos de actualización
  Notification.markAsRead = async (id, userId = null) => {
    const where = { id };
    if (userId) where.userId = userId;

    const [affectedRows] = await Notification.update(
      { read: true },
      { where }
    );

    return affectedRows > 0;
  };

  Notification.markAllAsRead = async (userId, filters = {}) => {
    const where = { userId, read: false };
    
    if (filters.type) where.type = filters.type;
    if (filters.important !== undefined) where.important = filters.important;

    const [affectedRows] = await Notification.update(
      { read: true },
      { where }
    );

    return affectedRows;
  };

  Notification.markAsUnread = async (id, userId = null) => {
    const where = { id };
    if (userId) where.userId = userId;

    const [affectedRows] = await Notification.update(
      { read: false },
      { where }
    );

    return affectedRows > 0;
  };

  // Métodos de eliminación
  Notification.deleteNotification = async (id, userId = null) => {
    const where = { id };
    if (userId) where.userId = userId;

    const affectedRows = await Notification.destroy({ where });
    return affectedRows > 0;
  };

  Notification.deleteAllRead = async (userId) => {
    const affectedRows = await Notification.destroy({
      where: {
        userId,
        read: true,
        important: false // No eliminar las importantes aunque estén leídas
      }
    });

    return affectedRows;
  };

  Notification.deleteOldNotifications = async (daysBefore = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBefore);

    const affectedRows = await Notification.destroy({
      where: {
        created_at: { [Op.lt]: cutoffDate },
        read: true,
        important: false
      }
    });

    return affectedRows;
  };

  // Métodos de notificaciones masivas
  Notification.notifyAllUsers = async (notificationData) => {
    const { User } = require('../../models/index');
    
    const users = await User.findAll({
      attributes: ['id'],
      where: { active: true } // Solo usuarios activos
    });

    const notifications = users.map(user => ({
      ...notificationData,
      userId: user.id,
      sentAt: new Date()
    }));

    return await Notification.bulkCreate(notifications);
  };

  Notification.notifyUsersByRole = async (role, notificationData) => {
    const { User } = require('../../models/index');
    
    const users = await User.findAll({
      attributes: ['id'],
      where: { 
        role,
        active: true
      }
    });

    const notifications = users.map(user => ({
      ...notificationData,
      userId: user.id,
      sentAt: new Date()
    }));

    return await Notification.bulkCreate(notifications);
  };

  // Métodos de estadísticas
  Notification.getStats = async (filters = {}) => {
    const where = {};
    
    if (filters.fechaDesde || filters.fechaHasta) {
      where.created_at = {};
      if (filters.fechaDesde) where.created_at[Op.gte] = new Date(filters.fechaDesde);
      if (filters.fechaHasta) where.created_at[Op.lte] = new Date(filters.fechaHasta);
    }

    const stats = await Notification.findAll({
      attributes: [
        'type',
        'important',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN read = true THEN 1 END')), 'read'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN read = false THEN 1 END')), 'unread']
      ],
      where,
      group: ['type', 'important'],
      raw: true
    });

    return stats;
  };

  // 🆕 Método actualizado para notificar cambios de transacción
  Notification.notifyTransactionUpdate = async (userId, transaccionData, status) => {
    const { id: transactionId, amount, crypto, fiatAmount, fiatCurrency } = transaccionData;
    
    const templates = {
      'initiated': 'P2P_TRANSACCION_INICIADA',
      'payment_confirmed': 'P2P_PAGO_CONFIRMADO_VENDEDOR',
      'completed': 'P2P_TRANSACCION_COMPLETADA_VENDEDOR',
      'cancelled': 'P2P_TRANSACCION_CANCELADA'
    };

    const template = templates[status];
    if (!template) return null;

    return await Notification.createNotification({
      userId,
      template,
      templateData: { 
        transactionId,
        amount,
        symbol: crypto?.symbol || 'crypto',
        fiatAmount,
        fiatCurrency
      }
    });
  };

  Notification.notifySecurityEvent = async (userId, eventType, details = {}) => {
    const templates = {
      'login_sospechoso': 'LOGIN_SOSPECHOSO',
      'cambio_password': 'CAMBIO_PASSWORD'
    };

    const template = templates[eventType];
    if (!template) return null;

    return await Notification.createNotification({
      userId,
      template,
      templateData: details
    });
  };

  // 🆕 Nuevo método para notificar a AMBAS partes de la transacción
  Notification.notifyBothParties = async (buyerId, sellerId, transaccionData, status) => {
    const { id: transactionId, amount, crypto, fiatAmount, fiatCurrency } = transaccionData;
    
    const templates = {
      'initiated': {
        buyer: 'P2P_NUEVA_TRANSACCION_COMPRADOR',
        seller: 'P2P_FONDOS_BLOQUEADOS_VENDEDOR'
      },
      'payment_confirmed': {
        buyer: 'P2P_PAGO_CONFIRMADO_COMPRADOR',
        seller: 'P2P_PAGO_CONFIRMADO_VENDEDOR'
      },
      'completed': {
        buyer: 'P2P_TRANSACCION_COMPLETADA_COMPRADOR',
        seller: 'P2P_TRANSACCION_COMPLETADA_VENDEDOR'
      },
      'cancelled': {
        buyer: 'P2P_TRANSACCION_CANCELADA',
        seller: 'P2P_TRANSACCION_CANCELADA'
      }
    };

    const estadoTemplates = templates[status];
    if (!estadoTemplates) return null;

    const templateData = { 
      transactionId,
      amount,
      symbol: crypto?.symbol || 'crypto',
      fiatAmount,
      fiatCurrency
    };

    // Notificar a ambos usuarios
    const [notifComprador, notifVendedor] = await Promise.all([
      Notification.createNotification({
        userId: buyerId,
        template: estadoTemplates.buyer,
        templateData
      }),
      Notification.createNotification({
        userId: sellerId,
        template: estadoTemplates.seller,
        templateData
      })
    ]);

    return { notifComprador, notifVendedor };
  };

  // Método para limpiar notificaciones antiguas (tarea programada)
  Notification.cleanupOldNotifications = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Eliminar notificaciones normales leídas de más de 30 días
    const normalDeleted = await Notification.destroy({
      where: {
        created_at: { [Op.lt]: thirtyDaysAgo },
        read: true,
        important: false
      }
    });

    // Eliminar notificaciones importantes leídas de más de 90 días
    const importantDeleted = await Notification.destroy({
      where: {
        created_at: { [Op.lt]: ninetyDaysAgo },
        read: true,
        important: true
      }
    });

    return {
      normalDeleted,
      importantDeleted,
      total: normalDeleted + importantDeleted
    };
  };

  Notification.createNotification = async (data, options = {}) => {
    const { 
      userId, 
      type, 
      title, 
      message, 
      important = false,
      template = null,
      templateData = {}
    } = data;

    let finalData = { userId, type, title, message, important };

    // Si se usa un template, aplicar los datos
    if (template && NOTIFICATION_TEMPLATES[template]) {
      const templateInfo = NOTIFICATION_TEMPLATES[template];
      finalData = {
        userId,
        type: templateInfo.type,
        title: templateInfo.title,
        message: templateInfo.message.replace(/\{(\w+)\}/g, (match, key) => templateData[key] || match),
        important: templateInfo.important
      };
    }

    finalData.sentAt = new Date();

    // 🆕 SOPORTAR TRANSACCIONES DE BD
    return await Notification.create(finalData, options);
  };

  return Notification;
}



module.exports = createNotificacionModel;