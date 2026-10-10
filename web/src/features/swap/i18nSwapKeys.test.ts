import { describe, it, expect } from 'vitest';
import { en } from '@/shared/i18n/catalogs/en';
import { es } from '@/shared/i18n/catalogs/es';

const UI_KEYS = [
  'nav.swap',
  'swap.title', 'swap.form.title', 'swap.form.pair', 'swap.form.selectPair',
  'swap.form.type', 'swap.form.buy', 'swap.form.sell', 'swap.form.compartment',
  'swap.form.amount', 'swap.form.submit', 'swap.form.paused', 'swap.form.pausedRetry',
  'swap.form.insufficient', 'swap.form.limitExceeded', 'swap.form.limitRemaining',
  'swap.quote.title', 'swap.quote.indicative', 'swap.quote.youPay', 'swap.quote.youReceive',
  'swap.quote.fee', 'swap.quote.price', 'swap.quote.loading', 'swap.quote.empty',
  'swap.success.title', 'swap.success.priceUsed', 'swap.success.fee',
  'swap.history.title', 'swap.history.empty', 'swap.history.error',
  'swap.history.pair', 'swap.history.type', 'swap.history.amount', 'swap.history.date',
];
const ERROR_KEYS = [
  'PRICE_ORACLE_DIVERGENCE', 'EXCHANGE_INVALID_INPUT', 'EXCHANGE_PAIR_NOT_FOUND',
  'EXCHANGE_PAIR_NO_PRICE', 'EXCHANGE_DAILY_LIMIT_EXCEEDED', 'EXCHANGE_INSUFFICIENT_BALANCE',
  'EXCHANGE_USER_NOT_FOUND',
];

describe('swap i18n keys', () => {
  it('every ui key exists in en and es', () => {
    for (const k of UI_KEYS) {
      expect(en.ui[k], `en.ui ${k}`).toBeDefined();
      expect(es.ui[k], `es.ui ${k}`).toBeDefined();
    }
  });
  it('every error code exists in en and es', () => {
    for (const k of ERROR_KEYS) {
      expect(en.errors[k], `en.errors ${k}`).toBeDefined();
      expect(es.errors[k], `es.errors ${k}`).toBeDefined();
    }
  });
});
