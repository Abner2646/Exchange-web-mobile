// services/priceService.js

const axios = require('axios');
const { SwapPair } = require('../models/index.js');
const money = require('../utils/money');

class PriceService {
  constructor() {
    // APIs completamente gratuitas
    this.binanceBaseURL = 'https://api.binance.com/api/v3';
    this.coinbaseBaseURL = 'https://api.coinbase.com/v2';
    this.krakenBaseURL = 'https://api.kraken.com/0/public';
    this.cryptocompareBaseURL = 'https://min-api.cryptocompare.com/data';
    this.coingeckoBaseURL = 'https://api.coingecko.com/api/v3';
    
    this.isUpdating = false;
    this.updateInterval = null;
    this.failureCount = 0;
    this.maxFailures = 5;
  }

  // Mapeo de símbolos para diferentes exchanges
  static SYMBOL_MAPPING = {
    binance: {
      'USDT': 'USDT',
      'USDC': 'USDC', 
      'BTC': 'BTC',
      'ETH': 'ETH',
      'BNB': 'BNB',
      'ADA': 'ADA',
      'DOT': 'DOT',
      'LINK': 'LINK',
      'UNI': 'UNI',
      'LTC': 'LTC',
      'BCH': 'BCH',
      'XRP': 'XRP',
      'DOGE': 'DOGE',
      'MATIC': 'MATIC',
      'AVAX': 'AVAX',
      'ATOM': 'ATOM'
    },
    cryptocompare: {
      'USDT': 'USDT',
      'USDC': 'USDC',
      'BTC': 'BTC',
      'ETH': 'ETH',
      'BNB': 'BNB',
      'ADA': 'ADA',
      'DOT': 'DOT',
      'LINK': 'LINK',
      'UNI': 'UNI',
      'LTC': 'LTC',
      'BCH': 'BCH',
      'XRP': 'XRP',
      'DOGE': 'DOGE',
      'MATIC': 'MATIC',
      'AVAX': 'AVAX',
      'ATOM': 'ATOM'
    }
  };

  // Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #1): getPriceFromCoinGecko ya
  // usaba PriceService.COINGECKO_MAP y this.coingeckoBaseURL, pero ninguno
  // de los dos estaba definido en ningún lado — TypeError garantizado en
  // cada llamada, silenciado por el catch de getPrice() que cae a Binance.
  // Para cualquier cripto que solo exista en CoinGecko (la razón de tener
  // este fallback) el price fallaba por completo sin que nadie lo notara.
  static COINGECKO_MAP = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'DAI': 'dai',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'WBTC': 'wrapped-bitcoin',
    'AAVE': 'aave',
    'MKR': 'maker',
    'SHIB': 'shiba-inu',
    'PEPE': 'pepe',
    'MATIC': 'matic-network',
    'ARB': 'arbitrum',
    'OP': 'optimism',
    'SOL': 'solana',
    'ADA': 'cardano',
    'XRP': 'ripple',
    'DOGE': 'dogecoin',
    'DOT': 'polkadot',
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'AVAX': 'avalanche-2',
    'ATOM': 'cosmos'
  };

  // Iniciar actualización automática de precios
  startPriceUpdates(intervalMinutes = 2) {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    console.log(`Iniciando actualización automática de precios cada ${intervalMinutes} minuto(s)`);
    
    // Actualización inicial
    this.updateAllPrices();
    
    // Actualización periódica
    this.updateInterval = setInterval(() => {
      this.updateAllPrices();
    }, intervalMinutes * 60 * 1000);
  }

  // Detener actualizaciones automáticas
  stopPriceUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('Actualización automática de precios detenida');
    }
  }

  // Actualizar todos los precios activos
  async updateAllPrices() {
    if (this.isUpdating) {
      console.log('Actualización de precios ya en progreso, saltando...');
      return;
    }

    this.isUpdating = true;
    
    try {
      console.log('Iniciando actualización de precios...');
      
      const paresActivos = await SwapPair.getActive();
      
      if (paresActivos.length === 0) {
        console.log('No hay pares activos para actualizar');
        return;
      }

      // Agrupar por fuente de precios
      const paresPorFuente = this.groupPairsBySource(paresActivos);
      
      const results = {
        binance: { success: 0, failed: 0, errors: [] },
        cryptocompare: { success: 0, failed: 0, errors: [] },
        coinbase: { success: 0, failed: 0, errors: [] },
        manual: { success: 0, failed: 0, errors: [] }
      };

      // Actualizar desde cada fuente
      if (paresPorFuente.binance.length > 0) {
        const binanceResults = await this.updateFromBinance(paresPorFuente.binance);
        results.binance = binanceResults;
      }

      if (paresPorFuente.cryptocompare.length > 0) {
        const cryptocompareResults = await this.updateFromCryptoCompare(paresPorFuente.cryptocompare);
        results.cryptocompare = cryptocompareResults;
      }

      if (paresPorFuente.coinbase.length > 0) {
        const coinbaseResults = await this.updateFromCoinbase(paresPorFuente.coinbase);
        results.coinbase = coinbaseResults;
      }

      this.failureCount = 0;
      
      console.log('Actualización de precios completada:', {
        totalPares: paresActivos.length,
        exitosos: results.binance.success + results.cryptocompare.success + results.coinbase.success,
        fallidos: results.binance.failed + results.cryptocompare.failed + results.coinbase.failed
      });

    } catch (error) {
      this.failureCount++;
      console.error('Error durante actualización de precios:', error.message);
      
      if (this.failureCount >= this.maxFailures) {
        console.error(`Demasiados fallos consecutivos (${this.failureCount}). Deteniendo actualizaciones automáticas.`);
        this.stopPriceUpdates();
      }
    } finally {
      this.isUpdating = false;
    }
  }

  // Agrupar pares por fuente de precios
  groupPairsBySource(pares) {
    return pares.reduce((acc, par) => {
      const fuente = par.priceSource || 'binance'; // Por defecto Binance (gratuita)
      if (!acc[fuente]) acc[fuente] = [];
      acc[fuente].push(par);
      return acc;
    }, { binance: [], cryptocompare: [], coinbase: [], manual: [] });
  }

  // Actualizar precios desde Binance (Completamente gratuita)
  async updateFromBinance(pares) {
    const results = { success: 0, failed: 0, errors: [] };
    
    try {
      // Obtener ticker de 24h de Binance
      const response = await axios.get(`${this.binanceBaseURL}/ticker/24hr`, {
        timeout: 10000
      });

      const tickers = response.data;
      
      // Crear mapeo de símbolos
      const tickerMap = {};
      tickers.forEach(ticker => {
        tickerMap[ticker.symbol] = ticker;
      });

      // Actualizar cada par
      for (const par of pares) {
        try {
          const simboloBinance = `${par.baseCrypto.symbol}${par.quoteCrypto.symbol}`;
          const ticker = tickerMap[simboloBinance];

          if (!ticker) {
            // Intentar orden inverso
            const simboloInverso = `${par.quoteCrypto.symbol}${par.baseCrypto.symbol}`;
            const tickerInverso = tickerMap[simboloInverso];
            
            if (tickerInverso) {
              // Calcular price inverso (Binance da strings exactos; división y
              // negación con money.js para no arrastrar error de coma)
              const precioInverso = money.divide('1', String(tickerInverso.lastPrice));
              await this.updatePairPrice(par.id, {
                currentPrice: precioInverso,
                volume24h: String(tickerInverso.quoteVolume),
                changePercent24h: money.multiply(String(tickerInverso.priceChangePercent), '-1'),
                priceSource: 'binance'
              });
              results.success++;
            } else {
              results.errors.push(`Par ${simboloBinance} no encontrado en Binance`);
              results.failed++;
            }
            continue;
          }

          await this.updatePairPrice(par.id, {
            currentPrice: String(ticker.lastPrice),
            previousPrice: String(ticker.prevClosePrice),
            changePercent24h: String(ticker.priceChangePercent),
            volume24h: String(ticker.quoteVolume),
            volumeBase24h: String(ticker.volume),
            maxPrice24h: String(ticker.highPrice),
            minPrice24h: String(ticker.lowPrice),
            operationsCount24h: parseInt(ticker.count),
            priceSource: 'binance'
          });

          results.success++;
        } catch (error) {
          results.errors.push(`Error actualizando ${par.baseCrypto.symbol}/${par.quoteCrypto.symbol}: ${error.message}`);
          results.failed++;
        }
      }

    } catch (error) {
      console.error('Error obteniendo precios de Binance:', error.message);
      results.errors.push(`Error de API Binance: ${error.message}`);
      results.failed = pares.length;
    }

    return results;
  }

  // Actualizar precios desde CryptoCompare (Gratuita)
  async updateFromCryptoCompare(pares) {
    const results = { success: 0, failed: 0, errors: [] };
    
    try {
      // Obtener símbolos únicos
      const simbolosUnicos = new Set();
      pares.forEach(par => {
        simbolosUnicos.add(par.baseCrypto.symbol);
        simbolosUnicos.add(par.quoteCrypto.symbol);
      });

      const symbols = Array.from(simbolosUnicos).join(',');
      
      // Obtener precios multiple
      const response = await axios.get(`${this.cryptocompareBaseURL}/pricemultifull`, {
        params: {
          fsyms: symbols,
          tsyms: 'USD,BTC,ETH,USDT'
        },
        timeout: 10000
      });

      const data = response.data.RAW;

      // Actualizar cada par
      for (const par of pares) {
        try {
          const baseData = data[par.baseCrypto.symbol];
          const quoteSymbol = par.quoteCrypto.symbol;
          
          if (!baseData || !baseData[quoteSymbol]) {
            // Intentar con USD como intermediario
            if (baseData && baseData.USD && data[quoteSymbol] && data[quoteSymbol].USD) {
              const baseUSD = baseData.USD.PRICE;
              const quoteUSD = data[quoteSymbol].USD.PRICE;
              const price = baseUSD / quoteUSD;
              
              await this.updatePairPrice(par.id, {
                currentPrice: price,
                changePercent24h: baseData.USD.CHANGEPCT24HOUR - data[quoteSymbol].USD.CHANGEPCT24HOUR,
                volume24h: baseData.USD.VOLUME24HOURTO || 0,
                priceSource: 'cryptocompare'
              });
              results.success++;
            } else {
              results.errors.push(`Datos no disponibles para ${par.baseCrypto.symbol}/${par.quoteCrypto.symbol}`);
              results.failed++;
            }
            continue;
          }

          const priceData = baseData[quoteSymbol];
          await this.updatePairPrice(par.id, {
            currentPrice: priceData.PRICE,
            changePercent24h: priceData.CHANGEPCT24HOUR || 0,
            volume24h: priceData.VOLUME24HOURTO || 0,
            maxPrice24h: priceData.HIGH24HOUR,
            minPrice24h: priceData.LOW24HOUR,
            priceSource: 'cryptocompare'
          });

          results.success++;
        } catch (error) {
          results.errors.push(`Error actualizando ${par.baseCrypto.symbol}/${par.quoteCrypto.symbol}: ${error.message}`);
          results.failed++;
        }
      }

    } catch (error) {
      console.error('Error obteniendo precios de CryptoCompare:', error.message);
      results.errors.push(`Error de API CryptoCompare: ${error.message}`);
      results.failed = pares.length;
    }

    return results;
  }

  // Actualizar precios desde Coinbase (Gratuita)
  async updateFromCoinbase(pares) {
    const results = { success: 0, failed: 0, errors: [] };
    
    try {
      // Coinbase tiene límites, así que actualizamos uno por uno
      for (const par of pares) {
        try {
          const coinbasePair = `${par.baseCrypto.symbol}-${par.quoteCrypto.symbol}`;
          
          // Obtener price spot
          const priceResponse = await axios.get(`${this.coinbaseBaseURL}/exchange-rates`, {
            params: { currency: par.baseCrypto.symbol },
            timeout: 5000
          });
          
          const rates = priceResponse.data.data.rates;
          const price = rates[par.quoteCrypto.symbol];
          
          if (!price) {
            results.errors.push(`Par ${coinbasePair} no disponible en Coinbase`);
            results.failed++;
            continue;
          }

          await this.updatePairPrice(par.id, {
            currentPrice: String(price),
            priceSource: 'coinbase'
          });

          results.success++;
          
          // Pequeña pausa para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          results.errors.push(`Error actualizando ${par.baseCrypto.symbol}/${par.quoteCrypto.symbol}: ${error.message}`);
          results.failed++;
        }
      }

    } catch (error) {
      console.error('Error obteniendo precios de Coinbase:', error.message);
      results.errors.push(`Error de API Coinbase: ${error.message}`);
      results.failed = pares.length;
    }

    return results;
  }

  // Actualizar price de un par específico
  async updatePairPrice(pairId, priceData) {
    try {
      const updateData = {
        ...priceData,
        lastUpdated: new Date()
      };

      // Si hay price anterior, calcularlo
      if (priceData.currentPrice && !priceData.previousPrice) {
        const parActual = await SwapPair.findByPk(pairId);
        if (parActual && parActual.currentPrice) {
          updateData.previousPrice = parActual.currentPrice;
        }
      }

      await SwapPair.update(updateData, {
        where: { id: pairId }
      });

    } catch (error) {
      throw new Error(`Error actualizando price del par ${pairId}: ${error.message}`);
    }
  }

  // Obtener price actual de un par específico
  async getCurrentPrice(baseSymbol, quoteSymbol) {
    try {
      const par = await SwapPair.getBySymbols(baseSymbol, quoteSymbol);
      
      if (!par || !par.active) {
        throw new Error(`Par ${baseSymbol}/${quoteSymbol} no encontrado o inactivo`);
      }

      // Si el price está muy desactualizado (más de 10 minutos), intentar actualizar
      const ahora = new Date();
      const lastUpdated = new Date(par.lastUpdated);
      const minutosDesdeActualizacion = (ahora - lastUpdated) / (1000 * 60);

      if (minutosDesdeActualizacion > 10) {
        console.log(`Precio desactualizado para ${baseSymbol}/${quoteSymbol}, actualizando...`);
        await this.updateSinglePair(par);
        
        // Obtener el par actualizado
        return await SwapPair.getBySymbols(baseSymbol, quoteSymbol);
      }

      return par;
    } catch (error) {
      throw new Error(`Error obteniendo price actual: ${error.message}`);
    }
  }

  // Actualizar un solo par
  async updateSinglePair(par) {
    try {
      if (par.priceSource === 'binance') {
        await this.updateFromBinance([par]);
      } else if (par.priceSource === 'cryptocompare') {
        await this.updateFromCryptoCompare([par]);
      } else if (par.priceSource === 'coinbase') {
        await this.updateFromCoinbase([par]);
      }
    } catch (error) {
      console.error(`Error actualizando par individual ${par.baseCrypto.symbol}/${par.quoteCrypto.symbol}:`, error.message);
    }
  }

  // Obtener estadísticas del servicio
  getServiceStats() {
    return {
      isUpdating: this.isUpdating,
      updateInterval: this.updateInterval ? 'Activo' : 'Inactivo',
      failureCount: this.failureCount,
      maxFailures: this.maxFailures,
      supportedSources: ['binance', 'cryptocompare', 'coinbase', 'manual'],
      defaultSource: 'binance',
      freeAPIs: true
    };
  }

  // Método público para obtener price individual
  async getPrice(baseSymbol, quoteSymbol) {
    try {
      // Intentar con CoinGecko primero
      const coingeckoPrice = await this.getPriceFromCoinGecko(baseSymbol, quoteSymbol);
      if (coingeckoPrice) {
        return {
          price: coingeckoPrice,
          source: 'coingecko'
        };
      }
    } catch (error) {
      console.warn(`CoinGecko failed for ${baseSymbol}/${quoteSymbol}:`, error.message);
    }

    try {
      // Intentar con Binance como fallback
      const binancePrice = await this.getPriceFromBinance(baseSymbol, quoteSymbol);
      if (binancePrice) {
        return {
          price: binancePrice,
          source: 'binance'
        };
      }
    } catch (error) {
      console.warn(`Binance failed for ${baseSymbol}/${quoteSymbol}:`, error.message);
    }

    throw new Error(`No se pudo obtener price para ${baseSymbol}/${quoteSymbol} desde ninguna fuente`);
  }

  // Obtener price específico de CoinGecko
  async getPriceFromCoinGecko(baseSymbol, quoteSymbol) {
    try {
      const baseId = PriceService.COINGECKO_MAP[baseSymbol];
      const quoteId = PriceService.COINGECKO_MAP[quoteSymbol];
      
      if (!baseId) {
        throw new Error(`${baseSymbol} no está en el mapeo de CoinGecko`);
      }

      // Si quote es una criptomoneda conocida pero no USD/EUR, hacer cálculo indirecto
      if (quoteId && quoteSymbol !== 'USD' && quoteSymbol !== 'EUR') {
        const response = await axios.get(`${this.coingeckoBaseURL}/simple/price`, {
          params: {
            ids: `${baseId},${quoteId}`,
            vs_currencies: 'usd'
          },
          timeout: 5000
        });
        
        const baseUSD = response.data[baseId]?.usd;
        const quoteUSD = response.data[quoteId]?.usd;
        
        if (baseUSD && quoteUSD) {
          return baseUSD / quoteUSD;
        }
      }
      
      // Método directo (para USD, EUR, etc.)
      const response = await axios.get(`${this.coingeckoBaseURL}/simple/price`, {
        params: {
          ids: baseId,
          vs_currencies: quoteSymbol.toLowerCase()
        },
        timeout: 5000
      });
      
      const price = response.data[baseId]?.[quoteSymbol.toLowerCase()];
      return price ? parseFloat(price) : null;
      
    } catch (error) {
      throw new Error(`Error obteniendo price de CoinGecko: ${error.message}`);
    }
  }

  // Obtener price específico de Binance
  async getPriceFromBinance(baseSymbol, quoteSymbol) {
    try {
      const symbol = `${baseSymbol}${quoteSymbol}`;
      const response = await axios.get(`${this.binanceBaseURL}/ticker/price`, {
        params: { symbol },
        timeout: 5000
      });
      return String(response.data.price);
    } catch (error) {
      // Intentar price inverso
      try {
        const inverseSymbol = `${quoteSymbol}${baseSymbol}`;
        const response = await axios.get(`${this.binanceBaseURL}/ticker/price`, {
          params: { symbol: inverseSymbol },
          timeout: 5000
        });
        return money.divide('1', String(response.data.price));
      } catch (inverseError) {
        throw error;
      }
    }
  }

  // Actualizar price en tiempo real para un par específico
  async updatePairPriceRealTime(pairId) {
    try {
      const par = await SwapPair.findByPk(pairId, {
        include: [
          {
            model: require('../models/index.js').Crypto,
            as: 'baseCrypto',
            attributes: ['symbol']
          },
          {
            model: require('../models/index.js').Crypto,
            as: 'quoteCrypto',
            attributes: ['symbol']
          }
        ]
      });

      if (!par || !par.active) {
        throw new Error('Par no encontrado o inactivo');
      }

      const priceResult = await this.getPrice(par.baseCrypto.symbol, par.quoteCrypto.symbol);
      
      if (priceResult && priceResult.price > 0) {
        await this.updatePairPrice(pairId, {
          currentPrice: priceResult.price,
          priceSource: priceResult.source
        });
        
        console.log(`Precio actualizado para ${par.baseCrypto.symbol}/${par.quoteCrypto.symbol}: ${priceResult.price}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error actualizando price en tiempo real para par ${pairId}:`, error.message);
      return false;
    }
  }
}

// Instancia singleton
const priceService = new PriceService();

module.exports = priceService;