// mobile/services/swapService.js
import api from './api';
import { ENDPOINTS } from '../api/endpoints';

class SwapService {
  /**
   * Obtener par de exchange por símbolos
   * @param {String} base - Símbolo base (ej: 'BTC')
   * @param {String} quote - Símbolo cotización (ej: 'USDT')
   * @returns {Promise<Object>} Par de exchange
   */
  async getExchangePair(base, quote) {
    try {
      const response = await api.get(ENDPOINTS.EXCHANGE_PAIR_BY_SYMBOLS(base, quote));
      return response.data;
    } catch (error) {
      console.warn(`No se pudo obtener par ${base}/${quote}:`, error.message);
      return null;
    }
  }

  /**
   * Obtener precio actual entre dos criptomonedas
   * @param {String} base - Símbolo base
   * @param {String} quote - Símbolo cotización
   * @returns {Promise<Number>} Precio actual
   */
  async getCurrentPrice(base, quote) {
    try {
      const response = await api.get(ENDPOINTS.EXCHANGE_PRICE(base, quote));
      return response.data?.price || 0;
    } catch (error) {
      console.warn(`No se pudo obtener precio para ${base}/${quote}:`, error.message);
      return 0;
    }
  }

  /**
   * Calcular el resultado de un intercambio
   * @param {Number} parExchangeId - ID del par de exchange
   * @param {Number} cantidad - Cantidad a intercambiar
   * @param {String} tipo - 'compra' o 'venta'
   * @returns {Promise<Object>} Resultado del cálculo
   */
  async calculateSwap(parExchangeId, cantidad, tipo = 'venta') {
    try {
      const response = await api.post(ENDPOINTS.EXCHANGE_CALCULATE, {
        parId: parExchangeId,        // ⭐ Backend espera "parId"
        cantidadBase: cantidad,       // ⭐ Backend espera "cantidadBase"
        tipo,                         // ⭐ Backend espera "tipo"
      });
      return response.data;
    } catch (error) {
      console.error('Error calculando swap:', error);
      throw error;
    }
  }

  /**
   * Ejecutar un intercambio
   * @param {Number} parExchangeId - ID del par de exchange
   * @param {Number} cantidad - Cantidad a intercambiar
   * @param {String} tipo - 'compra' o 'venta'
   * @returns {Promise<Object>} Resultado del intercambio
   */
  async executeSwap(parExchangeId, cantidad, tipo = 'venta') {
    try {
      const response = await api.post(ENDPOINTS.EXCHANGE_EXECUTE, {
        parId: parExchangeId,        // ⭐ Backend espera "parId"
        cantidadBase: cantidad,       // ⭐ Backend espera "cantidadBase"
        tipo,                         // ⭐ Backend espera "tipo"
      });
      return response.data;
    } catch (error) {
      console.error('Error ejecutando swap:', error);
      throw error;
    }
  }

  /**
   * Verificar límite de intercambio
   * @param {Number} parExchangeId - ID del par de exchange
   * @param {Number} cantidad - Cantidad a verificar
   * @returns {Promise<Object>} Resultado de verificación
   */
  async checkLimit(parExchangeId, cantidad) {
    try {
      const response = await api.post(ENDPOINTS.EXCHANGE_CHECK_LIMIT, {
        parId: parExchangeId,        // ⭐ Backend espera "parId"
        cantidadBase: cantidad,       // ⭐ Backend espera "cantidadBase"
      });
      return response.data;
    } catch (error) {
      console.error('Error verificando límite:', error);
      throw error;
    }
  }

  /**
   * Verificar balance de usuario para una criptomoneda
   * @param {Number} userId - ID del usuario
   * @param {Number} cryptoId - ID de la criptomoneda
   * @param {Number} amount - Cantidad a verificar
   * @returns {Promise<Boolean>} true si tiene suficiente balance
   */
  async checkBalance(userId, cryptoId, amount) {
    try {
      const response = await api.get(ENDPOINTS.BALANCE_CHECK(userId, cryptoId, amount));
      return response.data?.sufficient || false;
    } catch (error) {
      console.warn('Error verificando balance:', error.message);
      return false;
    }
  }
}

export default new SwapService();