// controllers/parExchange.controller.js

const { SwapPair, Crypto } = require('../../models/index.js');
const priceService = require('../../services/priceService');

// Listar pares de exchange
const getParesExchange = async (req, res) => {
  try {
    const filters = { ...req.query };
    const result = await SwapPair.getAll(filters);
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
    
    let result = await SwapPair.getById(id);
    if (!result) return res.status(404).json({ error: 'Par de exchange no encontrado' });

    // ACTUALIZACIÓN EN TIEMPO REAL SIEMPRE
    // updatePrice acepta cualquier string que no sea 'never'; 'force' no tiene
    // semántica especial propia, se comporta igual que cualquier otro valor
    // (incluyendo el default). Solo 'never' desactiva la actualización en vivo.
    if (result.active && result.priceSource !== 'manual' && updatePrice !== 'never') {
      console.log(`Actualizando price en tiempo real para ${result.baseCrypto.symbol}/${result.quoteCrypto.symbol}...`);
      
      try {
        const priceService = require('../../services/priceService');
        const updated = await priceService.updatePairPriceRealTime(id);
        
        if (updated) {
          // Obtener el par actualizado
          result = await SwapPair.getById(id);
          console.log(`✓ Precio actualizado en tiempo real`);
        }
      } catch (error) {
        console.warn(`⚠️ Error actualizando price en tiempo real: ${error.message}`);
        // Continuar con el price que tenemos en BD, pero marcar como stale
      }
    }

    const ahora = new Date();
    const lastUpdated = new Date(result.lastUpdated);
    const segundosDesdeActualizacion = (ahora - lastUpdated) / 1000;

    res.json({
      ...result.toJSON(),
      priceInfo: {
        lastUpdated: result.lastUpdated,
        secondsOld: Math.round(segundosDesdeActualizacion),
        source: result.priceSource,
        isRealTime: result.priceSource !== 'manual',
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
      baseCryptoId, 
      quoteCryptoId, 
      //currentPrice,      // OPCIONAL - si no se proporciona, se obtiene automáticamente
      feePercent, 
      active = true,
      //priceSource,      // OPCIONAL - se auto-detecta si no se especifica
      externalSymbol
    } = req.body;
    
    if (!baseCryptoId || !quoteCryptoId || feePercent === undefined) {
      return res.status(400).json({ 
        error: 'Los campos baseCryptoId, quoteCryptoId y feePercent son requeridos' 
      });
    }

    if (parseFloat(feePercent) < 0 || parseFloat(feePercent) > 100) {
      return res.status(400).json({ 
        error: 'La comisión debe estar entre 0 y 100%' 
      });
    }

    // Obtener información de las criptomonedas
    const { Crypto } = require('../../models/index.js');
    const baseCrypto = await Crypto.findByPk(baseCryptoId);
    const quoteCrypto = await Crypto.findByPk(quoteCryptoId);
    
    if (!baseCrypto || !quoteCrypto) {
      return res.status(400).json({ 
        error: 'Una o ambas criptomonedas no existen' 
      });
    }

    let finalPrice = null;
    let finalSource = 'manual';

    // AUTO-DETECTAR FUENTE Y PRECIO si no se proporcionan
    if (!currentPrice || !priceSource) {
      console.log(`Detectando price automático para ${baseCrypto.symbol}/${quoteCrypto.symbol}...`);
      
      // Intentar obtener price automáticamente
      try {
        const priceService = require('../../services/priceService');
        const priceResult = await priceService.getPrice(baseCrypto.symbol, quoteCrypto.symbol);
        
        if (priceResult && priceResult.price > 0) {
          finalPrice = priceResult.price;
          finalSource = priceResult.source;
          console.log(`✓ Precio obtenido de ${priceResult.source}: ${finalPrice}`);
        }
      } catch (error) {
        console.warn(`⚠️ No se pudo obtener price automático: ${error.message}`);
      }
    }

    // Si aún no hay price, usar el proporcionado o calcular uno básico <----------- SIEMRE debería detectar precios automáticamente
    if (!finalPrice) {
      if (currentPrice) {
        if (parseFloat(currentPrice) <= 0) {
          return res.status(400).json({ 
            error: 'El precio actual debe ser mayor a 0' 
          });
        }
        finalPrice = parseFloat(currentPrice);
        finalSource = priceSource || 'manual';
      } else {
        // Precio por defecto inteligente basado en el par
        finalPrice = getDefaultPrice(baseCrypto.symbol, quoteCrypto.symbol);
        finalSource = 'manual';
        console.log(`ℹ️ Usando price por defecto: ${finalPrice}`);
      }
    }

    // Validar fuente final
    const validSources = ['manual', 'coingecko', 'binance', 'chainlink'];
    if (!validSources.includes(finalSource)) {
      finalSource = 'manual';
    }

    const nuevoPar = await SwapPair.createPar({
      baseCryptoId,
      quoteCryptoId,
      currentPrice: finalPrice,
      feePercent: parseFloat(feePercent),
      active,
      priceSource: finalSource,
      externalSymbol: externalSymbol || `${baseCrypto.symbol}${quoteCrypto.symbol}`
    });
    
    res.status(201).json({ 
      message: 'Par de exchange creado exitosamente', 
      data: nuevoPar,
      info: {
        precioObtenidoAutomaticamente: !currentPrice,
        fuenteDetectada: finalSource,
        simboloGenerado: !externalSymbol
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
      baseCryptoId, 
      quoteCryptoId, 
      feePercent, 
      active = true,
      externalSymbol
    } = req.body;
    
    if (!baseCryptoId || !quoteCryptoId || feePercent === undefined) {
      return res.status(400).json({ 
        error: 'Los campos baseCryptoId, quoteCryptoId y feePercent son requeridos' 
      });
    }

    if (parseFloat(feePercent) < 0 || parseFloat(feePercent) > 100) {
      return res.status(400).json({ 
        error: 'La comisión debe estar entre 0 y 100%' 
      });
    }

    // Obtener información de las criptomonedas
    const { Crypto } = require('../../models/index.js');
    const baseCrypto = await Crypto.findByPk(baseCryptoId);
    const quoteCrypto = await Crypto.findByPk(quoteCryptoId);
    
    if (!baseCrypto || !quoteCrypto) {
      return res.status(400).json({ 
        error: 'Una o ambas criptomonedas no existen' 
      });
    }

    // OBTENER PRECIO AUTOMÁTICAMENTE DESDE LA API (OBLIGATORIO)
    console.log(`Obteniendo price automático para ${baseCrypto.symbol}/${quoteCrypto.symbol}...`);
    
    let finalPrice = null;
    let finalSource = null;
    
    try {
      const priceService = require('../../services/priceService');
      const priceResult = await priceService.getPrice(baseCrypto.symbol, quoteCrypto.symbol);
      
      if (priceResult && priceResult.price > 0) {
        finalPrice = priceResult.price;
        finalSource = priceResult.source;
        console.log(`✓ Precio obtenido de ${priceResult.source}: ${finalPrice}`);
      } else {
        throw new Error('El servicio de precios no devolvió un precio válido');
      }
    } catch (error) {
      console.error(`❌ Error obteniendo price automático: ${error.message}`);
      return res.status(400).json({ 
        error: `No se pudo obtener el price automáticamente para el par ${baseCrypto.symbol}/${quoteCrypto.symbol}. Error: ${error.message}` 
      });
    }

    // Validar que se obtuvo un precio válido
    if (!finalPrice || finalPrice <= 0) {
      return res.status(400).json({ 
        error: `No se pudo obtener un precio válido para el par ${baseCrypto.symbol}/${quoteCrypto.symbol}` 
      });
    }

    // Validar fuente
    const validSources = ['manual', 'coingecko', 'binance', 'chainlink'];
    if (!validSources.includes(finalSource)) {
      console.warn(`⚠️ Fuente desconocida: ${finalSource}, usando 'manual' como fallback`);
      finalSource = 'manual';
    }

    const nuevoPar = await SwapPair.createPar({
      baseCryptoId,
      quoteCryptoId,
      currentPrice: finalPrice,
      feePercent: parseFloat(feePercent),
      active,
      priceSource: finalSource,
      externalSymbol: externalSymbol || `${baseCrypto.symbol}${quoteCrypto.symbol}`
    });
    
    res.status(201).json({ 
      message: 'Par de exchange creado exitosamente', 
      data: nuevoPar,
      info: {
        precioObtenidoAutomaticamente: true,
        fuenteDetectada: finalSource,
        simboloGenerado: !externalSymbol,
        price: finalPrice
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

    const result = await SwapPair.search(term, limit);
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
    
    let par = await SwapPair.getBySymbols(baseSymbol, quoteSymbol);
    
    if (!par) {
      return res.status(404).json({ 
        error: `Par ${baseSymbol}/${quoteSymbol} no encontrado` 
      });
    }

    // updatePrice acepta cualquier string que no sea 'never'; 'force' no tiene
    // semántica especial propia, se comporta igual que cualquier otro valor
    // (incluyendo el default). Solo 'never' desactiva la actualización en vivo.
    if (par.active && par.priceSource !== 'manual' && updatePrice !== 'never') {
      console.log(`Actualizando price en tiempo real para ${baseSymbol}/${quoteSymbol}...`);
      
      try {
        const priceService = require('../../services/priceService');
        const updated = await priceService.updatePairPriceRealTime(par.id);
        
        if (updated) {
          par = await SwapPair.getBySymbols(baseSymbol, quoteSymbol);
          console.log(`✓ Precio actualizado en tiempo real`);
        }
      } catch (error) {
        console.warn(`⚠️ Error actualizando price en tiempo real: ${error.message}`);
        // Continuar con el price que tenemos, pero marcar como stale
      }
    }

    const ahora = new Date();
    const lastUpdated = new Date(par.lastUpdated);
    const segundosDesdeActualizacion = (ahora - lastUpdated) / 1000;
    
    res.json({
      ...par.toJSON(),
      priceInfo: {
        lastUpdated: par.lastUpdated,
        secondsOld: Math.round(segundosDesdeActualizacion),
        source: par.priceSource,
        isRealTime: par.priceSource !== 'manual',
        warning: segundosDesdeActualizacion > 30 ? 'Precio puede estar desactualizado' : null
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener pares por crypto base
const getParesByBaseCrypto = async (req, res) => {
  try {
    const { baseCryptoId } = req.params;
    const pares = await SwapPair.getByBaseCrypto(baseCryptoId);
    res.json(pares);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener pares por crypto quote
const getParesByQuoteCrypto = async (req, res) => {
  try {
    const { quoteCryptoId } = req.params;
    const pares = await SwapPair.getByQuoteCrypto(quoteCryptoId);
    res.json(pares);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener pares activos
const getActiveExchangePairs = async (req, res) => {
  try {
    const pares = await SwapPair.getActive();
    res.json(pares);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener top pares por volumen
const getTopPairsByVolume = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const pares = await SwapPair.getTopByVolume(parseInt(limit));
    res.json(pares);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener pares con comisión alta
const getHighCommissionPairs = async (req, res) => {
  try {
    const { threshold = 0.01 } = req.query;
    const pares = await SwapPair.getHighCommission(parseFloat(threshold));
    
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
    const pares = await SwapPair.getOutdatedPrices(parseInt(minutes));
    
    res.json({
      threshold: `${minutes} minutos`,
      count: pares.length,
      pares
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener solo el price en tiempo real (endpoint rápido para trading)
const getCurrentPrice = async (req, res) => {
  try {
    const { baseSymbol, quoteSymbol } = req.params;
    
    let par = await SwapPair.getBySymbols(baseSymbol, quoteSymbol);
    
    if (!par) {
      try {
        const priceService = require('../../services/priceService');
        const priceResult = await priceService.getPrice(baseSymbol, quoteSymbol);
        if (priceResult && priceResult.price > 0) {
          return res.json({
            pair: `${baseSymbol}/${quoteSymbol}`,
            price: priceResult.price,
            source: priceResult.source || 'live',
            timestamp: new Date().toISOString(),
            updated: true,
            commission: 0.1
          });
        }
      } catch (err) {
        // Continue to 404
      }
      return res.status(404).json({ 
        error: `Par ${baseSymbol}/${quoteSymbol} no encontrado` 
      });
    }

    if (!par.active) {
      return res.status(400).json({ 
        error: `Par ${baseSymbol}/${quoteSymbol} está inactivo` 
      });
    }

    let currentPrice = parseFloat(par.currentPrice);
    let source = par.priceSource;
    let updated = false;

    // Si no es manual, obtener price fresco SIEMPRE
    if (source !== 'manual') {
      try {
        const priceService = require('../../services/priceService');
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
        console.warn(`Error obteniendo price fresco: ${error.message}`);
        // Usar price de BD como fallback
      }
    }

    res.json({
      pair: `${baseSymbol}/${quoteSymbol}`,
      price: currentPrice,
      source: source,
      timestamp: new Date().toISOString(),
      updated: updated,
      commission: parseFloat(par.feePercent)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

  // ✨ FUNCIÓN OPTIMIZADA: Generar todos los pares automáticamente
  const generateAllPairs = async (req, res) => {
    const { Crypto, SwapPair } = require('../../models/index.js');
    const axios = require('axios');
    try {
      console.log('🚀 Iniciando generación automática de pares...');
      
      const defaultFee = parseFloat(process.env.EXCHANGE_FEE_PERCENTAGE || 0.1);
      
      const criptomonedas = await Crypto.findAll({
        where: { active: true },
        attributes: ['id', 'symbol', 'name'],
        order: [['symbol', 'ASC']]
      });
      
      if (criptomonedas.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Se necesitan al menos 2 criptomonedas activas para generar pares'
        });
      }

      // 1. Obtener precios USD en bulto desde CoinGecko en 1 sola llamada rápida
      const coingeckoMap = priceService.constructor.COINGECKO_MAP || {};
      const ids = criptomonedas
        .map(c => coingeckoMap[c.symbol])
        .filter(Boolean)
        .join(',');

      const usdPrices = {};
      try {
        const cgRes = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`, {
          timeout: 10000
        });
        for (const crypto of criptomonedas) {
          const cgId = coingeckoMap[crypto.symbol];
          if (cgId && cgRes.data[cgId]?.usd) {
            usdPrices[crypto.symbol] = cgRes.data[cgId].usd;
          }
        }
        console.log(`✓ Precios en bulto obtenidos para ${Object.keys(usdPrices).length} criptomonedas`);
      } catch (err) {
        console.warn('⚠️ Advertencia obteniendo precios en bulto de CoinGecko:', err.message);
      }

      // Precios de respaldo para cualquier cripto que CoinGecko no entregue
      const fallbackUSD = {
        'BTC': 76000,
        'ETH': 2500,
        'BNB': 730,
        'SOL': 100,
        'USDT': 1.0,
        'USDC': 1.0,
        'DAI': 1.0,
        'AAVE': 130,
        'MKR': 1400,
        'LINK': 15,
        'UNI': 8,
        'ADA': 0.25,
        'XRP': 0.6,
        'DOGE': 0.1,
        'DOT': 6,
        'LTC': 80,
        'MATIC': 0.4,
        'ARB': 0.5,
        'OP': 1.5,
        'WBTC': 76000,
        'PEPE': 0.000008,
        'SHIB': 0.000015
      };

      for (const crypto of criptomonedas) {
        if (!usdPrices[crypto.symbol]) {
          usdPrices[crypto.symbol] = fallbackUSD[crypto.symbol] || 1.0;
        }
      }

      const results = {
        total: 0,
        created: 0,
        updated: 0,
        failed: 0,
      };

      for (let i = 0; i < criptomonedas.length; i++) {
        for (let j = 0; j < criptomonedas.length; j++) {
          if (i === j) continue;
          
          const base = criptomonedas[i];
          const quote = criptomonedas[j];
          results.total++;

          try {
            const baseUSD = usdPrices[base.symbol] || 1.0;
            const quoteUSD = usdPrices[quote.symbol] || 1.0;
            const pairPrice = baseUSD / quoteUSD;

            // Formatear para DECIMAL(18, 8)
            let formattedPrice = parseFloat(pairPrice.toFixed(8));
            if (formattedPrice <= 0) {
              formattedPrice = 0.00000001;
            }

            const [par, created] = await SwapPair.findOrCreate({
              where: {
                baseCryptoId: base.id,
                quoteCryptoId: quote.id
              },
              defaults: {
                currentPrice: formattedPrice,
                feePercent: defaultFee,
                priceSource: 'coingecko',
                externalSymbol: `${base.symbol}${quote.symbol}`,
                active: true,
                lastUpdated: new Date()
              }
            });

            if (created) {
              results.created++;
            } else {
              await par.update({
                currentPrice: formattedPrice,
                lastUpdated: new Date(),
                active: true
              });
              results.updated++;
            }
          } catch (error) {
            results.failed++;
            console.error(`❌ Error creando/actualizando par ${base.symbol}/${quote.symbol}:`, error.message);
          }
        }
      }

      console.log(`✅ Generación de pares completada: ${results.created} creados, ${results.updated} actualizados de ${results.total} pares.`);

      res.status(201).json({
        success: true,
        message: `Generación de pares completada: ${results.created} nuevos creados, ${results.updated} actualizados`,
        summary: {
          totalCombinaciones: results.total,
          creados: results.created,
          actualizados: results.updated,
          fallidos: results.failed,
          comisionDefecto: `${defaultFee}%`,
          criptomonedasProcesadas: criptomonedas.length
        }
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