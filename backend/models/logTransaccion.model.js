// Importaciones
const initLogTransaccion = require('./entities/logTransaccion.entity');
const { Op } = require('sequelize');

function createLogTransaccionModel(sequelize) {
  const LogTransaccion = initLogTransaccion(sequelize);

  // Métodos de consulta básicos
  LogTransaccion.getById = async (id) => {
    try {
      const log = await LogTransaccion.findByPk(id, {
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ]
      });
      return log;
    } catch (error) {
      throw new Error(`Error al obtener log de transacción por ID: ${error.message}`);
    }
  };

  LogTransaccion.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.userId) {
        whereClause.userId = filters.userId;
      }
      
      if (filters.tipoTransaccion) {
        whereClause.tipoTransaccion = filters.tipoTransaccion;
      }

      if (filters.transaccionId) {
        whereClause.transaccionId = filters.transaccionId;
      }

      if (filters.accion) {
        whereClause.accion = {
          [Op.iLike]: `%${filters.accion}%`
        };
      }

      // Filtros de fecha
      if (filters.fechaDesde) {
        whereClause.created_at = {
          [Op.gte]: new Date(filters.fechaDesde)
        };
      }

      if (filters.fechaHasta) {
        whereClause.created_at = {
          ...whereClause.created_at,
          [Op.lte]: new Date(filters.fechaHasta)
        };
      }

      // Paginación
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 50;
      const offset = (page - 1) * limit;

      const { count, rows } = await LogTransaccion.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset
      });
      
      return {
        logs: rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      throw new Error(`Error al obtener logs de transacciones: ${error.message}`);
    }
  };

  LogTransaccion.search = async (term, limit = 10) => {
    try {
      const logs = await LogTransaccion.findAll({
        where: {
          [Op.or]: [
            { tipoTransaccion: { [Op.iLike]: `%${term}%` } },
            { accion: { [Op.iLike]: `%${term}%` } },
            { transaccionId: term }
          ]
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        limit: parseInt(limit),
        order: [['created_at', 'DESC']]
      });
      
      return logs;
    } catch (error) {
      throw new Error(`Error en búsqueda de logs de transacciones: ${error.message}`);
    }
  };

  // Métodos específicos para logs de transacciones
  LogTransaccion.getByUser = async (userId, limit = 100) => {
    try {
      const logs = await LogTransaccion.findAll({
        where: { userId: userId },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });
      return logs;
    } catch (error) {
      throw new Error(`Error al obtener logs por usuario: ${error.message}`);
    }
  };

  LogTransaccion.getByTransaction = async (transaccionId) => {
    try {
      const logs = await LogTransaccion.findAll({
        where: { transaccionId: transaccionId },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'ASC']]
      });
      return logs;
    } catch (error) {
      throw new Error(`Error al obtener logs por transacción: ${error.message}`);
    }
  };

  LogTransaccion.getByTransactionType = async (tipoTransaccion, limit = 100) => {
    try {
      const logs = await LogTransaccion.findAll({
        where: { tipoTransaccion: tipoTransaccion },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });
      return logs;
    } catch (error) {
      throw new Error(`Error al obtener logs por tipo de transacción: ${error.message}`);
    }
  };

  LogTransaccion.getByAction = async (accion, limit = 100) => {
    try {
      const logs = await LogTransaccion.findAll({
        where: { accion: accion },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });
      return logs;
    } catch (error) {
      throw new Error(`Error al obtener logs por acción: ${error.message}`);
    }
  };

  LogTransaccion.getByDateRange = async (fechaDesde, fechaHasta) => {
    try {
      const logs = await LogTransaccion.findAll({
        where: {
          created_at: {
            [Op.between]: [new Date(fechaDesde), new Date(fechaHasta)]
          }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      return logs;
    } catch (error) {
      throw new Error(`Error al obtener logs por rango de fechas: ${error.message}`);
    }
  };

  LogTransaccion.getFailedTransactions = async (timeframe = '24 hours') => {
    try {
      const failedLogs = await LogTransaccion.findAll({
        where: {
          created_at: {
            [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${timeframe}'`)
          },
          accion: {
            [Op.in]: ['FAILED', 'ERROR', 'REJECTED', 'CANCELLED', 'TIMEOUT']
          }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      return failedLogs;
    } catch (error) {
      throw new Error(`Error al obtener transacciones fallidas: ${error.message}`);
    }
  };

  LogTransaccion.getSuspiciousActivity = async (timeframe = '1 hour') => {
    try {
      // Detectar actividad sospechosa: muchas transacciones del mismo usuario en poco tiempo
      const suspiciousLogs = await LogTransaccion.findAll({
        attributes: [
          'userId',
          'tipoTransaccion',
          [sequelize.fn('COUNT', sequelize.col('userId')), 'count'],
          [sequelize.fn('MIN', sequelize.col('created_at')), 'first_transaction'],
          [sequelize.fn('MAX', sequelize.col('created_at')), 'last_transaction']
        ],
        where: {
          created_at: {
            [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${timeframe}'`)
          }
        },
        group: ['userId', 'tipoTransaccion'],
        having: sequelize.literal('COUNT(userId) > 10'), // Más de 10 transacciones en el timeframe
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [[sequelize.fn('COUNT', sequelize.col('userId')), 'DESC']],
        raw: false
      });
      return suspiciousLogs;
    } catch (error) {
      throw new Error(`Error al obtener actividad sospechosa: ${error.message}`);
    }
  };

  // Métodos de estadísticas
  LogTransaccion.getStats = async () => {
    try {
      const totalLogs = await LogTransaccion.count();
      
      // Logs por tipo de transacción
      const logsByType = await LogTransaccion.findAll({
        attributes: [
          'tipoTransaccion',
          [sequelize.fn('COUNT', sequelize.col('tipoTransaccion')), 'count']
        ],
        group: ['tipoTransaccion'],
        order: [[sequelize.fn('COUNT', sequelize.col('tipoTransaccion')), 'DESC']],
        raw: true
      });

      // Logs por acción
      const logsByAction = await LogTransaccion.findAll({
        attributes: [
          'accion',
          [sequelize.fn('COUNT', sequelize.col('accion')), 'count']
        ],
        group: ['accion'],
        order: [[sequelize.fn('COUNT', sequelize.col('accion')), 'DESC']],
        raw: true
      });

      // Usuarios más activos
      const usersByActivity = await LogTransaccion.findAll({
        attributes: [
          'userId',
          [sequelize.fn('COUNT', sequelize.col('userId')), 'count']
        ],
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['email', 'nombre']
          }
        ],
        group: ['userId', 'user.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('userId')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Actividad por fecha (últimos 7 días)
      const activityByDate = await LogTransaccion.findAll({
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'fecha'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        where: {
          created_at: {
            [Op.gte]: sequelize.literal("NOW() - INTERVAL '7 days'")
          }
        },
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'DESC']],
        raw: true
      });

      // Estadísticas de transacciones exitosas vs fallidas
      const successVsFailure = await LogTransaccion.findAll({
        attributes: [
          [sequelize.literal(`
            CASE 
              WHEN accion IN ('SUCCESS', 'COMPLETED', 'CONFIRMED') THEN 'SUCCESS'
              WHEN accion IN ('FAILED', 'ERROR', 'REJECTED', 'CANCELLED') THEN 'FAILED'
              ELSE 'OTHER'
            END
          `), 'status'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: [sequelize.literal(`
          CASE 
            WHEN accion IN ('SUCCESS', 'COMPLETED', 'CONFIRMED') THEN 'SUCCESS'
            WHEN accion IN ('FAILED', 'ERROR', 'REJECTED', 'CANCELLED') THEN 'FAILED'
            ELSE 'OTHER'
          END
        `)],
        raw: true
      });

      return {
        total: totalLogs,
        porTipoTransaccion: logsByType,
        porAccion: logsByAction,
        usuariosMasActivos: usersByActivity,
        actividadPorFecha: activityByDate,
        exitososVsFallidos: successVsFailure
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // Método para crear log
  LogTransaccion.createLog = async (data) => {
    try {
      const nuevoLog = await LogTransaccion.create(data);
      return nuevoLog;
    } catch (error) {
      throw new Error(`Error al crear log de transacción: ${error.message}`);
    }
  };

  // Método helper para logging automático
  LogTransaccion.logTransaction = async (userId, tipoTransaccion, transaccionId, accion, detalles = null) => {
    try {
      const logData = {
        userId,
        tipoTransaccion,
        transaccionId,
        accion,
        detalles
      };

      return await LogTransaccion.createLog(logData);
    } catch (error) {
      // No lanzar error para no interrumpir la operación principal
      console.error('Error al crear log de transacción:', error.message);
    }
  };

  // Método para obtener timeline de una transacción
  LogTransaccion.getTransactionTimeline = async (transaccionId) => {
    try {
      const timeline = await LogTransaccion.findAll({
        where: { transaccionId: transaccionId },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'ASC']]
      });

      // Agregar información de duración entre pasos
      const timelineWithDuration = timeline.map((log, index) => {
        const logObj = log.toJSON();
        if (index > 0) {
          const prevTime = new Date(timeline[index - 1].created_at);
          const currentTime = new Date(log.created_at);
          logObj.durationFromPrevious = currentTime - prevTime; // milliseconds
        }
        return logObj;
      });

      return timelineWithDuration;
    } catch (error) {
      throw new Error(`Error al obtener timeline de transacción: ${error.message}`);
    }
  };

  // Métodos de limpieza
  LogTransaccion.cleanOldLogs = async (daysToKeep = 90) => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedCount = await LogTransaccion.destroy({
        where: {
          created_at: {
            [Op.lt]: cutoffDate
          }
        }
      });

      return { 
        message: `Se eliminaron ${deletedCount} logs de transacciones antiguos`,
        deletedCount 
      };
    } catch (error) {
      throw new Error(`Error al limpiar logs antiguos: ${error.message}`);
    }
  };

  return LogTransaccion;
}

module.exports = createLogTransaccionModel;