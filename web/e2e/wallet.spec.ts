import { test, expect } from '@playwright/test';
import { json, loginViaUI, gotoApp, captureIdempotencyKeys } from './support';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BTC_ID = '11111111-1111-4111-8111-111111111111';

function balances() {
  return [
    {
      userId: '1',
      criptomonedaId: BTC_ID,
      availableBalance: '5.00000000',
      blockedBalance: '0',
      pendingBalance: '0',
      compartments: {
        funding: { available: '5', blocked: '0', pending: '0' },
        spot: { available: '0', blocked: '0' },
      },
      crypto: { id: BTC_ID, symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 },
    },
  ];
}

test.describe('wallet money flows', () => {
  test('Funding→Spot transfer submits with an Idempotency-Key and shows success', async ({ page }) => {
    await page.route('**/api/balances/my/balances', (r) => r.fulfill(json(balances())));
    const transfer = captureIdempotencyKeys(page, '**/api/balances/my/transfer', () => ({
      body: { message: 'ok', data: { from: 'funding', to: 'spot' } },
    }));

    await loginViaUI(page);
    await gotoApp(page, 'Wallet', /\/wallet$/);
    await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();

    await page.locator('#transfer-crypto').selectOption(BTC_ID);
    await page.locator('#transfer-from').selectOption('funding');
    await page.locator('#transfer-to').selectOption('spot');
    await page.locator('#transfer-amount').fill('1.5');
    await page.getByRole('button', { name: 'Transfer' }).click();

    await expect(page.getByText('Transfer completed.')).toBeVisible();
    expect(transfer.keys).toHaveLength(1);
    expect(transfer.keys[0]).toMatch(UUID_V4);
  });

  test('withdrawal submits with an Idempotency-Key and shows the queued message', async ({ page }) => {
    await page.route('**/api/balances/my/balances', (r) => r.fulfill(json(balances())));
    const wd = captureIdempotencyKeys(page, '**/api/transaccionBlockchain/withdraw', () => ({
      status: 201,
      body: {
        success: true,
        message: 'ok',
        data: {
          id: 'tx1', userId: '1', cryptoId: BTC_ID, type: 'withdrawal', amount: '0.5',
          confirmations: 0, requiredConfirmations: 2, status: 'pending', createdAt: new Date().toISOString(),
        },
      },
    }));

    await loginViaUI(page);
    await gotoApp(page, 'Wallet', /\/wallet$/);
    await page.getByRole('tab', { name: 'Withdraw' }).click();

    await page.locator('#wd-crypto').selectOption(BTC_ID);
    await page.locator('#wd-amount').fill('0.5');
    await page.locator('#wd-address').fill('bc1qdestaddr');
    await page.getByRole('button', { name: 'Withdraw' }).click();

    await expect(page.getByText(/Withdrawal requested/)).toBeVisible();
    expect(wd.keys).toHaveLength(1);
    expect(wd.keys[0]).toMatch(UUID_V4);
  });
});
