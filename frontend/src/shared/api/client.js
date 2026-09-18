/**
 * shared/api/client.js
 *
 * Cliente HTTP unificado para la comunicación con el backend.
 *
 * Características principales:
 * 1. Inyección automática de token de autenticación (Bearer) desde el session seam.
 * 2. Inyección y reuso de cabecera `Idempotency-Key` (UUID v4) en endpoints de dinero.
 * 3. Decodificación canónica de errores en instancias de `ApiError`.
 * 4. Notificación de sesión expirada (401) desacoplada de la UI.
 */

const axios = require('axios');
const { ApiError } = require('./errors');
const session = require('./session');
const { generateIdempotencyKey, isMoneyEndpoint } = require('./idempotency');

// Base URL configurada o fallback relativo
const DEFAULT_BASE_URL =
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) || '/api';

/**
 * Fábrica de clientes de API (permite crear instancias aisladas para testing).
 */
function createApiClient(options = {}) {
  const instance = axios.create({
    baseURL: options.baseURL || DEFAULT_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
    withCredentials: true,
  });

  // Interceptor de Peticiones
  instance.interceptors.request.use(
    (config) => {
      // 1. Inyectar Token de Sesión si existe
      const token = session.getToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // 2. Inyectar Idempotency-Key si se especificó o si es un endpoint monetario
      const explicitKey = config.idempotencyKey || config.headers['Idempotency-Key'];
      if (explicitKey) {
        config.headers['Idempotency-Key'] = explicitKey;
      } else if (isMoneyEndpoint(config.url, config.method)) {
        const generatedKey = generateIdempotencyKey();
        config.headers['Idempotency-Key'] = generatedKey;
        config.idempotencyKey = generatedKey; // Guardar en config para referencia
      }

      return config;
    },
    (error) => Promise.reject(ApiError.fromNetworkError(error))
  );

  // Interceptor de Respuestas
  instance.interceptors.response.use(
    (response) => {
      // Devuelve directamente el payload de datos de la respuesta
      return response.data;
    },
    (error) => {
      if (error.response) {
        const status = error.response.status;

        // Disparar evento de sesión no autorizada ante 401
        if (status === 401) {
          session.notifyUnauthorized();
        }

        // Decodificar el sobre canónico de error
        const apiError = ApiError.fromResponse(error.response.data, status, error);
        return Promise.reject(apiError);
      }

      // Error de red, caída o timeout
      return Promise.reject(ApiError.fromNetworkError(error));
    }
  );

  return instance;
}

// Instancia por defecto exportada
const apiClient = createApiClient();

module.exports = {
  createApiClient,
  apiClient,
};
