const { BalanceUsuario } = require('../models/index.js');

// Listar balances
const getBalances = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await BalanceUsuario.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener balance por ID
const getBalanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await BalanceUsuario.getById(id);
    if (!result) return res.status(404).json({ error: 'Balance no encontrado' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener balances por usuario
const getBalancesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await BalanceUsuario.getByUserId(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener balance específico (usuario + criptomoneda)
const getBalanceByUserAndCrypto = async (req, res) => {
  try {
    const { userId, criptomonedaId } = req.params;
    const result = await BalanceUsuario.getByUserAndCrypto(userId, criptomonedaId);
    if (!result) return res.status(404).json({ error: 'Balance no encontrado' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis balances (usuario autenticado)
const getMyBalances = async (req, res) => {
  try {
    const userId = req.user.id; // Asumiendo que viene del middleware de auth
    const result = await BalanceUsuario.getByUserId(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener balance total (disponible + bloqueado)
const getTotalBalance = async (req, res) => {
  try {
    const { userId, criptomonedaId } = req.params;
    const result = await BalanceUsuario.getTotalBalance(userId, criptomonedaId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar balance
const updateBalance = async (req, res) => {
  try {
    const { userId, criptomonedaId } = req.params;
    const { amount, type } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Monto requerido' });
    }

    const updated = await BalanceUsuario.updateBalance(userId, criptomonedaId, amount, type);
    res.json({ message: 'Balance actualizado', data: updated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Bloquear balance
const blockBalance = async (req, res) => {
  try {
    const { userId, criptomonedaId } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Monto válido requerido' });
    }

    const updated = await BalanceUsuario.blockBalance(userId, criptomonedaId, amount);
    res.json({ message: 'Balance bloqueado exitosamente', data: updated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Desbloquear balance
const unblockBalance = async (req, res) => {
  try {
    const { userId, criptomonedaId } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Monto válido requerido' });
    }

    const updated = await BalanceUsuario.unblockBalance(userId, criptomonedaId, amount);
    res.json({ message: 'Balance desbloqueado exitosamente', data: updated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Verificar si tiene balance disponible suficiente
const checkAvailableBalance = async (req, res) => {
  try {
    const { userId, criptomonedaId } = req.params;
    const { amount } = req.query;
    
    if (!amount) {
      return res.status(400).json({ error: 'Monto requerido' });
    }

    const hasBalance = await BalanceUsuario.hasAvailableBalance(userId, criptomonedaId, amount);
    res.json({ hasAvailableBalance: hasBalance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener usuarios con balance en una criptomoneda
const getUsersWithBalance = async (req, res) => {
  try {
    const { criptomonedaId } = req.params;
    const { minAmount } = req.query;
    
    const result = await BalanceUsuario.getUsersWithBalance(criptomonedaId, minAmount);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de balances
const getBalanceStats = async (req, res) => {
  try {
    const result = await BalanceUsuario.getBalanceStats();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Transferir balance entre usuarios
const transferBalance = async (req, res) => {
  try {
    const { fromUserId, toUserId, criptomonedaId, amount } = req.body;
    
    if (!fromUserId || !toUserId || !criptomonedaId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Datos de transferencia incompletos' });
    }

    // Verificar balance disponible del origen
    const hasBalance = await BalanceUsuario.hasAvailableBalance(fromUserId, criptomonedaId, amount);
    if (!hasBalance) {
      return res.status(400).json({ error: 'Balance insuficiente para la transferencia' });
    }

    // Restar del usuario origen
    await BalanceUsuario.updateBalance(fromUserId, criptomonedaId, -amount, 'disponible');
    
    // Sumar al usuario destino
    await BalanceUsuario.updateBalance(toUserId, criptomonedaId, amount, 'disponible');

    res.json({ message: 'Transferencia completada exitosamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getBalances,
  getBalanceById,
  getBalancesByUser,
  getBalanceByUserAndCrypto,
  getMyBalances,
  getTotalBalance,
  updateBalance,
  blockBalance,
  unblockBalance,
  checkAvailableBalance,
  getUsersWithBalance,
  getBalanceStats,
  transferBalance
};