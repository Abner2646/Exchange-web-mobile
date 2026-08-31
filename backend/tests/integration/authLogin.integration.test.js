require('../helpers/testEnv');
const request = require('supertest');
const { app, installAuthHarness } = require('../helpers/authHarness');
const bcrypt = require('bcrypt');
const f = require('../helpers/factories');

installAuthHarness();

describe('POST /api/usuario/login + GET /api/usuario/me', () => {
  // Seed-direct with a real bcrypt hash (seedUser's default passwordHash is a
  // placeholder). This sets up login quickly; the register happy-path test in
  // authRegister is what exercises the real registration path end to end.
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
