import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('localizes canonical API strings only at the presentation edge', () => {
    expect(formatMoney('1234.5', 'en-US')).toBe('1,234.5');
    expect(formatMoney('1234.5', 'es-AR')).toBe('1.234,5');
  });
  it('does not lose precision when formatting a large canonical amount', () => {
    expect(formatMoney('12345678901234567890.12345678', 'en-US')).toBe('12,345,678,901,234,567,890.12345678');
  });
  it('does not render an invalid money value as zero', () => { expect(formatMoney('not-money', 'en-US')).toBe('—'); });
});
