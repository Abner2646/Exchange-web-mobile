// controllers/parExchange.controller.js

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
    const { updatePrice = 'force' } = req.query; // Cambio: force por defecto
    
    let result = await ParExchange.getById(id);
    if (!result) return res.status(404).json({ error: 'Par de exchange no encontrado' });

    // ACTUALIZACIÓN EN TIEMPO REAL SIEMPRE
    if (result.activo && result.fuentePrecio !== 'manual' && updatePrice !== 'never') {
      console.log(`Actualizando precio en tiempo real para ${result.criptoBase.symbol}/${result.criptoQuote.symbol}...`);
      
      try {
        const priceService = require('../services/priceService');
        const updated = await priceService.updatePairPriceRealTime(id);
        
        if (updated) {
          // Obtener el par actualizado
          result = await ParExchange.getById(id);
          console.log(`✓ Precio actualizado en tiempo real`);
        }
      } catch (error) {
        console.warn(`⚠️ Error actualizando precio en tiempo real: ${error.message}`);
        // Continuar con el precio que tenemos en BD, pero marcar como stale
      }
    }

    const ahora = new Date();
    const ultimaActualizacion = new Date(result.ultimaActualizacion);
    const segundosDesdeActualizacion = (ahora - ultimaActualizacion) / 1000;

    res.json({
      ...result.toJSON(),
      priceInfo: {
        lastUpdated: result.ultimaActualizacion,
        secondsOld: Math.round(segundosDesdeActualizacion),
        source: result.fuentePrecio,
        isRealTime: result.fuentePrecio !== 'manual',
        warning: segundosDesdeActualizacion > 30 ? 'Precio puede estar desactualizado' : null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

//MÉTODO VIEJO
/*
// Crear nuevo par de exchange (solo admin)
const createParExchange = async (req, res) => {
  try {
    const { 
      criptoBaseId, 
      criptoQuoteId, 
      //precioActual,      // OPCIONAL - si no se proporciona, se obtiene automáticamente
      comisionPorcentaje, 
      activo = true,
      //fuentePrecio,      // OPCIONAL - se auto-detecta si no se especifica
      simboloExterno
    } = req.body;
    
    if (!criptoBaseId || !criptoQuoteId || comisionPorcentaje === undefined) {
      return res.status(400).json({ 
        error: 'Los campos criptoBaseId, criptoQuoteId y comisionPorcentaje son requeridos' 
      });
    }

    if (parseFloat(comisionPorcentaje) < 0 || parseFloat(comisionPorcentaje) > 100) {
      return res.status(400).json({ 
        error: 'La comisión debe estar entre 0 y 100%' 
      });
    }

    // Obtener información de las criptomonedas
    const { Criptomoneda } = require('../models/index.js');
    const criptoBase = await Criptomoneda.findByPk(criptoBaseId);
    const criptoQuote = await Criptomoneda.findByPk(criptoQuoteId);
    
    if (!criptoBase || !criptoQuote) {
      return res.status(400).json({ 
        error: 'Una o ambas criptomonedas no existen' 
      });
    }

    let finalPrice = null;
    let finalSource = 'manual';

    // AUTO-DETECTAR FUENTE Y PRECIO si no se proporcionan
    if (!precioActual || !fuentePrecio) {
      console.log(`Detectando precio automático para ${criptoBase.symbol}/${criptoQuote.symbol}...`);
      
      // Intentar obtener precio automáticamente
      try {
        const priceService = require('../services/priceService');
        const priceResult = await priceService.getPrice(criptoBase.symbol, criptoQuote.symbol);
        
        if (priceResult && priceResult.price > 0) {
          finalPrice = priceResult.price;
          finalSource = priceResult.source;
          console.log(`✓ Precio obtenido de ${priceResult.source}: ${finalPrice}`);
        }
      } catch (error) {
        console.warn(`⚠️ No se pudo obtener precio automático: ${error.message}`);
      }
    }

    // Si aún no hay precio, usar el proporcionado o calcular uno básico <----------- SIEMRE debería detectar precios automáticamente
    if (!finalPrice) {
      if (precioActual) {
        if (parseFloat(precioActual) <= 0) {
          return res.status(400).json({ 
            error: 'El precio actual debe ser mayor a 0' 
          });
        }
        finalPrice = parseFloat(precioActual);
        finalSource = fuentePrecio || 'manual';
      } else {
        // Precio por defecto inteligente basado en el par
        finalPrice = getDefaultPrice(criptoBase.symbol, criptoQuote.symbol);
        finalSource = 'manual';
        console.log(`ℹ️ Usando precio por defecto: ${finalPrice}`);
      }
    }

    // Validar fuente final
    const validSources = ['manual', 'coingecko', 'binance', 'chainlink'];
    if (!validSources.includes(finalSource)) {
      finalSource = 'manual';
    }

    const nuevoPar = await ParExchange.createPar({
      criptoBaseId,
      criptoQuoteId,
      precioActual: finalPrice,
      comisionPorcentaje: parseFloat(comisionPorcentaje),
      activo,
      fuentePrecio: finalSource,
      simboloExterno: simboloExterno || `${criptoBase.symbol}${criptoQuote.symbol}`
    });
    
    res.status(201).json({ 
      message: 'Par de exchange creado exitosamente', 
      data: nuevoPar,
      info: {
        precioObtenidoAutomaticamente: !precioActual,
        fuenteDetectada: finalSource,
        simboloGenerado: !simboloExterno
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
*/

// Crear nuevo par de exchange (solo admin)
const createParExchange = async (req, res) => {
  try {
    const { 
      criptoBaseId, 
      criptoQuoteId, 
      comisionPorcentaje, 
      activo = true,
      simboloExterno
    } = req.body;
    
    if (!criptoBaseId || !criptoQuoteId || comisionPorcentaje === undefined) {
      return res.status(400).json({ 
        error: 'Los campos criptoBaseId, criptoQuoteId y comisionPorcentaje son requeridos' 
      });
    }

    if (parseFloat(comisionPorcentaje) < 0 || parseFloat(comisionPorcentaje) > 100) {
      return res.status(400).json({ 
        error: 'La comisión debe estar entre 0 y 100%' 
      });
    }

    // Obtener información de las criptomonedas
    const { Criptomoneda } = require('../models/index.js');
    const criptoBase = await Criptomoneda.findByPk(criptoBaseId);
    const criptoQuote = await Criptomoneda.findByPk(criptoQuoteId);
    
    if (!criptoBase || !criptoQuote) {
      return res.status(400).json({ 
        error: 'Una o ambas criptomonedas no existen' 
      });
    }

    // OBTENER PRECIO AUTOMÁTICAMENTE DESDE LA API (OBLIGATORIO)
    console.log(`Obteniendo precio automático para ${criptoBase.symbol}/${criptoQuote.symbol}...`);
    
    let finalPrice = null;
    let finalSource = null;
    
    try {
      const priceService = require('../services/priceService');
      const priceResult = await priceService.getPrice(criptoBase.symbol, criptoQuote.symbol);
      
      if (priceResult && priceResult.price > 0) {
        finalPrice = priceResult.price;
        finalSource = priceResult.source;
        console.log(`✓ Precio obtenido de ${priceResult.source}: ${finalPrice}`);
      } else {
        throw new Error('El servicio de precios no devolvió un precio válido');
      }
    } catch (error) {
      console.error(`❌ Error obteniendo precio automático: ${error.message}`);
      return res.status(400).json({ 
        error: `No se pudo obtener el precio automáticamente para el par ${criptoBase.symbol}/${criptoQuote.symbol}. Error: ${error.message}` 
      });
    }

    // Validar que se obtuvo un precio válido
    if (!finalPrice || finalPrice <= 0) {
      return res.status(400).json({ 
        error: `No se pudo obtener un precio válido para el par ${criptoBase.symbol}/${criptoQuote.symbol}` 
      });
    }

    // Validar fuente
    const validSources = ['manual', 'coingecko', 'binance', 'chainlink'];
    if (!validSources.includes(finalSource)) {
      console.warn(`⚠️ Fuente desconocida: ${finalSource}, usando 'manual' como fallback`);
      finalSource = 'manual';
    }

    const nuevoPar = await ParExchange.createPar({
      criptoBaseId,
      criptoQuoteId,
      precioActual: finalPrice,
      comisionPorcentaje: parseFloat(comisionPorcentaje),
      activo,
      fuentePrecio: finalSource,
      simboloExterno: simboloExterno || `${criptoBase.symbol}${criptoQuote.symbol}`
    });
    
    res.status(201).json({ 
      message: 'Par de exchange creado exitosamente', 
      data: nuevoPar,
      info: {
        precioObtenidoAutomaticamente: true,
        fuenteDetectada: finalSource,
        simboloGenerado: !simboloExterno,
        precio: finalPrice
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Función auxiliar para precios por defecto inteligentes
function getDefaultPrice(baseSymbol, quoteSymbol) {
  const priceDefaults = {
    // Precios aproximados para pares comunes (USD/USDT como quote)
    'BTC/USDT': 45000,
    'BTC/USDC': 45000,
    'ETH/USDT': 3000,
    'ETH/USDC': 3000,
    'BNB/USDT': 300,
    'ADA/USDT': 0.5,
    'DOT/USDT': 8,
    'LINK/USDT': 15,
    'LTC/USDT': 100,
    'BCH/USDT': 250,
    
    // Pares crypto-to-crypto
    'ETH/BTC': 0.067,
    'BNB/BTC': 0.0067,
    'ADA/BTC': 0.000011,
    
    // Si quote es BTC, dividir precios USD por 45000
    'ETH/BTC': 0.067,
    'USDT/BTC': 0.000022,
    'USDC/BTC': 0.000022
  };
  
  const pairKey = `${baseSymbol}/${quoteSymbol}`;
  
  if (priceDefaults[pairKey]) {
    return priceDefaults[pairKey];
  }
  
  // Lógica de fallback
  if (quoteSymbol === 'USDT' || quoteSymbol === 'USDC' || quoteSymbol === 'USD') {
    // Precios USD por defecto para cryptos menos comunes
    const baseDefaults = {
      'DOGE': 0.08,
      'XRP': 0.6,
      'MATIC': 1.2,
      'AVAX': 25,
      'ATOM': 12,
      'UNI': 8
    };
    return baseDefaults[baseSymbol] || 1.0;
  }
  
  if (quoteSymbol === 'BTC') {
    // Para pares con BTC como quote, usar valores muy pequeños
    return 0.00001;
  }
  
  // Precio genérico
  return 1.0;
}

// Actualizar par de exchange por ID (solo admin)
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
    const { updatePrice = 'force' } = req.query; // Cambio: force por defecto
    
    let par = await ParExchange.getBySymbols(baseSymbol, quoteSymbol);
    
    if (!par) {
      return res.status(404).json({ 
        error: `Par ${baseSymbol}/${quoteSymbol} no encontrado` 
      });
    }

    // ACTUALIZACIÓN EN TIEMPO REAL SIEMPRE
    if (par.activo && par.fuentePrecio !== 'manual' && updatePrice !== 'never') {
      console.log(`Actualizando precio en tiempo real para ${baseSymbol}/${quoteSymbol}...`);
      
      try {
        const priceService = require('../services/priceService');
        const updated = await priceService.updatePairPriceRealTime(par.id);
        
        if (updated) {
          par = await ParExchange.getBySymbols(baseSymbol, quoteSymbol);
          console.log(`✓ Precio actualizado en tiempo real`);
        }
      } catch (error) {
        console.warn(`⚠️ Error actualizando precio en tiempo real: ${error.message}`);
        // Continuar con el precio que tenemos, pero marcar como stale
      }
    }

    const ahora = new Date();
    const ultimaActualizacion = new Date(par.ultimaActualizacion);
    const segundosDesdeActualizacion = (ahora - ultimaActualizacion) / 1000;
    
    res.json({
      ...par.toJSON(),
      priceInfo: {
        lastUpdated: par.ultimaActualizacion,
        secondsOld: Math.round(segundosDesdeActualizacion),
        source: par.fuentePrecio,
        isRealTime: par.fuentePrecio !== 'manual',
        warning: segundosDesdeActualizacion > 30 ? 'Precio puede estar desactualizado' : null
      }
    });
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

// Calcular intercambio para un par
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
    const bids = [];
    const asks = [];
    
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
        bids: bids.sort((a, b) => b.precio - a.precio),
        asks: asks.sort((a, b) => a.precio - b.precio)
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

// Obtener solo el precio en tiempo real (endpoint rápido para trading)
const getCurrentPrice = async (req, res) => {
  try {
    const { baseSymbol, quoteSymbol } = req.params;
    
    const par = await ParExchange.getBySymbols(baseSymbol, quoteSymbol);
    
    if (!par) {
      return res.status(404).json({ 
        error: `Par ${baseSymbol}/${quoteSymbol} no encontrado` 
      });
    }

    if (!par.activo) {
      return res.status(400).json({ 
        error: `Par ${baseSymbol}/${quoteSymbol} está inactivo` 
      });
    }

    let currentPrice = parseFloat(par.precioActual);
    let source = par.fuentePrecio;
    let updated = false;

    // Si no es manual, obtener precio fresco SIEMPRE
    if (source !== 'manual') {
      try {
        const priceService = require('../services/priceService');
        const priceResult = await priceService.getPrice(baseSymbol, quoteSymbol);
        
        if (priceResult && priceResult.price > 0) {
          currentPrice = priceResult.price;
          source = priceResult.source;
          updated = true;
          
          // Actualizar en BD de forma asíncrona (no bloquear respuesta)
          priceService.updatePairPriceRealTime(par.id).catch(err => 
            console.warn('Error actualizando BD:', err.message)
          );
        }
      } catch (error) {
        console.warn(`Error obteniendo precio fresco: ${error.message}`);
        // Usar precio de BD como fallback
      }
    }

    res.json({
      pair: `${baseSymbol}/${quoteSymbol}`,
      price: currentPrice,
      source: source,
      timestamp: new Date().toISOString(),
      updated: updated,
      commission: parseFloat(par.comisionPorcentaje)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
const getMarketMetrics = async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    const stats = await ParExchange.getStats();
    const paresActivos = await ParExchange.getActive();
    const preciosDesactualizados = await ParExchange.getOutdatedPrices(60);
    
    // Calcular distribución de precios por rangos
    const priceRanges = {
      'muy_bajo': 0,
      'bajo': 0,
      'medio': 0,
      'alto': 0,
      'muy_alto': 0
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
  getCurrentPrice,
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