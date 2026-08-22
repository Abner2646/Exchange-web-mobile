// tests/orderBook.test.js
//
// Fase 1 — migración del motor de matching a money.js. matchOrder llevaba la
// cantidad restante y el matchQuantity (Math.min) en float binario y se los
// pasaba a executeTrade: la cantidad REALMENTE tradeada (la que mueve saldos)
// salía contaminada (0.3 - 0.1 = 0.19999999999999998). determineExecutionPrice
// y getBestPrice devolvían Number. Después: aritmética exacta y montos como
// string canónico.

jest.mock('../models', () => ({
  Order: { findByPk: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), canBeMatched: jest.fn() },
  Trade: {},
  TradingPair: { findByPk: jest.fn() },
  sequelize: { transaction: jest.fn(), fn: jest.fn(), col: jest.fn() },
}));
jest.mock('../services/trading/tradeExecutor.service', () => ({
  executeTrade: jest.fn(),
}));

const { Order, TradingPair, sequelize } = require('../models');
const tradeExecutor = require('../services/trading/tradeExecutor.service');
const orderBook = require('../services/trading/orderBook.service');

beforeEach(() => jest.clearAllMocks());

describe('determineExecutionPrice — precio del maker como string exacto', () => {
  test('comprador maker: devuelve su precio como string', () => {
    const buyer = { side: 'buy', price: '0.1', createdAt: new Date(1) };
    const seller = { side: 'sell', price: '0.2', createdAt: new Date(2) };
    expect(orderBook.determineExecutionPrice(buyer, seller)).toBe('0.1');
  });
});

describe('getBestPrice — precio como string o null', () => {
  test('devuelve el precio del mejor postor como string', async () => {
    Order.findOne.mockResolvedValue({ price: '0.5' });
    expect(await orderBook.getBestPrice('p', 'buy')).toBe('0.5');
  });

  test('devuelve null si no hay liquidez', async () => {
    Order.findOne.mockResolvedValue(null);
    expect(await orderBook.getBestPrice('p', 'buy')).toBe(null);
  });
});

describe('matchOrder — cantidad tradeada exacta hacia executeTrade', () => {
  test('el matchQuantity del segundo fill no arrastra error de coma', async () => {
    const tx = { LOCK: { UPDATE: 'UPDATE' }, commit: jest.fn(), rollback: jest.fn() };
    sequelize.transaction.mockResolvedValue(tx);

    const order = {
      id: 'order123abcdef00', tradingPairId: 'p', userId: 'u1', side: 'buy',
      price: '0.5', orderType: 'limit', status: 'pending',
      quantity: '0.3', quantityRemaining: '0.3', createdAt: new Date(1000),
      update: jest.fn(),
    };
    const updatedOrder = { ...order };
    Order.findByPk.mockResolvedValueOnce(order).mockResolvedValueOnce(updatedOrder);
    Order.canBeMatched.mockReturnValue(true);

    const tradingPair = { id: 'p', symbol: 'BTC/USDT' };
    TradingPair.findByPk.mockResolvedValue(tradingPair);

    // Dos ventas: 0.1 y 0.2. Tras el primer fill, remaining = 0.3 - 0.1 = 0.2.
    // En float sería 0.19999999999999998 y el segundo matchQuantity heredaría el error.
    Order.findAll.mockResolvedValue([
      { id: 'm1', userId: 'u2', side: 'sell', price: '0.5', quantityRemaining: '0.1', createdAt: new Date(2000) },
      { id: 'm2', userId: 'u3', side: 'sell', price: '0.5', quantityRemaining: '0.2', createdAt: new Date(3000) },
    ]);

    tradeExecutor.executeTrade.mockResolvedValue({ id: 'trade789abcdef0' });

    const result = await orderBook.matchOrder('order123abcdef00');

    // Segundo fill: matchQuantity exacto = 0.2 (no 0.19999999999999998)
    expect(tradeExecutor.executeTrade).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ quantity: '0.2', price: '0.5' }),
      tx
    );
    expect(result.totalMatched).toBe('0.3');
  });
});

describe('getSpread — spread y % exactos como string', () => {
  test('spread = ask - bid sin error de coma', async () => {
    Order.findOne
      .mockResolvedValueOnce({ price: '0.2' })  // bestBid
      .mockResolvedValueOnce({ price: '0.5' }); // bestAsk

    const r = await orderBook.getSpread('p');

    expect(r.bid).toBe('0.2');
    expect(r.ask).toBe('0.5');
    expect(r.spread).toBe('0.3');       // float: 0.30000000000000004
    expect(r.spreadPercent).toBe('150'); // 0.3 / 0.2 * 100
  });
});
