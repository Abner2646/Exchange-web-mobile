// services/cryptoService.js (web)  

import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class CryptoService {
  /**
   * Obtener criptomonedas activas
   */
  async getActiveCryptos() {
    const response = await apiClient.get(ENDPOINTS.CRYPTOS_ACTIVE);
    
    if (Array.isArray(response.data)) return response.data;
    if (response.data?.data) return response.data.data;
    return [];
  }

  /**
   * Obtener una criptomoneda por ID
   */
  async getCryptoById(id) {
    try {
      const response = await apiClient.get(ENDPOINTS.CRYPTO_BY_ID(id));
      return response.data;
    } catch (error) {
      console.warn(`No se pudo obtener crypto con ID ${id}`);
      return null;
    }
  }

  /**
   * Obtener una criptomoneda por símbolo
   */
  async getCryptoBySymbol(symbol) {
    try {
      const response = await apiClient.get(ENDPOINTS.CRYPTO_BY_SYMBOL(symbol));
      return response.data;
    } catch (error) {
      console.warn(`No se pudo obtener crypto con símbolo ${symbol}`);
      return null;
    }
  }

  /**
   * Obtener precio de un par de exchange
   * @param {String} from - Símbolo de origen (ej: 'BTC')
   * @param {String} to - Símbolo de destino (ej: 'USDT')
   */
  async getPrice(from, to) {
    try {
      const response = await apiClient.get(ENDPOINTS.PRICE(from, to));
      return response.data?.price || 0;
    } catch (error) {
      console.warn(`No se pudo obtener precio para ${from}/${to}`);
      return 0;
    }
  }

  /**
   * Obtener múltiples criptomonedas por IDs (en paralelo)
   * @param {Array} ids - Array de IDs
   */
  async getCryptosByIds(ids) {
    const promises = ids.map(id => this.getCryptoById(id));
    const results = await Promise.all(promises);
    return results.filter(c => c !== null);
  }

  /**
   * Obtener precios para múltiples criptomonedas (en paralelo)
   * @param {Array} cryptos - Array de objetos crypto con propiedad 'symbol'
   * @param {String} quoteCurrency - Moneda de cotización (default: 'USDT')
   */
  async getPricesForCryptos(cryptos, quoteCurrency = 'USDT') {
    const pricesMap = {};
    
    const pricePromises = cryptos.map(async (crypto) => {
      // USDT siempre vale 1
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
}

export default new CryptoService();