// Importaciones
const initOfertaMetodoPago = require('./offerPaymentMethod.entity');
const { Op } = require('sequelize');

function createOfertaMetodoPagoModel(sequelize) {
  const OfferPaymentMethod = initOfertaMetodoPago(sequelize);

  // Métodos de consulta básicos
  OfferPaymentMethod.getById = async (id) => {
    try {
      const ofertaMetodo = await OfferPaymentMethod.findByPk(id, {
        include: [
          {
            model: sequelize.models.Oferta,
            as: 'offer',
            attributes: ['id', 'titulo', 'type', 'status', 'userId']
          },
          {
            model: sequelize.models.PaymentMethod,
            as: 'paymentMethod',
            attributes: ['id', 'name', 'description', 'active']
          }
        ]
      });
      return ofertaMetodo;
    } catch (error) {
      throw new Error(`Error al obtener oferta-método de pago por ID: ${error.message}`);
    }
  };

  OfferPaymentMethod.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      
      // Filtros disponibles
      if (filters.offerId) {
        whereClause.offerId = filters.offerId;
      }
      
      if (filters.paymentMethodId) {
        whereClause.paymentMethodId = filters.paymentMethodId;
      }

      const ofertaMetodos = await OfferPaymentMethod.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Oferta,
            as: 'offer',
            attributes: ['id', 'titulo', 'type', 'status']
          },
          {
            model: sequelize.models.PaymentMethod,
            as: 'paymentMethod',
            attributes: ['id', 'name', 'description', 'active']
          }
        ],
        order: [['offerId', 'ASC'], ['paymentMethodId', 'ASC']]
      });
      
      return ofertaMetodos;
    } catch (error) {
      throw new Error(`Error al obtener relaciones oferta-método de pago: ${error.message}`);
    }
  };

  // Métodos específicos para relaciones oferta-método pago
  OfferPaymentMethod.getByOferta = async (offerId) => {
    try {
      const metodosPago = await OfferPaymentMethod.findAll({
        where: { offerId: offerId },
        include: [
          {
            model: sequelize.models.PaymentMethod,
            as: 'paymentMethod',
            attributes: ['id', 'name', 'description', 'active'],
            where: { active: true }, // Solo métodos activos
            required: true
          }
        ],
        order: [['paymentMethod', 'name', 'ASC']]
      });
      
      return metodosPago.map(om => om.paymentMethod);
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago por oferta: ${error.message}`);
    }
  };

  OfferPaymentMethod.getByMetodoPago = async (paymentMethodId) => {
    try {
      const ofertas = await OfferPaymentMethod.findAll({
        where: { paymentMethodId: paymentMethodId },
        include: [
          {
            model: sequelize.models.Oferta,
            as: 'offer',
            attributes: ['id', 'titulo', 'type', 'status', 'userId'],
            where: { status: { [Op.in]: ['activa', 'pendiente'] } }, // Solo ofertas activas
            required: true
          }
        ],
        order: [['offer', 'titulo', 'ASC']]
      });
      
      return ofertas.map(om => om.offer);
    } catch (error) {
      throw new Error(`Error al obtener ofertas por método de pago: ${error.message}`);
    }
  };

  OfferPaymentMethod.getOfertaMetodosPago = async (offerId, includeInactive = false) => {
    try {
      const whereMetodo = includeInactive ? {} : { active: true };
      
      const relations = await OfferPaymentMethod.findAll({
        where: { offerId: offerId },
        include: [
          {
            model: sequelize.models.PaymentMethod,
            as: 'paymentMethod',
            attributes: ['id', 'name', 'description', 'active'],
            where: whereMetodo,
            required: true
          },
          {
            model: sequelize.models.Oferta,
            as: 'offer',
            attributes: ['id', 'titulo', 'type', 'status']
          }
        ],
        order: [['paymentMethod', 'name', 'ASC']]
      });
      
      return relations;
    } catch (error) {
      throw new Error(`Error al obtener métodos de pago de oferta: ${error.message}`);
    }
  };

  OfferPaymentMethod.exists = async (offerId, paymentMethodId) => {
    try {
      const relation = await OfferPaymentMethod.findOne({
        where: { 
          offerId: offerId,
          paymentMethodId: paymentMethodId
        }
      });
      return relation !== null;
    } catch (error) {
      throw new Error(`Error al verificar relación existente: ${error.message}`);
    }
  };

  // Métodos CRUD
  OfferPaymentMethod.createRelation = async (data) => {
    try {
      // Verificar que no existe ya esta relación
      const existingRelation = await OfferPaymentMethod.findOne({
        where: { 
          offerId: data.offerId,
          paymentMethodId: data.paymentMethodId
        }
      });
      
      if (existingRelation) {
        throw new Error('Ya existe esta relación oferta-método de pago');
      }

      // Verificar que la oferta existe
      const oferta = await sequelize.models.Oferta.findByPk(data.offerId);
      if (!oferta) {
        throw new Error('La oferta especificada no existe');
      }

      // Verificar que el método de pago existe y está active
      const metodoPago = await sequelize.models.PaymentMethod.findByPk(data.paymentMethodId);
      if (!metodoPago) {
        throw new Error('El método de pago especificado no existe');
      }
      
      if (!metodoPago.active) {
        throw new Error('El método de pago no está activo');
      }

      const nuevaRelacion = await OfferPaymentMethod.create(data);
      return await OfferPaymentMethod.getById(nuevaRelacion.id);
    } catch (error) {
      throw new Error(`Error al crear relación oferta-método de pago: ${error.message}`);
    }
  };

  OfferPaymentMethod.deleteRelation = async (id) => {
    try {
      const deletedRowsCount = await OfferPaymentMethod.destroy({
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

  OfferPaymentMethod.deleteByOfertaAndMetodo = async (offerId, paymentMethodId) => {
    try {
      const deletedRowsCount = await OfferPaymentMethod.destroy({
        where: { 
          offerId: offerId,
          paymentMethodId: paymentMethodId
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
  OfferPaymentMethod.addMetodosToOferta = async (offerId, metodosPagoIds) => {
    try {
      // Verificar que la oferta existe
      const oferta = await sequelize.models.Oferta.findByPk(offerId);
      if (!oferta) {
        throw new Error('La oferta especificada no existe');
      }

      const results = [];
      const errors = [];

      for (const paymentMethodId of metodosPagoIds) {
        try {
          // Verificar si ya existe la relación
          const exists = await OfferPaymentMethod.exists(offerId, paymentMethodId);
          if (exists) {
            errors.push({ paymentMethodId, error: 'Relación ya existe' });
            continue;
          }

          const relation = await OfferPaymentMethod.createRelation({
            offerId,
            paymentMethodId
          });
          
          results.push({ paymentMethodId, success: true, relation });
        } catch (error) {
          errors.push({ paymentMethodId, error: error.message });
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

  OfferPaymentMethod.removeMetodosFromOferta = async (offerId, metodosPagoIds) => {
    try {
      const deletedCount = await OfferPaymentMethod.destroy({
        where: {
          offerId: offerId,
          paymentMethodId: { [Op.in]: metodosPagoIds }
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

  OfferPaymentMethod.replaceMetodosOferta = async (offerId, newMetodosPagoIds) => {
    try {
      // Primero eliminar todos los métodos actuales
      await OfferPaymentMethod.destroy({
        where: { offerId: offerId }
      });

      // Luego agregar los nuevos métodos
      const result = await OfferPaymentMethod.addMetodosToOferta(offerId, newMetodosPagoIds);
      
      return {
        message: 'Métodos de pago de la oferta actualizados',
        ...result
      };
    } catch (error) {
      throw new Error(`Error al reemplazar métodos de oferta: ${error.message}`);
    }
  };

  // Métodos de estadísticas
  OfferPaymentMethod.getStats = async () => {
    try {
      const totalRelations = await OfferPaymentMethod.count();
      
      // Métodos de pago más populares
      const metodosPopulares = await OfferPaymentMethod.findAll({
        attributes: [
          'paymentMethodId',
          [sequelize.fn('COUNT', sequelize.col('paymentMethodId')), 'count']
        ],
        include: [
          {
            model: sequelize.models.PaymentMethod,
            as: 'paymentMethod',
            attributes: ['name', 'active']
          }
        ],
        group: ['paymentMethodId', 'metodoPago.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('paymentMethodId')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Ofertas con más métodos de pago
      const ofertasConMasMetodos = await OfferPaymentMethod.findAll({
        attributes: [
          'offerId',
          [sequelize.fn('COUNT', sequelize.col('offerId')), 'count']
        ],
        include: [
          {
            model: sequelize.models.Oferta,
            as: 'offer',
            attributes: ['titulo', 'type', 'status']
          }
        ],
        group: ['offerId', 'oferta.id'],
        order: [[sequelize.fn('COUNT', sequelize.col('offerId')), 'DESC']],
        limit: 10,
        raw: false
      });

      // Distribución por type de oferta
      const distribucionPorTipo = await OfferPaymentMethod.findAll({
        attributes: [
          [sequelize.col('oferta.type'), 'tipoOferta'],
          [sequelize.fn('COUNT', sequelize.col('OfferPaymentMethod.id')), 'count']
        ],
        include: [
          {
            model: sequelize.models.Oferta,
            as: 'offer',
            attributes: []
          }
        ],
        group: ['oferta.type'],
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
  OfferPaymentMethod.validateCompatibility = async (offerId, paymentMethodId) => {
    try {
      // Verificar que la oferta existe y está active
      const oferta = await sequelize.models.Oferta.findByPk(offerId);
      if (!oferta) {
        throw new Error('Oferta no encontrada');
      }

      if (oferta.status !== 'activa') {
        throw new Error('La oferta no está activa');
      }

      // Verificar que el método de pago existe y está active
      const metodoPago = await sequelize.models.PaymentMethod.findByPk(paymentMethodId);
      if (!metodoPago) {
        throw new Error('Método de pago no encontrado');
      }

      if (!metodoPago.active) {
        throw new Error('El método de pago no está activo');
      }

      // Verificar si ya existe la relación
      const exists = await OfferPaymentMethod.exists(offerId, paymentMethodId);
      
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
  OfferPaymentMethod.getAvailableMetodos = async (offerId) => {
    try {
      // Obtener todos los métodos activos
      const todosMetodos = await sequelize.models.PaymentMethod.findAll({
        where: { active: true },
        attributes: ['id', 'name', 'description']
      });

      // Obtener métodos ya asignados a esta oferta
      const metodosAsignados = await OfferPaymentMethod.findAll({
        where: { offerId: offerId },
        attributes: ['paymentMethodId']
      });

      const idsAsignados = metodosAsignados.map(m => m.paymentMethodId);
      
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

  return OfferPaymentMethod;
}

module.exports = createOfertaMetodoPagoModel;