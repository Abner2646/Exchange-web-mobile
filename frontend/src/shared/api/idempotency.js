/**
 * shared/api/idempotency.js
 *
 * Gestión de Idempotencia para operaciones financieras en el frontend.
 * El backend exige obligatoriamente la cabecera `Idempotency-Key` (UUID v4)
 * en los 5 endpoints que mueven fondos.
 */

/**
 * Genera un UUID v4 canónico compatible con RFC 4122.
 * Utiliza crypto.randomUUID si está disponible en el entorno;
 * en caso contrario, utiliza crypto.getRandomValues o fallback seguro.
 *
 * @returns {string} UUID v4 (ej. '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d')
 */
function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }

  // Fallback para entornos muy restringidos
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Rutas canónicas del backend que exigen obligatoriamente Idempotency-Key en método POST.
 */
const MONEY_POST_PATTERNS = [
  /\/api\/trading\/order/,
  /\/trading\/order/,
  /\/api\/transaccionBlockchain\/withdraw/,
  /\/transaccionBlockchain\/withdraw/,
  /\/api\/transfer(?:\/|$)/,
  /\/transfer(?:\/|$)/,
  /\/api\/intercambioExchange(?:\/|$)/,
  /\/intercambioExchange(?:\/|$)/,
  /\/api\/balances\/my\/transfer/,
  /\/balances\/my\/transfer/,
];

/**
 * Comprueba si una petición corresponde a un endpoint que mueve dinero y requiere idempotencia.
 * @param {string} url URL o ruta de la petición
 * @param {string} [method='GET'] Método HTTP ('GET', 'POST', etc.)
 * @returns {boolean}
 */
function isMoneyEndpoint(url, method = 'GET') {
  if (String(method).toUpperCase() !== 'POST') {
    return false;
  }
  if (!url) return false;
  return MONEY_POST_PATTERNS.some((pattern) => pattern.test(url));
}

module.exports = {
  generateIdempotencyKey,
  isMoneyEndpoint,
};
