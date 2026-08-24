// controllers/intercambioExchange.controller.js

const { IntercambioExchange, Usuario, ParExchange, BalanceUsuario, WalletMaestra, Criptomoneda, sequelize } = require('../models/index.js');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');

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

    if (!parId || !tipo || !cantidadBase) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'parId, tipo y cantidadBase son requeridos');
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

    const precio = parseFloat(par.precioActual);
    if (!precio || precio <= 0) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_PAIR_NO_PRICE, 'El par no tiene un precio válido configurado');
    }

    const usuario = await Usuario.findByPk(usuarioId, { transaction });
    if (!usuario || !usuario.activo) {
      await transaction.rollback();
      throw new AppError(404, errorCodes.EXCHANGE_USER_NOT_FOUND, 'Usuario no encontrado o inactivo');
    }

    const cantidadQuote = parseFloat((cantidadBase * precio).toFixed(8));
    const comisionPorcentaje = parseFloat(par.comisionPorcentaje || 0.1);
    const comisionMonto = parseFloat((cantidadQuote * (comisionPorcentaje / 100)).toFixed(8));

    const dailyVolume = await IntercambioExchange.getDailyVolume(usuarioId, new Date(), transaction);
    const newDailyVolume = dailyVolume + cantidadQuote;

    if (newDailyVolume > usuario.limiteDiarioUsd) {
      await transaction.rollback();
      throw new AppError(400, errorCodes.EXCHANGE_DAILY_LIMIT_EXCEEDED, 'Límite diario de operaciones excedido');
    }

    const criptoBaseId = par.criptoBaseId;
    const criptoQuoteId = par.criptoQuoteId;
    let netAmount;

    if (tipo === 'compra') {
      // Comprar: se paga en quote (+ comisión), se recibe base.
      const requiredAmount = cantidadQuote + comisionMonto;

      const balanceQuote = await BalanceUsuario.findOne({
        where: { userId: usuarioId, criptomonedaId: criptoQuoteId },
        transaction
      });

      if (!balanceQuote || parseFloat(balanceQuote.balanceDisponible) < requiredAmount) {
        await transaction.rollback();
        throw new AppError(400, errorCodes.EXCHANGE_INSUFFICIENT_BALANCE, 'Saldo insuficiente en moneda quote para realizar la operación');
      }

      await BalanceUsuario.updateBalance(usuarioId, criptoQuoteId, -requiredAmount, 'disponible', transaction);
      await BalanceUsuario.updateBalance(usuarioId, criptoBaseId, cantidadBase, 'disponible', transaction);
      netAmount = cantidadBase;
    } else {
      // Vender: se paga en base, se recibe quote (- comisión).
      const balanceBase = await BalanceUsuario.findOne({
        where: { userId: usuarioId, criptomonedaId: criptoBaseId },
        transaction
      });

      if (!balanceBase || parseFloat(balanceBase.balanceDisponible) < cantidadBase) {
        await transaction.rollback();
        throw new AppError(400, errorCodes.EXCHANGE_INSUFFICIENT_BALANCE, 'Saldo insuficiente en moneda base para realizar la operación');
      }

      await BalanceUsuario.updateBalance(usuarioId, criptoBaseId, -cantidadBase, 'disponible', transaction);
      netAmount = cantidadQuote - comisionMonto;
      await BalanceUsuario.updateBalance(usuarioId, criptoQuoteId, netAmount, 'disponible', transaction);
    }

    // La comisión siempre se cobra en la moneda quote, para los dos tipos de operación.
    const walletMaestraQuote = await WalletMaestra.findOne({
      where: { criptomonedaId: criptoQuoteId },
      transaction
    });

    if (walletMaestraQuote) {
      await WalletMaestra.addToBalance(walletMaestraQuote.id, comisionMonto, transaction);
    } else {
      console.warn(`No se encontró wallet maestra para ${par.criptoQuote.symbol}`);
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

    await transaction.commit();

    res.status(201).json({
      message: 'Intercambio realizado exitosamente',
      data: {
        ...newOrder.toJSON(),
        precioUsado: precio,
        comisionCalculada: comisionMonto,
        netAmount
      }
    });
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

// TAMBIÉN CREAR FUNCIÓN PARA REVERTIR LA TRANSACCIÓN SI ES NECESARIO
const revertLastExchange = async (intercambioId) => {
  const transaction = await sequelize.transaction();

  try {
    const intercambio = await IntercambioExchange.findByPk(intercambioId, {
      include: [
        {
          model: ParExchange,
          include: [
            { model: Criptomoneda, as: 'criptoBase' },
            { model: Criptomoneda, as: 'criptoQuote' }
          ]
        }
      ],
      transaction
    });

    if (!intercambio) {
      throw new Error('Intercambio no encontrado');
    }

    console.log(`Revirtiendo intercambio ${intercambioId}...`);

    // Revertir las operaciones según el tipo
    if (intercambio.tipo === 'compra') {
      // Revertir compra: devolver quote, quitar base
      await BalanceUsuario.updateBalance(
        intercambio.usuarioId,
        intercambio.ParExchange.criptoQuoteId,
        intercambio.cantidadQuote + intercambio.comisionMonto,
        'disponible',
        transaction
      );
      await BalanceUsuario.updateBalance(
        intercambio.usuarioId,
        intercambio.ParExchange.criptoBaseId,
        -intercambio.cantidadBase,
        'disponible',
        transaction
      );
    } else {
      // Revertir venta: devolver base, quitar quote neto
      await BalanceUsuario.updateBalance(
        intercambio.usuarioId,
        intercambio.ParExchange.criptoBaseId,
        intercambio.cantidadBase,
        'disponible',
        transaction
      );
      await BalanceUsuario.updateBalance(
        intercambio.usuarioId,
        intercambio.ParExchange.criptoQuoteId,
        -(intercambio.cantidadQuote - intercambio.comisionMonto),
        'disponible',
        transaction
      );
    }

    // Marcar como revertido
    await intercambio.update({
      estado: 'revertido',
      revertedAt: new Date()
    }, { transaction });

    await transaction.commit();
    console.log('Intercambio revertido exitosamente');

  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }
    console.error('Error revirtiendo intercambio:', error);
    throw error;
  }
};

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

  const precio = parseFloat(par.precioActual);
  if (!precio || precio <= 0) {
    throw new AppError(400, errorCodes.EXCHANGE_PAIR_NO_PRICE, 'El par no tiene un precio válido configurado');
  }

  // Calcular con el precio actual del par
  const cantidadQuote = parseFloat((cantidadBase * precio).toFixed(8));
  const comisionPorcentaje = parseFloat(par.comisionPorcentaje || 0.1);
  const comisionMonto = parseFloat((cantidadQuote * (comisionPorcentaje / 100)).toFixed(8));

  let cantidadFinal, impactoSlippage = 0;

  if (tipo === 'compra') {
    // Para comprar base: necesito quote + comisión
    cantidadFinal = cantidadQuote + comisionMonto;
  } else {
    // Para vender base: recibo quote - comisión
    cantidadFinal = cantidadQuote - comisionMonto;
  }

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

// Obtener mis balances
const getMyBalances = async (req, res) => {
  const usuarioId = req.user.id;

  const balances = await BalanceUsuario.findAll({
    where: { userId: usuarioId },
    include: [
      {
        model: Criptomoneda,
        as: 'criptomoneda',
        attributes: ['id', 'symbol', 'nombre', 'decimales']
      }
    ],
    order: [['balanceDisponible', 'DESC']]
  });

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
