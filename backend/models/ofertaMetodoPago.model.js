// Importaciones
const initOfertaMetodoPago = require('./entities/ofertaMetodoPago.entity');
const { Op } = require('sequelize');

function createOfertaMetodoPagoModel(sequelize) {
  const OfertaMetodoPago = initOfertaMetodoPago(sequelize);

  // Métodos de consulta básicos
  OfertaMetodoPago.getById = async (id) => {
    try {
      const ofertaMetodo = await OfertaMetodoPago.findByPk(id, {
        include: [
          {
            model: sequelize.models.Oferta,
            as: 'oferta',
            attributes: ['id', 'titulo', 'tipo', 'estado', 'userId']
          },
          {
            model: sequelize.models.MetodoPago,
            as: 'metodoPago',
            attributes: ['id', 'nombre', 'descripcion', 'activo']
          }
        ]
      });
      return ofertaMetodo;
    } catch (error) {
      throw new Error(`Error al obtener oferta-método de pago por ID: ${error.message}`);
    }
  };

  OfertaMetodoPago.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.ofertaId) {
        whereClause.ofertaId = filters.ofertaId;
      }
      
      if (filters.metodoPagoId) {
        whereClause.metodoPagoId = filters.metodoPagoId;
      }

      const ofertaMetodos = await OfertaMetodoPago.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Oferta,
            as: 'oferta',
            attributes: ['id', 'titulo', 'tipo', 'estado']
          },
          {
            model: sequelize.models.MetodoPago,
            as: 'metodoPago',
            attributes: ['id', 'nombre', 'descripcion', 'activo']
          }
        ],
        order: [['ofertaId', 'ASC'], ['metodoPagoId', 'ASC']]
      });
      
      return ofertaMetodos;
    } catch (error) {
      throw new Error(`Error al obtener relaciones oferta-método de pago: ${error.message}`);
    }
  };

  // Métodos específicos para relaciones oferta-método pago
  OfertaMetodoPago.getByOferta = async (ofertaId) => {
    try {
      const metodosPago = await OfertaMetodoPago.findAll({
        where: { ofertaId: ofertaId },
        include: [
          {
            model: sequelize.models.MetodoPago,
            as: 'metodoPago',
            attributes: ['id', 'nombre', 'descripcion', 'activo'],
            where: { activo: true }, // Solo métodos activos
            required: true
          }
        ],
        order: [['metodoPago', 'nombre', 'ASC']]
      });
      
      return metodosPago.map(om => om.metodoPago);
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago por oferta: ${error.message}`);
    }
  };

  OfertaMetodoPago.getByMetodoPago = async (metodoPagoId) => {
    try {
      const ofertas = await OfertaMetodoPago.findAll({
        where: { metodoPagoId: metodoPagoId },
        include: [
          {
            model: sequelize.models.Oferta,
            as: 'oferta',
            attributes: ['id', 'titulo', 'tipo', 'estado', 'userId'],
            where: { estado: { [Op.in]: ['activa', 'pendiente'] } }, // Solo ofertas activas
            required: true
          }
        ],
        order: [['oferta', 'titulo', 'ASC']]
      });
      
      return ofertas.map(om => om.oferta);
    } catch (error) {
      throw new Error(`Error al obtener ofertas por método de pago: ${error.message}`);
    }
  };

  OfertaMetodoPago.getOfertaMetodosPago = async (ofertaId, includeInactive = false) => {
    try {
      const whereMetodo = includeInactive ? {} : { activo: true };
      
      const relations = await OfertaMetodoPago.findAll({
        where: { ofertaId: ofertaId },
        include: [
          {
            model: sequelize.models.MetodoPago,
            as: 'metodoPago',
            attributes: ['id', 'nombre', 'descripcion', 'activo'],
            where: whereMetodo,
            required: true
          },
          {
            model: sequelize.models.Oferta,
            as: 'oferta',
            attributes: ['id', 'titulo', 'tipo', 'estado']
          }
        ],
        order: [['metodoPago', 'nombre', 'ASC']]
      });
      
      return relations;
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago de oferta: ${error.message}`);
    }
  };

  OfertaMetodoPago.exists = async (ofertaId, metodoPagoId) => {
    try {
      const relation = await OfertaMetodoPago.findOne({
        where: { 
          ofertaId: ofertaId,
          metodoPagoId: metodoPagoId
        }
      });
      return relation !== null;
    } catch (error) {
      throw new Error(`Error al verificar relación existente: ${error.message}`);
    }
  };

  // Métodos CRUD
  OfertaMetodoPago.createRelation = async (data) => {
    try {
      // Verificar que no existe ya esta relación
      const existingRelation = await OfertaMetodoPago.findOne({
        where: { 
          ofertaId: data.ofertaId,
          metodoPagoId: data.metodoPagoId
        }
      });
      
      if (existingRelation) {
        throw new Error('Ya existe esta relación oferta-método de pago');
      }

      // Verificar que la oferta existe
      const oferta = await sequelize.models.Oferta.findByPk(data.ofertaId);
      if (!oferta) {
        throw new Error('La oferta especificada no existe');
      }

      // Verificar que el método de pago existe y está activo
      const metodoPago = await sequelize.models.MetodoPago.findByPk(data.metodoPagoId);
      if (!metodoPago) {
        throw new Error('El método de pago especificado no existe');
      }
      
      if (!metodoPago.activo) {
        throw new Error('El método de pago no está activo');
      }

      const nuevaRelacion = await OfertaMetodoPago.create(data);
      return await OfertaMetodoPago.getById(nuevaRelacion.id);
    } catch (error) {
      throw new Error(`Error al crear relación oferta-método de pago: ${error.message}`);
    }
  };

  OfertaMetodoPago.deleteRelation = async (id) => {
    try {
      const deletedRowsCount = await OfertaMetodoPago.destroy({
        where: { id }
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Relación oferta-método de pago no encontrada');
      }
      
      return { message: 'Relación eliminada correctamente' };
    } catch (error) {
      throw new Error(`Error al eliminar relación: ${error.message}`);
    }
  };

  OfertaMetodoPago.deleteByOfertaAndMetodo = async (ofertaId, metodoPagoId) => {
    try {
      const deletedRowsCount = await OfertaMetodoPago.destroy({
        where: { 
          ofertaId: ofertaId,
          metodoPagoId: metodoPagoId
        }
      });
      
      if (deletedRowsCount === 0) {
        throw new Error('Relación oferta-método de pago no encontrada');
      }
      
      return { message: 'Relación eliminada correctamente' };
    } catch (error) {
      throw new Error(`Error al eliminar relación específica: ${error.message}`);
    }
  };

  // Métodos para gestión masiva
  OfertaMetodoPago.addMetodosToOferta = async (ofertaId, metodosPagoIds) => {
    try {
      // Verificar que la oferta existe
      const oferta = await sequelize.models.Oferta.findByPk(ofertaId);
      if (!oferta) {
        throw new Error('La oferta especificada no existe');
      }

      const results = [];
      const errors = [];

      for (const metodoPagoId of metodosPagoIds) {
        try {
          // Verificar si ya existe la relación
          const exists = await OfertaMetodoPago.exists(ofertaId, metodoPagoId);
          if (exists) {
            errors.push({ metodoPagoId, error: 'Relación ya existe' });
            continue;
          }

          const relation = await OfertaMetodoPago.createRelation({
            ofertaId,
            metodoPagoId
          });
          
          results.push({ metodoPagoId, success: true, relation });
        } catch (error) {
          errors.push({ metodoPagoId, error: error.message });
        }
      }

      return {
        totalProcessed: metodosPagoIds.length,
        successful: results.length,
        failed: errors.length,
        results: results,
        errors: errors
      };
    } catch (error) {
      throw new Error(`Error al agregar métodos a oferta: ${error.message}`);
    }
  };

  OfertaMetodoPago.removeMetodosFromOferta = async (ofertaId, metodosPagoIds) => {
    try {
      const deletedCount = await OfertaMetodoPago.destroy({
        where: {
          ofertaId: ofertaId,
          metodoPagoId: { [Op.in]: metodosPagoIds }
        }
      });

      return {
        message: `${deletedCount} métodos de pago removidos de la oferta`,
        removedCount: deletedCount,
        requestedCount: metodosPagoIds.length
      };
    } catch (error) {
      throw new Error(`Error al remover métodos de oferta: ${error.message}`);
    }
  };

  OfertaMetodoPago.replaceMetodosOferta = async (ofertaId, newMetodosPagoIds) => {
    try {
      // Primero eliminar todos los métodos actuales
      await OfertaMetodoPago.destroy({
        where: { ofertaId: ofertaId }
      });

      // Luego agregar los nuevos métodos
      const result = await OfertaMetodoPago.addMetodosToOferta(ofertaId, newMetodosPagoIds);
      
      return {
        message: 'Métodos de pago de la oferta actualizados',
        ...result
      };
    } catch (error) {
      throw new Error(`Error al reemplazar métodos de oferta: ${error.message}`);
    }
  };

  // Métodos de estadísticas
  OfertaMetodoPago.getStats = async () => {
    try {
      const totalRelations = await OfertaMetodoPago.count();
      
      // Métodos de pago más populares
      const metodosPopulares = await OfertaMetodoPago.findAll({
        attributes: [
          'metodoPagoId',
          [sequelize.fn('COUNT', sequelize.col('metodoPagoId')), 'count']
        ],
        include: [
          {
            model: sequelize.models.MetodoPago,
            as: 'metodoPago',
            attributes: ['nombre', 'activo']
          }
        ],
        group: ['metodoPagoId', 'metodoPago.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('metodoPagoId')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Ofertas con más métodos de pago
      const ofertasConMasMetodos = await OfertaMetodoPago.findAll({
        attributes: [
          'ofertaId',
          [sequelize.fn('COUNT', sequelize.col('ofertaId')), 'count']
        ],
        include: [
          {
            model: sequelize.models.Oferta,
            as: 'oferta',
            attributes: ['titulo', 'tipo', 'estado']
          }
        ],
        group: ['ofertaId', 'oferta.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('ofertaId')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Distribución por tipo de oferta
      const distribucionPorTipo = await OfertaMetodoPago.findAll({
        attributes: [
          [sequelize.col('oferta.tipo'), 'tipoOferta'],
          [sequelize.fn('COUNT', sequelize.col('OfertaMetodoPago.id')), 'count']
        ],
        include: [
          {
            model: sequelize.models.Oferta,
            as: 'oferta',
            attributes: []
          }
        ],
        group: ['oferta.tipo'],
        raw: true
      });

      return {
        totalRelaciones: totalRelations,
        metodosPopulares: metodosPopulares,
        ofertasConMasMetodos: ofertasConMasMetodos,
        distribucionPorTipo: distribucionPorTipo
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // Método para validar compatibilidad
  OfertaMetodoPago.validateCompatibility = async (ofertaId, metodoPagoId) => {
    try {
      // Verificar que la oferta existe y está activa
      const oferta = await sequelize.models.Oferta.findByPk(ofertaId);
      if (!oferta) {
        throw new Error('Oferta no encontrada');
      }

      if (oferta.estado !== 'activa') {
        throw new Error('La oferta no está activa');
      }

      // Verificar que el método de pago existe y está activo
      const metodoPago = await sequelize.models.MetodoPago.findByPk(metodoPagoId);
      if (!metodoPago) {
        throw new Error('Método de pago no encontrado');
      }

      if (!metodoPago.activo) {
        throw new Error('El método de pago no está activo');
      }

      // Verificar si ya existe la relación
      const exists = await OfertaMetodoPago.exists(ofertaId, metodoPagoId);
      
      return {
        compatible: true,
        exists: exists,
        oferta: oferta,
        metodoPago: metodoPago,
        message: exists ? 'Relación ya existe' : 'Compatible para crear relación'
      };
    } catch (error) {
      return {
        compatible: false,
        message: error.message
      };
    }
  };

  // Método para obtener métodos disponibles para una oferta
  OfertaMetodoPago.getAvailableMetodos = async (ofertaId) => {
    try {
      // Obtener todos los métodos activos
      const todosMetodos = await sequelize.models.MetodoPago.findAll({
        where: { activo: true },
        attributes: ['id', 'nombre', 'descripcion']
      });

      // Obtener métodos ya asignados a esta oferta
      const metodosAsignados = await OfertaMetodoPago.findAll({
        where: { ofertaId: ofertaId },
        attributes: ['metodoPagoId']
      });

      const idsAsignados = metodosAsignados.map(m => m.metodoPagoId);
      
      // Filtrar métodos disponibles (no asignados)
      const metodosDisponibles = todosMetodos.filter(
        metodo => !idsAsignados.includes(metodo.id)
      );

      return {
        disponibles: metodosDisponibles,
        yaAsignados: idsAsignados.length,
        totalDisponibles: metodosDisponibles.length
      };
    } catch (error) {
      throw new Error(`Error al obtener métodos disponibles: ${error.message}`);
    }
  };

  return OfertaMetodoPago;
}

module.exports = createOfertaMetodoPagoModel;