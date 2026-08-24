// tests/intercambioSettlement.test.js
//
// Fase 1 — migración del settlement de intercambioExchange a money.js. Antes el
// controller calculaba cantidadQuote/comisión/requiredAmount/netAmount con
// parseFloat + aritmética de Number (float binario): las sumas/restas que NO
// pasaban por toFixed(8) (`cantidadQuote + comisionMonto`,
// `cantidadQuote - comisionMonto`) arrastraban el error de coma y ese monto
// contaminado se pasaba como Number a BalanceUsuario.updateBalance /
// WalletMaestra.addToBalance (que lo congelaban con String(amount), salteando la
// guarda anti-float de money.js). Después: aritmética exacta con decimal.js y
// montos como string canónico.

const settlement = require('../services/intercambioSettlement.service');

describe('calculateSettlement — montos exactos como string', () => {
  test('compra: requiredQuote = cantidadQuote + comisión, sin error de coma', () => {
    // cantidadBase=3, precio=0.1 => cantidadQuote=0.3; comisión 10% => 0.03
    // requiredQuote = 0.3 + 0.03 = 0.33
    // Con float: 0.3 + 0.03 = 0.32999999999999996
    const s = settlement.calculateSettlement({
      cantidadBase: 3,
      precio: '0.1',
      comisionPorcentaje: '10',
      tipo: 'compra',
    });

    expect(s.cantidadQuote).toBe('0.3');
    expect(s.comisionMonto).toBe('0.03');
    expect(s.requiredQuote).toBe('0.33');
    // En compra, el monto "final" que se muestra/paga es el requiredQuote.
    expect(s.cantidadFinal).toBe('0.33');
  });

  test('venta: netQuote = cantidadQuote - comisión, sin error de coma', () => {
    // cantidadBase=0.29, precio=1 => cantidadQuote=0.29; comisión 1% => 0.0029
    // netQuote = 0.29 - 0.0029 = 0.2871
    // Con float: 0.29 - 0.0029 = 0.28709999999999997
    const s = settlement.calculateSettlement({
      cantidadBase: 0.29,
      precio: '1',
      comisionPorcentaje: '1',
      tipo: 'venta',
    });

    expect(s.cantidadQuote).toBe('0.29');
    expect(s.comisionMonto).toBe('0.0029');
    expect(s.netQuote).toBe('0.2871');
    // En venta, el monto "final" que se recibe es el netQuote.
    expect(s.cantidadFinal).toBe('0.2871');
  });

  test('venta con precio tipo BTC: resta exacta a 8 decimales', () => {
    // cantidadBase=0.1, precio=43250.1 => cantidadQuote=4325.01
    // comisión 0.1% => 4.32501; netQuote = 4325.01 - 4.32501 = 4320.68499
    // Con float: 4320.684990000001
    const s = settlement.calculateSettlement({
      cantidadBase: 0.1,
      precio: '43250.1',
      comisionPorcentaje: '0.1',
      tipo: 'venta',
    });

    expect(s.cantidadQuote).toBe('4325.01');
    expect(s.comisionMonto).toBe('4.32501');
    expect(s.netQuote).toBe('4320.68499');
  });

  test('siempre devuelve strings (nunca Number contaminable)', () => {
    const s = settlement.calculateSettlement({
      cantidadBase: 1,
      precio: '2',
      comisionPorcentaje: '0.5',
      tipo: 'compra',
    });

    for (const key of ['cantidadQuote', 'comisionMonto', 'requiredQuote', 'netQuote', 'cantidadFinal']) {
      expect(typeof s[key]).toBe('string');
    }
  });
});
