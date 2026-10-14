import { describe, it, expect } from 'vitest';
import { createIdempotencyManager } from './idempotencyManager';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('createIdempotencyManager (idempotency by intent)', () => {
  it('keyFor returns a valid UUID v4', () => {
    const m = createIdempotencyManager();
    expect(m.keyFor({ amount: '10' })).toMatch(UUID_V4);
  });

  it('reuses the same key for an identical payload (manual retry → backend dedups)', () => {
    const m = createIdempotencyManager();
    const payload = { from: 'funding', to: 'spot', amount: '10' };
    const first = m.keyFor(payload);
    const retry = m.keyFor({ ...payload });
    expect(retry).toBe(first);
  });

  it('is insensitive to object key order when fingerprinting the payload', () => {
    const m = createIdempotencyManager();
    const a = m.keyFor({ amount: '10', from: 'funding', to: 'spot' });
    const b = m.keyFor({ to: 'spot', from: 'funding', amount: '10' });
    expect(b).toBe(a);
  });

  it('issues a different key when the payload changes (avoids backend 422 KEY_REUSED)', () => {
    const m = createIdempotencyManager();
    const ten = m.keyFor({ amount: '10' });
    const twenty = m.keyFor({ amount: '20' });
    expect(twenty).not.toBe(ten);
  });

  it('rotates: after reset(), an identical payload gets a fresh key (rotate on success)', () => {
    const m = createIdempotencyManager();
    const payload = { amount: '10' };
    const before = m.keyFor(payload);
    m.reset();
    const after = m.keyFor(payload);
    expect(after).not.toBe(before);
    expect(after).toMatch(UUID_V4);
  });

  it('fingerprints an undefined field like an omitted one (matches the JSON wire body), distinct from explicit null', () => {
    const m = createIdempotencyManager();
    // JSON.stringify drops undefined keys, so { a, b: undefined } and { a } hit the
    // same wire body → must share a key (else a retry would double-spend).
    const omitted = m.keyFor({ a: '1' });
    const undef = m.keyFor({ a: '1', b: undefined });
    expect(undef).toBe(omitted);
    // explicit null IS sent on the wire → a genuinely different body → different key
    // (reusing the key here would earn a backend 422 IDEMPOTENCY_KEY_REUSED).
    const explicitNull = m.keyFor({ a: '1', b: null });
    expect(explicitNull).not.toBe(omitted);
  });

  it('keeps distinct payloads on distinct keys until reset', () => {
    const m = createIdempotencyManager();
    const k10a = m.keyFor({ amount: '10' });
    const k20 = m.keyFor({ amount: '20' });
    // revisiting the first payload still maps to its original key (no churn)
    const k10b = m.keyFor({ amount: '10' });
    expect(k10b).toBe(k10a);
    expect(k20).not.toBe(k10a);
  });
});
