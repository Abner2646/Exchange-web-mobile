// The cadence of the two HOT in-process jobs (order matching ~10x/s, price updater every 10s) is now
// env-configurable, so a low-traffic deploy (e.g. 5 users) can slow them down WITHOUT a code change —
// mirroring the existing pattern in the blockchain/outbox/reconciliation jobs (Number(env) > 0 ? env : default).
// A non-positive value must fall back to the default (never setInterval(0) → tight loop).

describe('order matching interval — ORDER_MATCH_INTERVAL_MS', () => {
  const OLD = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD };
    jest.doMock('../models', () => ({ Order: {}, TradingPair: {} }));
    jest.doMock('../modules/trading/orderBook.service', () => ({ matchOrder: jest.fn() }));
  });
  afterAll(() => { process.env = OLD; });

  test('defaults to 100ms when unset', () => {
    delete process.env.ORDER_MATCH_INTERVAL_MS;
    expect(require('../jobs/orderMatching.job').getStatus().matchFrequency).toBe(100);
  });
  test('honors a positive override', () => {
    process.env.ORDER_MATCH_INTERVAL_MS = '3000';
    expect(require('../jobs/orderMatching.job').getStatus().matchFrequency).toBe(3000);
  });
  test('ignores a non-positive value (guards against a tight loop)', () => {
    process.env.ORDER_MATCH_INTERVAL_MS = '0';
    expect(require('../jobs/orderMatching.job').getStatus().matchFrequency).toBe(100);
  });
});

describe('price updater interval — PRICE_UPDATE_INTERVAL_MS', () => {
  const OLD = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD };
    jest.doMock('../modules/trading/priceUpdater.service', () => ({ updatePrices: jest.fn() }));
  });
  afterAll(() => { process.env = OLD; });

  test('defaults to 10000ms when unset', () => {
    delete process.env.PRICE_UPDATE_INTERVAL_MS;
    expect(require('../jobs/priceUpdater.job').getStatus().updateFrequency).toBe(10000);
  });
  test('honors a positive override', () => {
    process.env.PRICE_UPDATE_INTERVAL_MS = '60000';
    expect(require('../jobs/priceUpdater.job').getStatus().updateFrequency).toBe(60000);
  });
  test('ignores a non-positive value (guards against a tight loop)', () => {
    process.env.PRICE_UPDATE_INTERVAL_MS = '-5';
    expect(require('../jobs/priceUpdater.job').getStatus().updateFrequency).toBe(10000);
  });
});
