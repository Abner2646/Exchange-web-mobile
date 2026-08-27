require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const { createFakeEmailService } = require('../helpers/fakeEmailService');
const { Usuario } = require('../../models');
const bcrypt = require('bcrypt');
const f = require('../helpers/factories');

let fakeEmail;
beforeEach(async () => {
  await resetDb();
  fakeEmail = createFakeEmailService();
  app.locals.emailService = fakeEmail;
});
afterAll(async () => {
  // Restore the real email service on the shared app singleton so a later suite
  // in the same worker does not inherit this file's fake.
  app.locals.emailService = require('../../services/email.service');
  await sequelize.close();
});

// Registers via HTTP and returns the token + the verification code the fake
// captured (never read from the DB). Shared by the Etapa 2 describe blocks.
async function registerAndGetCode({ email, username, password = 'password123' }) {
  const res = await request(app).post('/api/usuario/register').send({ email, username, password });
  const sent = fakeEmail.sent.find((s) => s.type === 'verificacion' && s.email === email);
  return { res, token: res.body.token, code: sent && sent.codigo };
}

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

describe('POST /api/usuario/login + GET /api/usuario/me', () => {
  // Seed-direct with a real bcrypt hash (seedUser's default passwordHash is a
  // placeholder). This sets up login quickly; the register happy-path test above
  // is what exercises the real registration path end to end.
  async function seedLoginUser() {
    const passwordHash = await bcrypt.hash('password123', 12);
    return f.seedUser({ email: 'loginuser@test.local', username: 'loginuser', passwordHash });
  }

  test('logs in with correct credentials and returns a usable token', async () => {
    await seedLoginUser();

    const res = await request(app)
      .post('/api/usuario/login')
      .send({ emailOrUsername: 'loginuser@test.local', password: 'password123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user.email).toBe('loginuser@test.local');
  });

  test('GET /me with the login token returns the profile (pins req.user, kills req.usuario regression)', async () => {
    const user = await seedLoginUser();

    const login = await request(app)
      .post('/api/usuario/login')
      .send({ emailOrUsername: 'loginuser@test.local', password: 'password123' });
    const token = login.body.token;

    const me = await request(app)
      .get('/api/usuario/me')
      .set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body.id).toBe(user.id);
    expect(me.body.email).toBe('loginuser@test.local');
  });
});

describe('auth rejections', () => {
  test('login with wrong password → 401', async () => {
    const passwordHash = await bcrypt.hash('password123', 12);
    await f.seedUser({ email: 'wrongpw@test.local', username: 'wrongpw', passwordHash });

    const res = await request(app)
      .post('/api/usuario/login')
      .send({ emailOrUsername: 'wrongpw@test.local', password: 'not-the-password' });

    expect(res.status).toBe(401);
  });

  test('login for a nonexistent user → 401', async () => {
    const res = await request(app)
      .post('/api/usuario/login')
      .send({ emailOrUsername: 'ghost@test.local', password: 'password123' });

    expect(res.status).toBe(401);
  });

  test('GET /me without a token → 401', async () => {
    const res = await request(app).get('/api/usuario/me');
    expect(res.status).toBe(401);
  });

  test('GET /me with a garbage token → 401', async () => {
    const res = await request(app)
      .get('/api/usuario/me')
      .set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/usuario/verify-email', () => {
  test('verifies the email with the emailed code and returns an updated token', async () => {
    const { token, code } = await registerAndGetCode({ email: 'verify@test.local', username: 'verifyuser' });
    expect(code).toBeTruthy();

    const res = await request(app)
      .post('/api/usuario/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: code });

    expect(res.status).toBe(200);
    expect(res.body.user.emailVerificado).toBe(true);
    expect(typeof res.body.token).toBe('string');

    const user = await Usuario.findOne({ where: { email: 'verify@test.local' } });
    expect(user.emailVerificado).toBe(true);
  });

  test('rejects a wrong verification code with 400', async () => {
    const { token } = await registerAndGetCode({ email: 'badcode@test.local', username: 'badcodeuser' });

    const res = await request(app)
      .post('/api/usuario/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: 'not-the-code' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/inv[aá]lido|expirado/i);

    const user = await Usuario.findOne({ where: { email: 'badcode@test.local' } });
    expect(user.emailVerificado).toBe(false);
  });
});
