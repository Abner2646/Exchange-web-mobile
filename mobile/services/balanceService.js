// mobile/services/balanceService.js
import api from './api';
import { ENDPOINTS } from '../api/endpoints';

class BalanceService {
  async getMyBalances() {
    const response = await api.get(ENDPOINTS.MY_BALANCES);
    
    if (Array.isArray(response.data)) return response.data;
    if (response.data?.data) return response.data.data;
    return [];
  }

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

  filterSmallBalances(enrichedBalances, minValue = 1) {
    return enrichedBalances.filter(b => b.valueInUSDT >= minValue);
  }

  getTopAssets(enrichedBalances, limit = 5) {
    if (!enrichedBalances || enrichedBalances.length === 0) {
      return [];
    }

    const validAssets = enrichedBalances
      .filter(balance => balance.valueInUSDT > 0)
      .sort((a, b) => b.valueInUSDT - a.valueInUSDT);

    const total = validAssets.reduce((sum, asset) => sum + asset.valueInUSDT, 0);

    return validAssets.slice(0, limit).map(asset => ({
      symbol: asset.crypto.symbol,
      value: asset.valueInUSDT,
      balance: asset.balanceAmount,
      percentage: total > 0 ? ((asset.valueInUSDT / total) * 100).toFixed(1) : '0.0',
    }));
  }
}

export default new BalanceService();