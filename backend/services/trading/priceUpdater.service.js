// services/trading/priceUpdater.service.js
const { TradingPair } = require('../../models');
const axios = require('axios');

class PriceUpdaterService {

  constructor() {
    this.binanceBaseUrl = 'https://api.binance.com/api/v3';
    this.priceCache = new Map(); // Cache para evitar consultas excesivas
    this.cacheDuration = 5000; // 5 segundos
  }

  /**
   * Actualiza el precio de un par desde Binance
   */
  async updatePairPrice(tradingPairId) {
    try {
      const tradingPair = await TradingPair.findByPk(tradingPairId, {
        include: [
          { association: 'baseAsset', attributes: ['symbol'] },
          { association: 'quoteAsset', attributes: ['symbol'] }
        ]
      });

      if (!tradingPair || tradingPair.status !== 'active') {
        return null;
      }

      // Construir símbolo de Binance (ej: BTCUSDT)
      const binanceSymbol = `${tradingPair.baseAsset.symbol}${tradingPair.quoteAsset.symbol}`;

      // Obtener datos de precio de Binance
      const priceData = await this.fetchBinancePrice(binanceSymbol);

      if (!priceData) {
        console.warn(`No se pudo obtener precio de Binance para ${binanceSymbol}`);
        return null;
      }

      // Actualizar en la base de datos
      await tradingPair.update({
        lastPrice: priceData.lastPrice,
        priceChange24h: priceData.priceChangePercent,
        volume24h: priceData.volume,
        high24h: priceData.highPrice,
        low24h: priceData.lowPrice
      });

      return {
        symbol: tradingPair.symbol,
        ...priceData,
        updatedAt: new Date()
      };

    } catch (error) {
      console.error(`Error actualizando precio para ${tradingPairId}:`, error.message);
      return null;
    }
  }

  /**
   * Actualiza precios de todos los pares activos
   */
  async updateAllPrices() {
    try {
      const activePairs = await TradingPair.findAll({
        where: { status: 'active' },
        include: [
          { association: 'baseAsset', attributes: ['symbol'] },
          { association: 'quoteAsset', attributes: ['symbol'] }
        ]
      });

      console.log(`Actualizando precios de ${activePairs.length} pares...`);

      const results = await Promise.allSettled(
        activePairs.map(pair => this.updatePairPrice(pair.id))
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
      const failed = results.length - successful;

      console.log(`Precios actualizados: ${successful} exitosos, ${failed} fallidos`);

      return {
        total: results.length,
        successful,
        failed
      };

    } catch (error) {
      console.error('Error actualizando todos los precios:', error);
      throw error;
    }
  }

  /**
   * Obtiene precio de Binance con datos de 24h
   */
  async fetchBinancePrice(symbol) {
    try {
      // Verificar cache
      const cached = this.priceCache.get(symbol);
      if (cached && (Date.now() - cached.timestamp) < this.cacheDuration) {
        return cached.data;
      }

      // Consultar a Binance - ticker 24h
      const response = await axios.get(`${this.binanceBaseUrl}/ticker/24hr`, {
        params: { symbol },
        timeout: 5000
      });

      const data = response.data;

      const priceData = {
        lastPrice: parseFloat(data.lastPrice),
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteVolume: parseFloat(data.quoteVolume),
        openPrice: parseFloat(data.openPrice),
        closePrice: parseFloat(data.lastPrice),
        trades: parseInt(data.count)
      };

      // Guardar en cache
      this.priceCache.set(symbol, {
        data: priceData,
        timestamp: Date.now()
      });

      return priceData;

    } catch (error) {
      if (error.response?.status === 404) {
        console.warn(`Par ${symbol} no encontrado en Binance`);
      } else {
        console.error(`Error consultando Binance para ${symbol}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Obtiene precio actual de un par (desde cache o Binance)
   */
  async getCurrentPrice(tradingPairId) {
    try {
      const tradingPair = await TradingPair.findByPk(tradingPairId, {
        include: [
          { association: 'baseAsset', attributes: ['symbol'] },
          { association: 'quoteAsset', attributes: ['symbol'] }
        ]
      });

      if (!tradingPair) {
        throw new Error('Trading pair no encontrado');
      }

      const binanceSymbol = `${tradingPair.baseAsset.symbol}${tradingPair.quoteAsset.symbol}`;
      const priceData = await this.fetchBinancePrice(binanceSymbol);

      return priceData ? priceData.lastPrice : parseFloat(tradingPair.lastPrice);

    } catch (error) {
      console.error('Error obteniendo precio actual:', error);
      throw error;
    }
  }

  /**
   * Obtiene datos de múltiples pares en una sola llamada
   */
  async getBatchPrices(symbols) {
    try {
      // Binance permite consultar múltiples símbolos
      const symbolsQuery = JSON.stringify(symbols);
      
      const response = await axios.get(`${this.binanceBaseUrl}/ticker/24hr`, {
        params: { symbols: symbolsQuery },
        timeout: 10000
      });

      return response.data.map(data => ({
        symbol: data.symbol,
        lastPrice: parseFloat(data.lastPrice),
        priceChangePercent: parseFloat(data.priceChangePercent),
        volume: parseFloat(data.volume),
        high: parseFloat(data.highPrice),
        low: parseFloat(data.lowPrice)
      }));

    } catch (error) {
      console.error('Error obteniendo precios en batch:', error);
      return [];
    }
  }

  /**
   * Limpia el cache de precios
   */
  clearCache() {
    this.priceCache.clear();
    console.log('Cache de precios limpiado');
  }

  /**
   * Verifica conectividad con Binance
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.binanceBaseUrl}/ping`, {
        timeout: 3000
      });
      return { connected: true, latency: response.headers['x-response-time'] };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
}

module.exports = new PriceUpdaterService();