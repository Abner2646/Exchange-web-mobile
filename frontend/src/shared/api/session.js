/**
 * shared/api/session.js
 *
 * Capa de abstracción de sesión (Session Seam).
 *
 * Desacopla el almacenamiento del token de autenticación del resto de la aplicación,
 * permitiendo cambiar de localStorage a cookies HttpOnly o almacenamiento en memoria
 * sin modificar una sola llamada de API de los features.
 */

// Almacenamiento por defecto: localStorage si está en entorno de navegador, o memoria en tests
const memoryStorage = new Map();

const defaultStorage = {
  getItem: (key) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStorage.get(key) || null;
  },
  setItem: (key, value) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    } else {
      memoryStorage.set(key, value);
    }
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    } else {
      memoryStorage.delete(key);
    }
  },
};

let currentStorage = defaultStorage;
const unauthorizedListeners = new Set();

const session = {
  TOKEN_KEY: 'token',

  /** Permite inyectar un almacenamiento personalizado (útil para tests o migración futura) */
  setStorage(customStorage) {
    currentStorage = customStorage || defaultStorage;
  },

  /** Obtiene el token JWT actual */
  getToken() {
    return currentStorage.getItem(this.TOKEN_KEY);
  },

  /** Almacena el token JWT */
  setToken(token) {
    if (!token) {
      this.clearToken();
      return;
    }
    currentStorage.setItem(this.TOKEN_KEY, token);
  },

  /** Elimina el token */
  clearToken() {
    currentStorage.removeItem(this.TOKEN_KEY);
  },

  /** Verifica si existe un token guardado */
  hasToken() {
    return Boolean(this.getToken());
  },

  /** Registra un listener para cuando el backend responda 401 Unauthorized */
  onUnauthorized(callback) {
    unauthorizedListeners.add(callback);
    return () => unauthorizedListeners.delete(callback);
  },

  /** Notifica a todos los listeners de una sesión no autorizada / expirada */
  notifyUnauthorized() {
    this.clearToken();
    unauthorizedListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error en listener onUnauthorized:', err);
      }
    });
  },
};

module.exports = session;
