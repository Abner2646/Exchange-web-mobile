const { Valoracion, sequelize } = require('../models/index.js');
const { Op } = require('sequelize');
const authz = require('../utils/authz');

// Listar valoraciones con filtros
const getValoraciones = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await Valoracion.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener valoración por ID
const getValoracionById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Valoracion.getById(id);
    if (!result) return res.status(404).json({ error: 'Valoración no encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva valoración
const createValoracion = async (req, res) => {
  try {
    const usuarioEvaluadorId = req.user.id;
    const { transaccionP2PId, usuarioEvaluadoId, puntuacion, comentario } = req.body;

    // Verificar si el usuario puede valorar esta transacción
    const canRate = await Valoracion.canUserRate(transaccionP2PId, usuarioEvaluadorId, usuarioEvaluadoId);
    if (!canRate.canRate) {
      return res.status(400).json({ error: canRate.reason });
    }

    const valoracionData = {
      transaccionP2PId,
      usuarioEvaluadorId,
      usuarioEvaluadoId,
      puntuacion,
      comentario
    };

    const nuevaValoracion = await Valoracion.createValoracion(valoracionData);
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
    const usuarioId = req.user.id;
    const updateData = req.body;

    const updated = await Valoracion.updateValoracion(id, updateData, usuarioId);
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
    const usuarioId = req.user.id;

    const valoracion = await Valoracion.findByPk(id);
    if (!valoracion) {
      return res.status(404).json({ error: 'Valoración no encontrada' });
    }

    // Solo admin o el evaluador (dentro de un tiempo límite) pueden eliminar
    const canDelete = authz.isAdmin(req.user) ||
                     (valoracion.usuarioEvaluadorId === usuarioId && 
                      new Date() - new Date(valoracion.created_at) < 24 * 60 * 60 * 1000); // 24 horas

    if (!canDelete) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta valoración' });
    }

    await valoracion.destroy();
    
    // Recalcular reputación del usuario evaluado
    await Valoracion.updateUserReputation(valoracion.usuarioEvaluadoId);

    res.json({ message: 'Valoración eliminada exitosamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener valoraciones de un usuario (recibidas)
const getUserRatings = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const filters = { ...req.query, tipo: 'recibidas' };
    
    const result = await Valoracion.getUserRatings(usuarioId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener valoraciones dadas por un usuario
const getUserGivenRatings = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const filters = { ...req.query, tipo: 'dadas' };
    
    const result = await Valoracion.getUserRatings(usuarioId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis valoraciones recibidas
const getMyRatings = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const filters = { ...req.query, tipo: 'recibidas' };
    
    const result = await Valoracion.getUserRatings(usuarioId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis valoraciones dadas
const getMyGivenRatings = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const filters = { ...req.query, tipo: 'dadas' };
    
    const result = await Valoracion.getUserRatings(usuarioId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de reputación de un usuario
const getUserReputationStats = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const stats = await Valoracion.getUserReputationStats(usuarioId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener valoraciones pendientes (transacciones completadas sin valorar)
const getPendingRatings = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const pending = await Valoracion.getPendingRatings(usuarioId);
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verificar si puedo valorar una transacción
const checkCanRate = async (req, res) => {
  try {
    const { transaccionP2PId, usuarioEvaluadoId } = req.params;
    const usuarioEvaluadorId = req.user.id;

    const result = await Valoracion.canUserRate(transaccionP2PId, usuarioEvaluadorId, usuarioEvaluadoId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener valoraciones de una transacción específica
const getTransactionRatings = async (req, res) => {
  try {
    const { transaccionP2PId } = req.params;
    const result = await Valoracion.getTransactionRatings(transaccionP2PId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas generales de valoraciones (admin)
const getGeneralStats = async (req, res) => {
  try {
    const filters = req.query;
    const stats = await Valoracion.getGeneralStats(filters);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Valorar múltiples transacciones (batch)
const createMultipleRatings = async (req, res) => {
  try {
    const usuarioEvaluadorId = req.user.id;
    const { valoraciones } = req.body; // Array de valoraciones

    if (!Array.isArray(valoraciones) || valoraciones.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de valoraciones' });
    }

    const results = [];
    const errors = [];

    for (const valoracionData of valoraciones) {
      try {
        const data = { ...valoracionData, usuarioEvaluadorId };
        const nuevaValoracion = await Valoracion.createValoracion(data);
        results.push(nuevaValoracion);
      } catch (error) {
        errors.push({
          transaccionP2PId: valoracionData.transaccionP2PId,
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
// Usuario no tiene: 'nombre' (el campo real es 'username') y
// 'reputacion' (el campo real es 'reputacionPromedio').
const getTopRatedUsers = async (req, res) => {
  try {
    const { limit = 10, minRatings = 5 } = req.query;

    const { Usuario } = require('../models/index.js');

    const topUsers = await Usuario.findAll({
      attributes: [
        'id',
        'username',
        'reputacionPromedio',
        [sequelize.fn('COUNT', sequelize.col('valoracionesRecibidas.id')), 'totalValoraciones']
      ],
      include: [
        {
          association: 'valoracionesRecibidas',
          attributes: []
        }
      ],
      group: ['Usuario.id'],
      having: sequelize.where(
        sequelize.fn('COUNT', sequelize.col('valoracionesRecibidas.id')),
        Op.gte,
        parseInt(minRatings)
      ),
      order: [
        ['reputacionPromedio', 'DESC'],
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
// Altos #11): usaba Op sin importarlo, y pedía 'nombre' de Usuario (el
// campo real es 'username').
const getUsersRatingSummary = async (req, res) => {
  try {
    const { usuario1Id, usuario2Id } = req.params;

    const valoraciones = await Valoracion.findAll({
      where: {
        [Op.or]: [
          { usuarioEvaluadorId: usuario1Id, usuarioEvaluadoId: usuario2Id },
          { usuarioEvaluadorId: usuario2Id, usuarioEvaluadoId: usuario1Id }
        ]
      },
      include: [
        {
          association: 'transaccion',
          attributes: ['id', 'montoFiat', 'created_at']
        },
        {
          association: 'evaluador',
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