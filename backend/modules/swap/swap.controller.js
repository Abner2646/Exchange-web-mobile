// controllers/intercambioExchange.controller.js

const { Swap, User, SwapPair, UserBalance, Crypto, sequelize } = require('../../models/index.js');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');
const money = require('../../utils/money');
const { calculateSettlement } = require('./swapSettlement.service');
const { settleSwap } = require('../balances/ledger/operations');
const idempotency = require('../../middleware/idempotency.middleware');

// Función auxiliar para validar fechas
const isValidDate = (dateString) => {
  try {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date) && dateString.includes('T');
  } catch {
    return false;
  }
};

// Función auxiliar para validar UUID
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Crear nueva orden.
//
// Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #4 y #6): esta función
// llegó a estar hardcodeada para ejecutar siempre "sell" sin importar el
// `type` recibido, con el chequeo de límite diario comentado. Ahora respeta
// `type`, revalida el límite diario, y pasa la transacción de forma
// consistente a cada escritura (incluida la comisión a la wallet maestra,
// que antes se confirmaba en su propia transacción aparte — ver el fix de
// MasterWallet.updateBalance en este mismo commit).
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { pairId, type, baseAmount } = req.body;
    const compartimento = req.body.compartimento || 'funding';

    if (!pairId || !type || !baseAmount) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'pairId, type y baseAmount son requeridos');
    }

    if (!['funding', 'spot'].includes(compartimento)) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'Compartimento inválido (funding|spot)');
    }

    if (!isValidUUID(pairId)) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'pairId debe ser un UUID válido');
    }

    if (!['buy', 'sell'].includes(type)) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'type debe ser "buy" o "sell"');
    }

    if (typeof baseAmount !== 'number' || baseAmount <= 0) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'baseAmount debe ser un número mayor a 0');
    }

    const baseDecimals = (baseAmount.toString().split('.')[1] || '').length;
    if (baseDecimals > 8) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'baseAmount no puede tener más de 8 decimales');
    }

    const par = await SwapPair.findByPk(pairId, {
      include: [
        { model: Crypto, as: 'baseCrypto' },
        { model: Crypto, as: 'quoteCrypto' }
      ],
      transaction
    });

    if (!par || !par.active) {
      await transaction.rollback();
      throw new AppError(404, errorCodes.EXCHANGE_PAIR_NOT_FOUND, 'Par de intercambio no encontrado o inactivo');
    }

    // price canónico (string): par.currentPrice es DECIMAL — pasarlo por
    // parseFloat perdería dígitos en precios de alta precisión antes de operar.
    const price = String(par.currentPrice);
    if (!par.currentPrice || money.compare(price, '0') <= 0) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_PAIR_NO_PRICE, 'El par no tiene un precio válido configurado');
    }

    // FOR UPDATE sobre la fila del usuario: serializa la sección crítica del
    // límite diario (AML) POR USUARIO. Sin este lock, dos swaps concurrentes del
    // mismo usuario leen el mismo getDailyVolume y ambos pasan → el volumen
    // combinado excede dailyLimitUsd (Radar #12d). Con el lock, el segundo swap
    // espera al commit del primero y re-lee el volumen ya incluyéndolo. Es
    // per-usuario (distintos usuarios lockean filas distintas, sin contención) y
    // se toma ANTES de los locks de saldo del ledger (orden consistente → sin
    // deadlock). El anti-sobregiro del ledger no cubre este agregado.
    const usuario = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!usuario || !usuario.active) {
      await transaction.rollback();
      throw new AppError(404, errorCodes.EXCHANGE_USER_NOT_FOUND, 'Usuario no encontrado o inactivo');
    }

    const feePercent = String(par.feePercent || '0.1');
    const { quoteAmount, feeAmount, requiredQuote, netQuote } =
      calculateSettlement({ baseAmount, price, feePercent, type });

    const dailyVolume = await Swap.getDailyVolume(userId, new Date(), transaction);
    const newDailyVolume = money.add(String(dailyVolume), quoteAmount);

    if (money.compare(newDailyVolume, String(usuario.dailyLimitUsd)) > 0) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_DAILY_LIMIT_EXCEEDED, 'Límite diario de operaciones excedido');
    }

    const baseCryptoId = par.baseCryptoId;
    const quoteCryptoId = par.quoteCryptoId;
    let netAmount;

    // Chequeo de suficiencia sobre la proyección del ledger (da el error code de
    // dominio correcto). El anti-sobregiro atómico real es el FOR UPDATE de
    // postTransaction dentro de settleSwap.
    if (type === 'buy') {
      const balanceQuote = await UserBalance.getCompartmentBalance(userId, quoteCryptoId, compartimento, { transaction });
      if (money.compare(String(balanceQuote.available), requiredQuote) < 0) {
        await transaction.rollback();
        throw new AppError(400, errorCodes.EXCHANGE_INSUFFICIENT_BALANCE, 'Saldo insuficiente en moneda quote para realizar la operación');
      }
      netAmount = String(baseAmount);
    } else {
      const balanceBase = await UserBalance.getCompartmentBalance(userId, baseCryptoId, compartimento, { transaction });
      if (money.compare(String(balanceBase.available), String(baseAmount)) < 0) {
        await transaction.rollback();
        throw new AppError(400, errorCodes.EXCHANGE_INSUFFICIENT_BALANCE, 'Saldo insuficiente en moneda base para realizar la operación');
      }
      netAmount = netQuote;
    }

    const newOrder = await Swap.create({
      userId,
      pairId,
      type,
      baseAmount,
      quoteAmount,
      price,
      feeAmount,
      feePercent,
      status: 'completed',
      completedAt: new Date()
    }, { transaction });

    // Paso D: liquidación rica en el ledger. User ↔ treasury (inventario de la
    // casa); la comisión (en quote) acredita fee_revenue. Reemplaza los
    // updateBalance (funding+suspense) y el crédito a MasterWallet.totalBalance.
    await settleSwap({
      userId,
      baseCryptoId,
      quoteCryptoId,
      baseAmount,
      quoteAmount,
      feeAmount,
      requiredQuote,
      netQuote,
      type,
      compartimento,
      referencia: `swap:${newOrder.id}`,
    }, transaction);

    const responseBody = {
      message: 'Intercambio realizado exitosamente',
      data: {
        ...newOrder.toJSON(),
        precioUsado: price,
        comisionCalculada: feeAmount,
        netAmount
      }
    };
    // Hardening anti-doble-gasto: marca la key de idempotencia como completada
    // DENTRO de esta transacción, para que commitee atómicamente con la
    // liquidación. Cierra la ventana en la que un crash tras el commit dejaba la
    // fila en 'in_progress' y el reclaim de 90s re-ejecutaba el swap.
    await idempotency.finalizeInTransaction(req, transaction, 201, responseBody);

    await transaction.commit();

    res.status(201).json(responseBody);
  } catch (error) {
    // If this is an operational AppError that already triggered rollback above,
    // just rethrow so asyncHandler forwards it to the central error handler.
    // If it is an unexpected error, guard the rollback (transaction may already
    // be finished if the error surfaced after commit/rollback) then rethrow —
    // never respond here; let the central handler do it.
    if (!transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

// (Paso D: se eliminó revertLastExchange — código muerto no exportado ni ruteado
// que aún usaba updateBalance con aritmética Number. Una reversión de swap, si se
// necesitara, se haría con un asiento 'reverso' en el ledger.)

// Calcular intercambio antes de ejecutar
const calculateExchange = async (req, res) => {
  const { pairId, baseAmount, type } = req.body;

  // Validaciones
  if (!pairId || !baseAmount || !type) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'pairId, baseAmount y type son requeridos');
  }

  if (!isValidUUID(pairId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'pairId debe ser un UUID válido');
  }

  if (!['buy', 'sell'].includes(type)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'type debe ser "buy" o "sell"');
  }

  if (typeof baseAmount !== 'number' || baseAmount <= 0.00000001) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'baseAmount debe ser un número mayor a 0.00000001');
  }

  const decimals = (baseAmount.toString().split('.')[1] || '').length;
  if (decimals > 8) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'baseAmount no puede tener más de 8 decimales');
  }

  // Obtener el par para usar su price actual
  const par = await SwapPair.findByPk(pairId, {
    include: [
      { model: Crypto, as: 'baseCrypto' },
      { model: Crypto, as: 'quoteCrypto' }
    ]
  });

  if (!par || !par.active) {
    throw new AppError(404, errorCodes.EXCHANGE_PAIR_NOT_FOUND, 'Par de intercambio no encontrado o inactivo');
  }

  const price = String(par.currentPrice);
  if (!par.currentPrice || money.compare(price, '0') <= 0) {
    throw new AppError(400, errorCodes.EXCHANGE_PAIR_NO_PRICE, 'El par no tiene un precio válido configurado');
  }

  // Mismo settlement exacto que usa la ejecución (createExchange): así el monto
  // mostrado en el preview coincide con el ejecutado, no dos cálculos float
  // independientes que podían divergir.
  const feePercent = String(par.feePercent || '0.1');
  const { quoteAmount, feeAmount, finalAmount } =
    calculateSettlement({ baseAmount, price, feePercent, type });

  const impactoSlippage = 0;

  const calculation = {
    par: {
      id: par.id,
      base: par.baseCrypto.symbol,
      quote: par.quoteCrypto.symbol,
      price: price,
      volume24h: par.volume24h || 0,
      lastUpdated: par.lastUpdated
    },
    calculo: {
      baseAmount: baseAmount,
      quoteAmount: quoteAmount,
      feePercent: feePercent,
      feeAmount: feeAmount,
      impactoSlippage: impactoSlippage,
      finalAmount: finalAmount,
      direccion: type,
      precioEfectivo: price
    },
    advertencias: []
  };

  res.json(calculation);
};

// Verificar límite de transacción
const checkTransactionLimit = async (req, res) => {
  const userId = req.user.id;
  const { quoteAmount } = req.body;

  if (!quoteAmount || typeof quoteAmount !== 'number' || quoteAmount <= 0) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'quoteAmount debe ser un número positivo');
  }

  const dailyVolume = await Swap.getDailyVolume(userId);
  const usuario = await User.findByPk(userId);

  if (!usuario) {
    throw new AppError(404, errorCodes.EXCHANGE_USER_NOT_FOUND, 'Usuario no encontrado');
  }

  const remainingLimit = usuario.dailyLimitUsd - dailyVolume;

  if (remainingLimit < quoteAmount) {
    throw new AppError(400, errorCodes.EXCHANGE_DAILY_LIMIT_EXCEEDED, 'Límite diario de operaciones excedido');
  }

  res.json({
    canTransact: true,
    dailyVolume,
    limit: usuario.dailyLimitUsd,
    remainingLimit,
    requestedAmount: quoteAmount
  });
};

// Obtener mis balances — forma UNIFICADA (2026-09-03): los tres endpoints de
// "mis balances" (balances/intercambio/usuario) devuelven la misma forma aditiva
// compartimentada de getBalancesWithCompartments (totales de raíz Funding+Spot +
// desglose por compartimento + objeto `crypto`). Antes este endpoint era
// funding-only y re-adjuntaba la cripto a mano. Cambio de contrato documentado en
// docs/frontend-rebuild/backend-contract-changes.md. El orden no está garantizado.
const getMyBalances = async (req, res) => {
  const userId = req.user.id;
  const balances = await UserBalance.getBalancesWithCompartments(userId);
  res.json(balances);
};

// Listar todos los intercambios (admin)
const getIntercambios = async (req, res) => {
  const filters = { ...req.query };

  // Validar filtros opcionales
  if (filters.status && !['pending', 'completed', 'failed'].includes(filters.status)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'status debe ser pending, completed o failed');
  }

  if (filters.type && !['buy', 'sell'].includes(filters.type)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'type debe ser buy o sell');
  }

  if (filters.userId && !isValidUUID(filters.userId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'userId debe ser un UUID válido');
  }

  if (filters.limit) {
    const limit = parseInt(filters.limit);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'limit debe ser un número entre 1 y 100');
    }
  }

  if (filters.offset) {
    const offset = parseInt(filters.offset);
    if (isNaN(offset) || offset < 0) {
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'offset debe ser un número mayor o igual a 0');
    }
  }

  if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaDesde debe ser una fecha válida en formato ISO8601');
  }
  if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaHasta debe ser una fecha válida en formato ISO8601');
  }

  const result = await Swap.getAll(filters);
  res.json(result);
};

// Obtener intercambio por ID
const getIntercambioById = async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'ID debe ser un UUID válido');
  }

  const result = await Swap.getById(id);
  if (!result) throw new AppError(404, errorCodes.EXCHANGE_NOT_FOUND, 'Intercambio no encontrado');
  res.json(result);
};

// Obtener mis intercambios
const getMyIntercambios = async (req, res) => {
  const userId = req.user.id;
  const filters = { ...req.query };

  if (filters.type && !['buy', 'sell'].includes(filters.type)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'type debe ser buy o sell');
  }

  if (filters.status && !['pending', 'completed', 'failed'].includes(filters.status)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'status debe ser pending, completed o failed');
  }

  if (filters.pairId && !isValidUUID(filters.pairId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'pairId debe ser un UUID válido');
  }

  if (filters.limit) {
    const limit = parseInt(filters.limit);
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'limit debe ser un número entre 1 y 100');
    }
  }

  if (filters.offset) {
    const offset = parseInt(filters.offset);
    if (isNaN(offset) || offset < 0) {
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'offset debe ser un número mayor o igual a 0');
    }
  }

  if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaDesde debe ser una fecha válida en formato ISO8601');
  }
  if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaHasta debe ser una fecha válida en formato ISO8601');
  }

  const result = await Swap.getByUserId(userId, filters);
  res.json(result);
};

// Buscar intercambios
const searchIntercambios = async (req, res) => {
  const { q, limit } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'Término de búsqueda (q) debe tener al menos 2 caracteres');
  }

  if (q.length > 100) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'Término de búsqueda no puede exceder 100 caracteres');
  }

  let searchLimit = 10;
  if (limit) {
    searchLimit = parseInt(limit);
    if (isNaN(searchLimit) || searchLimit < 1 || searchLimit > 50) {
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'limit debe ser un número entre 1 y 50');
    }
  }

  const results = await Swap.search(q.trim(), searchLimit);
  res.json(results);
};

// Obtener estadísticas generales
const getIntercambioStats = async (req, res) => {
  const filters = { ...req.query };

  if (filters.userId && !isValidUUID(filters.userId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'userId debe ser un UUID válido');
  }

  if (filters.pairId && !isValidUUID(filters.pairId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'pairId debe ser un UUID válido');
  }

  if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaDesde debe ser una fecha válida en formato ISO8601');
  }
  if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaHasta debe ser una fecha válida en formato ISO8601');
  }

  const stats = await Swap.getStats(filters);
  res.json(stats);
};

// Obtener volumen por par
const getVolumeByPair = async (req, res) => {
  const { pairId } = req.params;

  if (!isValidUUID(pairId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'pairId debe ser un UUID válido');
  }

  const filters = { ...req.query };
  if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaDesde debe ser una fecha válida en formato ISO8601');
  }
  if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaHasta debe ser una fecha válida en formato ISO8601');
  }

  if (filters.status && !['pending', 'completed', 'failed'].includes(filters.status)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'status debe ser pending, completed o failed');
  }

  const volume = await Swap.getVolumeByPair(pairId, filters);
  res.json(volume);
};

// Obtener historial de precios
const getPriceHistory = async (req, res) => {
  const { pairId } = req.params;

  if (!isValidUUID(pairId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'pairId debe ser un UUID válido');
  }

  const filters = { ...req.query };

  if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaDesde debe ser una fecha válida en formato ISO8601');
  }
  if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaHasta debe ser una fecha válida en formato ISO8601');
  }

  if (filters.limit) {
    const limit = parseInt(filters.limit);
    if (isNaN(limit) || limit < 1 || limit > 5000) {
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'limit debe ser un número entre 1 y 5000');
    }
  }

  if (filters.order && !['ASC', 'DESC'].includes(filters.order)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'order debe ser ASC o DESC');
  }

  const history = await Swap.getPriceHistory(pairId, filters);
  res.json(history);
};

// Obtener último price
const getLastPrice = async (req, res) => {
  const { pairId } = req.params;

  if (!isValidUUID(pairId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'pairId debe ser un UUID válido');
  }

  const lastPrice = await Swap.getLastPrice(pairId);

  if (lastPrice === null) {
    throw new AppError(404, errorCodes.EXCHANGE_NOT_FOUND, 'No hay intercambios completados para este par');
  }

  res.json({
    pairId,
    lastPrice,
    timestamp: new Date()
  });
};

// Obtener volumen diario del usuario
const getMyDailyVolume = async (req, res) => {
  const userId = req.user.id;
  const { date } = req.query;

  if (date && !/^.{4}-.{2}-.{2}$/.test(date)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'date debe tener formato YYYY-MM-DD');
  }

  const targetDate = date ? new Date(date + 'T00:00:00.000Z') : new Date();

  if (isNaN(targetDate.getTime())) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'Fecha inválida');
  }

  const volume = await Swap.getDailyVolume(userId, targetDate);

  res.json({
    date: targetDate.toISOString().split('T')[0],
    volume
  });
};

// Obtener resumen del trading del usuario
const getMyTradingSummary = async (req, res) => {
  const userId = req.user.id;
  const { period } = req.query;

  if (period && !['day', 'week', 'month', 'year'].includes(period)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'period debe ser day, week, month o year');
  }

  let fechaDesde = new Date();

  switch (period) {
    case 'week':
      fechaDesde.setDate(fechaDesde.getDate() - 7);
      break;
    case 'month':
      fechaDesde.setMonth(fechaDesde.getMonth() - 1);
      break;
    case 'year':
      fechaDesde.setFullYear(fechaDesde.getFullYear() - 1);
      break;
    default:
      fechaDesde.setHours(0, 0, 0, 0);
  }

  const filters = {
    fechaDesde: fechaDesde.toISOString(),
    userId
  };

  const summary = await Swap.getStats(filters);

  res.json({
    period: period || 'day',
    dateRange: {
      from: fechaDesde,
      to: new Date()
    },
    ...summary
  });
};

// Actualizar status de intercambio (admin)
const updateIntercambioStatus = async (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body;

  if (!isValidUUID(id)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'ID debe ser un UUID válido');
  }

  if (!newStatus || !['pending', 'completed', 'failed'].includes(newStatus)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_STATUS, 'newStatus debe ser pending, completed o failed');
  }

  const updated = await Swap.updateStatus(id, newStatus);
  res.json({
    message: 'Estado actualizado exitosamente',
    data: updated
  });
};

// Top traders (analytics)
const getTopTraders = async (req, res) => {
  const { limit, period } = req.query;

  let traderLimit = 10;
  if (limit) {
    traderLimit = parseInt(limit);
    if (isNaN(traderLimit) || traderLimit < 1 || traderLimit > 50) {
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'limit debe ser un número entre 1 y 50');
    }
  }

  const validPeriods = ['7d', '30d', '90d'];
  const traderPeriod = validPeriods.includes(period) ? period : '30d';

  const topTraders = await Swap.getTopTraders(traderLimit, traderPeriod);
  res.json(topTraders);
};

// Resumen de mercado (analytics)
const getMarketSummary = async (req, res) => {
  const { pairId } = req.query;

  if (pairId && !isValidUUID(pairId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'pairId debe ser un UUID válido');
  }

  const summary = await Swap.getMarketSummary(pairId);
  res.json(summary);
};

// Estadísticas por crypto (analytics)
const getStatsByCrypto = async (req, res) => {
  const filters = { ...req.query };

  if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaDesde debe ser una fecha válida en formato ISO8601');
  }
  if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaHasta debe ser una fecha válida en formato ISO8601');
  }

  const stats = await Swap.getStatsByCrypto(filters);
  res.json(stats);
};

module.exports = {
  // Operaciones principales
  createOrder,
  calculateExchange,
  checkTransactionLimit,
  getMyBalances,

  // Consultas básicas
  getIntercambios,
  getIntercambioById,
  getMyIntercambios,
  searchIntercambios,

  // Análisis de mercado
  getVolumeByPair,
  getPriceHistory,
  getLastPrice,
  getMyDailyVolume,
  getMyTradingSummary,
  getIntercambioStats,

  // Operaciones administrativas
  updateIntercambioStatus,

  // Analytics
  getTopTraders,
  getMarketSummary,
  getStatsByCrypto
};
