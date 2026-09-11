// backend/tests/tradingErrorEnvelope.test.js
const request = require('supertest');
const express = require('express');

jest.mock('../models', () => ({ Order: { create: jest.fn(), findByPk: jest.fn() }, TradingPair: { findByPk: jest.fn() }, Trade: {} }));
jest.mock('../modules/trading/orderBook.service', () => ({ matchOrder: jest.fn().mockResolvedValue({ matched: false, trades: [] }) }));
jest.mock('../modules/trading/orderValidator.service', () => ({ validateOrder: jest.fn() }));
jest.mock('../modules/trading/balanceManager.service', () => ({ checkSufficientBalance: jest.fn(), lockBalanceForOrder: jest.fn() }));
jest.mock('../modules/trading/feeCalculator.service', () => ({ calculateOrderFee: jest.fn() }));
jest.mock('../modules/trading/tradeExecutor.service', () => ({}));

const { TradingPair } = require('../models');
const orderValidator = require('../modules/trading/orderValidator.service');
const balanceManager = require('../modules/trading/balanceManager.service');
const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');
const tradingController = require('../modules/trading/trading.controller');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'u1' }; next(); });
  app.post('/trading/orders', asyncHandler(tradingController.createOrder));
  app.use(errorHandler);
  return app;
}

const body = { tradingPairId: 'p', orderType: 'limit', side: 'buy', quantity: '1', price: '2' };

beforeEach(() => jest.clearAllMocks());

test('insufficient balance -> 400 INSUFFICIENT_BALANCE (canonical envelope)', async () => {
  TradingPair.findByPk.mockResolvedValue({ id: 'p', status: 'active', quoteAssetId: 'q', baseAssetId: 'b' });
  orderValidator.validateOrder.mockResolvedValue({ valid: true });
  balanceManager.checkSufficientBalance.mockResolvedValue({ sufficient: false, error: 'Saldo insuficiente' });

  const res = await request(buildApp()).post('/trading/orders').send(body);
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: { code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente' } });
});

test('unexpected service throw -> sanitized 500, no leak', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  TradingPair.findByPk.mockRejectedValue(new Error('DB exploded: table orders'));

  const res = await request(buildApp()).post('/trading/orders').send(body);
  expect(res.status).toBe(500);
  expect(res.body.error.code).toBe('INTERNAL_ERROR');
  expect(res.text).not.toContain('table orders');
  spy.mockRestore();
});
