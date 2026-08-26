require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const { createFakeEmailService } = require('../helpers/fakeEmailService');
const { Usuario } = require('../../models');

let fakeEmail;
beforeEach(async () => {
  await resetDb();
  fakeEmail = createFakeEmailService();
  app.locals.emailService = fakeEmail;
});
afterAll(async () => { await sequelize.close(); });

describe('POST /api/usuario/register', () => {
  test('creates an active-unverified user, returns a token, emails exactly one verification code', async () => {
    const res = await request(app)
      .post('/api/usuario/register')
      .send({ email: 'newuser@test.local', username: 'newuser', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.requiresEmailVerification).toBe(true);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.emailVerificado).toBe(false);

    const user = await Usuario.findOne({ where: { email: 'newuser@test.local' } });
    expect(user).not.toBeNull();
    expect(user.activo).toBe(true);          // characterize entity default
    expect(user.emailVerificado).toBe(false);

    // exactly one verification email, to this address, carrying a non-empty code
    const verifications = fakeEmail.sent.filter((s) => s.type === 'verificacion');
    expect(verifications).toHaveLength(1);
    expect(verifications[0].email).toBe('newuser@test.local');
    expect(verifications[0].codigo).toBeTruthy();

    // the code is NOT leaked in the HTTP response
    expect(JSON.stringify(res.body)).not.toContain(verifications[0].codigo);
  });
});

describe('POST /api/usuario/register — rejections', () => {
  test('rejects a duplicate email/username', async () => {
    const body = { email: 'dupe@test.local', username: 'dupe', password: 'password123' };
    const first = await request(app).post('/api/usuario/register').send(body);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/usuario/register').send(body);
    expect(second.status).toBe(400);
    expect(second.body.error).toMatch(/en uso/i);
  });

  test('rejects a password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/usuario/register')
      .send({ email: 'weak@test.local', username: 'weak', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 caracteres/i);
  });
});
