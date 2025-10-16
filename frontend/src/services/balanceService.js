// src/services/balanceService.js
/*
import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class BalanceService {
  // Obtener balances del usuario
  async getMyBalances() {
    const response = await apiClient.get(ENDPOINTS.MY_BALANCES);
    
    // Normalizar respuesta
    if (Array.isArray(response.data)) return response.data;
    if (response.data?.data) return response.data.data;
    if (response.data?.balances) return response.data.balances;
    return [];
  }

  // Obtener balance de una crypto específica
  async getBalanceForCrypto(cryptoId) {
    const balances = await this.getMyBalances();
    return balances.find(b => b.criptomonedaId === cryptoId);
  }

  // Calcular portfolio total
  calculatePortfolioValue(balances, cryptos, prices) {
    if (!balances.length) return { totalUSDT: 0, totalBTC: 0 };

    const totalUSDT = balances.reduce((acc, balance) => {
      const crypto = cryptos.find(c => c.id === balance.criptomonedaId);
      const price = prices[crypto?.symbol] || 0;
      return acc + parseFloat(balance.balanceDisponible) * price;
    }, 0);

    const btcPrice = prices['BTC'] || 0;
    const totalBTC = btcPrice > 0 ? totalUSDT / btcPrice : 0;

    return { totalUSDT, totalBTC };
  }

  // Obtener top activos del portfolio
  getTopAssets(balances, cryptos, prices, limit = 2) {
    const assets = balances
      .map(balance => {
        const crypto = cryptos.find(c => c.id === balance.criptomonedaId);
        if (!crypto) return null;

        const price = prices[crypto.symbol] || 0;
        const value = parseFloat(balance.balanceDisponible) * price;

        return {
          symbol: crypto.symbol,
          value,
          balance: balance.balanceDisponible,
        };
      })
      .filter(item => item !== null && item.value > 0)
      .sort((a, b) => b.value - a.value);

    const total = assets.reduce((sum, item) => sum + item.value, 0);

    return assets.slice(0, limit).map(item => ({
      ...item,
      percentage: ((item.value / total) * 100).toFixed(1),
    }));
  }
}

export default new BalanceService();*/

// Esta nueva versión podría romper el balance del Home pero es bajo la que está construido "Balance.jsx"
import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class BalanceService {
  /**
   * Obtener balances del usuario autenticado
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
    
    // Si no hay precio de BTC, no podemos calcular
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
   */
  filterSmallBalances(enrichedBalances, minValue = 1) {
    return enrichedBalances.filter(b => b.valueInUSDT >= minValue);
  }
}

export default new BalanceService();