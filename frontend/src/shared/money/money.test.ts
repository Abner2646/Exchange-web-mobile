import * as money from './money';
import type { CanonicalAmount } from './money';

describe('money core — exact arithmetic (no binary float)', () => {
  test('the 0.1 + 0.2 trap resolves exactly', () => {
    expect(money.add('0.1', '0.2')).toBe('0.3');
  });

  test('add / subtract / multiply are exact', () => {
    expect(money.add('1.005', '2.005')).toBe('3.01');
    expect(money.subtract('0.3', '0.1')).toBe('0.2');
    expect(money.multiply('0.1', '0.1')).toBe('0.01');
  });

  test('divide guards against division by zero', () => {
    expect(() => money.divide('1', '0')).toThrow(RangeError);
    expect(money.divide('1', '3')).toMatch(/^0\.3{20,}/);
  });

  test('round uses banker (half-even) rounding', () => {
    expect(money.round('2.5', 0)).toBe('2');
    expect(money.round('3.5', 0)).toBe('4');
    expect(money.round('0.125', 2)).toBe('0.12');
  });

  test('negate normalizes negative zero to zero', () => {
    expect(money.negate('0')).toBe('0');
    expect(money.negate('5')).toBe('-5');
  });
});

describe('money core — canonical validation is strict (security)', () => {
  test('toCanonical rejects JS numbers outright', () => {
    // @ts-expect-error numbers are forbidden at the type level too
    expect(() => money.toCanonical(0.3)).toThrow(TypeError);
  });

  test.each(['Infinity', 'NaN', '1e3', '0x1f', '1,5', '+1', '1.', '.5', '', '  ', 'abc'])(
    'toCanonical rejects non-canonical string %p',
    (bad) => {
      expect(() => money.toCanonical(bad)).toThrow(TypeError);
    },
  );

  test('toCanonical normalizes redundant forms', () => {
    expect(money.toCanonical('-0')).toBe('0');
    expect(money.toCanonical('007')).toBe('7');
    expect(money.toCanonical('01.50')).toBe('1.5');
  });

  test('isCanonical is a correct type guard', () => {
    expect(money.isCanonical('12.5')).toBe(true);
    expect(money.isCanonical('-12.5')).toBe(true);
    expect(money.isCanonical('12,5')).toBe(false);
    expect(money.isCanonical('1e3')).toBe(false);
    expect(money.isCanonical(0.3)).toBe(false);
  });

  test('comparisons are exact', () => {
    expect(money.compare('0.1', '0.10')).toBe(0);
    expect(money.gt('0.3', money.add('0.1', '0.2'))).toBe(false);
    expect(money.gte('0.3', money.add('0.1', '0.2'))).toBe(true);
    expect(money.isPositive('0.00000001')).toBe(true);
    expect(money.isZero('-0')).toBe(true);
  });
});

describe('money core — locale-aware input parsing (the "0,300" boundary)', () => {
  test('es-AR interprets comma as the decimal separator', () => {
    const r = money.parseInput('0,300', { locale: 'es-AR' });
    expect(r).toEqual({ ok: true, value: '0.3' });
  });

  test('en-US interprets dot as the decimal separator', () => {
    const r = money.parseInput('0.300', { locale: 'en-US' });
    expect(r).toEqual({ ok: true, value: '0.3' });
  });

  test('es-AR strips "." grouping and uses "," decimal', () => {
    expect(money.parseInput('1.234,56', { locale: 'es-AR' })).toEqual({ ok: true, value: '1234.56' });
    expect(money.parseInput('1.234', { locale: 'es-AR' })).toEqual({ ok: true, value: '1234' });
  });

  test('en-US strips "," grouping and uses "." decimal', () => {
    expect(money.parseInput('1,234.56', { locale: 'en-US' })).toEqual({ ok: true, value: '1234.56' });
    expect(money.parseInput('1,234', { locale: 'en-US' })).toEqual({ ok: true, value: '1234' });
  });

  test('the SAME string is resolved differently and deterministically per locale', () => {
    // "1,5" -> 1.5 in es-AR (comma decimal); -> 15 in en-US (comma grouping)
    expect(money.parseInput('1,5', { locale: 'es-AR' })).toEqual({ ok: true, value: '1.5' });
    expect(money.parseInput('1,5', { locale: 'en-US' })).toEqual({ ok: true, value: '15' });
  });

  test('rejects grouping separator to the right of the decimal', () => {
    expect(money.parseInput('1,23.456', { locale: 'es-AR' }).ok).toBe(false);
  });

  test.each(['1e3', '0x1f', 'Infinity', 'abc', '5%'])('rejects non-numeric junk %p', (bad) => {
    expect(money.parseInput(bad, { locale: 'en-US' }).ok).toBe(false);
  });

  test('empty input is EMPTY', () => {
    expect(money.parseInput('', { locale: 'en-US' })).toEqual({ ok: false, error: 'EMPTY' });
    expect(money.parseInput('   ', { locale: 'en-US' })).toEqual({ ok: false, error: 'EMPTY' });
  });

  test('negative is rejected unless allowed', () => {
    expect(money.parseInput('-5', { locale: 'en-US' })).toEqual({ ok: false, error: 'NEGATIVE_NOT_ALLOWED' });
    expect(money.parseInput('-5', { locale: 'en-US', allowNegative: true })).toEqual({ ok: true, value: '-5' });
  });

  test('enforces maxDecimals', () => {
    const r = money.parseInput('0,123456789', { locale: 'es-AR', maxDecimals: 8 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('EXCEEDS_MAX_DECIMALS');
  });
});

describe('money core — locale display formatting (render edge only)', () => {
  test('es-AR formats with "." grouping and "," decimal', () => {
    expect(money.formatDisplay('1234.5' as CanonicalAmount, { locale: 'es-AR' })).toBe('1.234,50');
  });

  test('en-US formats with "," grouping and "." decimal', () => {
    expect(money.formatDisplay('1234.5' as CanonicalAmount, { locale: 'en-US' })).toBe('1,234.50');
  });

  test('stripTrailingZeros keeps at least minDecimals', () => {
    expect(
      money.formatDisplay('1234.5000' as CanonicalAmount, { locale: 'en-US', stripTrailingZeros: true }),
    ).toBe('1,234.50');
  });

  test('a rounded-to-zero negative shows no minus sign', () => {
    expect(money.formatDisplay('-0' as CanonicalAmount, { locale: 'en-US' })).toBe('0.00');
  });

  test('round-trip: parse then format returns to the user locale form', () => {
    const parsed = money.parseInput('1.234,56', { locale: 'es-AR' });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(money.formatDisplay(parsed.value, { locale: 'es-AR' })).toBe('1.234,56');
    }
  });
});
