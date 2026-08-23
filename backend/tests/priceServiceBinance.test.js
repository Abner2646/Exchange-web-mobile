// tests/priceServiceBinance.test.js
//
// Fase 1 — precisión monetaria en el feed de precios (path Binance de
// priceService). Binance devuelve strings decimales exactos; el parseFloat los
// contaminaba con float binario antes de guardarlos en ParExchange (DECIMAL).
// El precio inverso (1/precio) se calculaba con división float. Ahora: strings
// canónicos y money.divide para el inverso. (CoinGecko/CryptoCompare quedan como
// están: devuelven números JSON, ya float desde el parse.)

jest.mock('../models/index.js', () => ({ ParExchange: {} }));
jest.mock('axios');

const axios = require('axios');
const priceService = require('../services/priceService');

beforeEach(() => jest.clearAllMocks());

describe('priceService.updateFromBinance — precios exactos como string', () => {
  test('precio directo: preserva el string de Binance (no float)', async () => {
    axios.get.mockResolvedValue({
      data: [{
        symbol: 'BTCUSDT', lastPrice: '43250.123456789012345', prevClosePrice: '43000.0',
        priceChangePercent: '2.5', quoteVolume: '100.5', volume: '10.1',
        highPrice: '43300.0', lowPrice: '42000.0', count: 5,
      }],
    });
    const spy = jest.spyOn(priceService, 'updatePairPrice').mockResolvedValue();

    const par = { id: 'p1', criptoBase: { symbol: 'BTC' }, criptoQuote: { symbol: 'USDT' } };
    await priceService.updateFromBinance([par]);

    expect(spy).toHaveBeenCalledWith('p1', expect.objectContaining({
      precioActual: '43250.123456789012345',
      volumen24h: '100.5',
    }));
    spy.mockRestore();
  });

  test('precio inverso: 1 / 0.00002 = 50000 exacto (float da 49999.99999999999)', async () => {
    axios.get.mockResolvedValue({
      data: [{
        symbol: 'USDTBTC', lastPrice: '0.00002', quoteVolume: '50', priceChangePercent: '1.0',
      }],
    });
    const spy = jest.spyOn(priceService, 'updatePairPrice').mockResolvedValue();

    const par = { id: 'p2', criptoBase: { symbol: 'BTC' }, criptoQuote: { symbol: 'USDT' } };
    await priceService.updateFromBinance([par]);

    expect(spy).toHaveBeenCalledWith('p2', expect.objectContaining({ precioActual: '50000' }));
    spy.mockRestore();
  });
});
