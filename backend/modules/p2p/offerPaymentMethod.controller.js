const { OfferPaymentMethod } = require('../../models/index.js');

// Listar relaciones oferta-método de pago
const getOfertaMetodosPago = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await OfferPaymentMethod.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener relación por ID
const getOfertaMetodoPagoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await OfferPaymentMethod.getById(id);
    if (!result) return res.status(404).json({ error: 'Relación no encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva relación oferta-método de pago
const createOfertaMetodoPago = async (req, res) => {
  try {
    const { offerId, paymentMethodId } = req.body;
    
    if (!offerId || !paymentMethodId) {
      return res.status(400).json({ 
        error: 'Los campos offerId y paymentMethodId son requeridos' 
      });
    }

    const nuevaRelacion = await OfferPaymentMethod.createRelation({
      offerId,
      paymentMethodId
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
    const result = await OfferPaymentMethod.deleteRelation(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar relación específica por oferta y método
const deleteOfertaMetodoEspecifico = async (req, res) => {
  try {
    const { offerId, paymentMethodId } = req.params;
    const result = await OfferPaymentMethod.deleteByOfertaAndMetodo(offerId, paymentMethodId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener métodos de pago de una oferta específica
const getMetodosPagoByOferta = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { includeInactive = false } = req.query;
    
    const metodosPago = await OfferPaymentMethod.getByOferta(offerId);
    res.json(metodosPago);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener ofertas que usan un método de pago específico
const getOfertasByMetodoPago = async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const ofertas = await OfferPaymentMethod.getByMetodoPago(paymentMethodId);
    res.json(ofertas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener relaciones completas de una oferta
const getOfertaMetodosPagoCompleto = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { includeInactive = false } = req.query;
    
    const relations = await OfferPaymentMethod.getOfertaMetodosPago(
      offerId, 
      includeInactive === 'true'
    );
    
    res.json({
      offerId: offerId,
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
    const { offerId, paymentMethodId } = req.params;
    const exists = await OfferPaymentMethod.exists(offerId, paymentMethodId);
    
    res.json({
      exists: exists,
      offerId: offerId,
      paymentMethodId: paymentMethodId,
      message: exists ? 'La relación existe' : 'La relación no existe'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Agregar múltiples métodos de pago a una oferta
const addMultipleMetodos = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { metodosPagoIds } = req.body;
    
    if (!Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
      return res.status(400).json({ 
        error: 'Se requiere un array de IDs de métodos de pago' 
      });
    }

    const result = await OfferPaymentMethod.addMetodosToOferta(offerId, metodosPagoIds);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Remover múltiples métodos de pago de una oferta
const removeMultipleMetodos = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { metodosPagoIds } = req.body;
    
    if (!Array.isArray(metodosPagoIds) || metodosPagoIds.length === 0) {
      return res.status(400).json({ 
        error: 'Se requiere un array de IDs de métodos de pago' 
      });
    }

    const result = await OfferPaymentMethod.removeMetodosFromOferta(offerId, metodosPagoIds);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Reemplazar todos los métodos de pago de una oferta
const replaceMetodosOferta = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { metodosPagoIds } = req.body;
    
    if (!Array.isArray(metodosPagoIds)) {
      return res.status(400).json({ 
        error: 'Se requiere un array de IDs de métodos de pago (puede estar vacío)' 
      });
    }

    const result = await OfferPaymentMethod.replaceMetodosOferta(offerId, metodosPagoIds);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener estadísticas de relaciones
const getOfertaMetodoPagoStats = async (req, res) => {
  try {
    const stats = await OfferPaymentMethod.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Validar compatibilidad entre oferta y método de pago
const validateCompatibility = async (req, res) => {
  try {
    const { offerId, paymentMethodId } = req.params;
    const result = await OfferPaymentMethod.validateCompatibility(offerId, paymentMethodId);
    
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
    const { offerId } = req.params;
    const result = await OfferPaymentMethod.getAvailableMetodos(offerId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Dashboard de relaciones oferta-método de pago
const getOfertaMetodosDashboard = async (req, res) => {
  try {
    const stats = await OfferPaymentMethod.getStats();
    
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
    const { offerId } = req.params;
    
    const metodosPago = await OfferPaymentMethod.getByOferta(offerId);
    const metodosDisponibles = await OfferPaymentMethod.getAvailableMetodos(offerId);
    
    res.json({
      offerId: offerId,
      metodosAsignados: {
        count: metodosPago.length,
        metodos: metodosPago.map(m => ({
          id: m.id,
          name: m.name
        }))
      },
      metodosDisponibles: {
        count: metodosDisponibles.totalDisponibles,
        hayDisponibles: metodosDisponibles.totalDisponibles > 0
      },
      status: {
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
    const metodosPago = await OfferPaymentMethod.getByOferta(sourceOfertaId);
    const metodosPagoIds = metodosPago.map(m => m.id);

    if (metodosPagoIds.length === 0) {
      return res.status(400).json({ 
        error: 'La oferta origen no tiene métodos de pago para clonar' 
      });
    }

    // Agregar métodos a la oferta destino
    const result = await OfferPaymentMethod.addMetodosToOferta(targetOfertaId, metodosPagoIds);
    
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
    const relaciones = await OfferPaymentMethod.getAll(filters);
    
    // Convertir a formato CSV
    const csvHeader = 'ID,Oferta ID,Oferta Titulo,Oferta Tipo,Metodo Pago ID,Metodo Pago Nombre,Metodo Activo\n';
    const csvData = relaciones.map(relacion => {
      return [
        relacion.id,
        relacion.offerId,
        relacion.offer ? relacion.offer.titulo : '',
        relacion.offer ? relacion.offer.type : '',
        relacion.paymentMethodId,
        relacion.paymentMethod ? relacion.paymentMethod.name : '',
        relacion.paymentMethod ? (relacion.paymentMethod.active ? 'SI' : 'NO') : ''
      ].join(',');
    }).join('\n');
    
    const csv = csvHeader + csvData;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="offer_payment_methods.csv"');
    res.send(csv);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener métricas de uso de métodos de pago
const getMetodosUsageMetrics = async (req, res) => {
  try {
    const { timeframe = '30 days' } = req.query;
    
    const stats = await OfferPaymentMethod.getStats();
    
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
    const { offerId } = req.params;
    
    const metodosPago = await OfferPaymentMethod.getByOferta(offerId);
    const metodosDisponibles = await OfferPaymentMethod.getAvailableMetodos(offerId);
    
    const validationResult = {
      offerId: offerId,
      setup: {
        tienemetodos: metodosPago.length > 0,
        cantidadMetodos: metodosPago.length,
        metodosActivos: metodosPago.filter(m => m.active).length
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

    if (metodosPago.some(m => !m.active)) {
      const inactivos = metodosPago.filter(m => !m.active).length;
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