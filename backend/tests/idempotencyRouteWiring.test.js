// backend/tests/idempotencyRouteWiring.test.js
// Proves the idempotency middleware is actually in the /trading/orders chain:
// a valid POST with no Idempotency-Key returns 400 before the controller runs.
const request = require('supertest');
const express = require('express');

jest.mock('../models', () => ({
  IdempotencyKey: { create: jest.fn(), findOne: jest.fn(), update: jest.fn(), destroy: jest.fn() },
  Sequelize: {}
}));
jest.mock('../middleware/authMiddleware.js', () => ({
  authenticateToken: (req, _res, nx) => { req.user = { id: 'user-1' }; nx(); },
  requireEmailVerified: (_req, _res, nx) => nx()
}));
jest.mock('../middleware/adminMiddleware.js', () => ({ isAdmin: (_q, _s, n) => n(), isSuperAdmin: (_q, _s, n) => n() }));

// Stub every method trading.controller uses in the route file
const noop = (_req, res) => res.status(200).json({});
jest.mock('../controllers/trading.controller', () => ({
  createOrder: (_req, res) => res.status(201).json({ ok: true }),
  cancelOrder: noop,
  getUserOrders: noop,
  getUserActiveOrders: noop,
  getOrderDetail: noop,
  getOrderBook: noop,
  getOrderBookStats: noop,
  getSpread: noop,
  getTradingBalance: noop
}));
jest.mock('../controllers/trades.controller', () => ({
  getRecentTrades: noop,
  getUserTrades: noop,
  getUserTradeStats: noop,
  getTradeDetail: noop,
  getChartData: noop,
  getBinanceChartData: noop,
  getTradingPairStats: noop,
  getVolumeStats: noop,
  getTickers: noop,
  getUserTradingSummary: noop
}));
jest.mock('../controllers/tradingPairs.controller', () => ({
  getAllPairs: noop,
  getActivePairs: noop,
  getTopPairs: noop,
  getPairsStats: noop,
  getPairBySymbol: noop,
  getPairDetail: noop,
  autoCreatePairs: noop,
  createPair: noop,
  updatePair: noop,
  updatePairStatus: noop
}));

const tradingRoutes = require('../routes/trading.routes');

test('POST /trading/orders without Idempotency-Key -> 400', async () => {
  const app = express();
  app.use(express.json());
  app.use('/trading', tradingRoutes);

  const res = await request(app).post('/trading/orders').send({
    tradingPairId: '123e4567-e89b-12d3-a456-426614174000',
    orderType: 'limit',
    side: 'buy',
    quantity: 1.5,
    price: 45000.5
  });

  expect(res.status).toBe(400);
  expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
});
