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
    const rawList = Array.isArray(response.data) ? response.data : (response.data?.data || []);
    return rawList.map(b => {
      const available = b.availableBalance ?? b.balanceDisponible ?? b.disponible ?? b.saldoDisponible ?? b.compartments?.funding?.available ?? 0;
      const blocked = b.blockedBalance ?? b.balanceBloqueado ?? b.bloqueado ?? b.compartments?.funding?.blocked ?? 0;
      const cryptoId = b.criptomonedaId || b.cryptoId || b.crypto?.id;
      const symbol = b.crypto?.symbol || b.symbol;
      
      return {
        ...b,
        availableBalance: String(available),
        balanceDisponible: String(available),
        disponible: String(available),
        saldoDisponible: String(available),
        blockedBalance: String(blocked),
        balanceBloqueado: String(blocked),
        bloqueado: String(blocked),
        criptomonedaId: cryptoId,
        cryptoId: cryptoId,
        symbol: symbol,
      };
    });
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
      const crypto = balance.crypto || cryptos.find(c => c.id === (balance.criptomonedaId || balance.cryptoId));
      const symbol = crypto?.symbol || balance.symbol || '';
      const price = prices[symbol] ?? (symbol === 'USDT' ? 1 : 0);
      
      const available = parseFloat(balance.availableBalance ?? balance.balanceDisponible ?? 0) || 0;
      const blocked = parseFloat(balance.blockedBalance ?? balance.balanceBloqueado ?? 0) || 0;
      const amount = available + blocked;
      
      const value = amount * price;
      return acc + (isNaN(value) ? 0 : value);
    }, 0);

    const btcPrice = prices['BTC'];
    
    if (!btcPrice || btcPrice === 0 || isNaN(btcPrice)) {
      return { totalUSDT: isNaN(totalUSDT) ? 0 : totalUSDT, totalBTC: 0, btcPriceError: true };
    }
    
    const totalBTC = totalUSDT / btcPrice;

    return { 
      totalUSDT: isNaN(totalUSDT) ? 0 : totalUSDT, 
      totalBTC: isNaN(totalBTC) ? 0 : totalBTC, 
      btcPriceError: false 
    };
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
        const crypto = balance.crypto || cryptos.find(c => c.id === (balance.criptomonedaId || balance.cryptoId));
        if (!crypto) return null;

        const symbol = crypto.symbol || balance.symbol;
        const price = prices[symbol] ?? (symbol === 'USDT' ? 1 : 0);
        const available = parseFloat(balance.availableBalance ?? balance.balanceDisponible ?? 0) || 0;
        const blocked = parseFloat(balance.blockedBalance ?? balance.balanceBloqueado ?? 0) || 0;
        const balanceAmount = available + blocked;
        const valueInUSDT = balanceAmount * price;

        return {
          ...balance,
          crypto,
          price,
          valueInUSDT: isNaN(valueInUSDT) ? 0 : valueInUSDT,
          balanceAmount: isNaN(balanceAmount) ? 0 : balanceAmount,
          availableBalance: available,
          blockedBalance: blocked,
          compartments: balance.compartments || {
            funding: { available: String(available), blocked: String(blocked), pending: '0' },
            spot: { available: '0', blocked: '0' },
          },
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

  /**
   * Transferir fondos entre compartimentos (Funding <-> Spot)
   * @param {Object} params - { cryptoId, amount, from, to }
   * @returns {Promise<Object>}
   */
  async transferCompartments({ cryptoId, amount, from, to }) {
    const idempotencyKey = (typeof window !== 'undefined' && window.crypto?.randomUUID)
      ? window.crypto.randomUUID()
      : `transfer-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const response = await apiClient.post(
      ENDPOINTS.BALANCE_TRANSFER_COMPARTMENTS,
      {
        cryptoId,
        amount: String(amount),
        from,
        to,
      },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    return response.data;
  }

  /**
   * Reclamar fondos de prueba del faucet (Testnet)
   * @param {Object} [params] - { symbol, amount }
   * @returns {Promise<Object>}
   */
  async claimTestnetFaucet(params = {}) {
    const response = await apiClient.post(ENDPOINTS.BALANCE_TESTNET_FAUCET, params);
    return response.data;
  }

  /**
   * Reclamar 1 BTC de prueba (Legacy Faucet)
   * @returns {Promise<Object>}
   */
  async claimBtc() {
    const response = await apiClient.put(ENDPOINTS.BALANCE_CLAIM_BTC);
    return response.data;
  }
}

export default new BalanceService();