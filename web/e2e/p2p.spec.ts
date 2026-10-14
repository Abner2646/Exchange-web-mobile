import { test, expect } from '@playwright/test';
import { json, loginViaUI, gotoApp, captureIdempotencyKeys } from './support';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OFFER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BTC = '11111111-1111-4111-8111-111111111111';

function sellOffer() {
  return {
    id: OFFER, userId: 'seller-1', type: 'sell', cryptoId: BTC,
    minAmount: '0.01', maxAmount: '2', unitPrice: '65000', fiatCurrency: 'USD',
    additionalTerms: null, active: true, direccionFiat: null,
    paymentMethods: [{ id: 'pm1', name: 'Bank transfer', description: null, active: true }],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

function tx() {
  return {
    id: 'tx-1', offerId: OFFER, buyerId: '1', sellerId: 'seller-1', cryptoId: BTC,
    amount: '1', unitPrice: '65000', fiatAmount: '65000', fiatCurrency: 'USD',
    paymentMethodId: 'pm1', status: 'initiated', paymentConfirmedAt: null, completedAt: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    crypto: { id: BTC, symbol: 'BTC', name: 'Bitcoin' },
  };
}

test('accept a sell offer: POST /transaccionP2P carries an Idempotency-Key', async ({ page }) => {
  await page.route('**/api/ofertaP2P/activas', (r) => r.fulfill(json({ data: [sellOffer()] })));
  await page.route('**/api/crypto', (r) => r.fulfill(json([{ id: BTC, symbol: 'BTC', name: 'Bitcoin' }])));
  await page.route('**/api/balances/my/balances', (r) => r.fulfill(json([])));
  await page.route('**/api/transaccionP2P/me/transacciones', (r) => r.fulfill(json({ transacciones: [tx()], total: 1, page: 1, limit: 10 })));
  await page.route('**/api/transaccionP2P/tx-1', (r) => r.fulfill(json(tx())));
  const accept = captureIdempotencyKeys(page, '**/api/transaccionP2P', () => ({
    status: 201,
    body: { message: 'ok', data: tx() },
  }));

  await loginViaUI(page);
  await gotoApp(page, 'P2P', /\/p2p$/);

  // Browse tab defaults to SELL offers → accept the row.
  await page.getByRole('button', { name: 'Accept', exact: true }).click();

  // Accept form (acceptor is BUYER for a sell offer → no balance gate).
  await page.locator('#accept-amount').fill('1');
  await page.locator('#accept-payment-method').selectOption('pm1');
  await page.getByRole('button', { name: 'Accept offer' }).click();

  // onDone jumps to My transactions → the accept form is gone.
  await expect(page.getByRole('button', { name: 'Accept offer' })).toBeHidden();
  expect(accept.keys).toHaveLength(1);
  expect(accept.keys[0]).toMatch(UUID_V4);
});
