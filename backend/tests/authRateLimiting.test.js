// tests/authRateLimiting.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #11: de los 11 rate limiters específicos
// de auth (middleware/rateLimiters.js), solo forgotPasswordLimiter y
// changePasswordLimiter estaban conectados en routes/usuario.routes.js —
// los otros 9, incluidos registerLimiter y loginLimiter (los que protegen
// contra fuerza bruta / spam de cuentas), estaban comentados.

process.env.JWT_SECRET = 'test-secret';

jest.mock('../models', () => ({
  Usuario: {},
  sequelize: {},
}));

jest.mock('../controllers/usuario.controller.js', () => {
  const ok = (req, res) => res.json({ success: true });
  return new Proxy({}, { get: () => ok });
});

const express = require('express');
const request = require('supertest');
const usuarioRoutes = require('../routes/usuario.routes.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/usuario', usuarioRoutes);
  return app;
}

describe('POST /usuario/register rate limiting (registerLimiter: 3/hora por IP)', () => {
  const app = buildApp();

  test('permite 3 intentos y bloquea el 4to con 429', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app).post('/usuario/register').send({});
      expect(res.status).toBe(200);
    }

    const fourth = await request(app).post('/usuario/register').send({});
    expect(fourth.status).toBe(429);
  });
});

describe('POST /usuario/login rate limiting (loginLimiter: 5/15min por email)', () => {
  const app = buildApp();

  test('permite 5 intentos y bloquea el 6to con 429', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/usuario/login')
        .send({ emailOrUsername: 'brute-force-target@example.com', password: 'x' });
      expect(res.status).toBe(200);
    }

    const sixth = await request(app)
      .post('/usuario/login')
      .send({ emailOrUsername: 'brute-force-target@example.com', password: 'x' });
    expect(sixth.status).toBe(429);
  });
});
