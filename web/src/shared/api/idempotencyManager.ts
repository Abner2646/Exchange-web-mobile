/**
 * shared/api/idempotencyManager.ts
 *
 * Idempotency BY INTENT for money mutations (go-live gate §B.1).
 *
 * The backend dedups POST money requests by (userId, Idempotency-Key):
 *   - same key + same body  → replays the stored response (or 409 if still in flight);
 *   - same key + DIFFERENT body → 422 IDEMPOTENCY_KEY_REUSED.
 *
 * So the client key must be tied to the *content* of the submit intent, reused on a
 * manual retry of the identical payload (so the server dedups instead of double-spending),
 * and rotated once the operation succeeds (so a later, legitimately-identical operation
 * runs fresh instead of replaying the old response).
 *
 * A manager instance is scoped to one mutation hook instance (one form). It maps each
 * distinct payload fingerprint to a stable key until reset() is called on success.
 */
import { useRef } from 'react';
import { generateIdempotencyKey } from './idempotency';

/** Deterministic, key-order-independent stringify so {a,b} and {b,a} fingerprint alike. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export interface IdempotencyManager {
  /** The idempotency key to use for this payload. Stable for identical payloads until reset(). */
  keyFor(payload: unknown): string;
  /** Rotate: forget all issued keys so the next submit — even an identical one — is a new intent. */
  reset(): void;
}

export function createIdempotencyManager(): IdempotencyManager {
  const keys = new Map<string, string>();
  return {
    keyFor(payload: unknown): string {
      const fp = stableStringify(payload);
      let key = keys.get(fp);
      if (!key) {
        key = generateIdempotencyKey();
        keys.set(fp, key);
      }
      return key;
    },
    reset(): void {
      keys.clear();
    },
  };
}

/**
 * React hook: a single, stable idempotency manager for the lifetime of the component
 * (the submit "intent" lives as long as the form is mounted). Use inside a money
 * mutation hook: pass keyFor(variables) on mutate, call reset() in onSuccess.
 */
export function useIdempotencyKey(): IdempotencyManager {
  const ref = useRef<IdempotencyManager | null>(null);
  if (ref.current === null) ref.current = createIdempotencyManager();
  return ref.current;
}
