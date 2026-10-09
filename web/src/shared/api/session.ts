/**
 * shared/api/session.ts
 *
 * Auth/Session seam.
 *
 * Decouples token storage from the rest of the application.
 * Note: Storing JWT in localStorage is against OWASP guidance and is NOT production-ready.
 * This centralization allows a future HttpOnly cookie + CSRF migration to be a single-file change.
 */

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const memoryStorage = new Map<string, string>();

const defaultStorage: SessionStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStorage.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    } else {
      memoryStorage.set(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    } else {
      memoryStorage.delete(key);
    }
  },
};

let currentStorage: SessionStorage = defaultStorage;
type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

export const session = {
  TOKEN_KEY: 'token',

  /** Inject custom storage (useful for tests or future migration) */
  setStorage(customStorage?: SessionStorage): void {
    currentStorage = customStorage || defaultStorage;
  },

  /** Retrieves the current JWT token */
  getToken(): string | null {
    return currentStorage.getItem(this.TOKEN_KEY);
  },

  /** Stores the JWT token */
  setToken(token?: string | null): void {
    if (!token) {
      this.clearToken();
      return;
    }
    currentStorage.setItem(this.TOKEN_KEY, token);
  },

  /** Removes the token */
  clearToken(): void {
    currentStorage.removeItem(this.TOKEN_KEY);
  },

  /** Checks if a token is saved */
  hasToken(): boolean {
    return Boolean(this.getToken());
  },

  /** Registers a listener for when the backend responds with 401 Unauthorized */
  onUnauthorized(callback: Listener): () => boolean {
    unauthorizedListeners.add(callback);
    return () => unauthorizedListeners.delete(callback);
  },

  /** Notifies all listeners of an unauthorized / expired session */
  notifyUnauthorized(): void {
    this.clearToken();
    unauthorizedListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error in onUnauthorized listener:', err);
      }
    });
  },
};
