const { validateZeroSum } = require('../modules/balances/ledger/postingService');

describe('validateZeroSum', () => {
  test('accepts a balanced single-currency asiento', () => {
    expect(() => validateZeroSum([
      { cryptoId: 'btc', amount: '-5.00000000' },
      { cryptoId: 'btc', amount: '5.00000000' },
    ])).not.toThrow();
  });

  test('accepts a balanced cross-currency asiento (each currency nets to zero)', () => {
    expect(() => validateZeroSum([
      { cryptoId: 'usdt', amount: '-100.00000000' },
      { cryptoId: 'usdt', amount: '100.00000000' },
      { cryptoId: 'btc', amount: '-1.00000000' },
      { cryptoId: 'btc', amount: '0.99900000' },
      { cryptoId: 'btc', amount: '0.00100000' },
    ])).not.toThrow();
  });

  test('rejects an unbalanced asiento', () => {
    expect(() => validateZeroSum([
      { cryptoId: 'btc', amount: '-5.00000000' },
      { cryptoId: 'btc', amount: '4.00000000' },
    ])).toThrow(/unbalanced/i);
  });
});
