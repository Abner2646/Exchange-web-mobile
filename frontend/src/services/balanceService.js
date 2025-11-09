// src/services/balanceService.js (web)
import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class BalanceService {
  /**
   * Obtener balances del usuario autenticado
   * @returns {Promise<Array>} Lista de balances 
   */
  async getMyBalances() {
    const response = await apiClient.get(ENDPOINTS.MY_BALANCES);
    
    // Normalizar respuesta
    if (Array.isArray(response.data)) return response.data;
    if (response.data?.data) return response.data.data;
    return [];
  }

  /**
   * Calcular totales en USDT y BTC
   * @param {Array} balances - Lista de balances
   * @param {Array} cryptos - Lista de criptomonedas
   * @param {Object} prices - Mapa de precios {symbol: price}
   * @returns {Object} Totales calculados
   */
  calculateTotals(balances, cryptos, prices) {
    if (!balances || balances.length === 0) {
      return { totalUSDT: 0, totalBTC: 0, btcPriceError: false };
    }

    const totalUSDT = balances.reduce((acc, balance) => {
      const crypto = cryptos.find(c => c.id === balance.criptomonedaId);
      const price = prices[crypto?.symbol] || 0;
      return acc + (parseFloat(balance.balanceDisponible) * price);
    }, 0);

    const btcPrice = prices['BTC'];
    
    if (!btcPrice || btcPrice === 0) {
      return { totalUSDT, totalBTC: 0, btcPriceError: true };
    }
    
    const totalBTC = totalUSDT / btcPrice;

    return { totalUSDT, totalBTC, btcPriceError: false };
  }

  /**
   * Enriquecer balances con información de crypto, precio y valor
   * @param {Array} balances - Lista de balances
   * @param {Array} cryptos - Lista de criptomonedas
   * @param {Object} prices - Mapa de precios
   * @returns {Array} Balances enriquecidos
   */
  enrichBalances(balances, cryptos, prices) {
    return balances
      .map(balance => {
        const crypto = cryptos.find(c => c.id === balance.criptomonedaId);
        if (!crypto) return null;

        const price = prices[crypto.symbol] || 0;
        const balanceAmount = parseFloat(balance.balanceDisponible);
        const valueInUSDT = balanceAmount * price;

        return {
          ...balance,
          crypto,
          price,
          valueInUSDT,
          balanceAmount
        };
      })
      .filter(b => b !== null);
  }

  /**
   * Filtrar balances pequeños
   * @param {Array} enrichedBalances - Balances enriquecidos
   * @param {Number} minValue - Valor mínimo en USDT (default: 1)
   * @returns {Array} Balances filtrados
   */
  filterSmallBalances(enrichedBalances, minValue = 1) {
    return enrichedBalances.filter(b => b.valueInUSDT >= minValue);
  }

  /**
   * Obtener top activos del portfolio con porcentajes
   * @param {Array} enrichedBalances - Balances enriquecidos
   * @param {Number} limit - Número de activos a retornar (default: 5)
   * @returns {Array} Top activos con formato para UI
   */
  getTopAssets(enrichedBalances, limit = 5) {
    if (!enrichedBalances || enrichedBalances.length === 0) {
      return [];
    }

    // Filtrar activos con valor y ordenar por valor descendente
    const validAssets = enrichedBalances
      .filter(balance => balance.valueInUSDT > 0)
      .sort((a, b) => b.valueInUSDT - a.valueInUSDT);

    // Calcular total para porcentajes
    const total = validAssets.reduce((sum, asset) => sum + asset.valueInUSDT, 0);

    // Tomar top N y calcular porcentajes
    return validAssets.slice(0, limit).map(asset => ({
      symbol: asset.crypto.symbol,
      value: asset.valueInUSDT,
      balance: asset.balanceAmount,
      percentage: total > 0 ? ((asset.valueInUSDT / total) * 100).toFixed(1) : '0.0',
    }));
  }
}

export default new BalanceService();