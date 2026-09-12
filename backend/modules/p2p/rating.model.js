// Importaciones
const initValoracion = require('./rating.entity');
const { Op } = require('sequelize');

function createValoracionModel(sequelize) {
  const Rating = initValoracion(sequelize);

  // Métodos de creación y validación
  Rating.createValoracion = async (data) => {
    const { 
      p2pTransactionId, 
      raterId, 
      ratedUserId, 
      score, 
      comment 
    } = data;

    // Validar que el evaluador y evaluado sean diferentes
    if (raterId === ratedUserId) {
      throw new Error('Un usuario no puede valorarse a sí mismo');
    }

    // Validar puntuación
    if (score < 1 || score > 5) {
      throw new Error('La puntuación debe estar entre 1 y 5');
    }

    const transaction = await sequelize.transaction();
    
    try {
      // Verificar que la transacción existe y está completada
      const { P2PTransaction } = require('../../models/index');
      const transaccion = await P2PTransaction.findByPk(p2pTransactionId, { transaction });
      
      if (!transaccion) {
        throw new Error('Transacción no encontrada');
      }

      if (transaccion.status !== 'completed') {
        throw new Error('Solo se pueden valorar transacciones completadas');
      }

      // Verificar que el usuario evaluador participó en la transacción
      if (transaccion.buyerId !== raterId && 
          transaccion.sellerId !== raterId) {
        throw new Error('Solo los participantes de la transacción pueden valorar');
      }

      // Verificar que el usuario evaluado también participó
      if (transaccion.buyerId !== ratedUserId && 
          transaccion.sellerId !== ratedUserId) {
        throw new Error('Solo se puede valorar a participantes de la transacción');
      }

      // Verificar que no existe una valoración previa con esta combinación
      const valoracionExistente = await Rating.findOne({
        where: {
          p2pTransactionId,
          raterId,
          ratedUserId
        },
        transaction
      });

      if (valoracionExistente) {
        throw new Error('Ya existe una valoración para esta combinación');
      }

      // Crear la valoración
      const nuevaValoracion = await Rating.create({
        p2pTransactionId,
        raterId,
        ratedUserId,
        score,
        comment
      }, { transaction });

      // Actualizar la reputación del usuario evaluado
      await Rating.updateUserReputation(ratedUserId, transaction);

      await transaction.commit();
      return await Rating.getById(nuevaValoracion.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  // Métodos de consulta
  Rating.getById = async (id) => {
    return await Rating.findByPk(id, {
      include: [
        {
          association: 'transaction',
          attributes: ['id', 'status', 'fiatAmount', 'created_at']
        },
        {
          association: 'rater',
          attributes: ['id', 'username']
        },
        {
          association: 'ratedUser',
          attributes: ['id', 'username', 'averageRating']
        }
      ]
    });
  };

  Rating.getAll = async (filters = {}) => {
    const {
      raterId,
      ratedUserId,
      p2pTransactionId,
      puntuacionMin,
      puntuacionMax,
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
    if (raterId) where.raterId = raterId;
    if (ratedUserId) where.ratedUserId = ratedUserId;
    if (p2pTransactionId) where.p2pTransactionId = p2pTransactionId;

    // Filtros de puntuación
    if (puntuacionMin || puntuacionMax) {
      where.score = {};
      if (puntuacionMin) where.score[Op.gte] = puntuacionMin;
      if (puntuacionMax) where.score[Op.lte] = puntuacionMax;
    }

    // Filtros de fecha
    if (fechaDesde || fechaHasta) {
      where.created_at = {};
      if (fechaDesde) where.created_at[Op.gte] = new Date(fechaDesde);
      if (fechaHasta) where.created_at[Op.lte] = new Date(fechaHasta);
    }

    const { count, rows } = await Rating.findAndCountAll({
      where,
      include: [
        {
          association: 'transaction',
          attributes: ['id', 'fiatAmount', 'created_at']
        },
        {
          association: 'rater',
          attributes: ['id', 'username']
        },
        {
          association: 'ratedUser',
          attributes: ['id', 'username']
        }
      ],
      order: [[orderBy, orderDirection]],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    return {
      valoraciones: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  };

  // Métodos específicos de valoraciones
  Rating.getUserRatings = async (userId, filters = {}) => {
    const { page = 1, limit = 20, type = 'recibidas' } = filters;
    const offset = (page - 1) * limit;

    const whereField = type === 'recibidas' ? 'ratedUserId' : 'raterId';
    
    const { count, rows } = await Rating.findAndCountAll({
      where: { [whereField]: userId },
      include: [
        {
          association: 'transaction',
          attributes: ['id', 'fiatAmount', 'created_at'],
          include: [
            {
              association: 'crypto',
              attributes: ['simbolo']
            }
          ]
        },
        {
          association: type === 'recibidas' ? 'rater' : 'ratedUser',
          attributes: ['id', 'username']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
      distinct: true
    });

    return {
      valoraciones: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    };
  };

  Rating.getUserReputationStats = async (userId) => {
    const stats = await Rating.findAll({
      attributes: [
        'score',
        [sequelize.fn('COUNT', sequelize.col('score')), 'amount']
      ],
      where: { ratedUserId: userId },
      group: ['score'],
      order: [['score', 'ASC']],
      raw: true
    });

    const summary = await Rating.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalRatings'],
        [sequelize.fn('AVG', sequelize.col('score')), 'puntuacionPromedio'],
        [sequelize.fn('MIN', sequelize.col('score')), 'puntuacionMinima'],
        [sequelize.fn('MAX', sequelize.col('score')), 'puntuacionMaxima']
      ],
      where: { ratedUserId: userId },
      raw: true
    });

    return {
      distribuccionPuntuaciones: stats,
      resumen: summary
    };
  };

  Rating.getPendingRatings = async (userId) => {
    // Obtener transacciones completadas donde el usuario participó pero no valoró
    const { P2PTransaction } = require('../../models/index');
    
    const transaccionesCompletadas = await P2PTransaction.findAll({
      where: {
        [Op.or]: [
          { buyerId: userId },
          { sellerId: userId }
        ],
        status: 'completed'
      },
      include: [
        {
          association: 'ratings',
          where: { raterId: userId },
          required: false
        },
        {
          association: 'buyer',
          attributes: ['id', 'username']
        },
        {
          association: 'seller',
          attributes: ['id', 'username']
        },
        {
          association: 'crypto',
          attributes: ['simbolo']
        }
      ]
    });

    // Filtrar transacciones donde no existe valoración del usuario
    const pendientes = transaccionesCompletadas.filter(tx => {
      return tx.ratings.length === 0;
    }).map(tx => {
      const otroUsuario = tx.buyerId === userId ? tx.seller : tx.buyer;
      return {
        transaccionId: tx.id,
        usuarioAValorar: otroUsuario,
        fiatAmount: tx.fiatAmount,
        crypto: tx.crypto.simbolo,
        fechaTransaccion: tx.created_at
      };
    });

    return pendientes;
  };

  // Método para actualizar reputación del usuario
  Rating.updateUserReputation = async (userId, transaction = null) => {
    const stats = await Rating.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('score')), 'puntuacionPromedio']
      ],
      where: { ratedUserId: userId },
      raw: true,
      transaction
    });

    if (stats && stats.puntuacionPromedio) {
      const { User } = require('../../models/index');
      await User.update(
        { reputacion: parseFloat(stats.puntuacionPromedio).toFixed(2) },
        { 
          where: { id: userId },
          transaction
        }
      );
    }
  };

  // Métodos de consulta por transacción
  Rating.getTransactionRatings = async (p2pTransactionId) => {
    return await Rating.findAll({
      where: { p2pTransactionId },
      include: [
        {
          association: 'rater',
          attributes: ['id', 'username']
        },
        {
          association: 'ratedUser',
          attributes: ['id', 'username']
        }
      ],
      order: [['created_at', 'DESC']]
    });
  };

  Rating.canUserRate = async (p2pTransactionId, raterId, ratedUserId) => {
    // Verificar si ya existe una valoración
    const existeValoracion = await Rating.findOne({
      where: {
        p2pTransactionId,
        raterId,
        ratedUserId
      }
    });

    if (existeValoracion) {
      return { canRate: false, reason: 'Ya has valorado esta transacción' };
    }

    // Verificar que la transacción esté completada y el usuario haya participado
    const { P2PTransaction } = require('../../models/index');
    const transaccion = await P2PTransaction.findByPk(p2pTransactionId);
    
    if (!transaccion) {
      return { canRate: false, reason: 'Transacción no encontrada' };
    }

    if (transaccion.status !== 'completed') {
      return { canRate: false, reason: 'La transacción debe estar completada' };
    }

    if (transaccion.buyerId !== raterId && 
        transaccion.sellerId !== raterId) {
      return { canRate: false, reason: 'No participaste en esta transacción' };
    }

    return { canRate: true };
  };

  // Métodos de estadísticas generales
  Rating.getGeneralStats = async (filters = {}) => {
    const where = {};
    
    if (filters.fechaDesde || filters.fechaHasta) {
      where.created_at = {};
      if (filters.fechaDesde) where.created_at[Op.gte] = new Date(filters.fechaDesde);
      if (filters.fechaHasta) where.created_at[Op.lte] = new(filters.fechaHasta);
    }

    const stats = await Rating.findAll({
      attributes: [
        'score',
        [sequelize.fn('COUNT', sequelize.col('score')), 'amount']
      ],
      where,
      group: ['score'],
      order: [['score', 'ASC']],
      raw: true
    });

    const summary = await Rating.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalRatings'],
        [sequelize.fn('AVG', sequelize.col('score')), 'puntuacionPromedio']
      ],
      where,
      raw: true
    });

    return {
      distribuccionPuntuaciones: stats,
      resumen: summary
    };
  };

  Rating.updateValoracion = async (id, data, userId) => {
    const valoracion = await Rating.findByPk(id);
    if (!valoracion) {
      throw new Error('Valoración no encontrada');
    }

    // Solo el evaluador puede modificar su valoración
    if (valoracion.raterId !== userId) {
      throw new Error('No tienes permiso para modificar esta valoración');
    }

    // Validar puntuación si se proporciona
    if (data.score && (data.score < 1 || data.score > 5)) {
      throw new Error('La puntuación debe estar entre 1 y 5');
    }

    const transaction = await sequelize.transaction();
    
    try {
      await valoracion.update(data, { transaction });
      
      // Recalcular reputación del usuario evaluado
      await Rating.updateUserReputation(valoracion.ratedUserId, transaction);
      
      await transaction.commit();
      return await Rating.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  return Rating;
}

module.exports = createValoracionModel;