// tests/tradingIsAdminCheck.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #4: trading.controller.js y
// trades.controller.js chequeaban req.user.isAdmin, que nunca existe
// (authMiddleware solo setea req.user.rol) — ningún admin podía ver
// órdenes/trades ajenos pese a que el código aparentaba permitirlo.

jest.mock('../models', () => ({
  Order: { getById: jest.fn() },
  Trade: { getById: jest.fn() },
  TradingPair: {},
  PriceCandle: {},
  Criptomoneda: {},
}));
jest.mock('../services/trading/orderBook.service', () => ({}));
jest.mock('../services/trading/orderValidator.service', () => ({}));
jest.mock('../services/trading/balanceManager.service', () => ({}));
jest.mock('../services/trading/feeCalculator.service', () => ({}));
jest.mock('../services/trading/tradeExecutor.service', () => ({}));

const { Order, Trade } = require('../models');
const tradingController = require('../controllers/trading.controller');
const tradesController = require('../controllers/trades.controller');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('trading.controller.getOrderDetail — chequeo de admin', () => {
  beforeEach(() => jest.clearAllMocks());

  test('un admin SÍ puede ver la orden de otro usuario', async () => {
    Order.getById.mockResolvedValue({ id: 'o1', userId: 'dueño-de-la-orden' });

    const req = { params: { orderId: 'o1' }, user: { id: 'admin-1', rol: 'admin' } };
    const res = mockRes();

    await tradingController.getOrderDetail(req, res);

    expect(res.statusCode).not.toBe(403);
  });

  test('un usuario normal NO puede ver la orden de otro usuario', async () => {
    Order.getById.mockResolvedValue({ id: 'o1', userId: 'dueño-de-la-orden' });

    const req = { params: { orderId: 'o1' }, user: { id: 'otro-usuario', rol: 'normal' } };
    const res = mockRes();

    await tradingController.getOrderDetail(req, res);

    expect(res.statusCode).toBe(403);
  });
});

describe('trades.controller.getTradeDetail — chequeo de admin', () => {
  beforeEach(() => jest.clearAllMocks());

  test('un admin SÍ puede ver un trade ajeno', async () => {
    Trade.getById.mockResolvedValue({ id: 't1', buyerId: 'b', sellerId: 's' });

    const req = { params: { tradeId: 't1' }, user: { id: 'admin-1', rol: 'super_admin' } };
    const res = mockRes();

    await tradesController.getTradeDetail(req, res);

    expect(res.statusCode).not.toBe(403);
  });

  test('un usuario ajeno al trade NO puede verlo', async () => {
    Trade.getById.mockResolvedValue({ id: 't1', buyerId: 'b', sellerId: 's' });

    const req = { params: { tradeId: 't1' }, user: { id: 'otro-usuario', rol: 'normal' } };
    const res = mockRes();

    await tradesController.getTradeDetail(req, res);

    expect(res.statusCode).toBe(403);
  });
});
