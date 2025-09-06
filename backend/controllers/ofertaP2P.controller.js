const { OfertaP2P } = require('../models/index.js');

// Listar ofertas con filtros
const getOfertas = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await OfertaP2P.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener oferta por ID
const getOfertaById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await OfertaP2P.getById(id);
    if (!result) return res.status(404).json({ error: 'Oferta no encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva oferta
const createOferta = async (req, res) => {
  try {
    const usuarioId = req.user.id; // Obtenido del middleware de autenticación
    const ofertaData = { ...req.body, usuarioId };
    
    const nuevaOferta = await OfertaP2P.createOffer(ofertaData);
    res.status(201).json({
      message: 'Oferta creada exitosamente',
      data: nuevaOferta
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar oferta
const updateOferta = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;
    const updateData = req.body;

    const updated = await OfertaP2P.updateOffer(id, updateData, usuarioId);
    res.json({ 
      message: 'Oferta actualizada exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar/Desactivar oferta
const deleteOferta = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    // Verificar propiedad antes de desactivar
    const oferta = await OfertaP2P.findByPk(id);
    if (!oferta) {
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }

    if (oferta.usuarioId !== usuarioId && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta oferta' });
    }

    await OfertaP2P.updateStatus(id, false);
    res.json({ message: 'Oferta desactivada exitosamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar estado de oferta (admin)
const updateOfertaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activa } = req.body;
    
    const updated = await OfertaP2P.updateStatus(id, activa);
    res.json({ 
      message: 'Estado actualizado exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar ofertas
const searchOfertas = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    if (!term) {
      return res.status(400).json({ error: 'Término de búsqueda requerido' });
    }

    const results = await OfertaP2P.search(term, parseInt(limit));
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis ofertas
const getMyOfertas = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    
    const result = await OfertaP2P.getUserOfferHistory(usuarioId, parseInt(page), parseInt(limit));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Encontrar ofertas compatibles
const findCompatibleOffers = async (req, res) => {
  try {
    const { tipo, criptomonedaId, cantidad, monedaFiat, metodoPagoId } = req.query;
    
    if (!tipo || !criptomonedaId || !cantidad || !monedaFiat) {
      return res.status(400).json({ 
        error: 'Parámetros requeridos: tipo, criptomonedaId, cantidad, monedaFiat' 
      });
    }

    const ofertas = await OfertaP2P.findCompatibleOffers(
      tipo, 
      criptomonedaId, 
      parseFloat(cantidad), 
      monedaFiat, 
      metodoPagoId
    );

    res.json(ofertas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verificar si se puede aceptar una oferta
const checkOfferAcceptability = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad } = req.query;
    
    if (!cantidad) {
      return res.status(400).json({ error: 'Cantidad requerida' });
    }

    const result = await OfertaP2P.canAcceptOffer(id, cantidad);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de ofertas (admin)
const getOfertasStats = async (req, res) => {
  try {
    const stats = await OfertaP2P.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Activar/Desactivar oferta propia
const toggleMyOferta = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const oferta = await OfertaP2P.findByPk(id);
    if (!oferta) {
      return res.status(404).json({ error: 'Oferta no encontrada' });
    }

    if (oferta.usuarioId !== usuarioId) {
      return res.status(403).json({ error: 'No tienes permiso para modificar esta oferta' });
    }

    const updated = await OfertaP2P.updateStatus(id, !oferta.activa);
    res.json({ 
      message: `Oferta ${updated.activa ? 'activada' : 'desactivada'} exitosamente`,
      data: updated
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener ofertas por criptomoneda
const getOfertasByCrypto = async (req, res) => {
  try {
    const { criptomonedaId } = req.params;
    const filters = { ...req.query, criptomonedaId };
    
    const result = await OfertaP2P.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener ofertas por tipo
const getOfertasByTipo = async (req, res) => {
  try {
    const { tipo } = req.params;
    if (!['compra', 'venta'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo debe ser "compra" o "venta"' });
    }
    
    const filters = { ...req.query, tipo };
    const result = await OfertaP2P.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getOfertas,
  getOfertaById,
  createOferta,
  updateOferta,
  deleteOferta,
  updateOfertaStatus,
  searchOfertas,
  getMyOfertas,
  findCompatibleOffers,
  checkOfferAcceptability,
  getOfertasStats,
  toggleMyOferta,
  getOfertasByCrypto,
  getOfertasByTipo
};