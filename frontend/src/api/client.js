// src/api/client.js
import axios from 'axios';
import { API_URL } from '../config';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interceptor: Agregar token automáticamente
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ⭐ PÁGINAS PÚBLICAS que NO deben redirigir al login
const PUBLIC_PATHS = ['/', '/login', '/register', '/auth-success'];

// Interceptor: Manejar errores de API y autenticación
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Normalizar error canónico { error: { code, message } }
    const data = error.response?.data;
    let normalizedMsg = 'Ocurrió un error inesperado';
    let code = null;

    if (data) {
      if (typeof data.error === 'string') {
        normalizedMsg = data.error;
      } else if (data.error && typeof data.error === 'object') {
        normalizedMsg = data.error.message || 'Error en la solicitud';
        code = data.error.code || null;
      } else if (typeof data.message === 'string') {
        normalizedMsg = data.message;
      }

      // Asegurar que message siempre exista como string en data para compatibilidad
      if (!data.message && normalizedMsg) {
        data.message = normalizedMsg;
      }
    } else if (error.message) {
      normalizedMsg = error.message;
    }

    error.errorMessage = normalizedMsg;
    error.errorCode = code;

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      
      // ⭐ SOLO redirigir si NO estamos en una página pública
      const currentPath = window.location.pathname;
      const isPublicPage = PUBLIC_PATHS.includes(currentPath);
      
      if (!isPublicPage) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;