// controllers/parExchange.controller.js

const { ParExchange, Criptomoneda } = require('../models/index.js');
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

  // ✨ NUEVA FUNCIÓN: Generar todos los pares automáticamente
  const generateAllPairs = async (req, res) => {
    const { Criptomoneda } = require('../models/index.js')  // ✅ BIEN
    try {
      console.log('🚀 Iniciando generación automática de pares...');
      
      // Obtener comisión por defecto del .env
      const defaultFee = parseFloat(process.env.EXCHANGE_FEE_PERCENTAGE || 0.1);
      
      // Obtener todas las criptomonedas activas
      const criptomonedas = await Criptomoneda.findAll({
        where: { activa: true },
        attributes: ['id', 'symbol', 'nombre'],
        order: [['symbol', 'ASC']]
      });
      
      if (criptomonedas.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Se necesitan al menos 2 criptomonedas activas para generar pares'
        });
      }
      
      const results = {
        total: 0,
        created: 0,
        skipped: 0,
        failed: 0,
        details: []
      };
      
      // Generar todas las combinaciones (bidireccionales)
      for (let i = 0; i < criptomonedas.length; i++) {
        for (let j = 0; j < criptomonedas.length; j++) {
          // Saltar si es la misma criptomoneda
          if (i === j) continue;
          
          const base = criptomonedas[i];
          const quote = criptomonedas[j];
          
          results.total++;
          
          try {
            // Verificar si ya existe el par
            const existingPar = await ParExchange.findOne({
              where: {
                criptoBaseId: base.id,
                criptoQuoteId: quote.id
              }
            });
            
            if (existingPar) {
              results.skipped++;
              results.details.push({
                pair: `${base.symbol}/${quote.symbol}`,
                status: 'skipped',
                reason: 'Ya existe'
              });
              continue;
            }
            
            // Intentar obtener precio desde las APIs
            console.log(`⚡ Verificando precio para ${base.symbol}/${quote.symbol}...`);
            
            let priceResult;
            try {
              priceResult = await priceService.getPrice(base.symbol, quote.symbol);
            } catch (priceError) {
              results.skipped++;
              results.details.push({
                pair: `${base.symbol}/${quote.symbol}`,
                status: 'skipped',
                reason: `No disponible en APIs: ${priceError.message}`
              });
              continue;
            }
            
            if (!priceResult || !priceResult.price || priceResult.price <= 0) {
              results.skipped++;
              results.details.push({
                pair: `${base.symbol}/${quote.symbol}`,
                status: 'skipped',
                reason: 'Precio inválido o cero'
              });
              continue;
            }
            
            // Crear el par
            const nuevoPar = await ParExchange.create({
              criptoBaseId: base.id,
              criptoQuoteId: quote.id,
              precioActual: priceResult.price,
              comisionPorcentaje: defaultFee,
              fuentePrecio: priceResult.source || 'binance',
              simboloExterno: `${base.symbol}${quote.symbol}`,
              activo: true,
              ultimaActualizacion: new Date()
            });
            
            results.created++;
            results.details.push({
              pair: `${base.symbol}/${quote.symbol}`,
              status: 'created',
              price: priceResult.price,
              source: priceResult.source,
              id: nuevoPar.id
            });
            
            console.log(`✅ Par creado: ${base.symbol}/${quote.symbol} - Precio: ${priceResult.price}`);
            
          } catch (error) {
            results.failed++;
            results.details.push({
              pair: `${base.symbol}/${quote.symbol}`,
              status: 'failed',
              error: error.message
            });
            console.error(`❌ Error creando par ${base.symbol}/${quote.symbol}:`, error.message);
          }
        }
      }
      
      console.log('✅ Generación de pares completada');
      
      res.status(201).json({
        success: true,
        message: 'Generación de pares completada',
        summary: {
          totalCombinaciones: results.total,
          creados: results.created,
          saltados: results.skipped,
          fallidos: results.failed,
          comisionDefecto: `${defaultFee}%`,
          criptomonedasProcesadas: criptomonedas.length
        },
        details: results.details
      });
      
    } catch (error) {
      console.error('❌ Error en generación de pares:', error);
      res.status(500).json({
        success: false,
        error: 'Error generando pares automáticamente',
        details: error.message
      });
    }

};



module.exports = {
  generateAllPairs,
  getParesExchange,
  getParExchangeById,
  createParExchange,
  searchParesExchange,
  getParBySymbols,
  getCurrentPrice,
  getParesByBaseCrypto,
  getParesByQuoteCrypto,
  getActiveExchangePairs,
  getTopPairsByVolume,
  getHighCommissionPairs,
  getOutdatedPricePairs
};