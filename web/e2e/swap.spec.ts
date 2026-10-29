import { test, expect } from '@playwright/test';
import { json, loginViaUI, gotoApp, captureIdempotencyKeys } from './support';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PAIR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BTC = '11111111-1111-4111-8111-111111111111';
const USDT = '22222222-2222-4222-8222-222222222222';

test('swap buy: quote → execute with an Idempotency-Key and success', async ({ page }) => {
  await page.route('**/api/parExchange', (r) => r.fulfill(json([
    {
      id: PAIR, baseCryptoId: BTC, quoteCryptoId: USDT, currentPrice: '65000', feePercent: '0.1',
      active: true, oraclePaused: false,
      baseCrypto: { id: BTC, symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin' },
      quoteCrypto: { id: USDT, symbol: 'USDT', name: 'Tether', network: 'ethereum' },
    },
  ])));
  await page.route('**/api/balances/my/balances', (r) => r.fulfill(json([
    {
      userId: '1', criptomonedaId: USDT, availableBalance: '1000', blockedBalance: '0', pendingBalance: '0',
      compartments: { funding: { available: '1000', blocked: '0', pending: '0' }, spot: { available: '0', blocked: '0' } },
      crypto: { id: USDT, symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 },
    },
  ])));
  await page.route('**/api/intercambioExchange/calculate', (r) => r.fulfill(json({
    par: { id: PAIR, base: 'BTC', quote: 'USDT', price: '65000' },
    calculo: {
      baseAmount: '0.001', quoteAmount: '65', feePercent: '0.1', feeAmount: '0.065',
      impactoSlippage: 0, finalAmount: '65.065', direccion: 'buy', precioEfectivo: '65000',
    },
    advertencias: [],
  })));
  await page.route('**/api/intercambioExchange/check-limit', (r) => r.fulfill(json({
    canTransact: true, dailyVolume: 0, limit: 100000, remainingLimit: 100000, requestedAmount: 65,
  })));
  // SwapHistory's GET /intercambioExchange/me — stub it so a real backend's 401 for
  // the e2e fake token can't fire notifyUnauthorized() and unmount the (app) subtree.
  await page.route('**/api/intercambioExchange/me**', (r) => r.fulfill(json([])));
  const exec = captureIdempotencyKeys(page, '**/api/intercambioExchange', () => ({
    body: {
      message: 'ok',
      data: {
        id: 's1', pairId: PAIR, type: 'buy', baseAmount: '0.001', quoteAmount: '65', price: '65000',
        feeAmount: '0.065', feePercent: '0.1', status: 'completed', precioUsado: '65000',
        comisionCalculada: '0.065', netAmount: '0.001',
      },
    },
  }));

  await loginViaUI(page);
  await gotoApp(page, 'Swap', /\/swap$/);
  await expect(page.getByRole('heading', { name: 'Swap Crypto' })).toBeVisible();

  // Coin-based UI: the single pair defaults to From=USDT / To=BTC (a buy). Driving
  // the To (BTC) field with 0.001 auto-computes the amount paid — Uniswap-style.
  await page.getByLabel('Amount to receive').fill('0.001');

  const submit = page.getByRole('button', { name: 'Review & swap' });
  await expect(submit).toBeEnabled(); // waits for quote + sufficiency gates
  await submit.click();

  await expect(page.getByText('Swap completed.')).toBeVisible();
  // The POST to the bare /intercambioExchange endpoint is the execute (calculate and
  // check-limit are sub-paths captured by separate routes above).
  expect(exec.keys).toHaveLength(1);
  expect(exec.keys[0]).toMatch(UUID_V4);
});
