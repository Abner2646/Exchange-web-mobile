// Importaciones
const initLogAdmin = require('./entities/logAdmin.entity');
const { Op } = require('sequelize');

function createLogAdminModel(sequelize) {
  const LogAdmin = initLogAdmin(sequelize);

  // Métodos de consulta básicos
  LogAdmin.getById = async (id) => {
    try {
      const log = await LogAdmin.findByPk(id, {
        include: [
          {
            model: sequelize.models.User,
            as: 'admin',
            attributes: ['id', 'email', 'nombre', 'rol']
          }
        ]
      });
      return log;
    } catch (error) {
      throw new Error(`Error al obtener log por ID: ${error.message}`);
    }
  };

  LogAdmin.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.adminId) {
        whereClause.adminId = filters.adminId;
      }
      
      if (filters.accion) {
        whereClause.accion = {
          [Op.iLike]: `%${filters.accion}%`
        };
      }

      if (filters.entidadTipo) {
        whereClause.entidadTipo = filters.entidadTipo;
      }

      if (filters.entidadId) {
        whereClause.entidadId = filters.entidadId;
      }

      if (filters.ipAddress) {
        whereClause.ipAddress = filters.ipAddress;
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

      const { count, rows } = await LogAdmin.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.User,
            as: 'admin',
            attributes: ['id', 'email', 'nombre', 'rol']
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
      throw new Error(`Error al obtener logs: ${error.message}`);
    }
  };

  LogAdmin.search = async (term, limit = 10) => {
    try {
      const logs = await LogAdmin.findAll({
        where: {
          [Op.or]: [
            { accion: { [Op.iLike]: `%${term}%` } },
            { entidadTipo: { [Op.iLike]: `%${term}%` } },
            { userAgent: { [Op.iLike]: `%${term}%` } }
          ]
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'admin',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        limit: parseInt(limit),
        order: [['created_at', 'DESC']]
      });
      
      return logs;
    } catch (error) {
      throw new Error(`Error en búsqueda de logs: ${error.message}`);
    }
  };

  // Métodos específicos para logs de admin
  LogAdmin.getByAdmin = async (adminId, limit = 100) => {
    try {
      const logs = await LogAdmin.findAll({
        where: { adminId: adminId },
        include: [
          {
            model: sequelize.models.User,
            as: 'admin',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });
      return logs;
    } catch (error) {
      throw new Error(`Error al obtener logs por admin: ${error.message}`);
    }
  };

  LogAdmin.getByEntity = async (entidadTipo, entidadId) => {
    try {
      const logs = await LogAdmin.findAll({
        where: { 
          entidadTipo: entidadTipo,
          entidadId: entidadId 
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'admin',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      return logs;
    } catch (error) {
      throw new Error(`Error al obtener logs por entidad: ${error.message}`);
    }
  };

  LogAdmin.getByAction = async (accion, limit = 100) => {
    try {
      const logs = await LogAdmin.findAll({
        where: { accion: accion },
        include: [
          {
            model: sequelize.models.User,
            as: 'admin',
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

  LogAdmin.getByDateRange = async (fechaDesde, fechaHasta) => {
    try {
      const logs = await LogAdmin.findAll({
        where: {
          created_at: {
            [Op.between]: [new Date(fechaDesde), new Date(fechaHasta)]
          }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'admin',
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

  LogAdmin.getSuspiciousActivity = async (timeframe = '24 hours') => {
    try {
      const suspiciousLogs = await LogAdmin.findAll({
        where: {
          created_at: {
            [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${timeframe}'`)
          },
          accion: {
            [Op.in]: ['DELETE', 'FORCE_DELETE', 'BULK_DELETE', 'UPDATE_CRITICAL', 'DISABLE_USER']
          }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'admin',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      return suspiciousLogs;
    } catch (error) {
      throw new Error(`Error al obtener actividad sospechosa: ${error.message}`);
    }
  };

  // Métodos de estadísticas
  LogAdmin.getStats = async () => {
    try {
      const totalLogs = await LogAdmin.count();
      
      // Logs por acción
      const logsByAction = await LogAdmin.findAll({
        attributes: [
          'accion',
          [sequelize.fn('COUNT', sequelize.col('accion')), 'count']
        ],
        group: ['accion'],
        order: [[sequelize.fn('COUNT', sequelize.col('accion')), 'DESC']],
        raw: true
      });

      // Logs por tipo de entidad
      const logsByEntityType = await LogAdmin.findAll({
        attributes: [
          'entidadTipo',
          [sequelize.fn('COUNT', sequelize.col('entidadTipo')), 'count']
        ],
        where: {
          entidadTipo: { [Op.ne]: null }
        },
        group: ['entidadTipo'],
        order: [[sequelize.fn('COUNT', sequelize.col('entidadTipo')), 'DESC']],
        raw: true
      });

      // Admins más activos
      const adminsByActivity = await LogAdmin.findAll({
        attributes: [
          'adminId',
          [sequelize.fn('COUNT', sequelize.col('adminId')), 'count']
        ],
        include: [
          {
            model: sequelize.models.User,
            as: 'admin',
            attributes: ['email', 'nombre']
          }
        ],
        group: ['adminId', 'admin.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('adminId')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Actividad por fecha (últimos 7 días)
      const activityByDate = await LogAdmin.findAll({
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

      return {
        total: totalLogs,
        porAccion: logsByAction,
        porTipoEntidad: logsByEntityType,
        adminsMasActivos: adminsByActivity,
        actividadPorFecha: activityByDate
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // Método para crear log
  LogAdmin.createLog = async (data) => {
    try {
      const nuevoLog = await LogAdmin.create(data);
      return nuevoLog;
    } catch (error) {
      throw new Error(`Error al crear log: ${error.message}`);
    }
  };

  // Método helper para logging automático
  LogAdmin.logAction = async (adminId, accion, entidadTipo = null, entidadId = null, datosAnteriores = null, datosNuevos = null, req = null) => {
    try {
      const logData = {
        adminId,
        accion,
        entidadTipo,
        entidadId,
        datosAnteriores,
        datosNuevos
      };

      // Extraer información del request si está disponible
      if (req) {
        logData.ipAddress = req.ip || req.connection.remoteAddress;
        logData.userAgent = req.get('User-Agent');
      }

      return await LogAdmin.createLog(logData);
    } catch (error) {
      // No lanzar error para no interrumpir la operación principal
      console.error('Error al crear log de admin:', error.message);
    }
  };

  // Métodos de limpieza
  LogAdmin.cleanOldLogs = async (daysToKeep = 365) => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedCount = await LogAdmin.destroy({
        where: {
          created_at: {
            [Op.lt]: cutoffDate
          }
        }
      });

      return { 
        message: `Se eliminaron ${deletedCount} logs antiguos`,
        deletedCount 
      };
    } catch (error) {
      throw new Error(`Error al limpiar logs antiguos: ${error.message}`);
    }
  };

  return LogAdmin;
}

module.exports = createLogAdminModel;