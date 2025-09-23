// controllers/intercambioExchange.controller.js

const { IntercambioExchange, Usuario, ParExchange, BalanceUsuario, WalletMaestra, Criptomoneda, sequelize } = require('../models/index.js');

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

// Crear nueva orden
const createOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('Iniciando creación de orden')
    const usuarioId = req.user.id;
    const { parId, tipo, cantidadBase } = req.body;
    
    // Validar campos requeridos (sin precio)
    console.log('Validando campos requeridos')
    if (!parId || !tipo || !cantidadBase) {
      await transaction.rollback();
      return res.status(400).json({ error: 'parId, tipo y cantidadBase son requeridos' });
    }
    
    // Validar UUID
    console.log('Validadndo UUID========')
    if (!isValidUUID(parId)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'parId debe ser un UUID válido' });
    }
    
    // Validar tipo
    console.log('Validadno tipo========')
    if (!['compra', 'venta'].includes(tipo)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'tipo debe ser "compra" o "venta"' });
    }

    // Validar cantidadBase
    console.log('Validadno transacción base========')
    if (typeof cantidadBase !== 'number' || cantidadBase <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'cantidadBase debe ser un número mayor a 0' });
    }

    // Validar decimales
    console.log('Validando decimales========')
    const baseDecimals = (cantidadBase.toString().split('.')[1] || '').length;
    if (baseDecimals > 8) {
      await transaction.rollback();
      return res.status(400).json({ error: 'cantidadBase no puede tener más de 8 decimales' });
    }
    
    // Obtener información del par con precio actual
    console.log('Validando info del par con precio actual========')
    const par = await ParExchange.findByPk(parId, { 
      include: [
        { model: Criptomoneda, as: 'criptoBase' },
        { model: Criptomoneda, as: 'criptoQuote' }
      ],
      transaction 
    });
    
    if (!par || !par.activo) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Par de intercambio no encontrado o inactivo' });
    }

    // Usar el precio actual del par
    const precio = parseFloat(par.precioActual);
    if (!precio || precio <= 0) {
      await transaction.rollback();
      return res.status(400).json({ error: 'El par no tiene un precio válido configurado' });
    }

    // Obtener usuario para verificar límites
    const usuario = await Usuario.findByPk(usuarioId, { transaction });
    if (!usuario || !usuario.activo) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Usuario no encontrado o inactivo' });
    }
    // Calcular valores con el precio actual
    const cantidadQuote = parseFloat((cantidadBase * precio).toFixed(8));
    const comisionPorcentaje = parseFloat(par.comisionPorcentaje || 0.1);
    const comisionMonto = parseFloat((cantidadQuote * (comisionPorcentaje / 100)).toFixed(8));
    
    // Verificar límite diario
    const dailyVolume = await IntercambioExchange.getDailyVolume(usuarioId, new Date(), transaction);
    const newDailyVolume = dailyVolume + cantidadQuote;
    
    if (newDailyVolume > usuario.limiteDiarioUsd) {
      await transaction.rollback();
      return res.status(400).json({ 
        error: 'Límite diario excedido',
        dailyVolume,
        limit: usuario.limiteDiarioUsd,
        requestedAmount: cantidadQuote,
        currentPrice: precio
      });
    }

    // Determinar qué criptomonedas se necesitan
    const criptoBaseId = par.criptoBaseId;
    const criptoQuoteId = par.criptoQuoteId;
    
    // Verificar balances según el tipo de operación
    if (tipo === 'compra') {
      // Para comprar: necesito criptomoneda quote + comisión
      const requiredAmount = cantidadQuote + comisionMonto;
      
      const balanceQuote = await BalanceUsuario.findOne({
        where: { userId: usuarioId, criptomonedaId: criptoQuoteId },
        transaction
      });
      
      if (!balanceQuote || parseFloat(balanceQuote.balanceDisponible) < requiredAmount) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: 'Saldo insuficiente en moneda quote',
          required: requiredAmount,
          available: balanceQuote ? parseFloat(balanceQuote.balanceDisponible) : 0,
          currency: par.criptoQuote.symbol,
          currentPrice: precio
        });
      }
      
      // Ejecutar la transacción
      await BalanceUsuario.updateBalance(usuarioId, criptoQuoteId, -requiredAmount, 'disponible');
      await BalanceUsuario.updateBalance(usuarioId, criptoBaseId, cantidadBase, 'disponible');
      
      // Agregar comisión a la wallet maestra (quote)
      const walletMaestraQuote = await WalletMaestra.findOne({
        where: { criptomonedaId: criptoQuoteId },
        transaction
      });
      
      if (walletMaestraQuote) {
        await WalletMaestra.addToBalance(walletMaestraQuote.id, comisionMonto);
      }
      
    } else {
      // Para vender: necesito criptomoneda base
      const balanceBase = await BalanceUsuario.findOne({
        where: { userId: usuarioId, criptomonedaId: criptoBaseId },
        transaction
      });
      
      if (!balanceBase || parseFloat(balanceBase.balanceDisponible) < cantidadBase) {
        await transaction.rollback();
        return res.status(400).json({ 
          error: 'Saldo insuficiente en moneda base',
          required: cantidadBase,
          available: balanceBase ? parseFloat(balanceBase.balanceDisponible) : 0,
          currency: par.criptoBase.symbol,
          currentPrice: precio
        });
      }
      
      // Ejecutar la transacción
      await BalanceUsuario.updateBalance(usuarioId, criptoBaseId, -cantidadBase, 'disponible');
      
      const netAmount = cantidadQuote - comisionMonto;
      await BalanceUsuario.updateBalance(usuarioId, criptoQuoteId, netAmount, 'disponible');
      
      // Agregar comisión a la wallet maestra (quote)
      const walletMaestraQuote = await WalletMaestra.findOne({
        where: { criptomonedaId: criptoQuoteId },
        transaction
      });
      
      if (walletMaestraQuote) {
        await WalletMaestra.addToBalance(walletMaestraQuote.id, comisionMonto);
      }
    }

    // Crear el registro del intercambio como completado
    const newOrder = await IntercambioExchange.create({
      usuarioId,
      parId,
      tipo,
      cantidadBase,
      cantidadQuote,
      precio, // Precio obtenido automáticamente del par
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
        comisionCalculada: comisionMonto
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating exchange:', error);
    res.status(400).json({ error: error.message });
  }
};

// Calcular intercambio antes de ejecutar
const calculateExchange = async (req, res) => {
  try {
    const { parId, cantidadBase, tipo } = req.body;
    
    // Validaciones
    if (!parId || !cantidadBase || !tipo) {
      return res.status(400).json({ error: 'parId, cantidadBase y tipo son requeridos' });
    }

    if (!isValidUUID(parId)) {
      return res.status(400).json({ error: 'parId debe ser un UUID válido' });
    }

    if (!['compra', 'venta'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser "compra" o "venta"' });
    }

    if (typeof cantidadBase !== 'number' || cantidadBase <= 0.00000001) {
      return res.status(400).json({ error: 'cantidadBase debe ser un número mayor a 0.00000001' });
    }

    const decimals = (cantidadBase.toString().split('.')[1] || '').length;
    if (decimals > 8) {
      return res.status(400).json({ error: 'cantidadBase no puede tener más de 8 decimales' });
    }

    // Obtener el par para usar su precio actual
    const par = await ParExchange.findByPk(parId, { 
      include: [
        { model: Criptomoneda, as: 'criptoBase' },
        { model: Criptomoneda, as: 'criptoQuote' }
      ]
    });
    
    if (!par || !par.activo) {
      return res.status(404).json({ error: 'Par de intercambio no encontrado o inactivo' });
    }

    const precio = parseFloat(par.precioActual);
    if (!precio || precio <= 0) {
      return res.status(400).json({ error: 'El par no tiene un precio válido configurado' });
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
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Verificar límite de transacción
const checkTransactionLimit = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { cantidadQuote } = req.body;
    
    if (!cantidadQuote || typeof cantidadQuote !== 'number' || cantidadQuote <= 0) {
      return res.status(400).json({ error: 'cantidadQuote debe ser un número positivo' });
    }
    
    const dailyVolume = await IntercambioExchange.getDailyVolume(usuarioId);
    const usuario = await Usuario.findByPk(usuarioId);
    
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    const remainingLimit = usuario.limiteDiarioUsd - dailyVolume;
    
    if (remainingLimit < cantidadQuote) {
      return res.status(400).json({ 
        error: 'Límite diario excedido',
        dailyVolume,
        limit: usuario.limiteDiarioUsd,
        remainingLimit,
        requestedAmount: cantidadQuote
      });
    }
    
    res.json({ 
      canTransact: true,
      dailyVolume,
      limit: usuario.limiteDiarioUsd,
      remainingLimit,
      requestedAmount: cantidadQuote
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Obtener mis balances
const getMyBalances = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Listar todos los intercambios (admin)
const getIntercambios = async (req, res) => {
  try {
    const filters = { ...req.query };
    
    // Validar filtros opcionales
    if (filters.estado && !['pendiente', 'completado', 'fallido'].includes(filters.estado)) {
      return res.status(400).json({ error: 'estado debe ser pendiente, completado o fallido' });
    }
    
    if (filters.tipo && !['compra', 'venta'].includes(filters.tipo)) {
      return res.status(400).json({ error: 'tipo debe ser compra o venta' });
    }
    
    if (filters.usuarioId && !isValidUUID(filters.usuarioId)) {
      return res.status(400).json({ error: 'usuarioId debe ser un UUID válido' });
    }
    
    if (filters.limit) {
      const limit = parseInt(filters.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ error: 'limit debe ser un número entre 1 y 100' });
      }
    }
    
    if (filters.offset) {
      const offset = parseInt(filters.offset);
      if (isNaN(offset) || offset < 0) {
        return res.status(400).json({ error: 'offset debe ser un número mayor o igual a 0' });
      }
    }
    
    if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
      return res.status(400).json({ error: 'fechaDesde debe ser una fecha válida en formato ISO8601' });
    }
    if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
      return res.status(400).json({ error: 'fechaHasta debe ser una fecha válida en formato ISO8601' });
    }
    
    const result = await IntercambioExchange.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener intercambio por ID
const getIntercambioById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'ID debe ser un UUID válido' });
    }
    
    const result = await IntercambioExchange.getById(id);
    if (!result) return res.status(404).json({ error: 'Intercambio no encontrado' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener mis intercambios
const getMyIntercambios = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const filters = { ...req.query };
    
    if (filters.tipo && !['compra', 'venta'].includes(filters.tipo)) {
      return res.status(400).json({ error: 'tipo debe ser compra o venta' });
    }
    
    if (filters.estado && !['pendiente', 'completado', 'fallido'].includes(filters.estado)) {
      return res.status(400).json({ error: 'estado debe ser pendiente, completado o fallido' });
    }
    
    if (filters.parId && !isValidUUID(filters.parId)) {
      return res.status(400).json({ error: 'parId debe ser un UUID válido' });
    }
    
    if (filters.limit) {
      const limit = parseInt(filters.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ error: 'limit debe ser un número entre 1 y 100' });
      }
    }
    
    if (filters.offset) {
      const offset = parseInt(filters.offset);
      if (isNaN(offset) || offset < 0) {
        return res.status(400).json({ error: 'offset debe ser un número mayor o igual a 0' });
      }
    }
    
    if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
      return res.status(400).json({ error: 'fechaDesde debe ser una fecha válida en formato ISO8601' });
    }
    if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
      return res.status(400).json({ error: 'fechaHasta debe ser una fecha válida en formato ISO8601' });
    }
    
    const result = await IntercambioExchange.getByUserId(usuarioId, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Buscar intercambios
const searchIntercambios = async (req, res) => {
  try {
    const { q, limit } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.status(400).json({ error: 'Término de búsqueda (q) debe tener al menos 2 caracteres' });
    }

    if (q.length > 100) {
      return res.status(400).json({ error: 'Término de búsqueda no puede exceder 100 caracteres' });
    }

    let searchLimit = 10;
    if (limit) {
      searchLimit = parseInt(limit);
      if (isNaN(searchLimit) || searchLimit < 1 || searchLimit > 50) {
        return res.status(400).json({ error: 'limit debe ser un número entre 1 y 50' });
      }
    }
    
    const results = await IntercambioExchange.search(q.trim(), searchLimit);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas generales
const getIntercambioStats = async (req, res) => {
  try {
    const filters = { ...req.query };
    
    if (filters.usuarioId && !isValidUUID(filters.usuarioId)) {
      return res.status(400).json({ error: 'usuarioId debe ser un UUID válido' });
    }
    
    if (filters.parId && !isValidUUID(filters.parId)) {
      return res.status(400).json({ error: 'parId debe ser un UUID válido' });
    }
    
    if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
      return res.status(400).json({ error: 'fechaDesde debe ser una fecha válida en formato ISO8601' });
    }
    if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
      return res.status(400).json({ error: 'fechaHasta debe ser una fecha válida en formato ISO8601' });
    }
    
    const stats = await IntercambioExchange.getStats(filters);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener volumen por par
const getVolumeByPair = async (req, res) => {
  try {
    const { parId } = req.params;
    
    if (!isValidUUID(parId)) {
      return res.status(400).json({ error: 'parId debe ser un UUID válido' });
    }

    const filters = { ...req.query };
    if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
      return res.status(400).json({ error: 'fechaDesde debe ser una fecha válida en formato ISO8601' });
    }
    if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
      return res.status(400).json({ error: 'fechaHasta debe ser una fecha válida en formato ISO8601' });
    }

    if (filters.estado && !['pendiente', 'completado', 'fallido'].includes(filters.estado)) {
      return res.status(400).json({ error: 'estado debe ser pendiente, completado o fallido' });
    }
    
    const volume = await IntercambioExchange.getVolumeByPair(parId, filters);
    res.json(volume);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener historial de precios
const getPriceHistory = async (req, res) => {
  try {
    const { parId } = req.params;
    
    if (!isValidUUID(parId)) {
      return res.status(400).json({ error: 'parId debe ser un UUID válido' });
    }

    const filters = { ...req.query };
    
    if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
      return res.status(400).json({ error: 'fechaDesde debe ser una fecha válida en formato ISO8601' });
    }
    if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
      return res.status(400).json({ error: 'fechaHasta debe ser una fecha válida en formato ISO8601' });
    }

    if (filters.limit) {
      const limit = parseInt(filters.limit);
      if (isNaN(limit) || limit < 1 || limit > 5000) {
        return res.status(400).json({ error: 'limit debe ser un número entre 1 y 5000' });
      }
    }

    if (filters.order && !['ASC', 'DESC'].includes(filters.order)) {
      return res.status(400).json({ error: 'order debe ser ASC o DESC' });
    }
    
    const history = await IntercambioExchange.getPriceHistory(parId, filters);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener último precio
const getLastPrice = async (req, res) => {
  try {
    const { parId } = req.params;
    
    if (!isValidUUID(parId)) {
      return res.status(400).json({ error: 'parId debe ser un UUID válido' });
    }
    
    const lastPrice = await IntercambioExchange.getLastPrice(parId);
    
    if (lastPrice === null) {
      return res.status(404).json({ error: 'No hay intercambios completados para este par' });
    }
    
    res.json({ 
      parId,
      lastPrice,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener volumen diario del usuario
const getMyDailyVolume = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { date } = req.query;
    
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date debe tener formato YYYY-MM-DD' });
    }
    
    const targetDate = date ? new Date(date + 'T00:00:00.000Z') : new Date();
    
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Fecha inválida' });
    }
    
    const volume = await IntercambioExchange.getDailyVolume(usuarioId, targetDate);
    
    res.json({ 
      date: targetDate.toISOString().split('T')[0],
      volume 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener resumen del trading del usuario
const getMyTradingSummary = async (req, res) => {
  try {
    const usuarioId = req.usuario.id;
    const { period } = req.query;
    
    if (period && !['day', 'week', 'month', 'year'].includes(period)) {
      return res.status(400).json({ error: 'period debe ser day, week, month o year' });
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar estado de intercambio (admin)
const updateIntercambioStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus } = req.body;
    
    if (!isValidUUID(id)) {
      return res.status(400).json({ error: 'ID debe ser un UUID válido' });
    }
    
    if (!newStatus || !['pendiente', 'completado', 'fallido'].includes(newStatus)) {
      return res.status(400).json({ error: 'newStatus debe ser pendiente, completado o fallido' });
    }
    
    const updated = await IntercambioExchange.updateStatus(id, newStatus);
    res.json({ 
      message: 'Estado actualizado exitosamente', 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Top traders (analytics)
const getTopTraders = async (req, res) => {
  try {
    const { limit, period } = req.query;
    
    let traderLimit = 10;
    if (limit) {
      traderLimit = parseInt(limit);
      if (isNaN(traderLimit) || traderLimit < 1 || traderLimit > 50) {
        return res.status(400).json({ error: 'limit debe ser un número entre 1 y 50' });
      }
    }
    
    const validPeriods = ['7d', '30d', '90d'];
    const traderPeriod = validPeriods.includes(period) ? period : '30d';
    
    const topTraders = await IntercambioExchange.getTopTraders(traderLimit, traderPeriod);
    res.json(topTraders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Resumen de mercado (analytics)
const getMarketSummary = async (req, res) => {
  try {
    const { parId } = req.query;
    
    if (parId && !isValidUUID(parId)) {
      return res.status(400).json({ error: 'parId debe ser un UUID válido' });
    }
    
    const summary = await IntercambioExchange.getMarketSummary(parId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Estadísticas por criptomoneda (analytics)
const getStatsByCrypto = async (req, res) => {
  try {
    const filters = { ...req.query };
    
    if (filters.fechaDesde && !isValidDate(filters.fechaDesde)) {
      return res.status(400).json({ error: 'fechaDesde debe ser una fecha válida en formato ISO8601' });
    }
    if (filters.fechaHasta && !isValidDate(filters.fechaHasta)) {
      return res.status(400).json({ error: 'fechaHasta debe ser una fecha válida en formato ISO8601' });
    }
    
    const stats = await IntercambioExchange.getStatsByCrypto(filters);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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