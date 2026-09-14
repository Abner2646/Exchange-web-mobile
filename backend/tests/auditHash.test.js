const { GENESIS, canonical, computeHash } = require('../modules/audit/auditHash');

describe('canonical', () => {
  test('is independent of key insertion order', () => {
    expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }));
  });
  test('recurses into nested objects and arrays', () => {
    expect(canonical({ x: { b: 1, a: 2 }, y: [3, { d: 4, c: 5 }] }))
      .toBe(canonical({ y: [3, { c: 5, d: 4 }], x: { a: 2, b: 1 } }));
  });
});

describe('computeHash', () => {
  const fields = {
    eventId: 'e1', eventType: 'T', payload: { n: 1 },
    aggregateId: 'agg', occurredAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  test('is a 64-char hex string, deterministic for the same input', () => {
    const h1 = computeHash(fields, GENESIS);
    const h2 = computeHash({ ...fields }, GENESIS);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
  });
  test('changes if any content field or prevHash changes', () => {
    const base = computeHash(fields, GENESIS);
    expect(computeHash({ ...fields, payload: { n: 2 } }, GENESIS)).not.toBe(base);
    expect(computeHash(fields, 'other')).not.toBe(base);
  });
  test('key order in payload does not change the hash', () => {
    expect(computeHash({ ...fields, payload: { a: 1, b: 2 } }, GENESIS))
      .toBe(computeHash({ ...fields, payload: { b: 2, a: 1 } }, GENESIS));
  });
});
