import api from './api';

export const walletService = {
  // Obtener balance del usuario
  getBalance: async () => {
    const response = await api.get('/wallet/balance');
    return response.data;
  },

  // Obtener transacciones
  getTransactions: async (limit = 20) => {
    const response = await api.get('/wallet/transactions', {
      params: { limit },
    });
    return response.data;
  },

  // Realizar swap
  swap: async (fromCrypto, toCrypto, amount) => {
    const response = await api.post('/wallet/swap', {
      fromCrypto,
      toCrypto,
      amount,
    });
    return response.data;
  },
};