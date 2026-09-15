// backend/tests/amlSignalsS1S2S6.test.js
// Unit tests for pure signal functions S1, S2, S6 — no DB required.
const s1 = require('../modules/aml/signals/s1');
const s2 = require('../modules/aml/signals/s2');
const s6 = require('../modules/aml/signals/s6');

describe('S1 volume', () => {
  test('fires above limit × multiplier', () => {
    expect(s1({ totalUsd: '3001', limitUsd: '1000', multiplier: '3' })).toMatchObject({ signalId: 'S1', severity: 'medium' });
  });
  test('does not fire at/below', () => {
    expect(s1({ totalUsd: '3000', limitUsd: '1000', multiplier: '3' })).toBeNull();
  });
});

describe('S2 structuring', () => {
  test('fires with ≥count near-threshold withdrawals summing ≥ T', () => {
    const f = s2({ withdrawalUsds: ['9000', '9500', '8500'], thresholdUsd: '10000', count: 3 });
    expect(f).toMatchObject({ signalId: 'S2', severity: 'high' });
    expect(f.evidence.matched).toBe(3);
  });
  test('ignores withdrawals outside [0.8T, T)', () => {
    // 5000 is below 0.8×10000=8000; 10000 is not < T
    expect(s2({ withdrawalUsds: ['5000', '10000', '9000'], thresholdUsd: '10000', count: 3 })).toBeNull();
  });
});

describe('S6 new-account volume', () => {
  test('fires for a young account over the volume', () => {
    expect(s6({ accountAgeDays: 2, maxAgeDays: 7, totalUsd: '60000', volumeUsd: '50000' })).toMatchObject({ signalId: 'S6' });
  });
  test('does not fire for an old account', () => {
    expect(s6({ accountAgeDays: 30, maxAgeDays: 7, totalUsd: '60000', volumeUsd: '50000' })).toBeNull();
  });
});
