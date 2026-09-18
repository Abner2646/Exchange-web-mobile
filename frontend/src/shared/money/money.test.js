const money = require('./money');

describe('shared/money/money.js', () => {
  describe('toDecimal y guardas anti-float', () => {
    test('rechaza números de punto flotante de JS (IEEE 754)', () => {
      expect(() => money.toDecimal(0.1)).toThrow(TypeError);
      expect(() => money.toDecimal(0.29)).toThrow(TypeError);
      expect(() => money.toDecimal(1.00000001)).toThrow(TypeError);
    });

    test('acepta enteros seguros de JS', () => {
      expect(money.toDecimal(0).toFixed()).toBe('0');
      expect(money.toDecimal(100).toFixed()).toBe('100');
    });

    test('acepta strings canónicos válidos', () => {
      expect(money.toDecimal('0.1').toFixed()).toBe('0.1');
      expect(money.toDecimal('1000.50000000').toFixed()).toBe('1000.5');
    });

    test('rechaza valores nulos, vacíos o no numéricos', () => {
      expect(() => money.toDecimal(null)).toThrow(TypeError);
      expect(() => money.toDecimal(undefined)).toThrow(TypeError);
      expect(() => money.toDecimal('')).toThrow(TypeError);
      expect(() => money.toDecimal('abc')).toThrow(TypeError);
    });
  });

  describe('Operaciones aritméticas exactas', () => {
    test('suma exacta: resuelve 0.1 + 0.2 === 0.3 sin imprecisión binaria', () => {
      expect(money.add('0.1', '0.2')).toBe('0.3');
    });

    test('resta exacta', () => {
      expect(money.subtract('1', '0.9')).toBe('0.1');
      expect(money.subtract('0.00000005', '0.00000002')).toBe('0.00000003');
    });

    test('multiplicación exacta: satoshis de BTC sin perder precisión', () => {
      // 0.29 * 1e8 en JS float da 28999999.999999996
      expect(money.multiply('0.29', '100000000')).toBe('29000000');
    });

    test('división exacta y manejo de división por cero', () => {
      expect(money.divide('1', '2')).toBe('0.5');
      expect(() => money.divide('10', '0')).toThrow(RangeError);
    });

    test('negación de signo', () => {
      expect(money.negate('150.5')).toBe('-150.5');
      expect(money.negate('-150.5')).toBe('150.5');
      expect(money.negate('0')).toBe('0');
    });
  });

  describe('Redondeo Banker\'s (Half-Even)', () => {
    test('redondea al par más cercano en empates (.5)', () => {
      expect(money.round('2.5', 0)).toBe('2'); // 2 es par
      expect(money.round('3.5', 0)).toBe('4'); // 4 es par
      expect(money.round('0.125', 2)).toBe('0.12'); // 2 es par
      expect(money.round('0.135', 2)).toBe('0.14'); // 4 es par
    });

    test('redondea normalmente cuando no es empate exacto', () => {
      expect(money.round('2.51', 0)).toBe('3');
      expect(money.round('2.49', 0)).toBe('2');
    });
  });

  describe('Formateo canónico y format8', () => {
    test('formatCanonical fija la cantidad de decimales con relleno de ceros', () => {
      expect(money.formatCanonical('1.5', 4)).toBe('1.5000');
      expect(money.formatCanonical('2', 2)).toBe('2.00');
    });

    test('format8 formatea a exactamente 8 decimales uniformes', () => {
      expect(money.format8('1')).toBe('1.00000000');
      expect(money.format8('0.123456789')).toBe('0.12345679'); // redondeo en 8vo dígito
    });
  });

  describe('Comparaciones exactas', () => {
    test('compare devuelve -1, 0, 1', () => {
      expect(money.compare('0.1', '0.2')).toBe(-1);
      expect(money.compare('0.2', '0.1')).toBe(1);
      expect(money.compare('0.100', '0.1')).toBe(0);
    });

    test('helpers de comparación booleana', () => {
      expect(money.eq('1.0', '1')).toBe(true);
      expect(money.gt('1.0001', '1')).toBe(true);
      expect(money.gte('1', '1.0')).toBe(true);
      expect(money.lt('0.9999', '1')).toBe(true);
      expect(money.lte('1', '1')).toBe(true);
      expect(money.isZero('0.00000000')).toBe(true);
      expect(money.isPositive('0.00000001')).toBe(true);
      expect(money.isNegative('-0.00000001')).toBe(true);
    });
  });

  describe('parseInputToCanonical', () => {
    test('parsea formato con punto', () => {
      const res = money.parseInputToCanonical('123.456');
      expect(res).toEqual({ ok: true, value: '123.456' });
    });

    test('parsea formato con coma simple (hispano común)', () => {
      const res = money.parseInputToCanonical('123,456');
      expect(res).toEqual({ ok: true, value: '123.456' });
    });

    test('parsea formato con separadores de miles y coma decimal (1.250,50)', () => {
      const res = money.parseInputToCanonical('1.250,50');
      expect(res).toEqual({ ok: true, value: '1250.50' });
    });

    test('parsea formato anglosajón con coma de miles (1,250.50)', () => {
      const res = money.parseInputToCanonical('1,250.50');
      expect(res).toEqual({ ok: true, value: '1250.50' });
    });

    test('rechaza si excede la cantidad máxima de decimales', () => {
      const res = money.parseInputToCanonical('1.123456789', { maxDecimals: 8 });
      expect(res.ok).toBe(false);
      expect(res.error).toBe('EXCEEDS_MAX_DECIMALS');
    });

    test('rechaza caracteres no válidos o vacío', () => {
      expect(money.parseInputToCanonical('').ok).toBe(false);
      expect(money.parseInputToCanonical('12a.5').ok).toBe(false);
      expect(money.parseInputToCanonical('-50', { allowNegative: false }).ok).toBe(false);
      expect(money.parseInputToCanonical('-50', { allowNegative: true })).toEqual({ ok: true, value: '-50' });
    });
  });

  describe('formatDisplay', () => {
    test('formatea con separadores de miles y decimales mínimos', () => {
      const formatted = money.formatDisplay('1234567.8', { minDecimals: 2, maxDecimals: 2, locale: 'en-US' });
      expect(formatted).toBe('1,234,567.80');
    });

    test('formatea para locale hispano (es-AR)', () => {
      const formatted = money.formatDisplay('1234567.85', { minDecimals: 2, maxDecimals: 2, locale: 'es-AR' });
      // En es-AR usa punto para miles y coma para decimales
      expect(formatted).toMatch(/1\.234\.567,85/);
    });

    test('opción stripTrailingZeros remueve ceros innecesarios por encima del mínimo', () => {
      const formatted = money.formatDisplay('100.50000000', {
        minDecimals: 2,
        maxDecimals: 8,
        locale: 'en-US',
        stripTrailingZeros: true,
      });
      expect(formatted).toBe('100.50');
    });
  });
});
