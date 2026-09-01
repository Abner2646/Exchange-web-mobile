const { validarSumaCero } = require('../services/ledger/postingService');

describe('validarSumaCero', () => {
  test('accepts a balanced single-currency asiento', () => {
    expect(() => validarSumaCero([
      { criptomonedaId: 'btc', monto: '-5.00000000' },
      { criptomonedaId: 'btc', monto: '5.00000000' },
    ])).not.toThrow();
  });

  test('accepts a balanced cross-currency asiento (each currency nets to zero)', () => {
    expect(() => validarSumaCero([
      { criptomonedaId: 'usdt', monto: '-100.00000000' },
      { criptomonedaId: 'usdt', monto: '100.00000000' },
      { criptomonedaId: 'btc', monto: '-1.00000000' },
      { criptomonedaId: 'btc', monto: '0.99900000' },
      { criptomonedaId: 'btc', monto: '0.00100000' },
    ])).not.toThrow();
  });

  test('rejects an unbalanced asiento', () => {
    expect(() => validarSumaCero([
      { criptomonedaId: 'btc', monto: '-5.00000000' },
      { criptomonedaId: 'btc', monto: '4.00000000' },
    ])).toThrow(/desbalanceado/i);
  });
});
