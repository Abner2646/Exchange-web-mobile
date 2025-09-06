const { OfertaMetodoPago } = require('../models/index.js');

// Listar relaciones oferta-método de pago
const getOfertaMetodosPago = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await OfertaMetodoPago.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener relación por ID
const getOfertaMetodoPagoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await OfertaMetodoPago.getById(id);
    if (!result) return res.status(404).json({ error: 'Relación no encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva relación oferta-método de pago
const createOfertaMetodoPago = async (req, res) => {
  try {
    const { ofertaId, metodoPagoId } = req.body;
    
    if (!ofertaId || !metodoPagoId) {
      return res.status(400).json({ 
        error: 'Los campos ofertaId y metodoPagoId son requeridos' 
      });
    }

    const nuevaRelacion = await OfertaMetodoPago.createRelation({
      ofertaId,
      metodoPagoId
    });
    
    res.status(201).json({ 
      message: 'Método de pago agregado a la oferta exitosamente', 
      data: nuevaRelacion 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar relación por ID
const deleteOfertaMetodoPago = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await OfertaMetodoPago.deleteRelation(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar relación específica por oferta y método
const deleteOfertaMetodoEspecifico = async (req, res) => {
  try {
    const { ofertaId, metodoPagoId } = req.params;
    const result = await OfertaMetodoPago.deleteByOfertaAndMetodo(ofertaId, metodoPagoId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener métodos de pago de una oferta específica
const getMetodosPagoByOferta = async (req, res) => {
  try {
    const { ofertaId } = req.params;
    const { includeInactive = false } = req.query;
    
    const metodosPago = await OfertaMetodoPago.getByOferta(ofertaId);
    res.json(metodosPago);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener ofertas que usan un método de pago específico
const getOfertasByMetodoPago = async (req, res) => {
  try {
    const { metodoPagoId } = req.params;
    const ofertas = await OfertaMetodoPago.getByMetodoPago(metodoPagoId);
    res.json(ofertas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener relaciones completas de una oferta
const getOfertaMetodosPagoCompleto = async (req, res) => {
  try {
    const { ofertaId } = req.params;
    const { includeInactive = false } = req.query;
    
    const relations = await OfertaMetodoPago.getOfertaMetodosPago(
      ofertaId, 
      includeInactive === 'true'
    );
    
    res.json({
      ofertaId: ofertaId,
      metodosPago: relations,
      count: relations.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verificar si existe relación específica
const checkRelationExists = async (req, res) => {
  try {
    const { ofertaId, metodoPagoId } = req.params;
    const exists = await OfertaMetodoPago.exists(ofertaId, metodoPagoId);
    
    res.json({
      exists: exists,
      ofertaId: ofertaId,
      metodoPagoId: metodoPagoId,
      message: exists ? 'La relación existe' : 'La relación no existe'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Agregar múltiples métodos de pago a una oferta
const addMultipleMetodos = async (req, res) => {
  try {
    const { ofertaId } = req.params;
    const { metodosPagoIds } = req.body;
    
    if (!Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
      return res.status(400).json({ 
        error: 'Se requiere un array de IDs de métodos de pago' 
      });
    }

    const result = await OfertaMetodoPago.addMetodosToOferta(ofertaId, metodosPagoIds);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Remover múltiples métodos de pago de una oferta
const removeMultipleMetodos = async (req, res) => {
  try {
    const { ofertaId } = req.params;
    const { metodosPagoIds } = req.body;
    
    if (!Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
      return res.status(400).json({ 
        error: 'Se requiere un array de IDs de métodos de pago' 
      });
    }

    const result = await OfertaMetodoPago.removeMetodosFromOferta(ofertaId, metodosPagoIds);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Reemplazar todos los métodos de pago de una oferta
const replaceMetodosOferta = async (req, res) => {
  try {
    const { ofertaId } = req.params;
    const { metodosPagoIds } = req.body;
    
    if (!Array.isArray(metodosPagoIds)) {
      return res.status(400).json({ 
        error: 'Se requiere un array de IDs de métodos de pago (puede estar vacío)' 
      });
    }

    const result = await OfertaMetodoPago.replaceMetodosOferta(ofertaId, metodosPagoIds);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener estadísticas de relaciones
const getOfertaMetodoPagoStats = async (req, res) => {
  try {
    const stats = await OfertaMetodoPago.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Validar compatibilidad entre oferta y método de pago
const validateCompatibility = async (req, res) => {
  try {
    const { ofertaId, metodoPagoId } = req.params;
    const result = await OfertaMetodoPago.validateCompatibility(ofertaId, metodoPagoId);
    
    if (result.compatible) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener métodos de pago disponibles para una oferta
const getAvailableMetodos = async (req, res) => {
  try {
    const { ofertaId } = req.params;
    const result = await OfertaMetodoPago.getAvailableMetodos(ofertaId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Dashboard de relaciones oferta-método de pago
const getOfertaMetodosDashboard = async (req, res) => {
  try {
    const stats = await OfertaMetodoPago.getStats();
    
    res.json({
      estadisticas: {
        totalRelaciones: stats.totalRelaciones,
        metodosPopulares: stats.metodosPopulares.slice(0, 5),
        ofertasConMasMetodos: stats.ofertasConMasMetodos.slice(0, 5)
      },
      distribucion: {
        porTipoOferta: stats.distribucionPorTipo,
        metodoMasPopular: stats.metodosPopulares[0] || null,
        ofertaConMasMetodos: stats.ofertasConMasMetodos[0] || null
      },
      insights: {
        promedioMetodosPorOferta: stats.totalRelaciones > 0 
          ? (stats.totalRelaciones / (stats.ofertasConMasMetodos.length || 1)).toFixed(2)
          : 0,
        diversidadMetodos: stats.metodosPopulares.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener resumen rápido de una oferta
const getOfertaSummary = async (req, res) => {
  try {
    const { ofertaId } = req.params;
    
    const metodosPago = await OfertaMetodoPago.getByOferta(ofertaId);
    const metodosDisponibles = await OfertaMetodoPago.getAvailableMetodos(ofertaId);
    
    res.json({
      ofertaId: ofertaId,
      metodosAsignados: {
        count: metodosPago.length,
        metodos: metodosPago.map(m => ({
          id: m.id,
          nombre: m.nombre
        }))
      },
      metodosDisponibles: {
        count: metodosDisponibles.totalDisponibles,
        hayDisponibles: metodosDisponibles.totalDisponibles > 0
      },
      estado: {
        tienemetodos: metodosPago.length > 0,
        puedeAgregarMas: metodosDisponibles.totalDisponibles > 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Clonar métodos de pago de una oferta a otra
const cloneMetodosToOferta = async (req, res) => {
  try {
    const { sourceOfertaId, targetOfertaId } = req.body;
    
    if (!sourceOfertaId || !targetOfertaId) {
      return res.status(400).json({ 
        error: 'sourceOfertaId y targetOfertaId son requeridos' 
      });
    }

    if (sourceOfertaId === targetOfertaId) {
      return res.status(400).json({ 
        error: 'Las ofertas origen y destino deben ser diferentes' 
      });
    }

    // Obtener métodos de la oferta origen
    const metodosPago = await OfertaMetodoPago.getByOferta(sourceOfertaId);
    const metodosPagoIds = metodosPago.map(m => m.id);

    if (metodosPagoIds.length === 0) {
      return res.status(400).json({ 
        error: 'La oferta origen no tiene métodos de pago para clonar' 
      });
    }

    // Agregar métodos a la oferta destino
    const result = await OfertaMetodoPago.addMetodosToOferta(targetOfertaId, metodosPagoIds);
    
    res.json({
      message: `Métodos de pago clonados de oferta ${sourceOfertaId} a oferta ${targetOfertaId}`,
      sourceOfertaId: sourceOfertaId,
      targetOfertaId: targetOfertaId,
      metodosClonados: metodosPagoIds.length,
      resultado: result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Exportar relaciones a CSV
const exportOfertaMetodosPago = async (req, res) => {
  try {
    const filters = { ...req.query };
    const relaciones = await OfertaMetodoPago.getAll(filters);
    
    // Convertir a formato CSV
    const csvHeader = 'ID,Oferta ID,Oferta Titulo,Oferta Tipo,Metodo Pago ID,Metodo Pago Nombre,Metodo Activo\n';
    const csvData = relaciones.map(relacion => {
      return [
        relacion.id,
        relacion.ofertaId,
        relacion.oferta ? relacion.oferta.titulo : '',
        relacion.oferta ? relacion.oferta.tipo : '',
        relacion.metodoPagoId,
        relacion.metodoPago ? relacion.metodoPago.nombre : '',
        relacion.metodoPago ? (relacion.metodoPago.activo ? 'SI' : 'NO') : ''
      ].join(',');
    }).join('\n');
    
    const csv = csvHeader + csvData;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="oferta_metodos_pago.csv"');
    res.send(csv);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener métricas de uso de métodos de pago
const getMetodosUsageMetrics = async (req, res) => {
  try {
    const { timeframe = '30 days' } = req.query;
    
    const stats = await OfertaMetodoPago.getStats();
    
    // Calcular porcentajes de uso
    const totalRelaciones = stats.totalRelaciones;
    const metodosConPorcentajes = stats.metodosPopulares.map(metodo => ({
      ...metodo,
      porcentajeUso: totalRelaciones > 0 
        ? ((metodo.dataValues.count / totalRelaciones) * 100).toFixed(2) + '%'
        : '0%'
    }));

    res.json({
      periodo: timeframe,
      metricas: {
        totalRelaciones: totalRelaciones,
        metodosUnicos: metodosConPorcentajes.length,
        ofertasConMetodos: stats.ofertasConMasMetodos.length
      },
      metodosPopulares: metodosConPorcentajes.slice(0, 10),
      distribucionTipos: stats.distribucionPorTipo,
      insights: {
        metodoMasUsado: metodosConPorcentajes[0] || null,
        diversidadOfertas: stats.ofertasConMasMetodos.length,
        promedioMetodosPorOferta: stats.ofertasConMasMetodos.length > 0
          ? (totalRelaciones / stats.ofertasConMasMetodos.length).toFixed(1)
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Validar setup completo de oferta
const validateOfertaSetup = async (req, res) => {
  try {
    const { ofertaId } = req.params;
    
    const metodosPago = await OfertaMetodoPago.getByOferta(ofertaId);
    const metodosDisponibles = await OfertaMetodoPago.getAvailableMetodos(ofertaId);
    
    const validationResult = {
      ofertaId: ofertaId,
      setup: {
        tienemetodos: metodosPago.length > 0,
        cantidadMetodos: metodosPago.length,
        metodosActivos: metodosPago.filter(m => m.activo).length
      },
      validacion: {
        completa: metodosPago.length > 0,
        warnings: [],
        recomendaciones: []
      }
    };

    // Validaciones y recomendaciones
    if (metodosPago.length === 0) {
      validationResult.validacion.warnings.push('La oferta no tiene métodos de pago asignados');
      validationResult.validacion.recomendaciones.push('Agregar al menos un método de pago activo');
    }

    if (metodosPago.length === 1) {
      validationResult.validacion.recomendaciones.push('Considerar agregar más métodos de pago para mayor flexibilidad');
    }

    if (metodosPago.some(m => !m.activo)) {
      const inactivos = metodosPago.filter(m => !m.activo).length;
      validationResult.validacion.warnings.push(`${inactivos} método(s) de pago inactivo(s) asignado(s)`);
    }

    if (metodosDisponibles.totalDisponibles > 0) {
      validationResult.validacion.recomendaciones.push(
        `Hay ${metodosDisponibles.totalDisponibles} método(s) de pago adicional(es) disponible(s)`
      );
    }

    res.json(validationResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getOfertaMetodosPago,
  getOfertaMetodoPagoById,
  createOfertaMetodoPago,
  deleteOfertaMetodoPago,
  deleteOfertaMetodoEspecifico,
  getMetodosPagoByOferta,
  getOfertasByMetodoPago,
  getOfertaMetodosPagoCompleto,
  checkRelationExists,
  addMultipleMetodos,
  removeMultipleMetodos,
  replaceMetodosOferta,
  getOfertaMetodoPagoStats,
  validateCompatibility,
  getAvailableMetodos,
  getOfertaMetodosDashboard,
  getOfertaSummary,
  cloneMetodosToOferta,
  exportOfertaMetodosPago,
  getMetodosUsageMetrics,
  validateOfertaSetup
};