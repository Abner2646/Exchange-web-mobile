import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class DepositService {
  /**
   * Obtener dirección de depósito del usuario para una criptomoneda
   * @param {Number} cryptoId - ID de la criptomoneda
   * @returns {Object|null} - Objeto con dirección de depósito o null
   */
  async getDepositAddressByCrypto(cryptoId) {
    console.log('=== depositService.getDepositAddressByCrypto ===');
    console.log('CryptomonedaId:', cryptoId);
    
    try {
      const response = await apiClient.get(
        ENDPOINTS.DEPOSIT_ADDRESS_BY_CRYPTO(cryptoId)
      );
      
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);
      
      // Normalizar respuesta
      if (response.data) {
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error obteniendo dirección de depósito:', error.message);
      
      if (error.response) {
        console.error('Error response status:', error.response.status);
        console.error('Error response data:', error.response.data);
      }
      
      return null;
    } finally {
      console.log('=== FIN depositService.getDepositAddressByCrypto ===');
    }
  }
}

export default new DepositService();