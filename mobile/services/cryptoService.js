import api from './api';

export const cryptoService = {
  // Obtener todas las criptomonedas
  getAll: async () => {
    const response = await api.get('/criptomonedas');
    return response.data;
  },

  // Obtener precio actual
  getPrice: async (symbol) => {
    const response = await api.get(`/precios/${symbol}`);
    return response.data;
  },

  // Obtener historial de precios
  getPriceHistory: async (symbol, period = '24h') => {
    const response = await api.get(`/precios/${symbol}/history`, {
      params: { period },
    });
    return response.data;
  },
};