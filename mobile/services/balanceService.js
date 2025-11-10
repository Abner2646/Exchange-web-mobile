// mobile/services/balanceService.js
import api from './api';
import { ENDPOINTS } from '../api/endpoints';

class BalanceService {
  /**
   * Obtener balances del usuario autenticado
   * @returns {Promise<Array>} Lista de balances 
   */
  async getMyBalances() {
    const response = await api.get(ENDPOINTS.MY_BALANCES);
    
    if (Array.isArray(response.data)) return response.data;
    if (response.data?.data) return response.data.data;
    return [];
  }

  /**
   * Calcular totales en USDT y BTC
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
   */
  enrichBalances(balances, cryptos, prices, marketData = {}) {
    return balances
      .map(balance => {
        const crypto = cryptos.find(c => c.id === balance.criptomonedaId);
        if (!crypto) return null;

        const price = prices[crypto.symbol] || 0;
        const balanceAmount = parseFloat(balance.balanceDisponible);
        const valueInUSDT = balanceAmount * price;

        const market = marketData[crypto.symbol] || {};
        const priceChange24h = market.priceChange24h || 0;

        return {
          ...balance,
          crypto,
          price,
          valueInUSDT,
          balanceAmount,
          priceChange24h,
        };
      })
      .filter(b => b !== null);
  }

  /**
   * Filtrar balances pequeños
   */
  filterSmallBalances(enrichedBalances, minValue = 1) {
    return enrichedBalances.filter(b => b.valueInUSDT >= minValue);
  }

  /**
   * Obtener top activos del portfolio con porcentajes y variación 24h
   * @param {Array} enrichedBalances - Balances enriquecidos
   * @param {Number} limit - Número de activos a retornar
   * @param {Object} marketData - Datos del mercado (opcional) ⭐ NUEVO
   * @returns {Array} Top activos con formato para UI
   */
  getTopAssets(enrichedBalances, limit = 5, marketData = {}) {
    if (!enrichedBalances || enrichedBalances.length === 0) {
      return [];
    }

    const validAssets = enrichedBalances
      .filter(balance => balance.valueInUSDT > 0)
      .sort((a, b) => b.valueInUSDT - a.valueInUSDT);

    const total = validAssets.reduce((sum, asset) => sum + asset.valueInUSDT, 0);

    return validAssets.slice(0, limit).map(asset => {
      // Buscar datos de mercado para obtener priceChange24h ⭐ NUEVO
      const market = marketData[asset.crypto.symbol] || {};
      
      return {
        symbol: asset.crypto.symbol,
        value: asset.valueInUSDT,
        balance: asset.balanceAmount,
        percentage: total > 0 ? ((asset.valueInUSDT / total) * 100).toFixed(1) : '0.0',
        priceChange24h: market.price_change_percentage_24h || 0, // ⭐ NUEVO
      };
    });
  }
}

export default new BalanceService();