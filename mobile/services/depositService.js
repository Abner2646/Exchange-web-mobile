// src/services/depositService.js
import api from '../api/endpoints';

export const depositService = {
  // Obtener dirección de depósito para una crypto específica
  getDepositAddress: async (cryptoId) => {
    const { data } = await api.get(ENDPOINTS.DEPOSIT_ADDRESS_BY_CRYPTO(cryptoId));
    return data;
  },

  // Crear una nueva dirección de depósito (si es necesario)
  createDepositAddress: async (cryptoId) => {
    const { data } = await api.post(ENDPOINTS.DEPOSIT_ADDRESS_BY_CRYPTO(cryptoId));
    return data;
  },

  // Obtener historial de depósitos (usando el endpoint de transferencias)
  getDepositHistory: async () => {
    const { data } = await api.get(ENDPOINTS.MY_TRANSFERS);
    return data;
  },

  // Obtener un depósito específico por ID
  getDepositById: async (id) => {
    const { data } = await api.get(`${ENDPOINTS.TRANSFERS}/${id}`);
    return data;
  },

  // Verificar fondos para una transferencia/depósito
  verifyDepositFunds: async (transferData) => {
    const { data } = await api.post(ENDPOINTS.TRANSFER_VERIFY_FUNDS, transferData);
    return data;
  }
};