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
      if (response.data?.data) return response.data.data;
      return response.data;
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
   * @param {Number} parId - ID del par de exchange
   * @param {Number} cantidadBase - Cantidad base a intercambiar
   * @param {String} tipo - Tipo de operación ('venta' o 'compra')
   * @returns {Promise<Object>}
   */
  async calculateExchange(parId, cantidadBase, tipo = 'venta') {
    console.log('[SwapService] Calculating exchange:', { parId, cantidadBase, tipo });
    
    const response = await apiClient.post(ENDPOINTS.EXCHANGE_CALCULATE, {
      parId,
      cantidadBase,
      tipo,
    });

    console.log('[SwapService] Calculate response:', response.data);
    
    // Normalizar respuesta
    if (response.data?.data) return response.data.data;
    return response.data;
  }

  /**
   * Ejecutar intercambio
   * @param {Number} parId - ID del par de exchange
   * @param {Number} cantidadBase - Cantidad base
   * @param {String} tipo - Tipo de operación
   * @returns {Promise<Object>}
   */
  async executeSwap(parId, cantidadBase, tipo = 'venta') {
    console.log('[SwapService] Executing swap:', { parId, cantidadBase, tipo });
    
    const response = await apiClient.post(ENDPOINTS.EXCHANGE_EXECUTE, {
      parId,
      tipo,
      cantidadBase,
    });

    console.log('[SwapService] Swap executed:', response.data);
    
    // Normalizar respuesta
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