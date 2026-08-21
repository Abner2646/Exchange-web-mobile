// tests/joiValidationReconnected.test.js
//
// Cubre AUDITORIA_BACKEND.md Código muerto #10: los schemas de Joi en
// schemas/ existían pero ningún archivo de rutas los importaba. Al
// conectarlos apareció un bug real, nunca detectado porque el módulo
// nunca se había cargado en producción: transaccionBlockchain.schema.js
// usaba `.uuid({ version: 4 })`, pero Joi 17 espera `version: 'uuidv4'`
// (un string) — el módulo tiraba una excepción al cargarse, así que
// jamás hubiera funcionado ni siquiera si alguien lo hubiera conectado
// tal cual estaba.

process.env.JWT_SECRET = 'test-secret';

jest.mock('../models', () => ({
  Usuario: { findByPk: jest.fn() },
  sequelize: {},
  TransaccionBlockchain: {}, Criptomoneda: {}, BalanceUsuario: {}, DireccionDeposito: {},
}));
jest.mock('../controllers/usuario.controller.js', () => {
  const ok = (req, res) => res.json({ success: true, body: req.body });
  return new Proxy({}, { get: () => ok });
});
jest.mock('../controllers/transaccionBlockchain.controller', () => {
  const ok = (req, res) => res.json({ success: true, body: req.body });
  return new Proxy({}, { get: () => ok });
});

test('schemas/transaccionBlockchain.schema.js carga sin lanzar (antes crasheaba por .uuid({version: 4}))', () => {
  expect(() => require('../schemas/transaccionBlockchain.schema')).not.toThrow();
});

describe('POST /usuario/login valida el body con Joi antes del controller', () => {
  const express = require('express');
  const request = require('supertest');
  const usuarioRoutes = require('../routes/usuario.routes.js');

  function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/usuario', usuarioRoutes);
    return app;
  }

  test('body válido (emailOrUsername + password) llega al controller', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/usuario/login')
      .send({ emailOrUsername: 'user@example.com', password: 'x' });
    expect(res.status).toBe(200);
  });

  test('sin password: 400 antes de tocar el controller', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/usuario/login')
      .send({ emailOrUsername: 'user@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'password')).toBe(true);
  });

  test('sin emailOrUsername: 400 antes de tocar el controller', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/usuario/login')
      .send({ password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'emailOrUsername')).toBe(true);
  });
});

describe('POST /transaccionBlockchain/withdraw valida el body con Joi antes del controller', () => {
  const mockUser = {
    id: 'user-1', activo: true, email: 'user@example.com', username: 'user1',
    rol: 'normal', kycVerificado: true, limiteDiarioUsd: 1000,
    emailVerificado: true, googleId: null, ultimoLogout: null,
  };

  const jwt = require('jsonwebtoken');
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

  function auth() {
    return `Bearer ${jwt.sign({ id: mockUser.id }, process.env.JWT_SECRET)}`;
  }

  beforeEach(() => {
    Usuario.findByPk.mockResolvedValue(mockUser);
  });

  const validBody = {
    criptomonedaId: '11111111-1111-4111-8111-111111111111',
    cantidad: 0.5,
    direccionDestino: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  };

  test('body válido llega al controller', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/transaccionBlockchain/withdraw')
      .set('Authorization', auth())
      .send(validBody);
    expect(res.status).toBe(200);
  });

  test('criptomonedaId no-UUID: 400 antes de tocar el controller', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/transaccionBlockchain/withdraw')
      .set('Authorization', auth())
      .send({ ...validBody, criptomonedaId: 'not-a-uuid' });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'criptomonedaId')).toBe(true);
  });

  test('cantidad negativa: 400 antes de tocar el controller', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/transaccionBlockchain/withdraw')
      .set('Authorization', auth())
      .send({ ...validBody, cantidad: -5 });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'cantidad')).toBe(true);
  });

  test('direccionDestino demasiado corta: 400 antes de tocar el controller', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/transaccionBlockchain/withdraw')
      .set('Authorization', auth())
      .send({ ...validBody, direccionDestino: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field === 'direccionDestino')).toBe(true);
  });
});
