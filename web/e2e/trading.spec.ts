import { test, expect } from '@playwright/test';
import { json, loginViaUI, gotoApp, captureIdempotencyKeys } from './support';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PAIR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BTC = '11111111-1111-4111-8111-111111111111';
const USDT = '22222222-2222-4222-8222-222222222222';

test('limit buy: place order with an Idempotency-Key and success flash', async ({ page }) => {
  await page.route('**/api/trading/pairs', (r) => r.fulfill(json({
    success: true,
    pairs: [{
      id: PAIR, symbol: 'BTC/USDT', baseAssetId: BTC, quoteAssetId: USDT, status: 'active',
      minOrderAmount: '0.0001', maxOrderAmount: null, pricePrecision: 2, quantityPrecision: 8,
      makerFeePercent: '0.1', takerFeePercent: '0.1', lastPrice: '65000', priceChange24h: '1.5',
    }],
  })));
  await page.route('**/api/trading/orderbook/**', (r) => r.fulfill(json({
    success: true,
    orderBook: {
      bids: [{ price: 64900, quantity: 1, total: 64900, orders: 2 }],
      asks: [{ price: 65100, quantity: 2, total: 130200, orders: 1 }],
      timestamp: '',
    },
  })));
  await page.route('**/api/trading/trades/**', (r) => r.fulfill(json({
    success: true,
    trades: [{ id: 't1', price: 65000, quantity: 0.5, side: 'buy', createdAt: '2026-11-02T10:00:00Z' }],
  })));
  await page.route('**/api/trading/orders/active', (r) => r.fulfill(json({ success: true, orders: [] })));
  await page.route('**/api/balances/my/balances', (r) => r.fulfill(json([
    {
      userId: '1', criptomonedaId: USDT, availableBalance: '1000', blockedBalance: '0', pendingBalance: '0',
      compartments: { funding: { available: '0', blocked: '0', pending: '0' }, spot: { available: '1000', blocked: '0' } },
      crypto: { id: USDT, symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 },
    },
  ])));
  const place = captureIdempotencyKeys(page, '**/api/trading/orders', () => ({
    body: { success: true, order: { id: 'o1' }, message: 'ok' },
  }));

  await loginViaUI(page);
  await gotoApp(page, 'Trading', /\/trading$/);

  // Single pair selector (custom Select) drives the whole terminal.
  await page.getByRole('button', { name: 'Pair' }).click();
  await page.getByRole('option', { name: /BTC\/USDT/ }).click();

  // Order form appears once a pair is chosen. Defaults: limit buy.
  await page.locator('#order-qty').fill('0.001');
  await page.locator('#order-price').fill('65000');

  // "Buy" is both the side segment and the submit label — target the submit by type.
  const submit = page.locator('form button[type="submit"]');
  await expect(submit).toBeEnabled();
  await page.screenshot({ path: 'test-results/trading-terminal.png', fullPage: true });
  await submit.click();

  // Success is the full-screen SuccessFlash (role=alert).
  await expect(page.getByRole('alert').filter({ hasText: 'Order placed' })).toBeVisible();
  await page.screenshot({ path: 'test-results/trading-order.png', fullPage: true });
  expect(place.keys).toHaveLength(1);
  expect(place.keys[0]).toMatch(UUID_V4);
});
