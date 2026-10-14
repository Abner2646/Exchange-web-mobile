import { test, expect } from '@playwright/test';
import { json, loginViaUI, gotoApp, captureIdempotencyKeys } from './support';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PAIR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BTC = '11111111-1111-4111-8111-111111111111';
const USDT = '22222222-2222-4222-8222-222222222222';

test('limit buy: place order with an Idempotency-Key and success', async ({ page }) => {
  await page.route('**/api/trading/pairs', (r) => r.fulfill(json({
    success: true,
    pairs: [{
      id: PAIR, symbol: 'BTC/USDT', baseAssetId: BTC, quoteAssetId: USDT, status: 'active',
      minOrderAmount: '0.0001', maxOrderAmount: null, pricePrecision: 2, quantityPrecision: 8,
      makerFeePercent: '0.1', takerFeePercent: '0.1', lastPrice: '65000',
    }],
  })));
  await page.route('**/api/trading/orderbook/**', (r) => r.fulfill(json({ success: true, orderBook: { bids: [], asks: [] } })));
  await page.route('**/api/trading/trades/**', (r) => r.fulfill(json({ success: true, trades: [] })));
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
  await expect(page.getByRole('heading', { name: 'Place order' })).toBeVisible();

  // Defaults are a limit buy; fill the order form's own pair select + qty + price.
  // (The widget has a second #trading-pair; scope to the form's.)
  await page.locator('form #trading-pair').selectOption(PAIR);
  await page.locator('#order-qty').fill('0.001');
  await page.locator('#order-price').fill('65000');

  const submit = page.getByRole('button', { name: 'Buy' });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByText(/Order placed/)).toBeVisible();
  expect(place.keys).toHaveLength(1);
  expect(place.keys[0]).toMatch(UUID_V4);
});
