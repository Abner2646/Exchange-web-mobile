// backend/tests/amlSignalsS3S4.test.js
const s3 = require('../modules/aml/signals/s3');
const s4 = require('../modules/aml/signals/s4');

describe('S3 velocity', () => {
  test('fires when the withdrawal is ≥ ratio × a recent deposit (same asset)', () => {
    const f = s3({ withdrawalAmount: '0.95', deposits: [{ id: 'd1', amount: '1' }], ratio: '0.9' });
    expect(f).toMatchObject({ signalId: 'S3', severity: 'high' });
    expect(f.evidence.matchedDepositId).toBe('d1');
  });
  test('does not fire below the ratio', () => {
    expect(s3({ withdrawalAmount: '0.5', deposits: [{ id: 'd1', amount: '1' }], ratio: '0.9' })).toBeNull();
  });
  test('does not fire with no deposits', () => {
    expect(s3({ withdrawalAmount: '10', deposits: [], ratio: '0.9' })).toBeNull();
  });
});

describe('S4 P2P repeat', () => {
  test('fires at the count threshold', () => {
    expect(s4({ count: 5, threshold: 5 })).toMatchObject({ signalId: 'S4', severity: 'medium' });
  });
  test('does not fire below threshold', () => {
    expect(s4({ count: 4, threshold: 5 })).toBeNull();
  });
});
