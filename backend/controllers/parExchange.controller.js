// controllers/parExchange.controller.js

const { ParExchange } = require('../models/index.js');
const priceService = require('../services/priceService');

// Listar pares de exchange
const getParesExchange = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await ParExchange.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener par de exchange por ID
const getParExchangeById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ParExchange.getById(id);
    if (!result) return res.status(404).json({ error: 'Par de exchange no encontrado' });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nuevo par de exchange (solo admin) - MEJORADO
const createParExchange = async (req, res) => {
  try {
    const { 
      criptoBaseId, 
      criptoQuoteId, 
      precioActual, 
      comisionPorcentaje, 
      activo = true,
      fuentePrecio = 'manual',
      simboloExterno
    } = req.body;
    
    if (!criptoBaseId || !criptoQuoteId || comisionPorcentaje === undefined) {
      return res.status(400).json({ 
        error: 'Los campos criptoBaseId, criptoQuoteId y comisionPorcentaje son requeridos' 
      });
    }

    // Validar precio si se proporciona
    if (precioActual && parseFloat(precioActual) <= 0) {
      return res.status(400).json({ 
        error: 'El precio actual debe ser mayor a 0' 
      });
    }

    if (parseFloat(comisionPorcentaje) < 0 || parseFloat(comisionPorcentaje) > 100) {
      return res.status(400).json({ 
        error: 'La comisión debe estar entre 0 y 100%' 
      });
    }

    // Validar fuente de precio
    const validSources = ['manual', 'coingecko', 'binance', 'chainlink'];
    if (!validSources.includes(fuentePrecio)) {
      return res.status(400).json({ 
        error: `La fuente de precio debe ser una de: ${validSources.join(', ')}` 
      });
    }

    const parData = {
      criptoBaseId,
      criptoQuoteId,
      comisionPorcentaje: parseFloat(comisionPorcentaje),
      activo,
      fuentePrecio,
      simboloExterno
    };

    // Si no hay precio manual y la fuente es automática, intentar obtenerlo
    if (!precioActual && fuentePrecio !== 'manual') {
      try {
        // Obtener símbolos de las criptomonedas para precio inicial
        const { Criptomoneda } = require('../models/index.js');
        const criptoBase = await Criptomoneda.findByPk(criptoBaseId);
        const criptoQuote = await Criptomoneda.findByPk(criptoQuoteId);
        
        if (criptoBase && criptoQuote) {
          const precioTemp = await priceService.getCurrentPrice(criptoBase.symbol, criptoQuote.symbol);
          if (precioTemp) {
            parData.precioActual = precioTemp.precioActual;
          } else {
            parData.precioActual = 1.0; // Precio temporal
          }
        } else {
          parData.precioActual = 1.0;
        }
      } catch (error) {
        console.warn('No se pudo obtener precio inicial automático:', error.message);
        parData.precioActual = 1.0;
      }
    } else {
      parData.precioActual = parseFloat(precioActual) || 1.0;
    }

    const nuevoPar = await ParExchange.createPar(parData);
    
    res.status(201).json({ 
      message: 'Par de exchange creado exitosamente', 
      data: nuevoPar 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar par de exchange por ID (solo admin) - MEJORADO
const updateParExchange = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      precioActual, 
      comisionPorcentaje, 
      activo, 
      fuentePrecio,
      simboloExterno 
    } = req.body;

    const updateData = {};
    
    if (precioActual !== undefined) {
      if (parseFloat(precioActual) <= 0) {
        return res.status(400).json({ 
          error: 'El precio actual debe ser mayor a 0' 
        });
      }
      updateData.precioActual = parseFloat(precioActual);
    }

    if (comisionPorcentaje !== undefined) {
      if (parseFloat(comisionPorcentaje) < 0 || parseFloat(comisionPorcentaje) > 100) {
        return res.status(400).json({ 
          error: 'La comisión debe estar entre 0 y 100%' 
        });
      }
      updateData.comisionPorcentaje = parseFloat(comisionPorcentaje);
    }

    if (activo !== undefined) {
      updateData.activo = activo;
    }

    if (fuentePrecio !== undefined) {
      const validSources = ['manual', 'coingecko', 'binance', 'chainlink'];
      if (!validSources.includes(fuentePrecio)) {
        return res.status(400).json({ 
          error: `La fuente de precio debe ser una de: ${validSources.join(', ')}` 
        });
      }
      updateData.fuentePrecio = fuentePrecio;
    }

    if (simboloExterno !== undefined) {
      updateData.simboloExterno = simboloExterno;
    }

    const updatedPar = await ParExchange.updatePar(id, updateData);

    res.json({ 
      message: 'Par de exchange actualizado exitosamente', 
      data: updatedPar 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Eliminar par de exchange por ID (solo super admin)
const deleteParExchange = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await ParExchange.deletePar(id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Buscar pares de exchange
const searchParesExchange = async (req, res) => {
  try {
    const { q: term, limit = 10 } = req.query;
    
    if (!term) {
      return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });
    }

    const result = await ParExchange.search(term, limit);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de pares de exchange - MEJORADO
const getParExchangeStats = async (req, res) => {
  try {
    const stats = await ParExchange.getStats();
    const priceServiceStats = priceService.getServiceStats();
    
    res.json({
      ...stats,
      priceService: priceServiceStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener par por símbolos de criptomonedas - MEJORADO
const getParBySymbols = async (req, res) => {
  try {
    const { baseSymbol, quoteSymbol } = req.params;
    const { realtime = false } = req.query;
    
    let par;
    
    if (realtime === 'true') {
      // Intentar obtener precio en tiempo real
      try {
        par = await priceService.getCurrentPrice(baseSymbol, quoteSymbol);
      } catch (error) {
        console.warn('Error obteniendo precio en tiempo real:', error.message);
        par = await ParExchange.getBySymbols(baseSymbol, quoteSymbol);
      }
    } else {
      par = await ParExchange.getBySymbols(baseSymbol, quoteSymbol);
    }
    
    if (!par) {
      return res.status(404).json({ 
        error: `Par ${baseSymbol}/${quoteSymbol} no encontrado` 
      });
    }
    
    res.json(par);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener pares por criptomoneda base
const getParesByBaseCrypto = async (req, res) => {
  try {
    const { criptoBaseId } = req.params;
    const pares = await ParExchange.getByBaseCrypto(criptoBaseId);
    res.json(pares);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener pares por criptomoneda quote
const getParesByQuoteCrypto = async (req, res) => {
  try {
    const { criptoQuoteId } = req.params;
    const pares = await ParExchange.getByQuoteCrypto(criptoQuoteId);
    res.json(pares);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener pares activos
const getActiveExchangePairs = async (req, res) => {
  try {
    const pares = await ParExchange.getActive();
    res.json(pares);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener top pares por volumen - CORREGIDO
const getTopPairsByVolume = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const pares = await ParExchange.getTopByVolume(parseInt(limit));
    res.json(pares);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener pares con comisión alta
const getHighCommissionPairs = async (req, res) => {
  try {
    const { threshold = 0.01 } = req.query;
    const pares = await ParExchange.getHighCommission(parseFloat(threshold));
    
    res.json({
      threshold: parseFloat(threshold),
      count: pares.length,
      pares
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener pares con precios desactualizados
const getOutdatedPricePairs = async (req, res) => {
  try {
    const { minutes = 60 } = req.query;
    const pares = await ParExchange.getOutdatedPrices(parseInt(minutes));
    
    res.json({
      threshold: `${minutes} minutos`,
      count: pares.length,
      pares
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar estado de par
const updateParStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;
    
    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El campo activo debe ser un valor booleano' });
    }

    const updated = await ParExchange.updateStatus(id, activo);
    res.json({ 
      message: `Par de exchange ${activo ? 'activado' : 'desactivado'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Alternar estado de par
const toggleParStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const par = await ParExchange.getById(id);
    
    if (!par) {
      return res.status(404).json({ error: 'Par de exchange no encontrado' });
    }

    const newStatus = !par.activo;
    const updated = await ParExchange.updateStatus(id, newStatus);
    
    res.json({ 
      message: `Par de exchange ${newStatus ? 'activado' : 'desactivado'} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar precio del par
const updateParPrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { precio } = req.body;
    
    if (!precio || precio <= 0) {
      return res.status(400).json({ 
        error: 'El precio debe ser un número mayor a 0' 
      });
    }

    const updated = await ParExchange.updatePrice(id, parseFloat(precio));
    res.json({ 
      message: `Precio actualizado a ${precio} exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar comisión del par
const updateParCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const { comision } = req.body;
    
    if (comision === undefined || comision < 0 || comision > 100) {
      return res.status(400).json({ 
        error: 'La comisión debe ser un número entre 0 y 100' 
      });
    }

    const updated = await ParExchange.updateCommission(id, parseFloat(comision));
    res.json({ 
      message: `Comisión actualizada a ${comision}% exitosamente`, 
      data: updated 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Calcular intercambio/exchange - MEJORADO
const calculateExchange = async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad, direccion = 'buy' } = req.body;
    
    if (!cantidad || cantidad <= 0) {
      return res.status(400).json({ 
        error: 'La cantidad debe ser un número mayor a 0' 
      });
    }

    if (!['buy', 'sell'].includes(direccion)) {
      return res.status(400).json({ 
        error: 'La dirección debe ser "buy" o "sell"' 
      });
    }

    const result = await ParExchange.calculateExchange(id, parseFloat(cantidad), direccion);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualización masiva de precios (webhook/API externa) - MEJORADO
const bulkUpdatePrices = async (req, res) => {
  try {
    const { prices } = req.body;
    
    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ 
        error: 'Se requiere un array de precios con formato: [{baseSymbol, quoteSymbol, price, volume?, change?}]' 
      });
    }

    // Validar formato de cada precio
    for (const price of prices) {
      if (!price.baseSymbol || !price.quoteSymbol || !price.price || price.price <= 0) {
        return res.status(400).json({ 
          error: 'Cada precio debe tener baseSymbol, quoteSymbol y price (mayor a 0)' 
        });
      }
    }

    const result = await ParExchange.bulkUpdatePrices(prices);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Dashboard de exchange - MEJORADO
const getExchangeDashboard = async (req, res) => {
  try {
    const stats = await ParExchange.getStats();
    const paresActivos = await ParExchange.getActive();
    const topPares = await ParExchange.getTopByVolume(5);
    const preciosDesactualizados = await ParExchange.getOutdatedPrices(60);
    const comisionesAltas = await ParExchange.getHighCommission(0.02);
    const priceServiceStats = priceService.getServiceStats();
    
    res.json({
      estadisticas: stats,
      resumen: {
        totalPares: stats.total,
        paresActivos: stats.activos,
        paresInactivos: stats.inactivos,
        volumenTotal24h: stats.volumen.volumenTotal || 0,
        promedioCambios24h: (stats.mercado.topGainers[0]?.cambiosPorcentaje24h || 0)
      },
      topPares: topPares.slice(0, 5),
      alertas: {
        preciosDesactualizados: {
          count: preciosDesactualizados.length,
          pares: preciosDesactualizados.slice(0, 3)
        },
        comisionesAltas: {
          count: comisionesAltas.length,
          threshold: '2%',
          pares: comisionesAltas.slice(0, 3)
        }
      },
      mercado: {
        precioPromedio: parseFloat(stats.precios.precioPromedio || 0).toFixed(8),
        precioMinimo: parseFloat(stats.precios.precioMinimo || 0).toFixed(8),
        precioMaximo: parseFloat(stats.precios.precioMaximo || 0).toFixed(8),
        comisionPromedio: parseFloat(stats.comisiones.comisionPromedio || 0).toFixed(4) + '%',
        volumenTotal: parseFloat(stats.volumen.volumenTotal || 0).toFixed(2),
        topGainers: stats.mercado.topGainers,
        topLosers: stats.mercado.topLosers
      },
      priceService: priceServiceStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener libro de órdenes para un par - MEJORADO
const getOrderBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { depth = 10 } = req.query;
    
    const orderBook = await ParExchange.getRealisticOrderBook(id, parseInt(depth));
    res.json(orderBook);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Exportar pares a CSV
const exportPares = async (req, res) => {
  try {
    const filters = { ...req.query };
    const pares = await ParExchange.getAll(filters);
    
    // Convertir a formato CSV
    const csvHeader = 'ID,Base,Quote,Precio Actual,Precio Anterior,Volumen 24h,Cambio %,Comision %,Activo,Fuente Precio,Ultima Actualizacion\n';
    const csvData = pares.map(par => {
      return [
        par.id,
        par.criptoBase ? par.criptoBase.symbol : '',
        par.criptoQuote ? par.criptoQuote.symbol : '',
        par.precioActual,
        par.precioAnterior || '',
        par.volumen24h || 0,
        par.cambiosPorcentaje24h || 0,
        par.comisionPorcentaje,
        par.activo ? 'SI' : 'NO',
        par.fuentePrecio || 'manual',
        par.ultimaActualizacion
      ].join(',');
    }).join('\n');
    
    const csv = csvHeader + csvData;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pares_exchange.csv"');
    res.send(csv);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener métricas del mercado - MEJORADO
const getMarketMetrics = async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const stats = await ParExchange.getStats();
    const paresActivos = await ParExchange.getActive();
    const preciosDesactualizados = await ParExchange.getOutdatedPrices(60);
    
    // Calcular distribución de precios por rangos
    const priceRanges = {
      'muy_bajo': 0,      // < 0.01
      'bajo': 0,          // 0.01 - 1
      'medio': 0,         // 1 - 100
      'alto': 0,          // 100 - 10000
      'muy_alto': 0       // > 10000
    };
    
    // Calcular distribución de volumen
    const volumeRanges = {
      'sin_volumen': 0,   // 0
      'bajo': 0,          // 0 - 1000
      'medio': 0,         // 1000 - 100000
      'alto': 0,          // 100000 - 1000000
      'muy_alto': 0       // > 1000000
    };
    
    paresActivos.forEach(par => {
      const precio = parseFloat(par.precioActual);
      const volumen = parseFloat(par.volumen24h || 0);
      
      // Clasificar por precio
      if (precio < 0.01) priceRanges.muy_bajo++;
      else if (precio < 1) priceRanges.bajo++;
      else if (precio < 100) priceRanges.medio++;
      else if (precio < 10000) priceRanges.alto++;
      else priceRanges.muy_alto++;
      
      // Clasificar por volumen
      if (volumen === 0) volumeRanges.sin_volumen++;
      else if (volumen < 1000) volumeRanges.bajo++;
      else if (volumen < 100000) volumeRanges.medio++;
      else if (volumen < 1000000) volumeRanges.alto++;
      else volumeRanges.muy_alto++;
    });

    res.json({
      periodo: timeframe,
      metricas: {
        totalPares: stats.total,
        paresActivos: stats.activos,
        tasaActividad: ((stats.activos / stats.total) * 100).toFixed(2) + '%',
        precioPromedio: parseFloat(stats.precios.precioPromedio || 0),
        comisionPromedio: parseFloat(stats.comisiones.comisionPromedio || 0),
        volumenTotal: parseFloat(stats.volumen.volumenTotal || 0),
        volumenPromedio: parseFloat(stats.volumen.volumenPromedio || 0)
      },
      distribucionPrecios: priceRanges,
      distribucionVolumen: volumeRanges,
      alertas: {
        preciosDesactualizados: preciosDesactualizados.length,
        necesitanActualizacion: preciosDesactualizados.length > 0
      },
      criptomonedasPopulares: {
        base: stats.paresPorBase.slice(0, 5),
        quote: stats.paresPorQuote.slice(0, 5)
      },
      mercado: {
        topGainers: stats.mercado.topGainers.slice(0, 3),
        topLosers: stats.mercado.topLosers.slice(0, 3)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NUEVOS ENDPOINTS

// Iniciar/detener actualización automática de precios
const managePriceUpdates = async (req, res) => {
  try {
    const { action, intervalMinutes = 1 } = req.body;
    
    if (!['start', 'stop'].includes(action)) {
      return res.status(400).json({ 
        error: 'La acción debe ser "start" o "stop"' 
      });
    }

    if (action === 'start') {
      priceService.startPriceUpdates(parseInt(intervalMinutes));
      res.json({ 
        message: `Actualización automática iniciada cada ${intervalMinutes} minuto(s)`,
        status: 'active',
        interval: intervalMinutes
      });
    } else {
      priceService.stopPriceUpdates();
      res.json({ 
        message: 'Actualización automática detenida',
        status: 'inactive'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Forzar actualización manual de precios
const forceUpdatePrices = async (req, res) => {
  try {
    await priceService.updateAllPrices();
    const stats = priceService.getServiceStats();
    
    res.json({ 
      message: 'Actualización manual de precios ejecutada',
      timestamp: new Date(),
      serviceStats: stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getParesExchange,
  getParExchangeById,
  createParExchange,
  updateParExchange,
  deleteParExchange,
  searchParesExchange,
  getParExchangeStats,
  getParBySymbols,
  getParesByBaseCrypto,
  getParesByQuoteCrypto,
  getActiveExchangePairs,
  getTopPairsByVolume,
  getHighCommissionPairs,
  getOutdatedPricePairs,
  updateParStatus,
  toggleParStatus,
  updateParPrice,
  updateParCommission,
  calculateExchange,
  bulkUpdatePrices,
  getExchangeDashboard,
  getOrderBook,
  exportPares,
  getMarketMetrics,
  managePriceUpdates,
  forceUpdatePrices
};