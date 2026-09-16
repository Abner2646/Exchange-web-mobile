// backend/tests/integration/amlValuation.integration.test.js
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const { Crypto, SwapPair } = require('../../models');
const valuation = require('../../modules/aml/amlValuation');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('amlValuation.getUsdValue', () => {
  test('a USD-stable crypto is valued 1:1', async () => {
    const usdt = await Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 });
    const r = await valuation.getUsdValue(usdt.id, '250.5');
    expect(r.source).toBe('stable');
    expect(Number(r.usd)).toBe(250.5);
  });

  test('a crypto with an active pair against a stable is valued at amount × price', async () => {
    const btc = await Crypto.create({ symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 });
    const usdt = await Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 });
    await SwapPair.create({ baseCryptoId: btc.id, quoteCryptoId: usdt.id, currentPrice: '40000', feePercent: '0.1', active: true });
    const r = await valuation.getUsdValue(btc.id, '0.5');
    expect(r.source).toBe('pair');
    expect(Number(r.usd)).toBe(20000);
    expect(r.priceAsOf).toBeInstanceOf(Date);
  });

  test('a crypto with no stable pair is unvaluable (usd null)', async () => {
    const doge = await Crypto.create({ symbol: 'DOGE', name: 'Dogecoin', network: 'dogecoin', decimals: 8 });
    const r = await valuation.getUsdValue(doge.id, '1000');
    expect(r).toEqual({ usd: null, priceAsOf: null, source: 'unknown' });
  });

  test('a stale/corrupt price of 0 is treated as unknown, not $0 (no silent AML miss)', async () => {
    const btc = await Crypto.create({ symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 });
    const usdt = await Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 });
    await SwapPair.create({ baseCryptoId: btc.id, quoteCryptoId: usdt.id, currentPrice: '0', feePercent: '0.1', active: true });
    const r = await valuation.getUsdValue(btc.id, '0.5');
    expect(r.source).toBe('unknown');
    expect(r.usd).toBeNull();
  });

  test('a price older than the stale threshold emits a warning (but still returns a value)', async () => {
    const btc = await Crypto.create({ symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 });
    const usdt = await Crypto.create({ symbol: 'USDT', name: 'Tether', network: 'ethereum', decimals: 6 });
    // lastUpdated set to 2 hours ago
    const staleDate = new Date(Date.now() - 2 * 3600 * 1000);
    await SwapPair.create({ baseCryptoId: btc.id, quoteCryptoId: usdt.id, currentPrice: '40000', feePercent: '0.1', active: true, lastUpdated: staleDate });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await valuation.getUsdValue(btc.id, '1');
    expect(r.source).toBe('pair');
    expect(Number(r.usd)).toBe(40000);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[amlValuation] stale price'));
    warnSpy.mockRestore();
  });
});
