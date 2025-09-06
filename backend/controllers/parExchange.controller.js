const { ParExchange } = require('../models/index.js');

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

// Crear nuevo par de exchange (solo admin)
const createParExchange = async (req, res) => {
  try {
    const { criptoBaseId, criptoQuoteId, precioActual, comisionPorcentaje, activo = true } = req.body;
    
    if (!criptoBaseId || !criptoQuoteId || !precioActual || comisionPorcentaje === undefined) {
      return res.status(400).json({ 
        error: 'Los campos criptoBaseId, criptoQuoteId, precioActual y comisionPorcentaje son requeridos' 
      });
    }

    if (parseFloat(precioActual) <= 0) {
      return res.status(400).json({ 
        error: 'El precio actual debe ser mayor a 0' 
      });
    }

    if (parseFloat(comisionPorcentaje) < 0 || parseFloat(comisionPorcentaje) > 100) {
      return res.status(400).json({ 
        error: 'La comisión debe estar entre 0 y 100%' 
      });
    }

    const nuevoPar = await ParExchange.createPar({
      criptoBaseId,
      criptoQuoteId,
      precioActual: parseFloat(precioActual),
      comisionPorcentaje: parseFloat(comisionPorcentaje),
      activo
    });
    
    res.status(201).json({ 
      message: 'Par de exchange creado exitosamente', 
      data: nuevoPar 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Actualizar par de exchange por ID (solo admin)
const updateParExchange = async (req, res) => {
  try {
    const { id } = req.params;
    const { precioActual, comisionPorcentaje, activo } = req.body;

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

// Obtener estadísticas de pares de exchange
const getParExchangeStats = async (req, res) => {
  try {
    const stats = await ParExchange.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener par por símbolos de criptomonedas
const getParBySymbols = async (req, res) => {
  try {
    const { baseSymbol, quoteSymbol } = req.params;
    const par = await ParExchange.getBySymbols(baseSymbol, quoteSymbol);
    
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

// Obtener top pares por volumen
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

// Calcular intercambio/exchange
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

// Actualización masiva de precios (webhook/API externa)
const bulkUpdatePrices = async (req, res) => {
  try {
    const { prices } = req.body;
    
    if (!Array.isArray(prices) || prices.length === 0) {
      return res.status(400).json({ 
        error: 'Se requiere un array de precios con formato: [{baseSymbol, quoteSymbol, price}]' 
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

// Dashboard de exchange
const getExchangeDashboard = async (req, res) => {
  try {
    const stats = await ParExchange.getStats();
    const paresActivos = await ParExchange.getActive();
    const topPares = await ParExchange.getTopByVolume(5);
    const preciosDesactualizados = await ParExchange.getOutdatedPrices(60);
    const comisionesAltas = await ParExchange.getHighCommission(0.02);
    
    res.json({
      estadisticas: stats,
      resumen: {
        totalPares: stats.total,
        paresActivos: stats.activos,
        paresInactivos: stats.inactivos
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
        comisionPromedio: parseFloat(stats.comisiones.comisionPromedio || 0).toFixed(4) + '%'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener libro de órdenes simulado para un par
const getOrderBook = async (req, res) => {
  try {
    const { id } = req.params;
    const par = await ParExchange.getById(id);
    
    if (!par) {
      return res.status(404).json({ error: 'Par de exchange no encontrado' });
    }

    if (!par.activo) {
      return res.status(400).json({ error: 'Par de exchange inactivo' });
    }

    const precioBase = parseFloat(par.precioActual);
    
    // Generar libro de órdenes simulado
    const bids = []; // Órdenes de compra
    const asks = []; // Órdenes de venta
    
    // Generar algunos niveles alrededor del precio actual
    for (let i = 1; i <= 10; i++) {
      // Bids (compra) - precios menores al actual
      const bidPrice = precioBase * (1 - (i * 0.001));
      const bidQuantity = Math.random() * 100 + 10;
      bids.push({
        precio: parseFloat(bidPrice.toFixed(8)),
        cantidad: parseFloat(bidQuantity.toFixed(8)),
        total: parseFloat((bidPrice * bidQuantity).toFixed(8))
      });
      
      // Asks (venta) - precios mayores al actual
      const askPrice = precioBase * (1 + (i * 0.001));
      const askQuantity = Math.random() * 100 + 10;
      asks.push({
        precio: parseFloat(askPrice.toFixed(8)),
        cantidad: parseFloat(askQuantity.toFixed(8)),
        total: parseFloat((askPrice * askQuantity).toFixed(8))
      });
    }

    res.json({
      par: {
        id: par.id,
        base: par.criptoBase.symbol,
        quote: par.criptoQuote.symbol,
        precioActual: precioBase,
        comision: par.comisionPorcentaje
      },
      libro: {
        bids: bids.sort((a, b) => b.precio - a.precio), // Mayor a menor
        asks: asks.sort((a, b) => a.precio - b.precio)   // Menor a mayor
      },
      spread: {
        bid: Math.max(...bids.map(b => b.precio)),
        ask: Math.min(...asks.map(a => a.precio)),
        spreadPorcentaje: ((Math.min(...asks.map(a => a.precio)) - Math.max(...bids.map(b => b.precio))) / precioBase * 100).toFixed(4)
      }
    });
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
    const csvHeader = 'ID,Base,Quote,Precio Actual,Comision %,Activo,Ultima Actualizacion\n';
    const csvData = pares.map(par => {
      return [
        par.id,
        par.criptoBase ? par.criptoBase.symbol : '',
        par.criptoQuote ? par.criptoQuote.symbol : '',
        par.precioActual,
        par.comisionPorcentaje,
        par.activo ? 'SI' : 'NO',
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

// Obtener métricas del mercado
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
    
    paresActivos.forEach(par => {
      const precio = parseFloat(par.precioActual);
      if (precio < 0.01) priceRanges.muy_bajo++;
      else if (precio < 1) priceRanges.bajo++;
      else if (precio < 100) priceRanges.medio++;
      else if (precio < 10000) priceRanges.alto++;
      else priceRanges.muy_alto++;
    });

    res.json({
      periodo: timeframe,
      metricas: {
        totalPares: stats.total,
        paresActivos: stats.activos,
        tasaActividad: ((stats.activos / stats.total) * 100).toFixed(2) + '%',
        precioPromedio: parseFloat(stats.precios.precioPromedio || 0),
        comisionPromedio: parseFloat(stats.comisiones.comisionPromedio || 0)
      },
      distribucionPrecios: priceRanges,
      alertas: {
        preciosDesactualizados: preciosDesactualizados.length,
        necesitanActualizacion: preciosDesactualizados.length > 0
      },
      criptomonedasPopulares: {
        base: stats.paresPorBase.slice(0, 5),
        quote: stats.paresPorQuote.slice(0, 5)
      }
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
  getMarketMetrics
};