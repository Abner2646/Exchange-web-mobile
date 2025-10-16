import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class AdminService {
  // Buscar usuario por email
  async searchUserByEmail(email) {
    const response = await apiClient.get(
      `${ENDPOINTS.USER_SEARCH}?q=${email}&limit=1`
    );

    // Normalizar respuesta
    if (Array.isArray(response.data) && response.data.length > 0) {
      const usuario = response.data[0];
      return {
        found: true,
        username: usuario.username || usuario.nombre || 'Usuario encontrado',
        userId: usuario.id,
      };
    }

    return { found: false };
  }

  // Obtener criptomonedas activas
  async getActiveCryptocurrencies() {
    const response = await apiClient.get(ENDPOINTS.CRYPTOS_ACTIVE);

    // Normalizar respuesta (puede venir en varios formatos)
    let cryptoArray = [];
    if (Array.isArray(response.data)) {
      cryptoArray = response.data;
    } else if (response.data && Array.isArray(response.data.data)) {
      cryptoArray = response.data.data;
    } else if (response.data && Array.isArray(response.data.criptomonedas)) {
      cryptoArray = response.data.criptomonedas;
    }

    return cryptoArray;
  }

  // Inicializar wallets (operación sensible)
  async initializeWallets() {
    const response = await apiClient.post(ENDPOINTS.SETUP_WALLETS_INITIALIZE, {
      force: 'true',
    });
    return response.data;
  }

  // Actualizar balance de usuario
  async updateUserBalance(userId, cryptoId, amount) {
    const response = await apiClient.put(
      ENDPOINTS.BALANCE_UPDATE_USER(userId, cryptoId),
      { amount: parseFloat(amount) }
    );
    return response.data;
  }

  // Generar pares de exchange (operación sensible)
  async generateExchangePairs() {
    const response = await apiClient.post(ENDPOINTS.EXCHANGE_PAIRS_GENERATE);
    return response.data;
  }

  // Crear método de pago
  async createPaymentMethod(nombre, descripcion) {
    const response = await apiClient.post(ENDPOINTS.PAYMENT_METHOD_CREATE, {
      nombre,
      descripcion,
    });
    return response.data;
  }
}

export default new AdminService();