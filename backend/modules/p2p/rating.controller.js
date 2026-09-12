const { Rating, sequelize } = require('../../models/index.js');
const { Op } = require('sequelize');
const authz = require('../../utils/authz');

// Listar valoraciones con filtros
const getValoraciones = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await Rating.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener valoración por ID
const getValoracionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Rating.getById(id);
    if (!result) return res.status(404).json({ error: 'Valoración no encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva valoración
const createValoracion = async (req, res) => {
  try {
    const raterId = req.user.id;
    const { p2pTransactionId, ratedUserId, score, comment } = req.body;

    // Verificar si el usuario puede valorar esta transacción
    const canRate = await Rating.canUserRate(p2pTransactionId, raterId, ratedUserId);
    if (!canRate.canRate) {
      return res.status(400).json({ error: canRate.reason });
    }

    const valoracionData = {
      p2pTransactionId,
      raterId,
      ratedUserId,
      score,
      comment
    };

    const nuevaValoracion = await Rating.createValoracion(valoracionData);
    res.status(201).json({
      message: 'Valoración creada exitosamente',
      data: nuevaValoracion
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar valoración
const updateValoracion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const updateData = req.body;

    const updated = await Rating.updateValoracion(id, updateData, userId);
    res.json({ 
      message: 'Valoración actualizada exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar valoración (solo admin o en casos específicos)
const deleteValoracion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const valoracion = await Rating.findByPk(id);
    if (!valoracion) {
      return res.status(404).json({ error: 'Valoración no encontrada' });
    }

    // Solo admin o el evaluador (dentro de un tiempo límite) pueden eliminar
    const canDelete = authz.isAdmin(req.user) ||
                     (valoracion.raterId === userId && 
                      new Date() - new Date(valoracion.created_at) < 24 * 60 * 60 * 1000); // 24 horas

    if (!canDelete) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta valoración' });
    }

    await valoracion.destroy();
    
    // Recalcular reputación del usuario evaluado
    await Rating.updateUserReputation(valoracion.ratedUserId);

    res.json({ message: 'Valoración eliminada exitosamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener valoraciones de un usuario (recibidas)
const getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;
    const filters = { ...req.query, type: 'recibidas' };
    
    const result = await Rating.getUserRatings(userId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener valoraciones dadas por un usuario
const getUserGivenRatings = async (req, res) => {
  try {
    const { userId } = req.params;
    const filters = { ...req.query, type: 'dadas' };
    
    const result = await Rating.getUserRatings(userId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis valoraciones recibidas
const getMyRatings = async (req, res) => {
  try {
    const userId = req.user.id;
    const filters = { ...req.query, type: 'recibidas' };
    
    const result = await Rating.getUserRatings(userId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis valoraciones dadas
const getMyGivenRatings = async (req, res) => {
  try {
    const userId = req.user.id;
    const filters = { ...req.query, type: 'dadas' };
    
    const result = await Rating.getUserRatings(userId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de reputación de un usuario
const getUserReputationStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await Rating.getUserReputationStats(userId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener valoraciones pendientes (transacciones completadas sin valorar)
const getPendingRatings = async (req, res) => {
  try {
    const userId = req.user.id;
    const pending = await Rating.getPendingRatings(userId);
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verificar si puedo valorar una transacción
const checkCanRate = async (req, res) => {
  try {
    const { p2pTransactionId, ratedUserId } = req.params;
    const raterId = req.user.id;

    const result = await Rating.canUserRate(p2pTransactionId, raterId, ratedUserId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener valoraciones de una transacción específica
const getTransactionRatings = async (req, res) => {
  try {
    const { p2pTransactionId } = req.params;
    const result = await Rating.getTransactionRatings(p2pTransactionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas generales de valoraciones (admin)
const getGeneralStats = async (req, res) => {
  try {
    const filters = req.query;
    const stats = await Rating.getGeneralStats(filters);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Valorar múltiples transacciones (batch)
const createMultipleRatings = async (req, res) => {
  try {
    const raterId = req.user.id;
    const { valoraciones } = req.body; // Array de valoraciones

    if (!Array.isArray(valoraciones) || valoraciones.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de valoraciones' });
    }

    const results = [];
    const errors = [];

    for (const valoracionData of valoraciones) {
      try {
        const data = { ...valoracionData, raterId };
        const nuevaValoracion = await Rating.createValoracion(data);
        results.push(nuevaValoracion);
      } catch (error) {
        errors.push({
          p2pTransactionId: valoracionData.p2pTransactionId,
          error: error.message
        });
      }
    }

    res.status(201).json({
      message: `${results.length} valoraciones creadas exitosamente`,
      data: {
        creadas: results,
        errores: errors
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener top usuarios mejor valorados
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Código muerto #4, extendido a
// Altos #11): esta función usaba `sequelize` y `Op` sin importarlos —
// ReferenceError garantizado si se llamaba. También pedía columnas que
// User no tiene: 'name' (el campo real es 'username') y
// 'reputacion' (el campo real es 'averageRating').
const getTopRatedUsers = async (req, res) => {
  try {
    const { limit = 10, minRatings = 5 } = req.query;

    const { User } = require('../../models/index.js');

    const topUsers = await User.findAll({
      attributes: [
        'id',
        'username',
        'averageRating',
        [sequelize.fn('COUNT', sequelize.col('valoracionesRecibidas.id')), 'totalRatings']
      ],
      include: [
        {
          association: 'ratingsReceived',
          attributes: []
        }
      ],
      group: ['User.id'],
      having: sequelize.where(
        sequelize.fn('COUNT', sequelize.col('valoracionesRecibidas.id')),
        Op.gte,
        parseInt(minRatings)
      ),
      order: [
        ['averageRating', 'DESC'],
        [sequelize.fn('COUNT', sequelize.col('valoracionesRecibidas.id')), 'DESC']
      ],
      limit: parseInt(limit),
      subQuery: false
    });

    res.json(topUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener resumen de valoraciones entre dos usuarios
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Código muerto #4, extendido a
// Altos #11): usaba Op sin importarlo, y pedía 'name' de User (el
// campo real es 'username').
const getUsersRatingSummary = async (req, res) => {
  try {
    const { usuario1Id, usuario2Id } = req.params;

    const valoraciones = await Rating.findAll({
      where: {
        [Op.or]: [
          { raterId: usuario1Id, ratedUserId: usuario2Id },
          { raterId: usuario2Id, ratedUserId: usuario1Id }
        ]
      },
      include: [
        {
          association: 'transaction',
          attributes: ['id', 'fiatAmount', 'created_at']
        },
        {
          association: 'rater',
          attributes: ['id', 'username']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(valoraciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getValoraciones,
  getValoracionById,
  createValoracion,
  updateValoracion,
  deleteValoracion,
  getUserRatings,
  getUserGivenRatings,
  getMyRatings,
  getMyGivenRatings,
  getUserReputationStats,
  getPendingRatings,
  checkCanRate,
  getTransactionRatings,
  getGeneralStats,
  createMultipleRatings,
  getTopRatedUsers,
  getUsersRatingSummary
};