// amlValueItems.test.js — verifies that valueItems memoizes getUsdValue per cryptoId.
jest.mock('../modules/aml/amlValuation', () => ({ getUsdValue: jest.fn() }));
const valuation = require('../modules/aml/amlValuation');
const { valueItems } = require('../modules/aml/amlEvaluator');

describe('valueItems memoization', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls getUsdValue once per unique cryptoId, not once per item', async () => {
    valuation.getUsdValue.mockResolvedValue({ usd: '100', priceAsOf: new Date(), source: 'pair' });
    const items = [
      { cryptoId: 'btc', amount: '1' },
      { cryptoId: 'btc', amount: '2' }, // same cryptoId → should reuse cached result
      { cryptoId: 'eth', amount: '0.5' },
    ];
    const result = await valueItems(items);
    expect(valuation.getUsdValue).toHaveBeenCalledTimes(2); // btc + eth, not 3
    expect(result.valuedUsds).toHaveLength(3); // all 3 items valued
    expect(result.unvaluable).toBe(0);
  });

  test('a null usd result is cached too (no retry for unvaluable assets)', async () => {
    valuation.getUsdValue.mockResolvedValue({ usd: null, priceAsOf: null, source: 'unknown' });
    const items = [{ cryptoId: 'doge', amount: '1000' }, { cryptoId: 'doge', amount: '500' }];
    const result = await valueItems(items);
    expect(valuation.getUsdValue).toHaveBeenCalledTimes(1);
    expect(result.unvaluable).toBe(2);
  });
});
