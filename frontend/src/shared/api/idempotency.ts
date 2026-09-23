/**
 * shared/api/idempotency.ts
 *
 * Idempotency management for financial operations in the frontend.
 * The backend requires the `Idempotency-Key` header (UUID v4) on 5 specific endpoints.
 */

/**
 * Generates a canonical UUID v4 compliant with RFC 4122.
 * Uses crypto.randomUUID if available, otherwise falls back to a safe implementation.
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant RFC 4122
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }

  // Fallback for very restricted environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Canonical backend routes that require the Idempotency-Key header on POST requests.
 */
const MONEY_POST_PATTERNS: RegExp[] = [
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
  /\/api\/referrals\/claim/,
  /\/referrals\/claim/,
];

/**
 * Checks if a request targets an endpoint that moves money and thus requires idempotency.
 */
export function isMoneyEndpoint(url?: string, method: string = 'GET'): boolean {
  if (method.toUpperCase() !== 'POST') {
    return false;
  }
  if (!url) {
    return false;
  }
  return MONEY_POST_PATTERNS.some((pattern) => pattern.test(url));
}
