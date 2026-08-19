// tests/setupWalletsStatusAuth.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #5: GET /setup-wallets/status usaba
// isSuperAdmin sin authenticateToken antes en la cadena — req.user nunca
// existía, así que devolvía 401 siempre, para cualquiera, incluido un
// super-admin real con un token válido.

process.env.JWT_SECRET = 'test-secret';

jest.mock('../models', () => ({
  Usuario: { findByPk: jest.fn() },
  WalletMaestra: {},
  Criptomoneda: {},
  sequelize: {},
}));

jest.mock('../controllers/setupWallets.controller', () => ({
  checkSetupStatus: (req, res) => res.json({ success: true }),
  executeCompleteSetup: (req, res) => res.json({ success: true }),
  resetCompleteSetup: (req, res) => res.json({ success: true }),
}));

const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const { Usuario } = require('../models');
const setupWalletsRoutes = require('../routes/setupWallets.routes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/setup-wallets', setupWalletsRoutes);
  return app;
}

function tokenFor(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET);
}

describe('GET /setup-wallets/status', () => {
  const app = buildApp();
  beforeEach(() => jest.clearAllMocks());

  test('sin token: 401', async () => {
    const res = await request(app).get('/setup-wallets/status');
    expect(res.status).toBe(401);
  });

  test('con token pero sin ser super_admin: 403, no 401', async () => {
    Usuario.findByPk.mockResolvedValue({ id: 'u1', activo: true, rol: 'admin', emailVerificado: true });

    const res = await request(app)
      .get('/setup-wallets/status')
      .set('Authorization', `Bearer ${tokenFor('u1')}`);

    expect(res.status).toBe(403);
  });

  test('un super_admin real con token válido ya no recibe 401', async () => {
    Usuario.findByPk.mockResolvedValue({ id: 'admin1', activo: true, rol: 'super_admin', emailVerificado: true });

    const res = await request(app)
      .get('/setup-wallets/status')
      .set('Authorization', `Bearer ${tokenFor('admin1')}`);

    expect(res.status).toBe(200);
  });
});
