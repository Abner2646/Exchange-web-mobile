// services/swapService.js

const API_BASE_URL = 'http://localhost:3001/api';

// Obtener token de localStorage
const getToken = () => {
  return localStorage.getItem('token');
};

// Headers base para requests autenticados
const getAuthHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Manejar respuesta y errores
const handleResponse = async (response) => {
  // Si es 401, redirigir INMEDIATAMENTE sin esperar JSON
  if (response.status === 401) {
    console.log('❌ 401 detectado, redirigiendo al login...');
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }
  
  const data = await response.json();
  
  // Si hay error en la respuesta
  if (!response.ok) {
    throw new Error(data.error || 'Error en la petición');
  }
  
  // Retornar data directamente o extraer de { data: ... }
  return data.data || data;
};

// ===================== SERVICIOS SWAP =====================

export const swapService = {
  
  // Obtener criptomonedas activas
  async getActiveCryptos() {
    const response = await fetch(`${API_BASE_URL}/criptomoneda/public/active`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    return handleResponse(response);
  },

  // Obtener mis balances
  async getMyBalances() {
    const response = await fetch(`${API_BASE_URL}/balances/my/balances`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    return handleResponse(response);
  },

  // Obtener par de exchange por símbolos
  async getExchangePair(baseSymbol, quoteSymbol) {
    const response = await fetch(`${API_BASE_URL}/parExchange/symbols/${baseSymbol}/${quoteSymbol}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    return handleResponse(response);
  },

  // Obtener precio actual de un par
  async getCurrentPrice(baseSymbol, quoteSymbol) {
    const response = await fetch(`${API_BASE_URL}/parExchange/price/${baseSymbol}/${quoteSymbol}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    return handleResponse(response);
  },

  // Calcular intercambio
  async calculateExchange(parId, cantidadBase, tipo = 'venta') {
    const response = await fetch(`${API_BASE_URL}/intercambioExchange/calculate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        parId,
        cantidadBase,
        tipo
      })
    });
    
    return handleResponse(response);
  },

  // Ejecutar intercambio
  async executeSwap(parId, cantidadBase, tipo = 'venta') {
    const response = await fetch(`${API_BASE_URL}/intercambioExchange/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        parId,
        tipo,
        cantidadBase
      })
    });
    
    return handleResponse(response);
  },

  // Verificar límite de transacción
  async checkTransactionLimit(cantidadQuote) {
    const response = await fetch(`${API_BASE_URL}/intercambioExchange/check-limit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ cantidadQuote })
    });
    
    return handleResponse(response);
  },

  // Obtener balance específico de usuario y crypto
  async getSpecificBalance(userId, criptomonedaId) {
    const response = await fetch(`${API_BASE_URL}/balances/user/${userId}/crypto/${criptomonedaId}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    return handleResponse(response);
  },

  // Verificar balance disponible
  async checkAvailableBalance(userId, criptomonedaId, amount) {
    const response = await fetch(`${API_BASE_URL}/balances/user/${userId}/crypto/${criptomonedaId}/check?amount=${amount}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    return handleResponse(response);
  }
};

export default swapService;