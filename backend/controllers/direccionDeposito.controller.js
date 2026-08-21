const { DireccionDeposito } = require('../models/index.js');
const { Op } = require('sequelize');
const { sequelize } = require('../models/index.js');

// Listar direcciones de depósito
const getDireccionesDeposito = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await DireccionDeposito.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener dirección de depósito por ID
const getDireccionDepositoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DireccionDeposito.getById(id);
    if (!result) return res.status(404).json({ error: 'Dirección de depósito no encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva dirección de depósito
const createDireccionDeposito = async (req, res) => {
  try {
    let { criptomonedaId, walletMaestraId, direccion, derivationIndex, activa, crearParaTodasLasCriptos } = req.body;
    const userId = req.user.id;

    // Validación básica de entrada
    if (!userId) {
      return res.status(400).json({ 
        error: 'Usuario no autenticado' 
      });
    }

    // OPCIÓN 1: Crear direcciones para TODAS las criptomonedas activas
    if (crearParaTodasLasCriptos === true) {
      const resultados = await DireccionDeposito.createAddressesForAllCryptos(userId);
      return res.status(201).json({
        message: `Direcciones procesadas para ${resultados.total} criptomonedas`,
        data: resultados
      });
    }

    // OPCIÓN 2: Crear dirección para una criptomoneda específica
    // Si no se proporciona criptomonedaId pero sí walletMaestraId, obtenerla de la wallet
    if (!criptomonedaId && walletMaestraId) {
      const walletMaestra = await sequelize.models.WalletMaestra.findByPk(walletMaestraId);
      if (walletMaestra) {
        criptomonedaId = walletMaestra.criptomonedaId;
        console.log('CriptomonedaId obtenido desde WalletMaestra:', criptomonedaId);
      }
    }

    // Si se envía criptomonedaId pero no walletMaestraId, buscar la wallet correspondiente
    if (criptomonedaId && !walletMaestraId) {
      const walletMaestra = await sequelize.models.WalletMaestra.findOne({
        where: { criptomonedaId: criptomonedaId, activa: true }
      });
      
      if (walletMaestra) {
        walletMaestraId = walletMaestra.id;
        console.log('WalletMaestraId obtenida desde criptomonedaId:', walletMaestraId);
      } else {
        return res.status(400).json({ 
          error: 'No existe wallet maestra activa para esta criptomoneda' 
        });
      }
    }

    if (!criptomonedaId) {
      return res.status(400).json({ 
        error: 'criptomonedaId es requerido (directamente o a través de walletMaestraId), o usa crearParaTodasLasCriptos: true' 
      });
    }

    let nuevaDireccion;

    if (direccion) {
      // Creación manual con dirección proporcionada
      if (!walletMaestraId) {
        return res.status(400).json({ 
          error: 'walletMaestraId es requerido cuando se proporciona una dirección manual' 
        });
      }
      
      nuevaDireccion = await DireccionDeposito.createDireccion({
        userId,
        criptomonedaId,
        walletMaestraId,
        direccion,
        derivationIndex,
        activa
      });
    } else {
      // Generación automática
      nuevaDireccion = await DireccionDeposito.generateAddressForUser(userId, criptomonedaId);
    }
    
    res.status(201).json({ 
      message: 'Dirección de depósito creada exitosamente', 
      data: nuevaDireccion 
    });
  } catch (error) {
    console.error('Error en createDireccionDeposito:', error);
    res.status(400).json({ error: error.message });
  }
};

// Actualizar dirección de depósito por ID
const updateDireccionDeposito = async (req, res) => {
  try {
    const { id } = req.params;
    const { direccion, derivationIndex, activa, metadata } = req.body;

    // Preparar datos de actualización
    const updateData = {};
    if (direccion) updateData.direccion = direccion;
    if (derivationIndex !== undefined) updateData.derivationIndex = derivationIndex;
    if (activa !== undefined) updateData.activa = activa;
    if (metadata) updateData.metadata = metadata;

    const updatedDireccion = await DireccionDeposito.updateDireccion(id, updateData);

    res.json({ 
      message: 'Dirección de depósito actualizada exitosamente', 
      data: updatedDireccion 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar dirección de depósito por ID
const deleteDireccionDeposito = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DireccionDeposito.deleteDireccion(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar estado de dirección de depósito
const updateDireccionDepositoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activa } = req.body;
    
    if (typeof activa !== 'boolean') {
      return res.status(400).json({ error: 'El campo activa debe ser un valor booleano' });
    }

    const updated = await DireccionDeposito.updateStatus(id, activa);
    res.json({ 
      message: `Dirección de depósito ${activa ? 'activada' : 'desactivada'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Alternar estado de dirección de depósito
const toggleDireccionDepositoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const direccion = await DireccionDeposito.getById(id);
    
    if (!direccion) {
      return res.status(404).json({ error: 'Dirección de depósito no encontrada' });
    }

    const newStatus = !direccion.activa;
    const updated = await DireccionDeposito.updateStatus(id, newStatus);
    
    res.json({ 
      message: `Dirección de depósito ${newStatus ? 'activada' : 'desactivada'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar direcciones de depósito
const searchDireccionesDeposito = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const result = await DireccionDeposito.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de direcciones de depósito
const getDireccionDepositoStats = async (req, res) => {
  try {
    const stats = await DireccionDeposito.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener direcciones de depósito por usuario
const getDireccionesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { soloActivas } = req.query;
    const direcciones = await DireccionDeposito.getByUser(userId, {
      soloActivas: soloActivas !== 'false'
    });
    res.json(direcciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis direcciones de depósito (usuario autenticado)
const getMyDirecciones = async (req, res) => {
  try {
    const userId = req.user.id;
    const { soloActivas } = req.query;
    const direcciones = await DireccionDeposito.getByUser(userId, {
      soloActivas: soloActivas !== 'false'
    });
    res.json(direcciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener dirección específica por usuario y criptomoneda
const getDireccionByUserAndCrypto = async (req, res) => {
  try {
    const { userId, criptomonedaId } = req.params;
    const direccion = await DireccionDeposito.getByUserAndCrypto(userId, criptomonedaId);
    
    if (!direccion) {
      return res.status(404).json({ 
        error: 'No existe dirección de depósito para este usuario y criptomoneda' 
      });
    }
    
    res.json(direccion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mi dirección para una criptomoneda específica
const getMyDireccionForCrypto = async (req, res) => {
  try {
    const userId = req.user.id;
    const { criptomonedaId } = req.params;
    
    let direccion = await DireccionDeposito.getByUserAndCrypto(userId, criptomonedaId);
    
    // Si no existe, generar automáticamente
    if (!direccion) {
      direccion = await DireccionDeposito.generateAddressForUser(userId, criptomonedaId);
    }
    
    res.json(direccion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener dirección por address
const getDireccionByAddress = async (req, res) => {
  try {
    const { address } = req.params;
    const direccion = await DireccionDeposito.getByAddress(address);
    
    if (!direccion) {
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }
    
    res.json(direccion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener direcciones por wallet maestra
const getDireccionesByWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const direcciones = await DireccionDeposito.getByWallet(walletId);
    res.json(direcciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Validar dirección para depósito
const validateForDeposit = async (req, res) => {
  try {
    const { direccion } = req.body;
    
    if (!direccion) {
      return res.status(400).json({ 
        error: 'El campo direccion es requerido' 
      });
    }

    const result = await DireccionDeposito.validateForDeposit(direccion);
    
    if (result.valid) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener siguiente índice de derivación
const getNextDerivationIndex = async (req, res) => {
  try {
    const { walletId } = req.params;
    const nextIndex = await DireccionDeposito.getNextDerivationIndex(walletId);
    res.json({ nextIndex });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDireccionesDeposito,
  getDireccionDepositoById,
  createDireccionDeposito,
  updateDireccionDeposito,
  deleteDireccionDeposito,
  updateDireccionDepositoStatus,
  toggleDireccionDepositoStatus,
  searchDireccionesDeposito,
  getDireccionDepositoStats,
  getDireccionesByUser,
  getMyDirecciones,
  getDireccionByUserAndCrypto,
  getMyDireccionForCrypto,
  getDireccionByAddress,
  getDireccionesByWallet,
  validateForDeposit,
  getNextDerivationIndex
};