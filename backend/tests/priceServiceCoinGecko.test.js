// tests/priceServiceCoinGecko.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #1: getPriceFromCoinGecko usaba
// PriceService.COINGECKO_MAP y this.coingeckoBaseURL sin que ninguno de
// los dos estuviera definido — TypeError garantizado, silenciado por el
// catch de getPrice() que cae a Binance sin que nadie note que CoinGecko
// nunca funcionó.

jest.mock('../models/index.js', () => ({ ParExchange: {} }));
jest.mock('axios');

const axios = require('axios');
const priceService = require('../services/priceService');

describe('PriceService CoinGecko', () => {
  test('COINGECKO_MAP y coingeckoBaseURL están definidos', () => {
    expect(priceService.coingeckoBaseURL).toBe('https://api.coingecko.com/api/v3');
    expect(priceService.constructor.COINGECKO_MAP.BTC).toBe('bitcoin');
    expect(priceService.constructor.COINGECKO_MAP.ETH).toBe('ethereum');
  });

  test('getPriceFromCoinGecko ya no tira TypeError, hace la request real', async () => {
    axios.get.mockResolvedValue({ data: { bitcoin: { usd: 65000 } } });

    const price = await priceService.getPriceFromCoinGecko('BTC', 'USD');

    expect(price).toBe(65000);
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.coingecko.com/api/v3/simple/price',
      expect.objectContaining({ params: expect.objectContaining({ ids: 'bitcoin', vs_currencies: 'usd' }) })
    );
  });

  test('getPrice() usa CoinGecko como fuente primaria cuando responde bien (no cae a Binance)', async () => {
    axios.get.mockResolvedValue({ data: { ethereum: { usd: 3200 } } });

    const result = await priceService.getPrice('ETH', 'USD');

    expect(result.source).toBe('coingecko');
    expect(result.price).toBe(3200);
  });
});
