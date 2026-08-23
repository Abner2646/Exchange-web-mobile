// tests/priceUpdater.test.js
//
// Fase 1 — precisión monetaria en el feed de precios. priceUpdater escribe
// TradingPair.lastPrice, que es justo el precio que consume el trading engine ya
// migrado (market pricing en balanceManager, getBestPrice en orderBook). Binance
// devuelve los precios como strings decimales EXACTOS; el parseFloat los pasaba
// por float binario antes de guardarlos en columnas DECIMAL, contaminando el
// input del trading. Ahora se preserva el string canónico tal cual.

jest.mock('../models', () => ({ TradingPair: {} }));
jest.mock('axios');

const axios = require('axios');
const priceUpdater = require('../services/trading/priceUpdater.service');

beforeEach(() => {
  jest.clearAllMocks();
  priceUpdater.clearCache();
});

describe('priceUpdater.fetchBinancePrice — precios exactos como string', () => {
  test('preserva el string canónico de Binance (no lo pasa por float)', async () => {
    axios.get.mockResolvedValue({
      data: {
        lastPrice: '43250.123456789012345',
        priceChange: '10.5',
        priceChangePercent: '2.5',
        highPrice: '43300.00000001',
        lowPrice: '43000.0',
        volume: '1234.56789012',
        quoteVolume: '53400000.12',
        openPrice: '43240.0',
        count: 12345,
      },
    });

    const r = await priceUpdater.fetchBinancePrice('BTCUSDT');

    // parseFloat('43250.123456789012345') pierde dígitos (float ~15-17 sig)
    expect(r.lastPrice).toBe('43250.123456789012345');
    expect(r.highPrice).toBe('43300.00000001');
    expect(r.volume).toBe('1234.56789012');
    expect(r.trades).toBe(12345); // el conteo sigue siendo entero
  });
});
