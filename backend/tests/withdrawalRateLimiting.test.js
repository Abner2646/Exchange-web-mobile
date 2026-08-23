// tests/withdrawalRateLimiting.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #11: en transaccionBlockchain.routes.js
// los 5 limiters de middleware/rateLimit.middleware.js estaban importados
// pero cada uso real comentado — incluido `withdrawal`, justo donde más
// importa dado que este mismo pipeline tuvo el bug de retiros roto
// (Críticos #8).

process.env.JWT_SECRET = 'test-secret';

const jwt = require('jsonwebtoken');

const mockUser = {
  id: 'user-1',
  activo: true,
  email: 'user@example.com',
  username: 'user1',
  rol: 'normal',
  kycVerificado: true,
  limiteDiarioUsd: 1000,
  emailVerificado: true,
  googleId: null,
  ultimoLogout: null,
};

jest.mock('../models', () => ({
  Usuario: { findByPk: jest.fn() },
  TransaccionBlockchain: {},
  Criptomoneda: {},
  BalanceUsuario: {},
  DireccionDeposito: {},
  // Required by idempotency.middleware (now wired into /withdraw)
  IdempotencyKey: { create: jest.fn().mockResolvedValue({}), findOne: jest.fn(), update: jest.fn(), destroy: jest.fn() },
}));

jest.mock('../controllers/transaccionBlockchain.controller', () => {
  const ok = (req, res) => res.json({ success: true });
  return new Proxy({}, { get: () => ok });
});

const { Usuario } = require('../models');
const express = require('express');
const request = require('supertest');
const transaccionBlockchainRoutes = require('../routes/transaccionBlockchain.routes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/transaccionBlockchain', transaccionBlockchainRoutes);
  return app;
}

function tokenFor(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET);
}

// Payload válido para el schema createWithdrawal (Joi corre después del rate
// limiter en la ruta): sin esto Joi devuelve 400 antes de llegar al controller
// mockeado, y el test no puede verificar el 200 previo al 429.
const validWithdrawal = {
  criptomonedaId: '11111111-1111-4111-8111-111111111111',
  cantidad: 0.5,
  direccionDestino: 'abcdefghij1234567890abcd',
};

describe('POST /transaccionBlockchain/withdraw rate limiting (withdrawal: 10/15min)', () => {
  const app = buildApp();
  const auth = `Bearer ${tokenFor(mockUser.id)}`;

  beforeEach(() => {
    Usuario.findByPk.mockResolvedValue(mockUser);
  });

  test('permite 10 intentos y bloquea el 11vo con 429', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/transaccionBlockchain/withdraw')
        .set('Authorization', auth)
        .set('Idempotency-Key', `rate-limit-test-key-${i}`)
        .send(validWithdrawal);
      expect(res.status).toBe(200);
    }

    const eleventh = await request(app)
      .post('/transaccionBlockchain/withdraw')
      .set('Authorization', auth)
      .send({});
    expect(eleventh.status).toBe(429);
  });
});
