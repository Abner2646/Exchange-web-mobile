require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const businessConfig = require('../../services/config/businessConfig');

// Radar #13 — CRUD de admin sobre la config de negocio persistida, guardado por
// isAdmin + requireOperatorMFA (Fase 4.9). Verifica el flujo end-to-end y que el
// servicio lee el valor persistido (no el hardcode).
beforeEach(async () => { await resetDb(); businessConfig.clearCache(); });
afterAll(async () => { await sequelize.close(); });

const adminConMFA = () => f.seedUser({ rol: 'admin', dosFactoresActivado: true });

describe('config de negocio (admin CRUD)', () => {
  test('un operador con 2FA crea/lee/lista config, y el servicio la ve', async () => {
    const admin = await adminConMFA();

    const put = await request(app).put('/api/config/confirmaciones.bitcoin')
      .set(f.authHeader(admin))
      .send({ valor: '3', tipo: 'number', categoria: 'blockchain', descripcion: 'Confirmaciones BTC' });
    expect(put.status).toBe(200);

    const get = await request(app).get('/api/config/confirmaciones.bitcoin').set(f.authHeader(admin));
    expect(get.status).toBe(200);
    expect(get.body.data.valor).toBe('3');

    const list = await request(app).get('/api/config').set(f.authHeader(admin));
    expect(list.status).toBe(200);
    expect(list.body.data.map((c) => c.clave)).toContain('confirmaciones.bitcoin');

    // El servicio lee el valor persistido (no el default hardcodeado).
    expect(await businessConfig.getNumber('confirmaciones.bitcoin', 6)).toBe(3);
  });

  test('un usuario normal no puede tocar la config (403)', async () => {
    const user = await f.seedUser();
    const res = await request(app).get('/api/config').set(f.authHeader(user));
    expect(res.status).toBe(403);
  });

  test('un admin SIN 2FA es rechazado por el guard de operador (403 OPERATOR_MFA_REQUIRED)', async () => {
    const admin = await f.seedUser({ rol: 'admin', dosFactoresActivado: false });
    const res = await request(app).put('/api/config/x').set(f.authHeader(admin)).send({ valor: '1' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OPERATOR_MFA_REQUIRED');
  });

  test('clave inexistente → 404 CONFIG_NOT_FOUND', async () => {
    const admin = await adminConMFA();
    const res = await request(app).get('/api/config/no.existe').set(f.authHeader(admin));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CONFIG_NOT_FOUND');
  });

  test('valor faltante → 400 CONFIG_INVALID_INPUT', async () => {
    const admin = await adminConMFA();
    const res = await request(app).put('/api/config/alguna.clave').set(f.authHeader(admin)).send({ tipo: 'number' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CONFIG_INVALID_INPUT');
  });
});
