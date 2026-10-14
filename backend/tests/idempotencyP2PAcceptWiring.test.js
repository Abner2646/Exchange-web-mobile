// backend/tests/idempotencyP2PAcceptWiring.test.js
// Proves the idempotency middleware is in the chain of the P2P accept endpoint
// (POST /transaccionP2P), which opens a transaction and locks the seller's funds
// (go-live gate §B.2). A valid POST with no Idempotency-Key must return 400 before
// the controller runs — and it must NOT gate the reads or the admin sub-paths.
const request = require('supertest');
const express = require('express');

jest.mock('../models', () => ({
  IdempotencyKey: { create: jest.fn(), findOne: jest.fn(), update: jest.fn(), destroy: jest.fn() },
  Sequelize: {},
}));
jest.mock('../middleware/authMiddleware.js', () => ({
  authenticateToken: (req, _res, nx) => { req.user = { id: 'user-1' }; nx(); },
  requireEmailVerified: (_req, _res, nx) => nx(),
}));
jest.mock('../middleware/adminMiddleware.js', () => ({ isAdmin: (_q, _s, n) => n(), isSuperAdmin: (_q, _s, n) => n() }));
jest.mock('../middleware/operatorMFA.middleware', () => (_q, _s, n) => n());

const ok201 = (_req, res) => res.status(201).json({ ok: true });
const ok200 = (_req, res) => res.status(200).json({ ok: true });

jest.mock('../modules/p2p/p2pTransaction.controller.js', () => ({
  createTransaccion: (_req, res) => res.status(201).json({ ok: true }),
  getMyTransacciones: ok200,
  getPendingTransacciones: ok200,
  getUserVolume: ok200,
  getTransactionHistory: ok200,
  confirmPayment: ok200,
  completeTransaction: ok200,
  cancelTransaction: ok200,
  getTransacciones: ok200,
  getTransaccionById: ok200,
  getTransaccionesByOferta: ok200,
  getTransaccionesStats: ok200,
  checkTimeouts: ok201,
  forceStatusChange: ok200,
}));

const p2pTxRoutes = require('../modules/p2p/p2pTransaction.routes');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/transaccionP2P', p2pTxRoutes);
  return app;
}

test('POST /transaccionP2P (accept offer) without Idempotency-Key -> 400', async () => {
  const res = await request(makeApp())
    .post('/transaccionP2P')
    .send({ offerId: '123e4567-e89b-12d3-a456-426614174000', amount: '1.5', paymentMethodId: 'pm1' });

  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
});

test('reads on /transaccionP2P are NOT gated by idempotency', async () => {
  const res = await request(makeApp()).get('/transaccionP2P/me/transacciones');
  expect(res.status).toBe(200);
});

test('admin POST /transaccionP2P/admin/check-timeouts is NOT gated by idempotency', async () => {
  const res = await request(makeApp()).post('/transaccionP2P/admin/check-timeouts').send({});
  expect(res.status).toBe(201);
});
