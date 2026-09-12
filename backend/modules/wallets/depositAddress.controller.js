const { DepositAddress } = require('../../models/index.js');
const { Op } = require('sequelize');
const { sequelize } = require('../../models/index.js');

// Listar direcciones de depósito
const getDepositAddresses = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await DepositAddress.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener dirección de depósito por ID
const getDepositAddressById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DepositAddress.getById(id);
    if (!result) return res.status(404).json({ error: 'Dirección de depósito no encontrada' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nueva dirección de depósito
const createDepositAddress = async (req, res) => {
  try {
    let { cryptoId, masterWalletId, address, derivationIndex, active, crearParaTodasLasCriptos } = req.body;
    const userId = req.user.id;

    // Validación básica de entrada
    if (!userId) {
      return res.status(400).json({ 
        error: 'Usuario no autenticado' 
      });
    }

    // OPCIÓN 1: Crear direcciones para TODAS las criptomonedas activas
    if (crearParaTodasLasCriptos === true) {
      const resultados = await DepositAddress.createAddressesForAllCryptos(userId);
      return res.status(201).json({
        message: `Direcciones procesadas para ${resultados.total} criptomonedas`,
        data: resultados
      });
    }

    // OPCIÓN 2: Crear dirección para una criptomoneda específica
    // Si no se proporciona cryptoId pero sí masterWalletId, obtenerla de la wallet
    if (!cryptoId && masterWalletId) {
      const walletMaestra = await sequelize.models.MasterWallet.findByPk(masterWalletId);
      if (walletMaestra) {
        cryptoId = walletMaestra.cryptoId;
        console.log('CriptomonedaId obtenido desde MasterWallet:', cryptoId);
      }
    }

    // Si se envía cryptoId pero no masterWalletId, buscar la wallet correspondiente
    if (cryptoId && !masterWalletId) {
      const walletMaestra = await sequelize.models.MasterWallet.findOne({
        where: { cryptoId: cryptoId, active: true }
      });
      
      if (walletMaestra) {
        masterWalletId = walletMaestra.id;
        console.log('WalletMaestraId obtenida desde cryptoId:', masterWalletId);
      } else {
        return res.status(400).json({ 
          error: 'No existe wallet maestra activa para esta criptomoneda'
        });
      }
    }

    if (!cryptoId) {
      return res.status(400).json({ 
        error: 'criptomonedaId es requerido (directamente o a través de masterWalletId), o usa crearParaTodasLasCriptos: true' 
      });
    }

    let nuevaDireccion;

    if (address) {
      // Creación manual con dirección proporcionada
      if (!masterWalletId) {
        return res.status(400).json({ 
          error: 'masterWalletId es requerido cuando se proporciona una dirección manual' 
        });
      }
      
      nuevaDireccion = await DepositAddress.createAddress({
        userId,
        cryptoId,
        masterWalletId,
        address,
        derivationIndex,
        active
      });
    } else {
      // Generación automática
      nuevaDireccion = await DepositAddress.generateAddressForUser(userId, cryptoId);
    }
    
    res.status(201).json({ 
      message: 'Dirección de depósito creada exitosamente', 
      data: nuevaDireccion 
    });
  } catch (error) {
    console.error('Error en createDepositAddress:', error);
    res.status(400).json({ error: error.message });
  }
};

// Actualizar dirección de depósito por ID
const updateDepositAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { address, derivationIndex, active, metadata } = req.body;

    // Preparar datos de actualización
    const updateData = {};
    if (address) updateData.address = address;
    if (derivationIndex !== undefined) updateData.derivationIndex = derivationIndex;
    if (active !== undefined) updateData.active = active;
    if (metadata) updateData.metadata = metadata;

    const updatedDireccion = await DepositAddress.updateAddress(id, updateData);

    res.json({ 
      message: 'Dirección de depósito actualizada exitosamente', 
      data: updatedDireccion 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar dirección de depósito por ID
const deleteDepositAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await DepositAddress.deleteAddress(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar estado de dirección de depósito
const updateDepositAddressStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;
    
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'El campo active debe ser un valor booleano' });
    }

    const updated = await DepositAddress.updateStatus(id, active);
    res.json({ 
      message: `Dirección de depósito ${active ? 'activada' : 'desactivada'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Alternar estado de dirección de depósito
const toggleDepositAddressStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const address = await DepositAddress.getById(id);
    
    if (!address) {
      return res.status(404).json({ error: 'Dirección de depósito no encontrada' });
    }

    const newStatus = !address.active;
    const updated = await DepositAddress.updateStatus(id, newStatus);
    
    res.json({ 
      message: `Dirección de depósito ${newStatus ? 'activada' : 'desactivada'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar direcciones de depósito
const searchDepositAddresses = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const result = await DepositAddress.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de direcciones de depósito
const getDepositAddressStats = async (req, res) => {
  try {
    const stats = await DepositAddress.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener direcciones de depósito por usuario
const getDepositAddressesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { soloActivas } = req.query;
    const direcciones = await DepositAddress.getByUser(userId, {
      soloActivas: soloActivas !== 'false'
    });
    res.json(direcciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis direcciones de depósito (usuario autenticado)
const getMyDepositAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { soloActivas } = req.query;
    const direcciones = await DepositAddress.getByUser(userId, {
      soloActivas: soloActivas !== 'false'
    });
    res.json(direcciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener dirección específica por usuario y crypto
const getDepositAddressByUserAndCrypto = async (req, res) => {
  try {
    const { userId, cryptoId } = req.params;
    const address = await DepositAddress.getByUserAndCrypto(userId, cryptoId);
    
    if (!address) {
      return res.status(404).json({ 
        error: 'No existe dirección de depósito para este usuario y criptomoneda' 
      });
    }
    
    res.json(address);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mi dirección para una criptomoneda específica
const getMyDepositAddressForCrypto = async (req, res) => {
  try {
    const userId = req.user.id;
    const { cryptoId } = req.params;
    
    let address = await DepositAddress.getByUserAndCrypto(userId, cryptoId);
    
    // Si no existe, generar automáticamente
    if (!address) {
      address = await DepositAddress.generateAddressForUser(userId, cryptoId);
    }
    
    res.json(address);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener dirección por address
const getDepositAddressByAddress = async (req, res) => {
  try {
    const { address } = req.params;
    const depositAddress = await DepositAddress.getByAddress(address);

    if (!depositAddress) {
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }

    res.json(depositAddress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener direcciones por wallet maestra
const getDepositAddressesByWallet = async (req, res) => {
  try {
    const { walletId } = req.params;
    const direcciones = await DepositAddress.getByWallet(walletId);
    res.json(direcciones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Validar dirección para depósito
const validateForDeposit = async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ 
        error: 'El campo address es requerido' 
      });
    }

    const result = await DepositAddress.validateForDeposit(address);
    
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
    const nextIndex = await DepositAddress.getNextDerivationIndex(walletId);
    res.json({ nextIndex });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDepositAddresses,
  getDepositAddressById,
  createDepositAddress,
  updateDepositAddress,
  deleteDepositAddress,
  updateDepositAddressStatus,
  toggleDepositAddressStatus,
  searchDepositAddresses,
  getDepositAddressStats,
  getDepositAddressesByUser,
  getMyDepositAddresses,
  getDepositAddressByUserAndCrypto,
  getMyDepositAddressForCrypto,
  getDepositAddressByAddress,
  getDepositAddressesByWallet,
  validateForDeposit,
  getNextDerivationIndex
};