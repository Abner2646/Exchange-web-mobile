// controllers/intercambioExchange.controller.js

const { IntercambioExchange, Usuario, ParExchange, BalanceUsuario, Criptomoneda, sequelize } = require('../models/index.js');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const money = require('../utils/money');
const { calculateSettlement } = require('../services/intercambioSettlement.service');
const { liquidarSwap } = require('../services/ledger/operations');
const idempotency = require('../middleware/idempotency.middleware');

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
// llegó a estar hardcodeada para ejecutar siempre "venta" sin importar el
// `tipo` recibido, con el chequeo de límite diario comentado. Ahora respeta
// `tipo`, revalida el límite diario, y pasa la transacción de forma
// consistente a cada escritura (incluida la comisión a la wallet maestra,
// que antes se confirmaba en su propia transacción aparte — ver el fix de
// WalletMaestra.updateBalance en este mismo commit).
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const usuarioId = req.user.id;
    const { parId, tipo, cantidadBase } = req.body;
    const compartimento = req.body.compartimento || 'funding';

    if (!parId || !tipo || !cantidadBase) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId, tipo y cantidadBase son requeridos');
    }

    if (!['funding', 'spot'].includes(compartimento)) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'Compartimento inválido (funding|spot)');
    }

    if (!isValidUUID(parId)) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId debe ser un UUID válido');
    }

    if (!['compra', 'venta'].includes(tipo)) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'tipo debe ser "compra" o "venta"');
    }

    if (typeof cantidadBase !== 'number' || cantidadBase <= 0) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'cantidadBase debe ser un número mayor a 0');
    }

    const baseDecimals = (cantidadBase.toString().split('.')[1] || '').length;
    if (baseDecimals > 8) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'cantidadBase no puede tener más de 8 decimales');
    }

    const par = await ParExchange.findByPk(parId, {
      include: [
        { model: Criptomoneda, as: 'criptoBase' },
        { model: Criptomoneda, as: 'criptoQuote' }
      ],
      transaction
    });

    if (!par || !par.activo) {
      await transaction.rollback();
      throw new AppError(404, errorCodes.EXCHANGE_PAIR_NOT_FOUND, 'Par de intercambio no encontrado o inactivo');
    }

    // precio canónico (string): par.precioActual es DECIMAL — pasarlo por
    // parseFloat perdería dígitos en precios de alta precisión antes de operar.
    const precio = String(par.precioActual);
    if (!par.precioActual || money.compare(precio, '0') <= 0) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_PAIR_NO_PRICE, 'El par no tiene un precio válido configurado');
    }

    // FOR UPDATE sobre la fila del usuario: serializa la sección crítica del
    // límite diario (AML) POR USUARIO. Sin este lock, dos swaps concurrentes del
    // mismo usuario leen el mismo getDailyVolume y ambos pasan → el volumen
    // combinado excede limiteDiarioUsd (Radar #12d). Con el lock, el segundo swap
    // espera al commit del primero y re-lee el volumen ya incluyéndolo. Es
    // per-usuario (distintos usuarios lockean filas distintas, sin contención) y
    // se toma ANTES de los locks de saldo del ledger (orden consistente → sin
    // deadlock). El anti-sobregiro del ledger no cubre este agregado.
    const usuario = await Usuario.findByPk(usuarioId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!usuario || !usuario.activo) {
      await transaction.rollback();
      throw new AppError(404, errorCodes.EXCHANGE_USER_NOT_FOUND, 'Usuario no encontrado o inactivo');
    }

    const comisionPorcentaje = String(par.comisionPorcentaje || '0.1');
    const { cantidadQuote, comisionMonto, requiredQuote, netQuote } =
      calculateSettlement({ cantidadBase, precio, comisionPorcentaje, tipo });

    const dailyVolume = await IntercambioExchange.getDailyVolume(usuarioId, new Date(), transaction);
    const newDailyVolume = money.add(String(dailyVolume), cantidadQuote);

    if (money.compare(newDailyVolume, String(usuario.limiteDiarioUsd)) > 0) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_DAILY_LIMIT_EXCEEDED, 'Límite diario de operaciones excedido');
    }

    const criptoBaseId = par.criptoBaseId;
    const criptoQuoteId = par.criptoQuoteId;
    let netAmount;

    // Chequeo de suficiencia sobre la proyección del ledger (da el error code de
    // dominio correcto). El anti-sobregiro atómico real es el FOR UPDATE de
    // postTransaction dentro de liquidarSwap.
    if (tipo === 'compra') {
      const balanceQuote = await BalanceUsuario.getSaldoCompartimento(usuarioId, criptoQuoteId, compartimento, { transaction });
      if (money.compare(String(balanceQuote.disponible), requiredQuote) < 0) {
        await transaction.rollback();
        throw new AppError(400, errorCodes.EXCHANGE_INSUFFICIENT_BALANCE, 'Saldo insuficiente en moneda quote para realizar la operación');
      }
      netAmount = String(cantidadBase);
    } else {
      const balanceBase = await BalanceUsuario.getSaldoCompartimento(usuarioId, criptoBaseId, compartimento, { transaction });
      if (money.compare(String(balanceBase.disponible), String(cantidadBase)) < 0) {
        await transaction.rollback();
        throw new AppError(400, errorCodes.EXCHANGE_INSUFFICIENT_BALANCE, 'Saldo insuficiente en moneda base para realizar la operación');
      }
      netAmount = netQuote;
    }

    const newOrder = await IntercambioExchange.create({
      usuarioId,
      parId,
      tipo,
      cantidadBase,
      cantidadQuote,
      precio,
      comisionMonto,
      comisionPorcentaje,
      estado: 'completado',
      completedAt: new Date()
    }, { transaction });

    // Paso D: liquidación rica en el ledger. Usuario ↔ treasury (inventario de la
    // casa); la comisión (en quote) acredita fee_revenue. Reemplaza los
    // updateBalance (funding+suspense) y el crédito a WalletMaestra.balanceTotal.
    await liquidarSwap({
      usuarioId,
      criptoBaseId,
      criptoQuoteId,
      cantidadBase,
      cantidadQuote,
      comisionMonto,
      requiredQuote,
      netQuote,
      tipo,
      compartimento,
      referencia: `swap:${newOrder.id}`,
    }, transaction);

    const responseBody = {
      message: 'Intercambio realizado exitosamente',
      data: {
        ...newOrder.toJSON(),
        precioUsado: precio,
        comisionCalculada: comisionMonto,
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
  const { parId, cantidadBase, tipo } = req.body;

  // Validaciones
  if (!parId || !cantidadBase || !tipo) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId, cantidadBase y tipo son requeridos');
  }

  if (!isValidUUID(parId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId debe ser un UUID válido');
  }

  if (!['compra', 'venta'].includes(tipo)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'tipo debe ser "compra" o "venta"');
  }

  if (typeof cantidadBase !== 'number' || cantidadBase <= 0.00000001) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'cantidadBase debe ser un número mayor a 0.00000001');
  }

  const decimals = (cantidadBase.toString().split('.')[1] || '').length;
  if (decimals > 8) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'cantidadBase no puede tener más de 8 decimales');
  }

  // Obtener el par para usar su precio actual
  const par = await ParExchange.findByPk(parId, {
    include: [
      { model: Criptomoneda, as: 'criptoBase' },
      { model: Criptomoneda, as: 'criptoQuote' }
    ]
  });

  if (!par || !par.activo) {
    throw new AppError(404, errorCodes.EXCHANGE_PAIR_NOT_FOUND, 'Par de intercambio no encontrado o inactivo');
  }

  const precio = String(par.precioActual);
  if (!par.precioActual || money.compare(precio, '0') <= 0) {
    throw new AppError(400, errorCodes.EXCHANGE_PAIR_NO_PRICE, 'El par no tiene un precio válido configurado');
  }

  // Mismo settlement exacto que usa la ejecución (createExchange): así el monto
  // mostrado en el preview coincide con el ejecutado, no dos cálculos float
  // independientes que podían divergir.
  const comisionPorcentaje = String(par.comisionPorcentaje || '0.1');
  const { cantidadQuote, comisionMonto, cantidadFinal } =
    calculateSettlement({ cantidadBase, precio, comisionPorcentaje, tipo });

  const impactoSlippage = 0;

  const calculation = {
    par: {
      id: par.id,
      base: par.criptoBase.symbol,
      quote: par.criptoQuote.symbol,
      precio: precio,
      volumen24h: par.volumen24h || 0,
      ultimaActualizacion: par.ultimaActualizacion
    },
    calculo: {
      cantidadBase: cantidadBase,
      cantidadQuote: cantidadQuote,
      comisionPorcentaje: comisionPorcentaje,
      comisionMonto: comisionMonto,
      impactoSlippage: impactoSlippage,
      cantidadFinal: cantidadFinal,
      direccion: tipo,
      precioEfectivo: precio
    },
    advertencias: []
  };

  res.json(calculation);
};

// Verificar límite de transacción
const checkTransactionLimit = async (req, res) => {
  const usuarioId = req.user.id;
  const { cantidadQuote } = req.body;

  if (!cantidadQuote || typeof cantidadQuote !== 'number' || cantidadQuote <= 0) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'cantidadQuote debe ser un número positivo');
  }

  const dailyVolume = await IntercambioExchange.getDailyVolume(usuarioId);
  const usuario = await Usuario.findByPk(usuarioId);

  if (!usuario) {
    throw new AppError(404, errorCodes.EXCHANGE_USER_NOT_FOUND, 'Usuario no encontrado');
  }

  const remainingLimit = usuario.limiteDiarioUsd - dailyVolume;

  if (remainingLimit < cantidadQuote) {
    throw new AppError(400, errorCodes.EXCHANGE_DAILY_LIMIT_EXCEEDED, 'Límite diario de operaciones excedido');
  }

  res.json({
    canTransact: true,
    dailyVolume,
    limit: usuario.limiteDiarioUsd,
    remainingLimit,
    requestedAmount: cantidadQuote
  });
};

// Obtener mis balances — forma UNIFICADA (2026-09-03): los tres endpoints de
// "mis balances" (balances/intercambio/usuario) devuelven la misma forma aditiva
// compartimentada de getBalancesConCompartimentos (totales de raíz Funding+Spot +
// desglose por compartimento + objeto `criptomoneda`). Antes este endpoint era
// funding-only y re-adjuntaba la cripto a mano. Cambio de contrato documentado en
// docs/frontend-rebuild/backend-contract-changes.md. El orden no está garantizado.
const getMyBalances = async (req, res) => {
  const usuarioId = req.user.id;
  const balances = await BalanceUsuario.getBalancesConCompartimentos(usuarioId);
  res.json(balances);
};

// Listar todos los intercambios (admin)
const getIntercambios = async (req, res) => {
  const filters = { ...req.query };

  // Validar filtros opcionales
  if (filters.estado && !['pendiente', 'completado', 'fallido'].includes(filters.estado)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'estado debe ser pendiente, completado o fallido');
  }

  if (filters.tipo && !['compra', 'venta'].includes(filters.tipo)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'tipo debe ser compra o venta');
  }

  if (filters.usuarioId && !isValidUUID(filters.usuarioId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'usuarioId debe ser un UUID válido');
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

  const result = await IntercambioExchange.getAll(filters);
  res.json(result);
};

// Obtener intercambio por ID
const getIntercambioById = async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'ID debe ser un UUID válido');
  }

  const result = await IntercambioExchange.getById(id);
  if (!result) throw new AppError(404, errorCodes.EXCHANGE_NOT_FOUND, 'Intercambio no encontrado');
  res.json(result);
};

// Obtener mis intercambios
const getMyIntercambios = async (req, res) => {
  const usuarioId = req.user.id;
  const filters = { ...req.query };

  if (filters.tipo && !['compra', 'venta'].includes(filters.tipo)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'tipo debe ser compra o venta');
  }

  if (filters.estado && !['pendiente', 'completado', 'fallido'].includes(filters.estado)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'estado debe ser pendiente, completado o fallido');
  }

  if (filters.parId && !isValidUUID(filters.parId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId debe ser un UUID válido');
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

  const result = await IntercambioExchange.getByUserId(usuarioId, filters);
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

  const results = await IntercambioExchange.search(q.trim(), searchLimit);
  res.json(results);
};

// Obtener estadísticas generales
const getIntercambioStats = async (req, res) => {
  const filters = { ...req.query };

  if (filters.usuarioId && !isValidUUID(filters.usuarioId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'usuarioId debe ser un UUID válido');
  }

  if (filters.parId && !isValidUUID(filters.parId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId debe ser un UUID válido');
  }

  if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaDesde debe ser una fecha válida en formato ISO8601');
  }
  if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaHasta debe ser una fecha válida en formato ISO8601');
  }

  const stats = await IntercambioExchange.getStats(filters);
  res.json(stats);
};

// Obtener volumen por par
const getVolumeByPair = async (req, res) => {
  const { parId } = req.params;

  if (!isValidUUID(parId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId debe ser un UUID válido');
  }

  const filters = { ...req.query };
  if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaDesde debe ser una fecha válida en formato ISO8601');
  }
  if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaHasta debe ser una fecha válida en formato ISO8601');
  }

  if (filters.estado && !['pendiente', 'completado', 'fallido'].includes(filters.estado)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'estado debe ser pendiente, completado o fallido');
  }

  const volume = await IntercambioExchange.getVolumeByPair(parId, filters);
  res.json(volume);
};

// Obtener historial de precios
const getPriceHistory = async (req, res) => {
  const { parId } = req.params;

  if (!isValidUUID(parId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId debe ser un UUID válido');
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

  const history = await IntercambioExchange.getPriceHistory(parId, filters);
  res.json(history);
};

// Obtener último precio
const getLastPrice = async (req, res) => {
  const { parId } = req.params;

  if (!isValidUUID(parId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId debe ser un UUID válido');
  }

  const lastPrice = await IntercambioExchange.getLastPrice(parId);

  if (lastPrice === null) {
    throw new AppError(404, errorCodes.EXCHANGE_NOT_FOUND, 'No hay intercambios completados para este par');
  }

  res.json({
    parId,
    lastPrice,
    timestamp: new Date()
  });
};

// Obtener volumen diario del usuario
const getMyDailyVolume = async (req, res) => {
  const usuarioId = req.user.id;
  const { date } = req.query;

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'date debe tener formato YYYY-MM-DD');
  }

  const targetDate = date ? new Date(date + 'T00:00:00.000Z') : new Date();

  if (isNaN(targetDate.getTime())) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'Fecha inválida');
  }

  const volume = await IntercambioExchange.getDailyVolume(usuarioId, targetDate);

  res.json({
    date: targetDate.toISOString().split('T')[0],
    volume
  });
};

// Obtener resumen del trading del usuario
const getMyTradingSummary = async (req, res) => {
  const usuarioId = req.user.id;
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
    usuarioId
  };

  const summary = await IntercambioExchange.getStats(filters);

  res.json({
    period: period || 'day',
    dateRange: {
      from: fechaDesde,
      to: new Date()
    },
    ...summary
  });
};

// Actualizar estado de intercambio (admin)
const updateIntercambioStatus = async (req, res) => {
  const { id } = req.params;
  const { newStatus } = req.body;

  if (!isValidUUID(id)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'ID debe ser un UUID válido');
  }

  if (!newStatus || !['pendiente', 'completado', 'fallido'].includes(newStatus)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_STATUS, 'newStatus debe ser pendiente, completado o fallido');
  }

  const updated = await IntercambioExchange.updateStatus(id, newStatus);
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

  const topTraders = await IntercambioExchange.getTopTraders(traderLimit, traderPeriod);
  res.json(topTraders);
};

// Resumen de mercado (analytics)
const getMarketSummary = async (req, res) => {
  const { parId } = req.query;

  if (parId && !isValidUUID(parId)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId debe ser un UUID válido');
  }

  const summary = await IntercambioExchange.getMarketSummary(parId);
  res.json(summary);
};

// Estadísticas por criptomoneda (analytics)
const getStatsByCrypto = async (req, res) => {
  const filters = { ...req.query };

  if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaDesde debe ser una fecha válida en formato ISO8601');
  }
  if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
    throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'fechaHasta debe ser una fecha válida en formato ISO8601');
  }

  const stats = await IntercambioExchange.getStatsByCrypto(filters);
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
