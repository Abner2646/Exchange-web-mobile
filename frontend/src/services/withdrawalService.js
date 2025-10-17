import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class WithdrawalService {
  /**
   * Crear un retiro de criptomoneda
   * @param {Object} withdrawalData - Datos del retiro
   * @param {String} withdrawalData.criptomonedaId - ID de la criptomoneda
   * @param {Number} withdrawalData.cantidad - Cantidad a retirar
   * @param {String} withdrawalData.direccionDestino - Dirección de destino
   * @returns {Promise<Object>} Respuesta del servidor
   */
  async createWithdrawal(withdrawalData) {
    console.log('💸 Creando retiro:', withdrawalData);
    
    const response = await apiClient.post(
      ENDPOINTS.TRANSACTIONS_WITHDRAW,
      withdrawalData
    );

    // Normalizar respuesta
    if (response.data?.data) {
      return response.data.data;
    }

    return response.data;
  }
}

export default new WithdrawalService();