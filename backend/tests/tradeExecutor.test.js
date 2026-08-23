// tests/tradeExecutor.test.js
//
// Fase 1 — migración de tradeExecutor a money.js. Tenía float propio en tres
// lugares: el totalValue del trade (quantity*price), el precio promedio
// ponderado de la orden (updateOrderAfterTrade) y las estadísticas del par
// (volumen/high/low). Todos arrastraban error de coma. Después: aritmética
// exacta con decimal.js y valores como string canónico (columnas DECIMAL).

jest.mock('../models', () => ({
  Trade: { create: jest.fn() },
  Order: {},
  TradingPair: { findByPk: jest.fn() },
  sequelize: { transaction: jest.fn() },
}));
jest.mock('../services/trading/balanceManager.service', () => ({
  updateBalancesAfterTrade: jest.fn(),
  unlockBalanceFromOrder: jest.fn(),
}));
jest.mock('../services/trading/feeCalculator.service', () => ({
  calculateBothSidesFees: jest.fn(),
}));

const { Trade, TradingPair } = require('../models');
const feeCalculator = require('../services/trading/feeCalculator.service');
const tradeExecutor = require('../services/trading/tradeExecutor.service');

beforeEach(() => jest.clearAllMocks());

describe('updateOrderAfterTrade — filled/remaining/averagePrice exactos', () => {
  test('llenado parcial: promedio ponderado sin error de coma', async () => {
    const order = {
      quantityFilled: '0.1', quantity: '0.5', averagePrice: '0.2',
      update: jest.fn(),
    };

    await tradeExecutor.updateOrderAfterTrade(order, '0.1', '0.4', true, {});

    // newFilled = 0.1+0.1 = 0.2 ; newRemaining = 0.5-0.2 = 0.3 (float: 0.30000000000000004)
    // prevTotal = 0.1*0.2 = 0.02 ; newTotal = 0.1*0.4 = 0.04 ; avg = 0.06/0.2 = 0.3
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        quantityFilled: '0.2',
        quantityRemaining: '0.3',
        averagePrice: '0.3',
        makerOrTaker: 'maker',
        status: 'partially_filled',
      }),
      { transaction: {} }
    );
  });

  test('llenado total: remaining colapsa a "0" y status filled', async () => {
    const order = {
      quantityFilled: '0', quantity: '0.1', averagePrice: '0',
      update: jest.fn(),
    };

    await tradeExecutor.updateOrderAfterTrade(order, '0.1', '0.2', false, {});

    const arg = order.update.mock.calls[0][0];
    expect(arg.quantityRemaining).toBe('0');
    expect(arg.status).toBe('filled');
    expect(arg.averagePrice).toBe('0.2'); // (0 + 0.1*0.2)/0.1 = 0.2
    expect(arg.makerOrTaker).toBe('taker');
    expect(arg.executedAt).toBeInstanceOf(Date);
  });
});

describe('executeTrade — totalValue exacto', () => {
  test('totalValue = quantity*price sin error de coma', async () => {
    feeCalculator.calculateBothSidesFees.mockReturnValue({
      buyer: { fee: '0', feePercent: '0', isMaker: true },
      seller: { fee: '0', feePercent: '0', isMaker: false },
    });
    Trade.create.mockResolvedValue({ id: 't', price: '0.2', quantity: '0.1' });
    jest.spyOn(tradeExecutor, 'updateOrderAfterTrade').mockResolvedValue();
    jest.spyOn(tradeExecutor, 'updateTradingPairStats').mockResolvedValue();

    const buyOrder = {
      id: 'bo', tradingPairId: 'p', userId: 'b',
      createdAt: new Date(1), tradingPair: {}, tradingType: 'spot',
    };
    const sellOrder = { id: 'so', userId: 's', createdAt: new Date(2) };

    await tradeExecutor.executeTrade({ buyOrder, sellOrder, quantity: '0.1', price: '0.2' }, {});

    // 0.1 * 0.2 = 0.02 (float: 0.020000000000000004)
    expect(Trade.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalValue: '0.02' }),
      { transaction: {} }
    );

    tradeExecutor.updateOrderAfterTrade.mockRestore();
    tradeExecutor.updateTradingPairStats.mockRestore();
  });
});

describe('updateTradingPairStats — volumen/high/low exactos', () => {
  test('acumula volumen y ajusta high/low sin error de coma', async () => {
    const pair = {
      volume24h: '0.1', high24h: '0.3', low24h: '0.5',
      update: jest.fn(),
    };
    TradingPair.findByPk.mockResolvedValue(pair);

    await tradeExecutor.updateTradingPairStats('p', { price: '0.4', quantity: '0.2' }, {});

    // newVolume = 0.1 + 0.2 = 0.3 (float: 0.30000000000000004)
    // price 0.4 > high 0.3 -> high 0.4 ; price 0.4 < low 0.5 -> low 0.4
    expect(pair.update).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPrice: '0.4',
        volume24h: '0.3',
        high24h: '0.4',
        low24h: '0.4',
      }),
      { transaction: {} }
    );
  });
});
