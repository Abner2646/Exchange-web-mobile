import { test, expect } from '@playwright/test';
import { json, loginViaUI, gotoApp, captureIdempotencyKeys } from './support';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BTC_ID = '11111111-1111-4111-8111-111111111111';
const USDT_ID = '22222222-2222-4222-8222-222222222222';

function balances() {
  return [
    {
      userId: '1', criptomonedaId: BTC_ID,
      availableBalance: '5.00000000', blockedBalance: '0.25000000', pendingBalance: '0.10000000',
      compartments: {
        funding: { available: '3.00000000', blocked: '0.25000000', pending: '0.10000000' },
        spot: { available: '2.00000000', blocked: '0' },
      },
      crypto: { id: BTC_ID, symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 },
    },
    {
      userId: '1', criptomonedaId: USDT_ID,
      availableBalance: '1500.00', blockedBalance: '0', pendingBalance: '0',
      compartments: {
        funding: { available: '1000.00', blocked: '0', pending: '0' },
        spot: { available: '500.00', blocked: '0' },
      },
      crypto: { id: USDT_ID, symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 },
    },
  ];
}

function history() {
  return {
    success: true,
    data: [
      { id: 'tx1', userId: '1', cryptoId: BTC_ID, type: 'withdrawal', amount: '0.50000000', confirmations: 1, requiredConfirmations: 3, status: 'processing', createdAt: '2026-10-20T12:00:00Z' },
      { id: 'tx2', userId: '1', cryptoId: BTC_ID, type: 'deposit', amount: '1.00000000', confirmations: 3, requiredConfirmations: 3, status: 'completed', createdAt: '2026-10-18T09:30:00Z' },
      { id: 'tx3', userId: '1', cryptoId: USDT_ID, type: 'withdrawal', amount: '200.00', confirmations: 0, requiredConfirmations: 12, status: 'pending', createdAt: '2026-10-15T15:45:00Z' },
    ],
  };
}

// Stub every authenticated GET the wallet page fires, so a real backend 401 for the
// e2e fake token can't fire notifyUnauthorized() and unmount the (app) subtree.
async function stubWalletGets(page: import('@playwright/test').Page) {
  await page.route('**/api/balances/my/balances', (r) => r.fulfill(json(balances())));
  await page.route('**/api/transaccionBlockchain/my**', (r) => r.fulfill(json(history())));
}

// The asset/compartment pickers use the custom Select (button trigger + listbox).
async function pickSelect(page: import('@playwright/test').Page, triggerName: string, optionName: RegExp) {
  await page.getByRole('button', { name: triggerName, exact: true }).click();
  await page.getByRole('option', { name: optionName }).click();
}

test.describe('wallet money flows', () => {
  test('balances render as per-compartment cards', async ({ page }) => {
    await stubWalletGets(page);
    await loginViaUI(page);
    await gotoApp(page, 'Wallet', /\/wallet$/);
    await expect(page.getByRole('heading', { name: 'Wallet' })).toBeVisible();
    // Both assets shown, with the symbol labels.
    await expect(page.getByText('Bitcoin')).toBeVisible();
    await expect(page.getByText('Tether')).toBeVisible();
    await page.screenshot({ path: 'test-results/wallet-balances.png', fullPage: true });
  });

  test('Funding→Spot transfer submits with an Idempotency-Key and flashes success', async ({ page }) => {
    await stubWalletGets(page);
    const transfer = captureIdempotencyKeys(page, '**/api/balances/my/transfer', () => ({
      body: { message: 'ok', data: { from: 'funding', to: 'spot' } },
    }));

    await loginViaUI(page);
    await gotoApp(page, 'Wallet', /\/wallet$/);

    await pickSelect(page, 'Asset', /BTC/);
    // Defaults are Funding → Spot.
    await page.locator('#transfer-amount').fill('1.5');
    await page.getByRole('button', { name: 'Transfer', exact: true }).click();

    // Success is the full-screen SuccessFlash (role=alert) — the inline note was retired.
    await expect(page.getByRole('alert').filter({ hasText: 'Transfer complete' })).toBeVisible();
    await page.screenshot({ path: 'test-results/wallet-transfer-flash.png' });
    expect(transfer.keys).toHaveLength(1);
    expect(transfer.keys[0]).toMatch(UUID_V4);
  });

  test('withdrawal submits with an Idempotency-Key and flashes the requested message', async ({ page }) => {
    await stubWalletGets(page);
    const wd = captureIdempotencyKeys(page, '**/api/transaccionBlockchain/withdraw', () => ({
      status: 201,
      body: {
        success: true, message: 'ok',
        data: {
          id: 'tx1', userId: '1', cryptoId: BTC_ID, type: 'withdrawal', amount: '0.5',
          confirmations: 0, requiredConfirmations: 2, status: 'pending', createdAt: new Date().toISOString(),
        },
      },
    }));

    await loginViaUI(page);
    await gotoApp(page, 'Wallet', /\/wallet$/);
    await page.getByRole('tab', { name: 'Withdraw' }).click();

    await pickSelect(page, 'Asset', /BTC/);
    await page.locator('#wd-amount').fill('0.5');
    await page.locator('#wd-address').fill('bc1qdestaddr');
    await page.screenshot({ path: 'test-results/wallet-withdraw-form.png' });
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click();

    await expect(page.getByRole('alert').filter({ hasText: 'Withdrawal requested' })).toBeVisible();
    expect(wd.keys).toHaveLength(1);
    expect(wd.keys[0]).toMatch(UUID_V4);
  });

  test('deposit tab shows the region-unavailable notice (no deposit flow)', async ({ page }) => {
    await stubWalletGets(page);
    await loginViaUI(page);
    await gotoApp(page, 'Wallet', /\/wallet$/);
    await page.getByRole('tab', { name: 'Deposit' }).click();
    await expect(page.getByText('Deposits unavailable in your region')).toBeVisible();
    await expect(page.getByRole('button', { name: /copy/i })).toHaveCount(0);
    await page.screenshot({ path: 'test-results/wallet-deposit.png' });
  });

  test('history tab shows the transactions table with status badges', async ({ page }) => {
    await stubWalletGets(page);
    await loginViaUI(page);
    await gotoApp(page, 'Wallet', /\/wallet$/);
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('Completed')).toBeVisible();
    await expect(page.getByText('Pending')).toBeVisible();
    await page.screenshot({ path: 'test-results/wallet-history.png', fullPage: true });
  });
});
