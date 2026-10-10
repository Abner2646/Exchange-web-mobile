import { describe, it, expect } from 'vitest';
import { en } from '@/shared/i18n/catalogs/en';
import { es } from '@/shared/i18n/catalogs/es';

const UI_KEYS = [
  'nav.trading',
  'trading.title', 'trading.pair', 'trading.selectPair',
  'trading.book.title', 'trading.book.price', 'trading.book.amount', 'trading.book.total',
  'trading.book.bids', 'trading.book.asks', 'trading.book.spread', 'trading.book.empty',
  'trading.trades.title', 'trading.trades.empty', 'trading.trades.price', 'trading.trades.amount', 'trading.trades.side',
  'trading.form.title', 'trading.form.type', 'trading.form.market', 'trading.form.limit',
  'trading.form.buy', 'trading.form.sell', 'trading.form.quantity', 'trading.form.price',
  'trading.form.submitBuy', 'trading.form.submitSell', 'trading.form.feeNoteBuy', 'trading.form.feeNoteSell',
  'trading.form.marketCostNote', 'trading.form.insufficient', 'trading.form.fundSpot',
  'trading.form.minAmount', 'trading.form.success',
  'trading.orders.title', 'trading.orders.empty', 'trading.orders.pair', 'trading.orders.type',
  'trading.orders.side', 'trading.orders.amount', 'trading.orders.price', 'trading.orders.status', 'trading.orders.cancel',
];
const ERROR_KEYS = ['TRADING_PAIR_NOT_FOUND', 'INVALID_ORDER', 'INSUFFICIENT_BALANCE'];

describe('trading i18n keys', () => {
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
