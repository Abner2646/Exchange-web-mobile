// mobile/services/cryptoService.js (mobile)
import api from './api';
import { ENDPOINTS } from '../api/endpoints';

class CryptoService {
  async getActiveCryptos() {
    const response = await api.get(ENDPOINTS.CRYPTOS_ACTIVE);
    
    if (Array.isArray(response.data)) return response.data;
    if (response.data?.data) return response.data.data;
    return [];
  }

  async getCryptoById(id) {
    try {
      const response = await api.get(ENDPOINTS.CRYPTO_BY_ID(id));
      return response.data;
    } catch (error) {
      console.warn(`No se pudo obtener crypto con ID ${id}`);
      return null;
    }
  }

  async getCryptoBySymbol(symbol) {
    try {
      const response = await api.get(ENDPOINTS.CRYPTO_BY_SYMBOL(symbol));
      return response.data;
    } catch (error) {
      console.warn(`No se pudo obtener crypto con símbolo ${symbol}`);
      return null;
    }
  }

  async getPrice(from, to) {
    try {
      const response = await api.get(ENDPOINTS.PRICE(from, to));
      return response.data?.price || 0;
    } catch (error) {
      console.warn(`No se pudo obtener precio para ${from}/${to}`);
      return 0;
    }
  }

  async getCryptosByIds(ids) {
    const promises = ids.map(id => this.getCryptoById(id));
    const results = await Promise.all(promises);
    return results.filter(c => c !== null);
  }

  async getPricesForCryptos(cryptos, quoteCurrency = 'USDT') {
    const pricesMap = {};
    
    const pricePromises = cryptos.map(async (crypto) => {
      if (crypto.symbol === quoteCurrency) {
        pricesMap[crypto.symbol] = 1;
        return;
      }

      const price = await this.getPrice(crypto.symbol, quoteCurrency);
      pricesMap[crypto.symbol] = price;
    });

    await Promise.all(pricePromises);
    return pricesMap;
  }

  /**
   * Obtener datos de mercado de CoinGecko (incluye variaciones 24h)
   * @param {Number} limit - Número de criptomonedas a obtener (default: 250)
   * @returns {Promise<Array>} Array de datos de mercado
   */
  async getMarketData(limit = 250) {
    try {
      const response = await api.get(ENDPOINTS.COINGECKO_MARKETS(1, limit));
      return response.data || [];
    } catch (error) {
      console.warn('Error obteniendo datos de mercado de CoinGecko:', error.message);
      return [];
    }
  }
}

export default new CryptoService();