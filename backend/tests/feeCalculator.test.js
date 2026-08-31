// tests/feeCalculator.test.js
//
// Fase 1 — migración de feeCalculator a money.js: aritmética exacta con
// decimal.js y montos como string canónico (antes parseFloat/Number arrastraba
// error de coma). Endurecido 2026-08-31 con mutation testing (Stryker): además
// de los montos exactos, se aseveran el LADO del fee (buy→base, sell→quote), el
// feeType (maker/taker), el flag isMaker por lado, el uso del price pasado (no
// lastPrice), y el rechazo de par inexistente — todo lo que un mutante lógico
// (condición flipeada, string vaciado) hacía pasar antes sin que ningún test lo
// atrapara.

jest.mock('../models', () => ({
  TradingPair: { findByPk: jest.fn() },
}));

const { TradingPair } = require('../models');
const feeCalculator = require('../services/trading/feeCalculator.service');

beforeEach(() => jest.clearAllMocks());

const pair = { symbol: 'BTC/USDT', makerFeePercent: '0.1', takerFeePercent: '0.2', lastPrice: '0.2' };

describe('feeCalculator.calculateBothSidesFees', () => {
  test('buyer maker / seller taker: fee, feeCurrency, isMaker y feePercent por lado', () => {
    const fees = feeCalculator.calculateBothSidesFees(
      { tradingPair: pair, quantity: '0.1', price: '0.2' },
      true // buyerIsMaker
    );

    // buyer.fee = 0.1 * (0.1/100) = 0.0001 (base asset, maker)
    expect(fees.buyer.fee).toBe('0.0001');
    expect(fees.buyer.feeCurrency).toBe('BTC');
    expect(fees.buyer.isMaker).toBe(true);
    expect(fees.buyer.feePercent).toBe('0.1'); // maker

    // seller.fee = (0.1*0.2) * (0.2/100) = 0.02 * 0.002 = 0.00004 (quote, taker)
    expect(fees.seller.fee).toBe('0.00004');
    expect(fees.seller.feeCurrency).toBe('USDT');
    expect(fees.seller.isMaker).toBe(false); // es la negación del buyer, no el mismo valor
    expect(fees.seller.feePercent).toBe('0.2'); // taker
  });
});

describe('feeCalculator.calculateTradeFee', () => {
  test('venta (taker): fee en quote (USDT), feeType taker, exacto', () => {
    const fee = feeCalculator.calculateTradeFee(
      { tradingPair: pair, quantity: '0.1', price: '0.2', side: 'sell' },
      false // taker
    );
    expect(fee.feeAmount).toBe('0.00004'); // (0.1*0.2)*(0.2/100)
    expect(fee.feeCurrency).toBe('USDT');
    expect(fee.feeType).toBe('taker');
  });

  test('compra (taker): fee en base (BTC)', () => {
    const fee = feeCalculator.calculateTradeFee(
      { tradingPair: pair, quantity: '0.1', price: '0.2', side: 'buy' },
      false
    );
    expect(fee.feeCurrency).toBe('BTC'); // lado compra: fee en base, no en quote
    expect(fee.feeAmount).toBe('0.0002'); // 0.1*(0.2/100)
  });

  test('maker: feeType maker y usa makerFeePercent', () => {
    const fee = feeCalculator.calculateTradeFee(
      { tradingPair: pair, quantity: '0.1', price: '0.2', side: 'sell' },
      true // maker
    );
    expect(fee.feeType).toBe('maker');
    expect(fee.feePercent).toBe('0.1'); // maker, no taker
  });
});

describe('feeCalculator.calculateOrderFee (usa la DB)', () => {
  test('compra: fee en base (BTC), feeType taker, exacto', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    const fee = await feeCalculator.calculateOrderFee({
      tradingPairId: 'x', side: 'buy', quantity: '0.1', price: '0.2', orderType: 'limit',
    });
    expect(fee.feeAmount).toBe('0.0002'); // 0.1*(0.2/100)
    expect(fee.feeCurrency).toBe('BTC');
    expect(fee.feeType).toBe('taker'); // órdenes nuevas se asumen taker
  });

  test('venta: fee en quote (USDT), usando el price pasado (no lastPrice)', async () => {
    TradingPair.findByPk.mockResolvedValue(pair); // lastPrice 0.2
    // price 0.3 distinto de lastPrice: fija que el fee de venta usa el price pasado.
    const fee = await feeCalculator.calculateOrderFee({
      tradingPairId: 'x', side: 'sell', quantity: '0.1', price: '0.3', orderType: 'limit',
    });
    expect(fee.feeCurrency).toBe('USDT'); // lado venta: fee en quote, no en base
    // totalValue = 0.1*0.3 = 0.03; fee = 0.03*(0.2/100) = 0.00006 (con lastPrice 0.2 daría 0.00004)
    expect(fee.feeAmount).toBe('0.00006');
  });

  test('par inexistente → rechaza con "no encontrado"', async () => {
    TradingPair.findByPk.mockResolvedValue(null);
    await expect(feeCalculator.calculateOrderFee({
      tradingPairId: 'x', side: 'buy', quantity: '0.1', price: '0.2',
    })).rejects.toThrow(/no encontrado/i);
  });
});

describe('feeCalculator.calculateRequiredAmount', () => {
  test('compra: totalValue + feeInQuote, usando el price pasado (no lastPrice)', async () => {
    TradingPair.findByPk.mockResolvedValue({ ...pair, quoteAssetId: 'q', baseAssetId: 'b' });
    // price 0.3 distinto de lastPrice 0.2: fija que se usa el price pasado.
    const req = await feeCalculator.calculateRequiredAmount({
      tradingPairId: 'x', side: 'buy', quantity: '0.1', price: '0.3',
    });
    // totalValue = 0.1*0.3 = 0.03; feeInQuote = 0.03*(0.2/100) = 0.00006; total = 0.03006
    expect(req.requiredAmount).toBe('0.03006');
    expect(req.withoutFee).toBe('0.03');
    expect(req.assetNeeded).toBe('q');
  });

  test('venta: requiere base asset, cantidad exacta (sin fee reservado)', async () => {
    TradingPair.findByPk.mockResolvedValue({ ...pair, quoteAssetId: 'q', baseAssetId: 'b' });
    const req = await feeCalculator.calculateRequiredAmount({
      tradingPairId: 'x', side: 'sell', quantity: '0.1', price: '0.2',
    });
    expect(req.assetNeeded).toBe('b'); // base, no quote
    expect(req.requiredAmount).toBe('0.1');
  });

  test('par inexistente → rechaza con "no encontrado"', async () => {
    TradingPair.findByPk.mockResolvedValue(null);
    await expect(feeCalculator.calculateRequiredAmount({
      tradingPairId: 'x', side: 'buy', quantity: '0.1', price: '0.2',
    })).rejects.toThrow(/no encontrado/i);
  });
});
