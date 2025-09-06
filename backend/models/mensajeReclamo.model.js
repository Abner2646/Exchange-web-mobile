// Importaciones
const initMensajeReclamo = require('./entities/mensajeReclamo.entity');
const { Op } = require('sequelize');

function createMensajeReclamoModel(sequelize) {
  const MensajeReclamo = initMensajeReclamo(sequelize);

  // Métodos de consulta básicos
  MensajeReclamo.getById = async (id) => {
    try {
      const mensaje = await MensajeReclamo.findByPk(id, {
        include: [
          {
            model: sequelize.models.User,
            as: 'autor',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.Reclamo,
            as: 'reclamo',
            attributes: ['id', 'titulo', 'estado']
          }
        ]
      });
      return mensaje;
    } catch (error) {
      throw new Error(`Error al obtener mensaje de reclamo por ID: ${error.message}`);
    }
  };

  MensajeReclamo.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.reclamoId) {
        whereClause.reclamoId = filters.reclamoId;
      }
      
      if (filters.autorId) {
        whereClause.autorId = filters.autorId;
      }

      if (filters.esAdmin !== undefined) {
        whereClause.esAdmin = filters.esAdmin === 'true';
      }

      if (filters.mensaje) {
        whereClause.mensaje = {
          [Op.iLike]: `%${filters.mensaje}%`
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

      const { count, rows } = await MensajeReclamo.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.User,
            as: 'autor',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.Reclamo,
            as: 'reclamo',
            attributes: ['id', 'titulo', 'estado']
          }
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset
      });
      
      return {
        mensajes: rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      throw new Error(`Error al obtener mensajes de reclamos: ${error.message}`);
    }
  };

  MensajeReclamo.search = async (term, limit = 10) => {
    try {
      const mensajes = await MensajeReclamo.findAll({
        where: {
          mensaje: { [Op.iLike]: `%${term}%` }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'autor',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.Reclamo,
            as: 'reclamo',
            attributes: ['id', 'titulo', 'estado']
          }
        ],
        limit: parseInt(limit),
        order: [['created_at', 'DESC']]
      });
      
      return mensajes;
    } catch (error) {
      throw new Error(`Error en búsqueda de mensajes de reclamos: ${error.message}`);
    }
  };

  // Métodos específicos para mensajes de reclamos
  MensajeReclamo.getByReclamo = async (reclamoId) => {
    try {
      const mensajes = await MensajeReclamo.findAll({
        where: { reclamoId: reclamoId },
        include: [
          {
            model: sequelize.models.User,
            as: 'autor',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        order: [['created_at', 'ASC']] // Orden cronológico para conversación
      });
      return mensajes;
    } catch (error) {
      throw new Error(`Error al obtener mensajes por reclamo: ${error.message}`);
    }
  };

  MensajeReclamo.getByAuthor = async (autorId, limit = 100) => {
    try {
      const mensajes = await MensajeReclamo.findAll({
        where: { autorId: autorId },
        include: [
          {
            model: sequelize.models.User,
            as: 'autor',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.Reclamo,
            as: 'reclamo',
            attributes: ['id', 'titulo', 'estado']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });
      return mensajes;
    } catch (error) {
      throw new Error(`Error al obtener mensajes por autor: ${error.message}`);
    }
  };

  MensajeReclamo.getAdminMessages = async (limit = 100) => {
    try {
      const mensajes = await MensajeReclamo.findAll({
        where: { esAdmin: true },
        include: [
          {
            model: sequelize.models.User,
            as: 'autor',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.Reclamo,
            as: 'reclamo',
            attributes: ['id', 'titulo', 'estado']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });
      return mensajes;
    } catch (error) {
      throw new Error(`Error al obtener mensajes de admin: ${error.message}`);
    }
  };

  MensajeReclamo.getUserMessages = async (limit = 100) => {
    try {
      const mensajes = await MensajeReclamo.findAll({
        where: { esAdmin: false },
        include: [
          {
            model: sequelize.models.User,
            as: 'autor',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.Reclamo,
            as: 'reclamo',
            attributes: ['id', 'titulo', 'estado']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });
      return mensajes;
    } catch (error) {
      throw new Error(`Error al obtener mensajes de usuarios: ${error.message}`);
    }
  };

  MensajeReclamo.getMessagesWithAttachments = async () => {
    try {
      const mensajes = await MensajeReclamo.findAll({
        where: {
          adjuntos: { [Op.ne]: null }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'autor',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.Reclamo,
            as: 'reclamo',
            attributes: ['id', 'titulo', 'estado']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      return mensajes;
    } catch (error) {
      throw new Error(`Error al obtener mensajes con adjuntos: ${error.message}`);
    }
  };

  MensajeReclamo.getRecentActivity = async (timeframe = '24 hours') => {
    try {
      const mensajes = await MensajeReclamo.findAll({
        where: {
          created_at: {
            [Op.gte]: sequelize.literal(`NOW() - INTERVAL '${timeframe}'`)
          }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'autor',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.Reclamo,
            as: 'reclamo',
            attributes: ['id', 'titulo', 'estado']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      return mensajes;
    } catch (error) {
      throw new Error(`Error al obtener actividad reciente: ${error.message}`);
    }
  };

  // Métodos de estadísticas
  MensajeReclamo.getStats = async () => {
    try {
      const totalMensajes = await MensajeReclamo.count();
      const mensajesAdmin = await MensajeReclamo.count({
        where: { esAdmin: true }
      });
      const mensajesUsuario = await MensajeReclamo.count({
        where: { esAdmin: false }
      });
      const mensajesConAdjuntos = await MensajeReclamo.count({
        where: { adjuntos: { [Op.ne]: null } }
      });

      // Mensajes por reclamo
      const mensajesPorReclamo = await MensajeReclamo.findAll({
        attributes: [
          'reclamoId',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        include: [
          {
            model: sequelize.models.Reclamo,
            as: 'reclamo',
            attributes: ['titulo', 'estado']
          }
        ],
        group: ['reclamoId', 'reclamo.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Autores más activos
      const autoresMasActivos = await MensajeReclamo.findAll({
        attributes: [
          'autorId',
          [sequelize.fn('COUNT', sequelize.col('autorId')), 'count']
        ],
        include: [
          {
            model: sequelize.models.User,
            as: 'autor',
            attributes: ['email', 'nombre']
          }
        ],
        group: ['autorId', 'autor.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('autorId')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Actividad por fecha (últimos 7 días)
      const actividadPorFecha = await MensajeReclamo.findAll({
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
        total: totalMensajes,
        admin: mensajesAdmin,
        usuario: mensajesUsuario,
        conAdjuntos: mensajesConAdjuntos,
        porReclamo: mensajesPorReclamo,
        autoresMasActivos: autoresMasActivos,
        actividadPorFecha: actividadPorFecha
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // Método para crear mensaje
  MensajeReclamo.createMensaje = async (data) => {
    try {
      // Validar que el reclamo existe
      const reclamo = await sequelize.models.Reclamo.findByPk(data.reclamoId);
      if (!reclamo) {
        throw new Error('El reclamo especificado no existe');
      }

      const nuevoMensaje = await MensajeReclamo.create(data);
      return await MensajeReclamo.getById(nuevoMensaje.id);
    } catch (error) {
      throw new Error(`Error al crear mensaje de reclamo: ${error.message}`);
    }
  };

  MensajeReclamo.updateMensaje = async (id, data) => {
    try {
      const [updatedRowsCount] = await MensajeReclamo.update(data, {
        where: { id },
        returning: true
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Mensaje de reclamo no encontrado');
      }
      
      const updatedMensaje = await MensajeReclamo.getById(id);
      return updatedMensaje;
    } catch (error) {
      throw new Error(`Error al actualizar mensaje de reclamo: ${error.message}`);
    }
  };

  MensajeReclamo.deleteMensaje = async (id) => {
    try {
      const deletedRowsCount = await MensajeReclamo.destroy({
        where: { id }
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Mensaje de reclamo no encontrado');
      }
      
      return { message: 'Mensaje de reclamo eliminado correctamente' };
    } catch (error) {
      throw new Error(`Error al eliminar mensaje de reclamo: ${error.message}`);
    }
  };

  // Método para obtener conversación completa
  MensajeReclamo.getConversation = async (reclamoId, userId = null, includeMetadata = false) => {
    try {
      const mensajes = await MensajeReclamo.getByReclamo(reclamoId);
      
      // Si es un usuario específico, verificar que tenga acceso al reclamo
      if (userId && !includeMetadata) {
        const reclamo = await sequelize.models.Reclamo.findByPk(reclamoId);
        if (!reclamo || reclamo.userId !== userId) {
          throw new Error('No tienes acceso a este reclamo');
        }
      }

      let conversation = {
        reclamoId: reclamoId,
        totalMensajes: mensajes.length,
        mensajes: mensajes
      };

      if (includeMetadata) {
        const adminMessages = mensajes.filter(m => m.esAdmin).length;
        const userMessages = mensajes.filter(m => !m.esAdmin).length;
        const withAttachments = mensajes.filter(m => m.adjuntos && m.adjuntos.length > 0).length;
        
        conversation.metadata = {
          mensajesAdmin: adminMessages,
          mensajesUsuario: userMessages,
          conAdjuntos: withAttachments,
          ultimaActividad: mensajes.length > 0 ? mensajes[mensajes.length - 1].created_at : null
        };
      }

      return conversation;
    } catch (error) {
      throw new Error(`Error al obtener conversación: ${error.message}`);
    }
  };

  // Método para marcar mensajes como leídos (si implementas sistema de lectura)
  MensajeReclamo.markAsRead = async (reclamoId, userId) => {
    try {
      // Este método podría expandirse si implementas un sistema de lectura
      // Por ahora, solo devuelve información de los mensajes no leídos
      const mensajes = await MensajeReclamo.getByReclamo(reclamoId);
      const unreadMessages = mensajes.filter(m => 
        m.autorId !== userId && // Mensajes de otros usuarios
        !m.leido // Si tienes campo 'leido'
      );
      
      return {
        totalMessages: mensajes.length,
        unreadCount: unreadMessages.length
      };
    } catch (error) {
      throw new Error(`Error al marcar mensajes como leídos: ${error.message}`);
    }
  };

  return MensajeReclamo;
}

module.exports = createMensajeReclamoModel;