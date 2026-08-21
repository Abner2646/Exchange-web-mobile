// Importaciones
const initValoracion = require('./entities/valoracion.entity');
const { Op } = require('sequelize');

function createValoracionModel(sequelize) {
  const Valoracion = initValoracion(sequelize);

  // Métodos de creación y validación
  Valoracion.createValoracion = async (data) => {
    const { 
      transaccionP2PId, 
      usuarioEvaluadorId, 
      usuarioEvaluadoId, 
      puntuacion, 
      comentario 
    } = data;

    // Validar que el evaluador y evaluado sean diferentes
    if (usuarioEvaluadorId === usuarioEvaluadoId) {
      throw new Error('Un usuario no puede valorarse a sí mismo');
    }

    // Validar puntuación
    if (puntuacion < 1 || puntuacion > 5) {
      throw new Error('La puntuación debe estar entre 1 y 5');
    }

    const transaction = await sequelize.transaction();
    
    try {
      // Verificar que la transacción existe y está completada
      const { TransaccionP2P } = require('./index');
      const transaccion = await TransaccionP2P.findByPk(transaccionP2PId, { transaction });
      
      if (!transaccion) {
        throw new Error('Transacción no encontrada');
      }

      if (transaccion.estado !== 'completada') {
        throw new Error('Solo se pueden valorar transacciones completadas');
      }

      // Verificar que el usuario evaluador participó en la transacción
      if (transaccion.compradorId !== usuarioEvaluadorId && 
          transaccion.vendedorId !== usuarioEvaluadorId) {
        throw new Error('Solo los participantes de la transacción pueden valorar');
      }

      // Verificar que el usuario evaluado también participó
      if (transaccion.compradorId !== usuarioEvaluadoId && 
          transaccion.vendedorId !== usuarioEvaluadoId) {
        throw new Error('Solo se puede valorar a participantes de la transacción');
      }

      // Verificar que no existe una valoración previa con esta combinación
      const valoracionExistente = await Valoracion.findOne({
        where: {
          transaccionP2PId,
          usuarioEvaluadorId,
          usuarioEvaluadoId
        },
        transaction
      });

      if (valoracionExistente) {
        throw new Error('Ya existe una valoración para esta combinación');
      }

      // Crear la valoración
      const nuevaValoracion = await Valoracion.create({
        transaccionP2PId,
        usuarioEvaluadorId,
        usuarioEvaluadoId,
        puntuacion,
        comentario
      }, { transaction });

      // Actualizar la reputación del usuario evaluado
      await Valoracion.updateUserReputation(usuarioEvaluadoId, transaction);

      await transaction.commit();
      return await Valoracion.getById(nuevaValoracion.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  // Métodos de consulta
  Valoracion.getById = async (id) => {
    return await Valoracion.findByPk(id, {
      include: [
        {
          association: 'transaccion',
          attributes: ['id', 'estado', 'montoFiat', 'created_at']
        },
        {
          association: 'evaluador',
          attributes: ['id', 'username']
        },
        {
          association: 'evaluado',
          attributes: ['id', 'username', 'reputacionPromedio']
        }
      ]
    });
  };

  Valoracion.getAll = async (filters = {}) => {
    const {
      usuarioEvaluadorId,
      usuarioEvaluadoId,
      transaccionP2PId,
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
    if (usuarioEvaluadorId) where.usuarioEvaluadorId = usuarioEvaluadorId;
    if (usuarioEvaluadoId) where.usuarioEvaluadoId = usuarioEvaluadoId;
    if (transaccionP2PId) where.transaccionP2PId = transaccionP2PId;

    // Filtros de puntuación
    if (puntuacionMin || puntuacionMax) {
      where.puntuacion = {};
      if (puntuacionMin) where.puntuacion[Op.gte] = puntuacionMin;
      if (puntuacionMax) where.puntuacion[Op.lte] = puntuacionMax;
    }

    // Filtros de fecha
    if (fechaDesde || fechaHasta) {
      where.created_at = {};
      if (fechaDesde) where.created_at[Op.gte] = new Date(fechaDesde);
      if (fechaHasta) where.created_at[Op.lte] = new Date(fechaHasta);
    }

    const { count, rows } = await Valoracion.findAndCountAll({
      where,
      include: [
        {
          association: 'transaccion',
          attributes: ['id', 'montoFiat', 'created_at']
        },
        {
          association: 'evaluador',
          attributes: ['id', 'username']
        },
        {
          association: 'evaluado',
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
  Valoracion.getUserRatings = async (usuarioId, filters = {}) => {
    const { page = 1, limit = 20, tipo = 'recibidas' } = filters;
    const offset = (page - 1) * limit;

    const whereField = tipo === 'recibidas' ? 'usuarioEvaluadoId' : 'usuarioEvaluadorId';
    
    const { count, rows } = await Valoracion.findAndCountAll({
      where: { [whereField]: usuarioId },
      include: [
        {
          association: 'transaccion',
          attributes: ['id', 'montoFiat', 'created_at'],
          include: [
            {
              association: 'criptomoneda',
              attributes: ['simbolo']
            }
          ]
        },
        {
          association: tipo === 'recibidas' ? 'evaluador' : 'evaluado',
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

  Valoracion.getUserReputationStats = async (usuarioId) => {
    const stats = await Valoracion.findAll({
      attributes: [
        'puntuacion',
        [sequelize.fn('COUNT', sequelize.col('puntuacion')), 'cantidad']
      ],
      where: { usuarioEvaluadoId: usuarioId },
      group: ['puntuacion'],
      order: [['puntuacion', 'ASC']],
      raw: true
    });

    const summary = await Valoracion.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalValoraciones'],
        [sequelize.fn('AVG', sequelize.col('puntuacion')), 'puntuacionPromedio'],
        [sequelize.fn('MIN', sequelize.col('puntuacion')), 'puntuacionMinima'],
        [sequelize.fn('MAX', sequelize.col('puntuacion')), 'puntuacionMaxima']
      ],
      where: { usuarioEvaluadoId: usuarioId },
      raw: true
    });

    return {
      distribuccionPuntuaciones: stats,
      resumen: summary
    };
  };

  Valoracion.getPendingRatings = async (usuarioId) => {
    // Obtener transacciones completadas donde el usuario participó pero no valoró
    const { TransaccionP2P } = require('./index');
    
    const transaccionesCompletadas = await TransaccionP2P.findAll({
      where: {
        [Op.or]: [
          { compradorId: usuarioId },
          { vendedorId: usuarioId }
        ],
        estado: 'completada'
      },
      include: [
        {
          association: 'valoraciones',
          where: { usuarioEvaluadorId: usuarioId },
          required: false
        },
        {
          association: 'comprador',
          attributes: ['id', 'username']
        },
        {
          association: 'vendedor',
          attributes: ['id', 'username']
        },
        {
          association: 'criptomoneda',
          attributes: ['simbolo']
        }
      ]
    });

    // Filtrar transacciones donde no existe valoración del usuario
    const pendientes = transaccionesCompletadas.filter(tx => {
      return tx.valoraciones.length === 0;
    }).map(tx => {
      const otroUsuario = tx.compradorId === usuarioId ? tx.vendedor : tx.comprador;
      return {
        transaccionId: tx.id,
        usuarioAValorar: otroUsuario,
        montoFiat: tx.montoFiat,
        criptomoneda: tx.criptomoneda.simbolo,
        fechaTransaccion: tx.created_at
      };
    });

    return pendientes;
  };

  // Método para actualizar reputación del usuario
  Valoracion.updateUserReputation = async (usuarioId, transaction = null) => {
    const stats = await Valoracion.findOne({
      attributes: [
        [sequelize.fn('AVG', sequelize.col('puntuacion')), 'puntuacionPromedio']
      ],
      where: { usuarioEvaluadoId: usuarioId },
      raw: true,
      transaction
    });

    if (stats && stats.puntuacionPromedio) {
      const { Usuario } = require('./index');
      await Usuario.update(
        { reputacion: parseFloat(stats.puntuacionPromedio).toFixed(2) },
        { 
          where: { id: usuarioId },
          transaction
        }
      );
    }
  };

  // Métodos de consulta por transacción
  Valoracion.getTransactionRatings = async (transaccionP2PId) => {
    return await Valoracion.findAll({
      where: { transaccionP2PId },
      include: [
        {
          association: 'evaluador',
          attributes: ['id', 'username']
        },
        {
          association: 'evaluado',
          attributes: ['id', 'username']
        }
      ],
      order: [['created_at', 'DESC']]
    });
  };

  Valoracion.canUserRate = async (transaccionP2PId, usuarioEvaluadorId, usuarioEvaluadoId) => {
    // Verificar si ya existe una valoración
    const existeValoracion = await Valoracion.findOne({
      where: {
        transaccionP2PId,
        usuarioEvaluadorId,
        usuarioEvaluadoId
      }
    });

    if (existeValoracion) {
      return { canRate: false, reason: 'Ya has valorado esta transacción' };
    }

    // Verificar que la transacción esté completada y el usuario haya participado
    const { TransaccionP2P } = require('./index');
    const transaccion = await TransaccionP2P.findByPk(transaccionP2PId);
    
    if (!transaccion) {
      return { canRate: false, reason: 'Transacción no encontrada' };
    }

    if (transaccion.estado !== 'completada') {
      return { canRate: false, reason: 'La transacción debe estar completada' };
    }

    if (transaccion.compradorId !== usuarioEvaluadorId && 
        transaccion.vendedorId !== usuarioEvaluadorId) {
      return { canRate: false, reason: 'No participaste en esta transacción' };
    }

    return { canRate: true };
  };

  // Métodos de estadísticas generales
  Valoracion.getGeneralStats = async (filters = {}) => {
    const where = {};
    
    if (filters.fechaDesde || filters.fechaHasta) {
      where.created_at = {};
      if (filters.fechaDesde) where.created_at[Op.gte] = new Date(filters.fechaDesde);
      if (filters.fechaHasta) where.created_at[Op.lte] = new(filters.fechaHasta);
    }

    const stats = await Valoracion.findAll({
      attributes: [
        'puntuacion',
        [sequelize.fn('COUNT', sequelize.col('puntuacion')), 'cantidad']
      ],
      where,
      group: ['puntuacion'],
      order: [['puntuacion', 'ASC']],
      raw: true
    });

    const summary = await Valoracion.findOne({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'totalValoraciones'],
        [sequelize.fn('AVG', sequelize.col('puntuacion')), 'puntuacionPromedio']
      ],
      where,
      raw: true
    });

    return {
      distribuccionPuntuaciones: stats,
      resumen: summary
    };
  };

  Valoracion.updateValoracion = async (id, data, usuarioId) => {
    const valoracion = await Valoracion.findByPk(id);
    if (!valoracion) {
      throw new Error('Valoración no encontrada');
    }

    // Solo el evaluador puede modificar su valoración
    if (valoracion.usuarioEvaluadorId !== usuarioId) {
      throw new Error('No tienes permiso para modificar esta valoración');
    }

    // Validar puntuación si se proporciona
    if (data.puntuacion && (data.puntuacion < 1 || data.puntuacion > 5)) {
      throw new Error('La puntuación debe estar entre 1 y 5');
    }

    const transaction = await sequelize.transaction();
    
    try {
      await valoracion.update(data, { transaction });
      
      // Recalcular reputación del usuario evaluado
      await Valoracion.updateUserReputation(valoracion.usuarioEvaluadoId, transaction);
      
      await transaction.commit();
      return await Valoracion.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  return Valoracion;
}

module.exports = createValoracionModel;