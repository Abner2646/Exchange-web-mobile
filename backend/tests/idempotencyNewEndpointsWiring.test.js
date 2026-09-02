// backend/tests/idempotencyNewEndpointsWiring.test.js
// Proves the idempotency middleware is in the chain of the two money endpoints
// added with the ledger + Spot work (surfaced by the PR #12 review): the swap
// (POST /intercambioExchange/) and the Funding<->Spot transfer
// (POST /balances/my/transfer). A valid POST with no Idempotency-Key returns 400
// before the controller runs.
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
jest.mock('../middleware/rateLimit.middleware.js', () => ({ general: (_q, _s, n) => n(), withdrawal: (_q, _s, n) => n() }));

const noop = (_req, res) => res.status(200).json({});

// intercambioExchange.controller: createOrder is the swap execution (POST /).
jest.mock('../controllers/intercambioExchange.controller', () => ({
  createOrder: (_req, res) => res.status(201).json({ ok: true }),
  calculateExchange: noop,
  checkTransactionLimit: noop,
  getMyIntercambios: noop,
  getMyBalances: noop,
  getMyDailyVolume: noop,
  getMyTradingSummary: noop,
  getIntercambios: noop,
  searchIntercambios: noop,
  getIntercambioStats: noop,
  getIntercambioById: noop,
  updateIntercambioStatus: noop,
  getTopTraders: noop,
  getMarketSummary: noop,
  getStatsByCrypto: noop,
  getPriceHistory: noop,
  getLastPrice: noop,
  getVolumeByPair: noop
}));

// balanceUsuario.controller: transferMisCompartimentos is the Funding<->Spot transfer.
jest.mock('../controllers/balanceUsuario.controller', () => ({
  getMyBalances: noop,
  transferMisCompartimentos: (_req, res) => res.status(200).json({ ok: true }),
  updateBalance: noop,
  reclamarBtc: noop,
  getBalances: noop,
  getBalanceStats: noop,
  getBalancesByUser: noop,
  getBalanceByUserAndCrypto: noop,
  getTotalBalance: noop,
  checkAvailableBalance: noop,
  blockBalance: noop,
  unblockBalance: noop,
  transferBalance: noop,
  getUsersWithBalance: noop
}));

const intercambioRoutes = require('../routes/intercambioExchange.routes');
const balanceRoutes = require('../routes/balanceUsuario.routes');

test('POST /intercambioExchange/ (swap) without Idempotency-Key -> 400', async () => {
  const app = express();
  app.use(express.json());
  app.use('/intercambioExchange', intercambioRoutes);

  const res = await request(app).post('/intercambioExchange/').send({
    parId: '123e4567-e89b-12d3-a456-426614174000',
    tipo: 'compra',
    cantidadBase: 0.5
  });

  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
});

test('POST /balances/my/transfer (Funding<->Spot) without Idempotency-Key -> 400', async () => {
  const app = express();
  app.use(express.json());
  app.use('/balances', balanceRoutes);

  const res = await request(app).post('/balances/my/transfer').send({
    criptomonedaId: '123e4567-e89b-12d3-a456-426614174000',
    origen: 'funding',
    destino: 'spot',
    cantidad: '1.0'
  });

  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
});
