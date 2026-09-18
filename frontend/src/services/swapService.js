// src/services/swapService.js
import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class SwapService {
  /**
   * Obtener par de exchange por símbolos
   * @param {String} baseSymbol - Símbolo base (ej: 'BTC')
   * @param {String} quoteSymbol - Símbolo quote (ej: 'USDT')
   * @returns {Promise<Object>}
   */
  async getExchangePair(baseSymbol, quoteSymbol) {
    console.log(`[SwapService] Getting exchange pair: ${baseSymbol}/${quoteSymbol}`);
    
    try {
      const response = await apiClient.get(ENDPOINTS.EXCHANGE_PAIR_BY_SYMBOLS(baseSymbol, quoteSymbol));
      console.log('[SwapService] Exchange pair found:', response.data);
      
      // Normalizar respuesta
      const data = response.data?.data || response.data;
      if (data) {
        data.activo = data.active !== undefined ? data.active : (data.activo !== undefined ? data.activo : true);
        data.active = data.activo;
      }
      return data;
    } catch (error) {
      console.warn(`[SwapService] Pair ${baseSymbol}/${quoteSymbol} not found:`, error.message);
      throw error;
    }
  }

  /**
   * Obtener precio actual de un par
   * @param {String} baseSymbol - Símbolo base
   * @param {String} quoteSymbol - Símbolo quote
   * @returns {Promise<Number>}
   */
  async getCurrentPrice(baseSymbol, quoteSymbol) {
    console.log(`[SwapService] Getting price: ${baseSymbol}/${quoteSymbol}`);
    
    try {
      const response = await apiClient.get(ENDPOINTS.EXCHANGE_PRICE(baseSymbol, quoteSymbol));
      console.log('[SwapService] Price response:', response.data);
      
      // Normalizar respuesta - puede venir en varios formatos
      const precio = response.data?.precio || 
                    response.data?.price || 
                    response.data?.rate || 
                    response.data?.tasa ||
                    response.data?.precioActual || 
                    0;
      
      console.log('[SwapService] Normalized price:', precio);
      return precio;
    } catch (error) {
      console.error(`[SwapService] Error getting price ${baseSymbol}/${quoteSymbol}:`, error);
      throw error;
    }
  }

  /**
   * Calcular intercambio
   * @param {String} parId - ID del par de exchange (UUID)
   * @param {Number|String} cantidadBase - Cantidad base a intercambiar
   * @param {String} tipo - Tipo de operación ('sell'|'buy' o 'venta'|'compra')
   * @returns {Promise<Object>}
   */
  async calculateExchange(parId, cantidadBase, tipo = 'sell') {
    const normType = (tipo === 'compra' || tipo === 'buy') ? 'buy' : 'sell';
    const numAmount = parseFloat(cantidadBase);
    console.log('[SwapService] Calculating exchange:', { parId, cantidadBase: numAmount, tipo: normType });
    
    const response = await apiClient.post(ENDPOINTS.EXCHANGE_CALCULATE, {
      pairId: parId,
      parId: parId,
      baseAmount: numAmount,
      cantidadBase: numAmount,
      type: normType,
      tipo: normType,
    });

    console.log('[SwapService] Calculate response:', response.data);
    
    if (response.data?.data) return response.data.data;
    return response.data;
  }

  /**
   * Ejecutar intercambio
   * @param {String} parId - ID del par de exchange (UUID)
   * @param {Number|String} cantidadBase - Cantidad base
   * @param {String} tipo - Tipo de operación ('sell'|'buy' o 'venta'|'compra')
   * @param {String} compartimento - Compartimento de saldo ('funding'|'spot')
   * @returns {Promise<Object>}
   */
  async executeSwap(parId, cantidadBase, tipo = 'sell', compartimento = 'funding') {
    const normType = (tipo === 'compra' || tipo === 'buy') ? 'buy' : 'sell';
    const numAmount = parseFloat(cantidadBase);
    const idempotencyKey = (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });

    console.log('[SwapService] Executing swap:', { parId, cantidadBase: numAmount, tipo: normType, idempotencyKey });
    
    const response = await apiClient.post(
      ENDPOINTS.EXCHANGE_EXECUTE,
      {
        pairId: parId,
        parId: parId,
        type: normType,
        tipo: normType,
        baseAmount: numAmount,
        cantidadBase: numAmount,
        compartimento,
      },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );

    console.log('[SwapService] Swap executed:', response.data);
    
    if (response.data?.data) return response.data.data;
    return response.data;
  }

  /**
   * Verificar límite de transacción
   * @param {Number} cantidadQuote - Cantidad en moneda quote
   * @returns {Promise<Object>}
   */
  async checkTransactionLimit(cantidadQuote) {
    console.log('[SwapService] Checking transaction limit:', cantidadQuote);
    
    const response = await apiClient.post(ENDPOINTS.EXCHANGE_CHECK_LIMIT, {
      cantidadQuote,
    });

    // Normalizar respuesta
    if (response.data?.data) return response.data.data;
    return response.data;
  }

  /**
   * Verificar balance disponible
   * @param {Number} userId - ID del usuario
   * @param {Number} criptomonedaId - ID de la criptomoneda
   * @param {Number} amount - Cantidad a verificar
   * @returns {Promise<Object>}
   */
  async checkAvailableBalance(userId, criptomonedaId, amount) {
    console.log('[SwapService] Checking available balance:', { userId, criptomonedaId, amount });
    
    const response = await apiClient.get(
      ENDPOINTS.BALANCE_CHECK(userId, criptomonedaId, amount)
    );

    // Normalizar respuesta
    if (response.data?.data) return response.data.data;
    return response.data;
  }
}

export default new SwapService();