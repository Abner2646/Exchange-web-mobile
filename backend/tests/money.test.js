// tests/money.test.js
//
// Fase 1 — precisión monetaria. money.js es el ÚNICO punto de aritmética de
// dinero del backend. Usa decimal.js (base 10 por software), nunca el float
// binario IEEE 754 de JS. Estos tests prueban que no hay errores de coma y que
// el redondeo es half-even (banker's rounding), el estándar de sistemas
// financieros profesionales.

const money = require('../utils/money');

describe('money.add — suma exacta (sin errores de coma binarios)', () => {
  test('0.1 + 0.2 === 0.3 (el caso clásico donde el float falla)', () => {
    // Con Number: 0.1 + 0.2 === 0.30000000000000004
    expect(money.add('0.1', '0.2')).toBe('0.3');
  });

  test('suma montos con 8 decimales (satoshis) sin perder precisión', () => {
    expect(money.add('0.00000001', '0.00000002')).toBe('0.00000003');
  });

  test('suma valores grandes con 18 decimales (wei) sin redondear', () => {
    expect(money.add('1234567890.123456789012345678', '0.000000000000000001')).toBe(
      '1234567890.123456789012345679'
    );
  });
});

describe('money.subtract — resta exacta', () => {
  test('0.3 - 0.1 === 0.2 (el float da 0.19999999999999998)', () => {
    expect(money.subtract('0.3', '0.1')).toBe('0.2');
  });

  test('resta que da cero exacto', () => {
    expect(money.subtract('0.00000001', '0.00000001')).toBe('0');
  });
});

describe('money.multiply — multiplicación exacta', () => {
  test('0.1 * 0.2 === 0.02 (el float da 0.020000000000000004)', () => {
    expect(money.multiply('0.1', '0.2')).toBe('0.02');
  });

  test('cálculo de fee: 100 * 0.001 === 0.1', () => {
    expect(money.multiply('100', '0.001')).toBe('0.1');
  });
});

describe('money.divide — división exacta (resultados terminantes)', () => {
  test('1 / 4 === 0.25', () => {
    expect(money.divide('1', '4')).toBe('0.25');
  });

  test('0.1 / 0.2 === 0.5', () => {
    expect(money.divide('0.1', '0.2')).toBe('0.5');
  });
});

describe('money.round — half-even (banker\'s rounding)', () => {
  test('empates van al dígito par: 2.5 -> 2, 3.5 -> 4 (a 0 decimales)', () => {
    expect(money.round('2.5', 0)).toBe('2');
    expect(money.round('3.5', 0)).toBe('4');
  });

  test('empates a 2 decimales: 0.125 -> 0.12, 0.135 -> 0.14', () => {
    expect(money.round('0.125', 2)).toBe('0.12');
    expect(money.round('0.135', 2)).toBe('0.14');
  });

  test('no-empate redondea normal: 0.126 -> 0.13', () => {
    expect(money.round('0.126', 2)).toBe('0.13');
  });

  test('1.005 -> 1.00 (con Number, toFixed(2) da 1.00 por el float; acá es exacto y par)', () => {
    // 1.005 en float es 1.00499999...; este test prueba que operamos sobre el
    // decimal exacto, no sobre el binario.
    expect(money.round('1.005', 2)).toBe('1');
  });

  test('redondea a 8 decimales (BTC/satoshis)', () => {
    expect(money.round('0.123456785', 8)).toBe('0.12345678');
  });
});

describe('money.compare — comparación exacta (-1 / 0 / 1)', () => {
  test('a < b devuelve -1; a > b devuelve 1', () => {
    expect(money.compare('0.1', '0.2')).toBe(-1);
    expect(money.compare('0.2', '0.1')).toBe(1);
  });

  test('iguales devuelve 0 (incluso a nivel satoshi)', () => {
    expect(money.compare('0.00000001', '0.00000001')).toBe(0);
  });

  test('compara sin error de coma: (0.1+0.2) === 0.3', () => {
    // Con Number, 0.1 + 0.2 = 0.30000000000000004 > 0.3 daría 1 (falso positivo).
    expect(money.compare(money.add('0.1', '0.2'), '0.3')).toBe(0);
  });

  test('detecta saldo negativo: compare(resultado, "0") < 0', () => {
    expect(money.compare(money.subtract('0.1', '0.3'), '0')).toBe(-1);
  });

  test('respeta la guarda anti-float en el borde', () => {
    expect(() => money.compare(0.1, '0.2')).toThrow(/string/i);
  });
});

describe('money — guarda anti-float (bloquea Number no-entero en el borde)', () => {
  test('rechaza un Number no-entero (ej. resultado de un parseFloat previo)', () => {
    expect(() => money.add(0.1, '0.2')).toThrow(/string/i);
    expect(() => money.multiply('100', 0.001)).toThrow(/string/i);
  });

  test('permite enteros seguros (son exactos en float)', () => {
    expect(money.multiply('100', 2)).toBe('200');
  });

  test('rechaza un entero fuera del rango seguro de float (2^53 + 1)', () => {
    expect(() => money.add(9007199254740993, '0')).toThrow();
  });
});
