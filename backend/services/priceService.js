// services/priceService.js

const axios = require('axios');
const { ParExchange } = require('../models/index.js');

class PriceService {
  constructor() {
    this.coingeckoBaseURL = 'https://api.coingecko.com/api/v3';
    this.binanceBaseURL = 'https://api.binance.com/api/v3';
    this.isUpdating = false;
    this.updateInterval = null;
    this.failureCount = 0;
    this.maxFailures = 5;
  }

  // Mapeo de símbolos a IDs de CoinGecko
  static COINGECKO_MAP = {
    'BTC': 'bitcoin',
    'ETH': 'ethereum',
    'BNB': 'binancecoin',
    'ADA': 'cardano',
    'DOT': 'polkadot',
    'LINK': 'chainlink',
    'UNI': 'uniswap',
    'LTC': 'litecoin',
    'BCH': 'bitcoin-cash',
    'XRP': 'ripple',
    'DOGE': 'dogecoin',
    'MATIC': 'matic-network',
    'AVAX': 'avalanche-2',
    'ATOM': 'cosmos',
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'DAI': 'dai',
    'BUSD': 'binance-usd'
  };

  // Iniciar actualización automática de precios
  startPriceUpdates(intervalMinutes = 1) {
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
      
      // Obtener todos los pares activos
      const paresActivos = await ParExchange.getActive();
      
      if (paresActivos.length === 0) {
        console.log('No hay pares activos para actualizar');
        return;
      }

      // Agrupar por fuente de precios
      const paresPorFuente = this.groupPairsBySource(paresActivos);
      
      // Actualizar desde cada fuente
      const results = {
        coingecko: { success: 0, failed: 0, errors: [] },
        binance: { success: 0, failed: 0, errors: [] },
        manual: { success: 0, failed: 0, errors: [] }
      };

      if (paresPorFuente.coingecko.length > 0) {
        const coingeckoResults = await this.updateFromCoinGecko(paresPorFuente.coingecko);
        results.coingecko = coingeckoResults;
      }

      if (paresPorFuente.binance.length > 0) {
        const binanceResults = await this.updateFromBinance(paresPorFuente.binance);
        results.binance = binanceResults;
      }

      this.failureCount = 0; // Reset contador de fallos en caso de éxito
      
      console.log('Actualización de precios completada:', {
        totalPares: paresActivos.length,
        exitosos: results.coingecko.success + results.binance.success,
        fallidos: results.coingecko.failed + results.binance.failed
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
      const fuente = par.fuentePrecio || 'manual';
      if (!acc[fuente]) acc[fuente] = [];
      acc[fuente].push(par);
      return acc;
    }, { coingecko: [], binance: [], manual: [] });
  }

  // Actualizar precios desde CoinGecko
  async updateFromCoinGecko(pares) {
    const results = { success: 0, failed: 0, errors: [] };
    
    try {
      // Crear mapeo de símbolos únicos
      const simbolosUnicos = new Set();
      pares.forEach(par => {
        simbolosUnicos.add(par.criptoBase.symbol);
        simbolosUnicos.add(par.criptoQuote.symbol);
      });

      // Convertir símbolos a IDs de CoinGecko
      const coingeckoIds = Array.from(simbolosUnicos)
        .map(symbol => PriceService.COINGECKO_MAP[symbol])
        .filter(id => id);

      if (coingeckoIds.length === 0) {
        console.log('No hay símbolos mapeados para CoinGecko');
        return results;
      }

      // Obtener precios de CoinGecko
      const response = await axios.get(`${this.coingeckoBaseURL}/simple/price`, {
        params: {
          ids: coingeckoIds.join(','),
          vs_currencies: 'usd',
          include_24hr_change: 'true',
          include_24hr_vol: 'true'
        },
        timeout: 10000
      });

      const precios = response.data;

      // Crear mapeo inverso para conversión rápida
      const symbolToPrice = {};
      Object.entries(PriceService.COINGECKO_MAP).forEach(([symbol, geckoId]) => {
        if (precios[geckoId]) {
          symbolToPrice[symbol] = {
            usd: precios[geckoId].usd,
            usd_24h_change: precios[geckoId].usd_24h_change || 0,
            usd_24h_vol: precios[geckoId].usd_24h_vol || 0
          };
        }
      });

      // Actualizar cada par
      for (const par of pares) {
        try {
          const baseData = symbolToPrice[par.criptoBase.symbol];
          const quoteData = symbolToPrice[par.criptoQuote.symbol];

          if (!baseData || !quoteData) {
            results.errors.push(`Precio no disponible para ${par.criptoBase.symbol}/${par.criptoQuote.symbol}`);
            results.failed++;
            continue;
          }

          // Calcular precio del par (base/quote)
          const nuevoPrecio = baseData.usd / quoteData.usd;
          const cambio24h = baseData.usd_24h_change - quoteData.usd_24h_change;

          await this.updatePairPrice(par.id, {
            precioActual: nuevoPrecio,
            cambiosPorcentaje24h: cambio24h,
            volumen24h: baseData.usd_24h_vol || 0,
            fuentePrecio: 'coingecko'
          });

          results.success++;
        } catch (error) {
          results.errors.push(`Error actualizando ${par.criptoBase.symbol}/${par.criptoQuote.symbol}: ${error.message}`);
          results.failed++;
        }
      }

    } catch (error) {
      console.error('Error obteniendo precios de CoinGecko:', error.message);
      results.errors.push(`Error de API CoinGecko: ${error.message}`);
      results.failed = pares.length;
    }

    return results;
  }

  // Actualizar precios desde Binance
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
          const simboloBinance = `${par.criptoBase.symbol}${par.criptoQuote.symbol}`;
          const ticker = tickerMap[simboloBinance];

          if (!ticker) {
            results.errors.push(`Par ${simboloBinance} no encontrado en Binance`);
            results.failed++;
            continue;
          }

          await this.updatePairPrice(par.id, {
            precioActual: parseFloat(ticker.lastPrice),
            precioAnterior: parseFloat(ticker.prevClosePrice),
            cambiosPorcentaje24h: parseFloat(ticker.priceChangePercent),
            volumen24h: parseFloat(ticker.quoteVolume),
            volumenBase24h: parseFloat(ticker.volume),
            precioMaximo24h: parseFloat(ticker.highPrice),
            precioMinimo24h: parseFloat(ticker.lowPrice),
            cantidadOperaciones24h: parseInt(ticker.count),
            fuentePrecio: 'binance'
          });

          results.success++;
        } catch (error) {
          results.errors.push(`Error actualizando ${par.criptoBase.symbol}/${par.criptoQuote.symbol}: ${error.message}`);
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

  // Actualizar precio de un par específico
  async updatePairPrice(parId, priceData) {
    try {
      const updateData = {
        ...priceData,
        ultimaActualizacion: new Date()
      };

      // Si hay precio anterior, calcularlo
      if (priceData.precioActual && !priceData.precioAnterior) {
        const parActual = await ParExchange.findByPk(parId);
        if (parActual && parActual.precioActual) {
          updateData.precioAnterior = parActual.precioActual;
        }
      }

      await ParExchange.update(updateData, {
        where: { id: parId }
      });

    } catch (error) {
      throw new Error(`Error actualizando precio del par ${parId}: ${error.message}`);
    }
  }

  // Obtener precio actual de un par específico
  async getCurrentPrice(baseSymbol, quoteSymbol) {
    try {
      const par = await ParExchange.getBySymbols(baseSymbol, quoteSymbol);
      
      if (!par || !par.activo) {
        throw new Error(`Par ${baseSymbol}/${quoteSymbol} no encontrado o inactivo`);
      }

      // Si el precio está muy desactualizado (más de 5 minutos), intentar actualizar
      const ahora = new Date();
      const ultimaActualizacion = new Date(par.ultimaActualizacion);
      const minutosDesdeActualizacion = (ahora - ultimaActualizacion) / (1000 * 60);

      if (minutosDesdeActualizacion > 5) {
        console.log(`Precio desactualizado para ${baseSymbol}/${quoteSymbol}, actualizando...`);
        await this.updateSinglePair(par);
        
        // Obtener el par actualizado
        return await ParExchange.getBySymbols(baseSymbol, quoteSymbol);
      }

      return par;
    } catch (error) {
      throw new Error(`Error obteniendo precio actual: ${error.message}`);
    }
  }

  // Actualizar un solo par
  async updateSinglePair(par) {
    try {
      if (par.fuentePrecio === 'coingecko') {
        await this.updateFromCoinGecko([par]);
      } else if (par.fuentePrecio === 'binance') {
        await this.updateFromBinance([par]);
      }
    } catch (error) {
      console.error(`Error actualizando par individual ${par.criptoBase.symbol}/${par.criptoQuote.symbol}:`, error.message);
    }
  }

  // Obtener estadísticas del servicio
  getServiceStats() {
    return {
      isUpdating: this.isUpdating,
      updateInterval: this.updateInterval ? 'Activo' : 'Inactivo',
      failureCount: this.failureCount,
      maxFailures: this.maxFailures,
      supportedSources: ['coingecko', 'binance', 'manual'],
      coingeckoSymbols: Object.keys(PriceService.COINGECKO_MAP).length
    };
  }
}

// Instancia singleton
const priceService = new PriceService();

module.exports = priceService;