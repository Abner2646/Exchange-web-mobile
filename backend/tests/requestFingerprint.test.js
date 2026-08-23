const { fingerprint } = require('../utils/requestFingerprint');

describe('requestFingerprint', () => {
  test('is stable regardless of object key order', () => {
    const a = fingerprint('POST', '/trading/orders', { side: 'buy', quantity: '1', price: '2' });
    const b = fingerprint('POST', '/trading/orders', { price: '2', quantity: '1', side: 'buy' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  test('differs when the body differs', () => {
    const a = fingerprint('POST', '/trading/orders', { quantity: '1' });
    const b = fingerprint('POST', '/trading/orders', { quantity: '2' });
    expect(a).not.toBe(b);
  });

  test('differs when method or path differ', () => {
    const base = fingerprint('POST', '/a', { x: 1 });
    expect(fingerprint('PUT', '/a', { x: 1 })).not.toBe(base);
    expect(fingerprint('POST', '/b', { x: 1 })).not.toBe(base);
  });
});
