const crypto = require('crypto');
const { BalanceUsuario } = require('../models/index.js');
const { transferirInterno, transferirEntreCompartimentos } = require('../services/ledger/operations');
const money = require('../utils/money');

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

// Obtener mis balances (usuario autenticado) — decisión 1B: respuesta aditiva
// con totales de raíz (Funding + Spot) y desglose por compartimento.
const getMyBalances = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await BalanceUsuario.getBalancesConCompartimentos(userId);
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

const reclamarBtc = async (req, res) => {
  try {
    // Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #12): el propio autor
    // había marcado esta ruta "ELIMINAR EN DEPLOY REAL" pero nunca se
    // borró y seguía viva sin ninguna protección de entorno. Es un faucet
    // de testnet legítimo para que se pueda probar el exchange sin
    // depositar de verdad — el problema no era que exista, era que no
    // tenía freno. Ahora se desactiva solo en producción, en vez de
    // depender de que alguien se acuerde de borrar la ruta a mano.
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ success: false, error: 'No encontrado' });
    }

    const userId = req.user.id; // Del token JWT

    const resultado = await BalanceUsuario.reclamarBtcGratis(userId);
    
    res.json({
      success: true,
      message: resultado.message,
      data: {
        criptomoneda: 'BTC',
        cantidad: '1.00000000',
        balanceDisponible: resultado.balance.balanceDisponible,
        balanceBloqueado: resultado.balance.balanceBloqueado
      }
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
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

    // Paso D: transferencia admin como UN asiento user↔user (sin suspense).
    await transferirInterno({
      remitenteId: fromUserId,
      destinatarioId: toUserId,
      criptomonedaId,
      cantidad: String(amount),
      referencia: `admin-transfer:${crypto.randomUUID()}`,
    });

    res.json({ message: 'Transferencia completada exitosamente' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Transferencia del usuario autenticado entre sus compartimentos (Funding↔Spot).
// Self-service: el userId sale del token, no del body.
const transferMisCompartimentos = async (req, res) => {
  try {
    const userId = req.user.id;
    const { criptomonedaId, cantidad, origen, destino } = req.body;

    const COMPARTIMENTOS = ['funding', 'spot'];
    if (!criptomonedaId || !cantidad || money.compare(String(cantidad), '0') <= 0) {
      return res.status(400).json({ error: 'Datos de transferencia incompletos' });
    }
    if (!COMPARTIMENTOS.includes(origen) || !COMPARTIMENTOS.includes(destino) || origen === destino) {
      return res.status(400).json({ error: 'Compartimentos inválidos (usá funding/spot, distintos)' });
    }

    // Early-error de suficiencia (el guard real es el FOR UPDATE del ledger).
    const alcanza = await BalanceUsuario.hasAvailableEnCompartimento(userId, criptomonedaId, cantidad, origen);
    if (!alcanza) {
      return res.status(400).json({ error: `Saldo insuficiente en ${origen} para transferir` });
    }

    await transferirEntreCompartimentos({
      userId, criptomonedaId, cantidad: String(cantidad), origen, destino,
      referencia: `compartimento:${crypto.randomUUID()}`,
    });

    res.json({ message: 'Transferencia entre compartimentos completada', data: { origen, destino } });
  } catch (error) {
    // /sobregiro/ del ledger (carrera) → 400 con mensaje de dominio.
    if (/sobregiro/i.test(error.message)) {
      return res.status(400).json({ error: 'Saldo insuficiente para transferir' });
    }
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getBalances,
  getBalancesByUser,
  getBalanceByUserAndCrypto,
  getMyBalances,
  getTotalBalance,
  updateBalance,
  reclamarBtc,
  blockBalance,
  unblockBalance,
  checkAvailableBalance,
  getUsersWithBalance,
  getBalanceStats,
  transferBalance,
  transferMisCompartimentos
};