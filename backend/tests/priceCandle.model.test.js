// tests/priceCandle.model.test.js
//
// Fase 1 — precisión monetaria en las velas (OHLCV). createOrUpdateCandle
// agregaba el volumen de la vela con `parseFloat(candle.volume) + parseFloat(
// volume)` (float binario) y high/low con Math.max/min sobre parseFloat. Los
// campos son DECIMAL: con money.js la agregación de volumen es exacta y el
// high/low se elige por comparación exacta.

jest.mock('../models/entities/priceCandle.entity');

const initPriceCandle = require('../models/entities/priceCandle.entity');
const createPriceCandleModel = require('../models/priceCandle.model');

const fakeModel = {};
initPriceCandle.mockReturnValue(fakeModel);
const sequelize = {};
const PriceCandle = createPriceCandleModel(sequelize);

beforeEach(() => jest.clearAllMocks());

describe('PriceCandle.createOrUpdateCandle — agrega vela existente exacto', () => {
  test('volumen 0.1+0.2="0.3", high/low por comparación exacta', async () => {
    const candle = { high: '0.3', low: '0.2', volume: '0.1', quoteVolume: '0.5', trades: '2', update: jest.fn() };
    PriceCandle.findOrCreate = jest.fn().mockResolvedValue([candle, false]); // false = ya existía

    await PriceCandle.createOrUpdateCandle({
      tradingPairId: 'p', interval: '1m', openTime: 1,
      high: '0.4', low: '0.15', close: '0.4', volume: '0.2', quoteVolume: '0.3', trades: 1,
    });

    const arg = candle.update.mock.calls[0][0];
    expect(arg.high).toBe('0.4');        // max(0.3, 0.4)
    expect(arg.low).toBe('0.15');        // min(0.2, 0.15)
    expect(arg.volume).toBe('0.3');      // 0.1 + 0.2 (float: 0.30000000000000004)
    expect(arg.quoteVolume).toBe('0.8'); // 0.5 + 0.3
  });
});
