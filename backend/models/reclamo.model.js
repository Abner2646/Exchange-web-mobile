// Importaciones
const initReclamo = require('./entities/reclamo.entity');
const { Op } = require('sequelize');

function createReclamoModel(sequelize) {
  const Reclamo = initReclamo(sequelize);

  // Métodos de consulta básicos
  Reclamo.getById = async (id) => {
    try {
      const reclamo = await Reclamo.findByPk(id, {
        include: [
          {
            model: sequelize.models.User,
            as: 'usuario',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.CategoriaReclamo,
            as: 'categoria',
            attributes: ['id', 'nombre', 'descripcion']
          },
          {
            model: sequelize.models.User,
            as: 'adminAsignado',
            attributes: ['id', 'email', 'nombre'],
            required: false
          },
          {
            model: sequelize.models.TransaccionP2P,
            as: 'transaccionP2P',
            attributes: ['id', 'monto', 'estado'],
            required: false
          },
          {
            model: sequelize.models.MensajeReclamo,
            as: 'mensajes',
            attributes: ['id', 'mensaje', 'esAdmin', 'created_at'],
            include: [
              {
                model: sequelize.models.User,
                as: 'autor',
                attributes: ['id', 'email', 'nombre']
              }
            ],
            order: [['created_at', 'ASC']]
          }
        ]
      });
      return reclamo;
    } catch (error) {
      throw new Error(`Error al obtener reclamo por ID: ${error.message}`);
    }
  };

  Reclamo.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.userId) {
        whereClause.userId = filters.userId;
      }
      
      if (filters.categoriaId) {
        whereClause.categoriaId = filters.categoriaId;
      }

      if (filters.tipoReclamo) {
        whereClause.tipoReclamo = filters.tipoReclamo;
      }

      if (filters.estado) {
        if (Array.isArray(filters.estado)) {
          whereClause.estado = { [Op.in]: filters.estado };
        } else {
          whereClause.estado = filters.estado;
        }
      }

      if (filters.prioridad) {
        if (Array.isArray(filters.prioridad)) {
          whereClause.prioridad = { [Op.in]: filters.prioridad };
        } else {
          whereClause.prioridad = filters.prioridad;
        }
      }

      if (filters.adminAsignadoId) {
        whereClause.adminAsignadoId = filters.adminAsignadoId;
      }

      if (filters.asunto) {
        whereClause.asunto = {
          [Op.iLike]: `%${filters.asunto}%`
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

      // Filtro para reclamos sin asignar
      if (filters.sinAsignar === 'true') {
        whereClause.adminAsignadoId = null;
      }

      // Paginación
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 50;
      const offset = (page - 1) * limit;

      const { count, rows } = await Reclamo.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.User,
            as: 'usuario',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.CategoriaReclamo,
            as: 'categoria',
            attributes: ['id', 'nombre']
          },
          {
            model: sequelize.models.User,
            as: 'adminAsignado',
            attributes: ['id', 'email', 'nombre'],
            required: false
          }
        ],
        order: [
          ['prioridad', 'DESC'], // Alta prioridad primero
          ['created_at', 'ASC']   // Más antiguos primero
        ],
        limit,
        offset
      });
      
      return {
        reclamos: rows,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: limit
        }
      };
    } catch (error) {
      throw new Error(`Error al obtener reclamos: ${error.message}`);
    }
  };

  Reclamo.search = async (term, limit = 10) => {
    try {
      const reclamos = await Reclamo.findAll({
        where: {
          [Op.or]: [
            { asunto: { [Op.iLike]: `%${term}%` } },
            { descripcion: { [Op.iLike]: `%${term}%` } }
          ]
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'usuario',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.CategoriaReclamo,
            as: 'categoria',
            attributes: ['id', 'nombre']
          }
        ],
        limit: parseInt(limit),
        order: [['created_at', 'DESC']]
      });
      
      return reclamos;
    } catch (error) {
      throw new Error(`Error en búsqueda de reclamos: ${error.message}`);
    }
  };

  // Métodos específicos para reclamos
  Reclamo.getByUser = async (userId, filters = {}) => {
    try {
      const whereClause = { userId: userId };
      
      // Aplicar filtros adicionales
      if (filters.estado) {
        whereClause.estado = filters.estado;
      }
      if (filters.tipoReclamo) {
        whereClause.tipoReclamo = filters.tipoReclamo;
      }

      const reclamos = await Reclamo.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.CategoriaReclamo,
            as: 'categoria',
            attributes: ['id', 'nombre']
          },
          {
            model: sequelize.models.User,
            as: 'adminAsignado',
            attributes: ['id', 'email', 'nombre'],
            required: false
          }
        ],
        order: [['created_at', 'DESC']]
      });
      return reclamos;
    } catch (error) {
      throw new Error(`Error al obtener reclamos por usuario: ${error.message}`);
    }
  };

  Reclamo.getByAdmin = async (adminId, filters = {}) => {
    try {
      const whereClause = { adminAsignadoId: adminId };
      
      if (filters.estado) {
        whereClause.estado = filters.estado;
      }

      const reclamos = await Reclamo.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.User,
            as: 'usuario',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.CategoriaReclamo,
            as: 'categoria',
            attributes: ['id', 'nombre']
          }
        ],
        order: [
          ['prioridad', 'DESC'],
          ['created_at', 'ASC']
        ]
      });
      return reclamos;
    } catch (error) {
      throw new Error(`Error al obtener reclamos por admin: ${error.message}`);
    }
  };

  Reclamo.getByStatus = async (estado) => {
    try {
      const reclamos = await Reclamo.findAll({
        where: { estado: estado },
        include: [
          {
            model: sequelize.models.User,
            as: 'usuario',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.CategoriaReclamo,
            as: 'categoria',
            attributes: ['id', 'nombre']
          },
          {
            model: sequelize.models.User,
            as: 'adminAsignado',
            attributes: ['id', 'email', 'nombre'],
            required: false
          }
        ],
        order: [
          ['prioridad', 'DESC'],
          ['created_at', 'ASC']
        ]
      });
      return reclamos;
    } catch (error) {
      throw new Error(`Error al obtener reclamos por estado: ${error.message}`);
    }
  };

  Reclamo.getByPriority = async (prioridad) => {
    try {
      const reclamos = await Reclamo.findAll({
        where: { prioridad: prioridad },
        include: [
          {
            model: sequelize.models.User,
            as: 'usuario',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.CategoriaReclamo,
            as: 'categoria',
            attributes: ['id', 'nombre']
          }
        ],
        order: [['created_at', 'ASC']]
      });
      return reclamos;
    } catch (error) {
      throw new Error(`Error al obtener reclamos por prioridad: ${error.message}`);
    }
  };

  Reclamo.getUnassigned = async () => {
    try {
      const reclamos = await Reclamo.findAll({
        where: { 
          adminAsignadoId: null,
          estado: { [Op.in]: ['pendiente', 'en_revision'] }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'usuario',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.CategoriaReclamo,
            as: 'categoria',
            attributes: ['id', 'nombre']
          }
        ],
        order: [
          ['prioridad', 'DESC'],
          ['created_at', 'ASC']
        ]
      });
      return reclamos;
    } catch (error) {
      throw new Error(`Error al obtener reclamos sin asignar: ${error.message}`);
    }
  };

  Reclamo.getOverdue = async (days = 3) => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const reclamos = await Reclamo.findAll({
        where: {
          created_at: { [Op.lt]: cutoffDate },
          estado: { [Op.in]: ['pendiente', 'en_revision'] }
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'usuario',
            attributes: ['id', 'email', 'nombre']
          },
          {
            model: sequelize.models.CategoriaReclamo,
            as: 'categoria',
            attributes: ['id', 'nombre']
          },
          {
            model: sequelize.models.User,
            as: 'adminAsignado',
            attributes: ['id', 'email', 'nombre'],
            required: false
          }
        ],
        order: [['created_at', 'ASC']]
      });
      return reclamos;
    } catch (error) {
      throw new Error(`Error al obtener reclamos vencidos: ${error.message}`);
    }
  };

  // Métodos de estadísticas
  Reclamo.getStats = async () => {
    try {
      const totalReclamos = await Reclamo.count();
      
      // Estadísticas por estado
      const estadisticasPorEstado = await Reclamo.findAll({
        attributes: [
          'estado',
          [sequelize.fn('COUNT', sequelize.col('estado')), 'count']
        ],
        group: ['estado'],
        raw: true
      });

      // Estadísticas por prioridad
      const estadisticasPorPrioridad = await Reclamo.findAll({
        attributes: [
          'prioridad',
          [sequelize.fn('COUNT', sequelize.col('prioridad')), 'count']
        ],
        group: ['prioridad'],
        raw: true
      });

      // Estadísticas por tipo
      const estadisticasPorTipo = await Reclamo.findAll({
        attributes: [
          'tipoReclamo',
          [sequelize.fn('COUNT', sequelize.col('tipoReclamo')), 'count']
        ],
        group: ['tipoReclamo'],
        raw: true
      });

      // Estadísticas por categoría
      const estadisticasPorCategoria = await Reclamo.findAll({
        attributes: [
          'categoriaId',
          [sequelize.fn('COUNT', sequelize.col('categoriaId')), 'count']
        ],
        include: [
          {
            model: sequelize.models.CategoriaReclamo,
            as: 'categoria',
            attributes: ['nombre']
          }
        ],
        group: ['categoriaId', 'categoria.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('categoriaId')), 'DESC']],
        raw: false
      });

      // Reclamos sin asignar
      const sinAsignar = await Reclamo.count({
        where: { adminAsignadoId: null }
      });

      // Reclamos vencidos (más de 3 días sin resolver)
      const vencidos = await Reclamo.count({
        where: {
          created_at: { [Op.lt]: sequelize.literal("NOW() - INTERVAL '3 days'") },
          estado: { [Op.in]: ['pendiente', 'en_revision'] }
        }
      });

      // Tiempo promedio de resolución
      const tiempoPromedioResolucion = await Reclamo.findAll({
        attributes: [
          [sequelize.fn('AVG', 
            sequelize.literal("EXTRACT(EPOCH FROM (fecha_resolucion - created_at)) / 3600")
          ), 'promedio_horas']
        ],
        where: {
          fechaResolucion: { [Op.ne]: null },
          estado: 'resuelto'
        },
        raw: true
      });

      return {
        total: totalReclamos,
        porEstado: estadisticasPorEstado,
        porPrioridad: estadisticasPorPrioridad,
        porTipo: estadisticasPorTipo,
        porCategoria: estadisticasPorCategoria,
        sinAsignar: sinAsignar,
        vencidos: vencidos,
        tiempoPromedioResolucionHoras: tiempoPromedioResolucion[0]?.promedio_horas || 0
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // Métodos CRUD
  Reclamo.createReclamo = async (data) => {
    try {
      const nuevoReclamo = await Reclamo.create(data);
      return await Reclamo.getById(nuevoReclamo.id);
    } catch (error) {
      throw new Error(`Error al crear reclamo: ${error.message}`);
    }
  };

  Reclamo.updateReclamo = async (id, data) => {
    try {
      const [updatedRowsCount] = await Reclamo.update(data, {
        where: { id },
        returning: true
      });
      
      if (updatedRowsCount === 0) {
        throw new Error('Reclamo no encontrado');
      }
      
      const updatedReclamo = await Reclamo.getById(id);
      return updatedReclamo;
    } catch (error) {
      throw new Error(`Error al actualizar reclamo: ${error.message}`);
    }
  };

  Reclamo.deleteReclamo = async (id) => {
    try {
      const deletedRowsCount = await Reclamo.destroy({
        where: { id }
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Reclamo no encontrado');
      }
      
      return { message: 'Reclamo eliminado correctamente' };
    } catch (error) {
      throw new Error(`Error al eliminar reclamo: ${error.message}`);
    }
  };

  // Métodos de gestión de estado
  Reclamo.assignToAdmin = async (reclamoId, adminId) => {
    try {
      const updated = await Reclamo.updateReclamo(reclamoId, {
        adminAsignadoId: adminId,
        estado: 'en_revision',
        fechaAsignacion: new Date()
      });
      return updated;
    } catch (error) {
      throw new Error(`Error al asignar reclamo a admin: ${error.message}`);
    }
  };

  Reclamo.updateStatus = async (id, nuevoEstado, resolucion = null) => {
    try {
      const updateData = { estado: nuevoEstado };
      
      if (nuevoEstado === 'resuelto' && resolucion) {
        updateData.resolucion = resolucion;
        updateData.fechaResolucion = new Date();
      }

      const updated = await Reclamo.updateReclamo(id, updateData);
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar estado del reclamo: ${error.message}`);
    }
  };

  Reclamo.updatePriority = async (id, nuevaPrioridad) => {
    try {
      const updated = await Reclamo.updateReclamo(id, {
        prioridad: nuevaPrioridad
      });
      return updated;
    } catch (error) {
      throw new Error(`Error al actualizar prioridad del reclamo: ${error.message}`);
    }
  };

  Reclamo.resolveReclamo = async (id, resolucion, adminId) => {
    try {
      const updated = await Reclamo.updateReclamo(id, {
        estado: 'resuelto',
        resolucion: resolucion,
        fechaResolucion: new Date(),
        adminAsignadoId: adminId || updated.adminAsignadoId
      });
      return updated;
    } catch (error) {
      throw new Error(`Error al resolver reclamo: ${error.message}`);
    }
  };

  return Reclamo;
}

module.exports = createReclamoModel;