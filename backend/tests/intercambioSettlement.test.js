// tests/intercambioSettlement.test.js
//
// Fase 1 — migración del settlement de intercambioExchange a money.js. Antes el
// controller calculaba quoteAmount/comisión/requiredAmount/netAmount con
// parseFloat + aritmética de Number (float binario): las sumas/restas que NO
// pasaban por toFixed(8) (`quoteAmount + feeAmount`,
// `quoteAmount - feeAmount`) arrastraban el error de coma y ese monto
// contaminado se pasaba como Number a UserBalance.updateBalance /
// MasterWallet.addToBalance (que lo congelaban con String(amount), salteando la
// guarda anti-float de money.js). Después: aritmética exacta con decimal.js y
// montos como string canónico.

const settlement = require('../modules/swap/swapSettlement.service');

describe('calculateSettlement — montos exactos como string', () => {
  test('buy: requiredQuote = quoteAmount + comisión, sin error de coma', () => {
    // baseAmount=3, price=0.1 => quoteAmount=0.3; comisión 10% => 0.03
    // requiredQuote = 0.3 + 0.03 = 0.33
    // Con float: 0.3 + 0.03 = 0.32999999999999996
    const s = settlement.calculateSettlement({
      baseAmount: 3,
      price: '0.1',
      feePercent: '10',
      type: 'buy',
    });

    expect(s.quoteAmount).toBe('0.3');
    expect(s.feeAmount).toBe('0.03');
    expect(s.requiredQuote).toBe('0.33');
    // En buy, el monto "final" que se muestra/paga es el requiredQuote.
    expect(s.finalAmount).toBe('0.33');
  });

  test('sell: netQuote = quoteAmount - comisión, sin error de coma', () => {
    // baseAmount=0.29, price=1 => quoteAmount=0.29; comisión 1% => 0.0029
    // netQuote = 0.29 - 0.0029 = 0.2871
    // Con float: 0.29 - 0.0029 = 0.28709999999999997
    const s = settlement.calculateSettlement({
      baseAmount: 0.29,
      price: '1',
      feePercent: '1',
      type: 'sell',
    });

    expect(s.quoteAmount).toBe('0.29');
    expect(s.feeAmount).toBe('0.0029');
    expect(s.netQuote).toBe('0.2871');
    // En sell, el monto "final" que se recibe es el netQuote.
    expect(s.finalAmount).toBe('0.2871');
  });

  test('sell con price type BTC: resta exacta a 8 decimales', () => {
    // baseAmount=0.1, price=43250.1 => quoteAmount=4325.01
    // comisión 0.1% => 4.32501; netQuote = 4325.01 - 4.32501 = 4320.68499
    // Con float: 4320.684990000001
    const s = settlement.calculateSettlement({
      baseAmount: 0.1,
      price: '43250.1',
      feePercent: '0.1',
      type: 'sell',
    });

    expect(s.quoteAmount).toBe('4325.01');
    expect(s.feeAmount).toBe('4.32501');
    expect(s.netQuote).toBe('4320.68499');
  });

  test('siempre devuelve strings (nunca Number contaminable)', () => {
    const s = settlement.calculateSettlement({
      baseAmount: 1,
      price: '2',
      feePercent: '0.5',
      type: 'buy',
    });

    for (const key of ['quoteAmount', 'feeAmount', 'requiredQuote', 'netQuote', 'finalAmount']) {
      expect(typeof s[key]).toBe('string');
    }
  });
});
