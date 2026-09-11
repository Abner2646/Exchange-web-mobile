const crypto = require('crypto');
const { UserBalance, sequelize } = require('../../models/index.js');
const { transferInternal, transferBetweenCompartments } = require('./ledger/operations');
const money = require('../../utils/money');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');
const idempotency = require('../../middleware/idempotency.middleware');

// Este controller usa el envelope canónico { error: { code, message } } vía
// AppError + el errorHandler central (las rutas envuelven cada handler en
// asyncHandler). Los errores inesperados se dejan propagar → el handler central
// los sanitiza a un 500 sin filtrar internals (guardrail). Sólo los fallos de
// negocio conocidos se mapean a AppError con su code de dominio.

// Traduce el error de saldo insuficiente del ledger (code 'OVERDRAFT', que
// preservan block/unblock/updateBalance y postTransaction) al envelope de
// dominio; cualquier otro error se re-lanza para que lo sanitice el handler.
function mapOverdraft(error, message) {
  if (error.code === 'OVERDRAFT') {
    return new AppError(400, errorCodes.BALANCE_INSUFFICIENT, message);
  }
  return error;
}

// Listar balances (admin)
const getBalances = async (req, res) => {
  const result = await UserBalance.getAll({ ...req.query });
  res.json(result);
};

// Obtener balances por usuario (admin)
const getBalancesByUser = async (req, res) => {
  const result = await UserBalance.getByUserId(req.params.userId);
  res.json(result);
};

// Obtener balance específico (usuario + crypto) (admin)
const getBalanceByUserAndCrypto = async (req, res) => {
  const { userId, cryptoId } = req.params;
  const result = await UserBalance.getByUserAndCrypto(userId, cryptoId);
  res.json(result);
};

// Obtener mis balances (usuario autenticado) — forma aditiva con totales de raíz
// (Funding + Spot) y desglose por compartimento (ver contract doc §9).
const getMyBalances = async (req, res) => {
  const result = await UserBalance.getBalancesWithCompartments(req.user.id);
  res.json(result);
};

// Obtener balance total (available + blocked) (admin)
const getTotalBalance = async (req, res) => {
  const { userId, cryptoId } = req.params;
  const result = await UserBalance.getTotalBalance(userId, cryptoId);
  res.json(result);
};

// Actualizar balance (admin, ajuste manual)
const updateBalance = async (req, res) => {
  const { userId, cryptoId } = req.params;
  const { amount, type } = req.body;
  if (!amount) {
    throw new AppError(400, errorCodes.BALANCE_INVALID_INPUT, 'Monto requerido');
  }
  try {
    const updated = await UserBalance.updateBalance(userId, cryptoId, amount, type);
    res.json({ message: 'Balance actualizado', data: updated });
  } catch (error) {
    throw mapOverdraft(error, 'Balance insuficiente para el ajuste');
  }
};

const claimBtc = async (req, res) => {
  try {
    // Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #12): el propio autor
    // había marcado esta ruta "ELIMINAR EN DEPLOY REAL" pero nunca se
    // borró y seguía viva sin ninguna protección de entorno. Es un faucet
    // de testnet legítimo para que se pueda probar el exchange sin
    // depositar de verdad — el problema no era que exista, era que no
    // tenía freno. Ahora se desactiva solo en producción, en vez de
    // depender de que alguien se acuerde de borrar la ruta a mano.
    // NOTA: este endpoint conserva su envelope propio { success, ... } a
    // propósito (faucet testnet, deshabilitado en prod → sin fuga real); no se
    // migró al envelope canónico como el resto del controller.
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ success: false, error: 'No encontrado' });
    }

    const result = await UserBalance.claimFreeBtc(req.user.id);
    res.json({
      success: true,
      message: result.message,
      data: {
        crypto: 'BTC',
        amount: '1.00000000',
        availableBalance: result.balance.availableBalance,
        blockedBalance: result.balance.blockedBalance
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Bloquear balance (admin)
const blockBalance = async (req, res) => {
  const { userId, cryptoId } = req.params;
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    throw new AppError(400, errorCodes.BALANCE_INVALID_INPUT, 'Monto válido requerido');
  }
  try {
    const updated = await UserBalance.blockBalance(userId, cryptoId, amount);
    res.json({ message: 'Balance bloqueado exitosamente', data: updated });
  } catch (error) {
    throw mapOverdraft(error, 'Balance disponible insuficiente para bloquear');
  }
};

// Desbloquear balance (admin)
const unblockBalance = async (req, res) => {
  const { userId, cryptoId } = req.params;
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    throw new AppError(400, errorCodes.BALANCE_INVALID_INPUT, 'Monto válido requerido');
  }
  try {
    const updated = await UserBalance.unblockBalance(userId, cryptoId, amount);
    res.json({ message: 'Balance desbloqueado exitosamente', data: updated });
  } catch (error) {
    throw mapOverdraft(error, 'Balance bloqueado insuficiente para desbloquear');
  }
};

// Verificar si tiene balance disponible suficiente (admin)
const checkAvailableBalance = async (req, res) => {
  const { userId, cryptoId } = req.params;
  const { amount } = req.query;
  if (!amount) {
    throw new AppError(400, errorCodes.BALANCE_INVALID_INPUT, 'Monto requerido');
  }
  const hasBalance = await UserBalance.hasAvailableBalance(userId, cryptoId, amount);
  res.json({ hasAvailableBalance: hasBalance });
};

// Obtener usuarios con balance en una criptomoneda (admin)
const getUsersWithBalance = async (req, res) => {
  const result = await UserBalance.getUsersWithBalance(req.params.cryptoId, req.query.minAmount);
  res.json(result);
};

// Obtener estadísticas de balances (admin)
const getBalanceStats = async (req, res) => {
  const result = await UserBalance.getBalanceStats();
  res.json(result);
};

// Transferir balance entre usuarios (admin)
const transferBalance = async (req, res) => {
  const { fromUserId, toUserId, cryptoId, amount } = req.body;
  if (!fromUserId || !toUserId || !cryptoId || !amount || amount <= 0) {
    throw new AppError(400, errorCodes.BALANCE_INVALID_INPUT, 'Datos de transferencia incompletos');
  }

  // Early-error de suficiencia (el guard real es el FOR UPDATE del ledger).
  const hasBalance = await UserBalance.hasAvailableBalance(fromUserId, cryptoId, amount);
  if (!hasBalance) {
    throw new AppError(400, errorCodes.BALANCE_INSUFFICIENT, 'Balance insuficiente para la transferencia');
  }

  try {
    // Paso D: transferencia admin como UN asiento user↔user (sin suspense).
    await transferInternal({
      remitenteId: fromUserId,
      destinatarioId: toUserId,
      criptomonedaId: cryptoId,
      cantidad: String(amount),
      referencia: `admin-transfer:${crypto.randomUUID()}`,
    });
  } catch (error) {
    throw mapOverdraft(error, 'Balance insuficiente para la transferencia');
  }
  res.json({ message: 'Transferencia completada exitosamente' });
};

// Transferencia del usuario autenticado entre sus compartimentos (Funding↔Spot).
// Self-service: el userId sale del token, no del body.
const transferMyCompartments = async (req, res) => {
  const userId = req.user.id;
  const { cryptoId, amount, from, to } = req.body;

  const COMPARTMENTS = ['funding', 'spot'];
  if (!cryptoId || !amount || money.compare(String(amount), '0') <= 0) {
    throw new AppError(400, errorCodes.BALANCE_INVALID_INPUT, 'Datos de transferencia incompletos');
  }
  if (!COMPARTMENTS.includes(from) || !COMPARTMENTS.includes(to) || from === to) {
    throw new AppError(400, errorCodes.BALANCE_INVALID_INPUT, 'Compartimentos inválidos (usá funding/spot, distintos)');
  }

  // Early-error de suficiencia (el guard real es el FOR UPDATE del ledger).
  const hasEnough = await UserBalance.hasAvailableInCompartment(userId, cryptoId, amount, from);
  if (!hasEnough) {
    throw new AppError(400, errorCodes.BALANCE_INSUFFICIENT, `Saldo insuficiente en ${from} para transferir`);
  }

  // Transacción propia del controller: la mueve el ledger (que acepta la tx) y,
  // en la misma tx, se completa la key de idempotencia (hardening anti-doble-gasto)
  // → el asiento y el 'completed' commitean atómicamente.
  const transaction = await sequelize.transaction();
  try {
    await transferBetweenCompartments({
      userId, criptomonedaId: cryptoId, cantidad: String(amount), origen: from, destino: to,
      referencia: `compartimento:${crypto.randomUUID()}`,
    }, transaction);
    const responseBody = { message: 'Transferencia entre compartimentos completada', data: { from, to } };
    await idempotency.finalizeInTransaction(req, transaction, 200, responseBody);
    await transaction.commit();
    res.json(responseBody);
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    // Sobregiro del ledger (carrera) → 400 de dominio; el resto se sanitiza.
    throw mapOverdraft(error, 'Saldo insuficiente para transferir');
  }
};

module.exports = {
  getBalances,
  getBalancesByUser,
  getBalanceByUserAndCrypto,
  getMyBalances,
  getTotalBalance,
  updateBalance,
  claimBtc,
  blockBalance,
  unblockBalance,
  checkAvailableBalance,
  getUsersWithBalance,
  getBalanceStats,
  transferBalance,
  transferMyCompartments
};
