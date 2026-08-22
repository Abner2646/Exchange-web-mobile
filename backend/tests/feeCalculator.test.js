// tests/feeCalculator.test.js
//
// Fase 1 — migración de feeCalculator a money.js. Antes calculaba fees con
// parseFloat + aritmética de Number (float binario), así que montos como
// 0.1 * 0.2 * fee arrastraban errores de coma y devolvían Number. Después de la
// migración: aritmética exacta con decimal.js y montos como string canónico.

jest.mock('../models', () => ({
  TradingPair: { findByPk: jest.fn() },
}));

const { TradingPair } = require('../models');
const feeCalculator = require('../services/trading/feeCalculator.service');

const pair = { symbol: 'BTC/USDT', makerFeePercent: '0.1', takerFeePercent: '0.2', lastPrice: '0.2' };

describe('feeCalculator.calculateBothSidesFees — fees exactos como string', () => {
  test('buyer maker / seller taker: fees exactos sin error de coma', () => {
    const fees = feeCalculator.calculateBothSidesFees(
      { tradingPair: pair, quantity: '0.1', price: '0.2' },
      true // buyerIsMaker
    );

    // buyer.fee = 0.1 * (0.1/100) = 0.0001 (base asset)
    expect(fees.buyer.fee).toBe('0.0001');
    expect(fees.buyer.feeCurrency).toBe('BTC');
    // seller.fee = (0.1*0.2) * (0.2/100) = 0.02 * 0.002 = 0.00004
    // Con float: 0.02000...4 * 0.002 = 0.00004000000000000001
    expect(fees.seller.fee).toBe('0.00004');
    expect(fees.seller.feeCurrency).toBe('USDT');
  });
});

describe('feeCalculator.calculateTradeFee — fee de un lado, exacto', () => {
  test('venta (taker): fee en quote, exacto', () => {
    const fee = feeCalculator.calculateTradeFee(
      { tradingPair: pair, quantity: '0.1', price: '0.2', side: 'sell' },
      false // taker
    );
    // (0.1*0.2) * (0.2/100) = 0.00004
    expect(fee.feeAmount).toBe('0.00004');
    expect(fee.feeCurrency).toBe('USDT');
  });
});

describe('feeCalculator.calculateOrderFee — usa la DB, fee exacto', () => {
  test('compra: fee en base asset, exacto', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    const fee = await feeCalculator.calculateOrderFee({
      tradingPairId: 'x', side: 'buy', quantity: '0.1', price: '0.2', orderType: 'limit',
    });
    // 0.1 * (0.2/100) = 0.0002
    expect(fee.feeAmount).toBe('0.0002');
    expect(fee.feeCurrency).toBe('BTC');
  });
});

describe('feeCalculator.calculateRequiredAmount — total con fee, exacto', () => {
  test('compra: totalValue + feeInQuote sin error de coma', async () => {
    TradingPair.findByPk.mockResolvedValue({ ...pair, quoteAssetId: 'q', baseAssetId: 'b' });
    const req = await feeCalculator.calculateRequiredAmount({
      tradingPairId: 'x', side: 'buy', quantity: '0.1', price: '0.2',
    });
    // totalValue = 0.02; feeInQuote = 0.02*0.002 = 0.00004; total = 0.02004
    // Con float: 0.020000000000000004 + 0.00004000000000000001 = 0.020040000000000004
    expect(req.requiredAmount).toBe('0.02004');
  });
});
