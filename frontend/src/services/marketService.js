// src/services/marketService.js
import axios from 'axios';
import { ENDPOINTS } from '../api/endpoints';

// Lista de stablecoins a filtrar
const STABLECOINS = [
  'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 
  'USDP', 'USDD', 'GUSD', 'FRAX', 'PYUSD'
];

class MarketService {
  /**
   * Obtener datos del mercado (CoinGecko)
   * @param {Number} page - Número de página (default: 1)
   * @param {Number} perPage - Cryptos por página (default: 100, máximo permitido)
   */
  async getMarketData(page = 1, perPage = 100) {
    try {
      const response = await axios.get(
        ENDPOINTS.COINGECKO_MARKETS(page, perPage)
      );
      console.log(`MarketService.getMarketData: ${response.data.length} cryptos cargadas`);
      return response.data;
    } catch (error) {
      console.error('MarketService.getMarketData error:', error);
      throw error;
    }
  }

  /**
   * ⭐ MODIFICADO: Obtener todas las cryptos con 1 SOLA llamada
   * Simplificado para usar el máximo permitido por CoinGecko (100)
   */
  async getAllMarketData() {
    try {
      console.log('MarketService.getAllMarketData: Obteniendo top 100 cryptos...');
      const data = await this.getMarketData(1, 100);
      console.log(`MarketService.getAllMarketData: ${data.length} cryptos cargadas exitosamente`);
      return data;
    } catch (error) {
      console.error('MarketService.getAllMarketData error:', error);
      throw error;
    }
  }

  /**
   * Calcular top gainers con filtros inteligentes
   * @param {Array} marketData - Datos del mercado
   * @param {Number} limit - Límite de resultados (default: 5)
   * @param {String} timeframe - '24h' o '7d'
   * @param {Number} minChange - Cambio mínimo porcentual (default: 0.5)
   */
  getTopGainers(marketData, limit = 5, timeframe = '24h', minChange = 0.05) {
    if (!marketData || marketData.length === 0) return [];
    
    const priceChangeKey = timeframe === '7d' 
      ? 'price_change_percentage_7d_in_currency' 
      : 'price_change_percentage_24h';

    return [...marketData]
      .filter(coin => !STABLECOINS.includes(coin.symbol.toUpperCase()))
      .filter(coin => {
        const change = coin[priceChangeKey];
        return change && change >= minChange;
      })
      .sort((a, b) => b[priceChangeKey] - a[priceChangeKey])
      .slice(0, limit)
      .map(coin => ({
        ...coin,
        changePercentage: coin[priceChangeKey],
        timeframe,
      }));
  }

  /**
   * Calcular top losers con filtros inteligentes
   * @param {Array} marketData - Datos del mercado
   * @param {Number} limit - Límite de resultados (default: 5)
   * @param {String} timeframe - '24h' o '7d'
   * @param {Number} minChange - Cambio mínimo porcentual (default: 0.5)
   */
  getTopLosers(marketData, limit = 5, timeframe = '24h', minChange = 0.5) {
    if (!marketData || marketData.length === 0) return [];
    
    const priceChangeKey = timeframe === '7d' 
      ? 'price_change_percentage_7d_in_currency' 
      : 'price_change_percentage_24h';

    return [...marketData]
      .filter(coin => !STABLECOINS.includes(coin.symbol.toUpperCase()))
      .filter(coin => {
        const change = coin[priceChangeKey];
        return change && change <= -minChange;
      })
      .sort((a, b) => a[priceChangeKey] - b[priceChangeKey])
      .slice(0, limit)
      .map(coin => ({
        ...coin,
        changePercentage: coin[priceChangeKey],
        timeframe,
      }));
  }
}

export default new MarketService();