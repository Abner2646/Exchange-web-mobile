const { Crypto } = require('../../models/index.js');

// Listar criptomonedas
const getCriptomonedas = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await Crypto.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener crypto por ID
const getCriptomonedaById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Crypto.getById(id);
    if (!result) return res.status(404).json({ error: 'Criptomoneda no encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva crypto
const createCrypto = async (req, res) => {
  try {
    const { 
      symbol, 
      name, 
      network, 
      contractAddress, 
      decimals = 18, 
      active = true,
      iconUrl // ✨ NUEVO
    } = req.body;
    
    if (!symbol || !name || !network) {
      return res.status(400).json({ 
        error: 'Los campos symbol, name y network son requeridos' 
      });
    }

    const nuevaCriptomoneda = await Crypto.createCrypto({
      symbol,
      name,
      network,
      contractAddress,
      decimals,
      active,
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

// Actualizar crypto por ID
const updateCriptomoneda = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      symbol, 
      name, 
      network, 
      contractAddress, 
      decimals, 
      active,
      iconUrl // ✨ NUEVO
    } = req.body;

    const updatedCriptomoneda = await Crypto.updateCriptomoneda(id, {
      ...(symbol && { symbol }),
      ...(name && { name }),
      ...(network && { network }),
      ...(contractAddress !== undefined && { contractAddress }),
      ...(decimals !== undefined && { decimals }),
      ...(active !== undefined && { active }),
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

// Eliminar crypto por ID
const deleteCriptomoneda = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Crypto.deleteCriptomoneda(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar estado de crypto
const updateCriptomonedaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'El campo active debe ser un valor booleano' });
    }

    const updated = await Crypto.updateStatus(id, active);
    res.json({ 
      message: `Crypto ${active ? 'activada' : 'desactivada'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Alternar estado de crypto
const toggleCriptomonedaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const crypto = await Crypto.getById(id);
    
    if (!crypto) {
      return res.status(404).json({ error: 'Criptomoneda no encontrada' });
    }

    const newStatus = !crypto.active;
    const updated = await Crypto.updateStatus(id, newStatus);
    
    res.json({ 
      message: `Crypto ${newStatus ? 'activada' : 'desactivada'} exitosamente`, 
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

    const result = await Crypto.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de criptomonedas
const getCriptomonedaStats = async (req, res) => {
  try {
    const stats = await Crypto.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener solo criptomonedas activas
const getCriptomonedasActivas = async (req, res) => {
  try {
    const criptomonedas = await Crypto.getActive();
    res.json(criptomonedas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener crypto por símbolo
const getCriptomonedaBySymbol = async (req, res) => {
  try {
    const { symbol } = req.params;
    const result = await Crypto.getBySymbol(symbol);
    
    if (!result) {
      return res.status(404).json({ error: 'Criptomoneda no encontrada' });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener criptomonedas por network
const getCriptomonedasByNetwork = async (req, res) => {
  try {
    const { network } = req.params;
    const result = await Crypto.getByNetwork(network);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener crypto por dirección de contrato
const getCriptomonedaByContract = async (req, res) => {
  try {
    const { address } = req.params;
    const result = await Crypto.getByContractAddress(address);
    
    if (!result) {
      return res.status(404).json({ error: 'Criptomoneda no encontrada para esa dirección de contrato' });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Validar crypto para transacción
const validateForTransaction = async (req, res) => {
  try {
    const { symbol, amount } = req.body;
    
    if (!symbol || amount === undefined) {
      return res.status(400).json({ 
        error: 'Los campos symbol y amount son requeridos' 
      });
    }

    const result = await Crypto.validateForTransaction(symbol, parseFloat(amount));
    
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
    const crypto = await Crypto.getById(id);
    
    if (!crypto) {
      return res.status(404).json({ error: 'Criptomoneda no encontrada' });
    }

    // SVG transparente
    const iconUrl = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${crypto.symbol.toLowerCase()}.svg`;
    
    const updated = await Crypto.updateCriptomoneda(id, { iconUrl });
    
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
    const criptomonedas = await Crypto.getAll({});
    const updated = [];
    
    for (const crypto of criptomonedas) {
      if (!crypto.iconUrl) {
        const iconUrl = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${crypto.symbol.toLowerCase()}.svg`;
        const updatedCrypto = await Crypto.updateCriptomoneda(crypto.id, { iconUrl });
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
  createCrypto,
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