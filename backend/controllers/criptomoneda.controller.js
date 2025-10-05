const { Criptomoneda } = require('../models/index.js');

// Listar criptomonedas
const getCriptomonedas = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await Criptomoneda.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener criptomoneda por ID
const getCriptomonedaById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Criptomoneda.getById(id);
    if (!result) return res.status(404).json({ error: 'Criptomoneda no encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva criptomoneda
const createCriptomoneda = async (req, res) => {
  try {
    const { 
      symbol, 
      nombre, 
      red, 
      direccionContrato, 
      decimales = 18, 
      activa = true,
      iconUrl // ✨ NUEVO
    } = req.body;
    
    if (!symbol || !nombre || !red) {
      return res.status(400).json({ 
        error: 'Los campos symbol, nombre y red son requeridos' 
      });
    }

    const nuevaCriptomoneda = await Criptomoneda.createCriptomoneda({
      symbol,
      nombre,
      red,
      direccionContrato,
      decimales,
      activa,
      iconUrl // ✨ NUEVO
    });
    
    res.status(201).json({ 
      message: 'Criptomoneda creada exitosamente', 
      data: nuevaCriptomoneda 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar criptomoneda por ID
const updateCriptomoneda = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      symbol, 
      nombre, 
      red, 
      direccionContrato, 
      decimales, 
      activa,
      iconUrl // ✨ NUEVO
    } = req.body;

    const updatedCriptomoneda = await Criptomoneda.updateCriptomoneda(id, {
      ...(symbol && { symbol }),
      ...(nombre && { nombre }),
      ...(red && { red }),
      ...(direccionContrato !== undefined && { direccionContrato }),
      ...(decimales !== undefined && { decimales }),
      ...(activa !== undefined && { activa }),
      ...(iconUrl !== undefined && { iconUrl }) // ✨ NUEVO
    });

    res.json({ 
      message: 'Criptomoneda actualizada exitosamente', 
      data: updatedCriptomoneda 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar criptomoneda por ID
const deleteCriptomoneda = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Criptomoneda.deleteCriptomoneda(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar estado de criptomoneda
const updateCriptomonedaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activa } = req.body;
    
    if (typeof activa !== 'boolean') {
      return res.status(400).json({ error: 'El campo activa debe ser un valor booleano' });
    }

    const updated = await Criptomoneda.updateStatus(id, activa);
    res.json({ 
      message: `Criptomoneda ${activa ? 'activada' : 'desactivada'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Alternar estado de criptomoneda
const toggleCriptomonedaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const criptomoneda = await Criptomoneda.getById(id);
    
    if (!criptomoneda) {
      return res.status(404).json({ error: 'Criptomoneda no encontrada' });
    }

    const newStatus = !criptomoneda.activa;
    const updated = await Criptomoneda.updateStatus(id, newStatus);
    
    res.json({ 
      message: `Criptomoneda ${newStatus ? 'activada' : 'desactivada'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar criptomonedas
const searchCriptomonedas = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const result = await Criptomoneda.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de criptomonedas
const getCriptomonedaStats = async (req, res) => {
  try {
    const stats = await Criptomoneda.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener solo criptomonedas activas
const getCriptomonedasActivas = async (req, res) => {
  try {
    const criptomonedas = await Criptomoneda.getActive();
    res.json(criptomonedas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener criptomoneda por símbolo
const getCriptomonedaBySymbol = async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await Criptomoneda.getBySymbol(symbol);
    
    if (!result) {
      return res.status(404).json({ error: 'Criptomoneda no encontrada' });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener criptomonedas por red
const getCriptomonedasByNetwork = async (req, res) => {
  try {
    const { network } = req.params;
    const result = await Criptomoneda.getByNetwork(network);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener criptomoneda por dirección de contrato
const getCriptomonedaByContract = async (req, res) => {
  try {
    const { address } = req.params;
    const result = await Criptomoneda.getByContractAddress(address);
    
    if (!result) {
      return res.status(404).json({ error: 'Criptomoneda no encontrada para esa dirección de contrato' });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Validar criptomoneda para transacción
const validateForTransaction = async (req, res) => {
  try {
    const { symbol, amount } = req.body;
    
    if (!symbol || amount === undefined) {
      return res.status(400).json({ 
        error: 'Los campos symbol y amount son requeridos' 
      });
    }

    const result = await Criptomoneda.validateForTransaction(symbol, parseFloat(amount));
    
    if (result.valid) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✨ NUEVO: Generar URL de icono automáticamente
const generateIconUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const criptomoneda = await Criptomoneda.getById(id);
    
    if (!criptomoneda) {
      return res.status(404).json({ error: 'Criptomoneda no encontrada' });
    }

    // SVG transparente
    const iconUrl = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${criptomoneda.symbol.toLowerCase()}.svg`;
    
    const updated = await Criptomoneda.updateCriptomoneda(id, { iconUrl });
    
    res.json({
      message: 'URL de icono SVG transparente generada',
      data: updated
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ✨ Generar todos con SVG transparente
const generateAllIconUrls = async (req, res) => {
  try {
    const criptomonedas = await Criptomoneda.getAll({});
    const updated = [];
    
    for (const crypto of criptomonedas) {
      if (!crypto.iconUrl) {
        const iconUrl = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${crypto.symbol.toLowerCase()}.svg`;
        const updatedCrypto = await Criptomoneda.updateCriptomoneda(crypto.id, { iconUrl });
        updated.push(updatedCrypto);
      }
    }
    
    res.json({
      message: `${updated.length} iconos SVG transparentes generados`,
      data: updated
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getCriptomonedas,
  getCriptomonedaById,
  createCriptomoneda,
  updateCriptomoneda,
  deleteCriptomoneda,
  updateCriptomonedaStatus,
  toggleCriptomonedaStatus,
  searchCriptomonedas,
  getCriptomonedaStats,
  getCriptomonedasActivas,
  getCriptomonedaBySymbol,
  getCriptomonedasByNetwork,
  getCriptomonedaByContract,
  validateForTransaction,
  generateIconUrl, // ✨ NUEVO
  generateAllIconUrls // ✨ NUEVO
};