// tests/intercambioExchangeAdminAuthz.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #7: router.use(isAdmin) estaba
// comentado en las rutas administrativas de intercambioExchange, así que
// cualquier usuario autenticado (no solo admins) podía listar todos los
// intercambios y cambiar el estado de intercambios ajenos.

process.env.JWT_SECRET = 'test-secret';

jest.mock('../models', () => ({
  Usuario: { findByPk: jest.fn() },
  IntercambioExchange: { getAll: jest.fn().mockResolvedValue({ intercambios: [], total: 0 }) },
  ParExchange: {},
  BalanceUsuario: {},
  WalletMaestra: {},
  Criptomoneda: {},
  sequelize: { transaction: jest.fn() },
}));

const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const { Usuario } = require('../models');
const intercambioRoutes = require('../routes/intercambioExchange.routes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/intercambioExchange', intercambioRoutes);
  return app;
}

function tokenFor(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET);
}

describe('GET /intercambioExchange (ruta administrativa)', () => {
  const app = buildApp();

  beforeEach(() => jest.clearAllMocks());

  test('un usuario autenticado normal NO puede listar todos los intercambios', async () => {
    Usuario.findByPk.mockResolvedValue({
      id: 'user-1', activo: true, rol: 'usuario', emailVerificado: true,
    });

    const res = await request(app)
      .get('/intercambioExchange')
      .set('Authorization', `Bearer ${tokenFor('user-1')}`);

    expect(res.status).toBe(403);
  });

  test('un admin sí puede listar todos los intercambios', async () => {
    Usuario.findByPk.mockResolvedValue({
      id: 'admin-1', activo: true, rol: 'admin', emailVerificado: true,
    });

    const res = await request(app)
      .get('/intercambioExchange')
      .set('Authorization', `Bearer ${tokenFor('admin-1')}`);

    expect(res.status).toBe(200);
  });

  test('sin token, 401 antes de llegar a la autorización de admin', async () => {
    const res = await request(app).get('/intercambioExchange');
    expect(res.status).toBe(401);
  });
});
