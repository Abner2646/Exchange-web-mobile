require('../helpers/testEnv');
const request = require('supertest');
const { app, installAuthHarness } = require('../helpers/authHarness');
const { Usuario } = require('../../models');
const bcrypt = require('bcrypt');
const f = require('../helpers/factories');

const h = installAuthHarness();

// Seeds an email-verified, active user with 2FA enabled and a real bcrypt hash
// so password login reaches the 2FA branch of loginStep1.
async function seed2FAUser({ email, username }) {
  const passwordHash = await bcrypt.hash('password123', 12);
  return f.seedUser({ email, username, passwordHash, dosFactoresActivado: true });
}

// Logs in step 1 and returns the temporalToken + the 2FA code the fake captured.
async function login2FA(email) {
  const res = await request(app)
    .post('/api/usuario/login')
    .send({ emailOrUsername: email, password: 'password123' });
  const sent = h.fake.sent.find((s) => s.type === '2fa' && s.email === email);
  return { res, temporalToken: res.body.temporalToken, code: sent && sent.codigo };
}

describe('POST /api/usuario/login (2FA enabled) + /verify-2fa', () => {
  test('login returns a temporal token and emails a code; verify-2fa completes login', async () => {
    await seed2FAUser({ email: '2fa@test.local', username: '2fauser' });

    const { res, temporalToken, code } = await login2FA('2fa@test.local');

    // Step 1 does not complete the login: no real token, just requires2FA + temporal token.
    expect(res.status).toBe(200);
    expect(res.body.requires2FA).toBe(true);
    expect(typeof temporalToken).toBe('string');
    expect(res.body.token).toBeUndefined();

    // Exactly one 2FA code emailed to this address.
    const codes = h.fake.sent.filter((s) => s.type === '2fa' && s.email === '2fa@test.local');
    expect(codes).toHaveLength(1);
    expect(code).toBeTruthy();

    // The code is NOT leaked in the step-1 response.
    expect(JSON.stringify(res.body)).not.toContain(code);

    // Step 2: verifying with the emailed code completes login with a usable token.
    const verify = await request(app)
      .post('/api/usuario/verify-2fa')
      .send({ temporalToken, codigo: code });

    expect(verify.status).toBe(200);
    expect(typeof verify.body.token).toBe('string');

    const me = await request(app)
      .get('/api/usuario/me')
      .set('Authorization', `Bearer ${verify.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('2fa@test.local');
  });

  test('verify-2fa rejects a wrong code with 400', async () => {
    await seed2FAUser({ email: '2fabad@test.local', username: '2fabaduser' });
    const { temporalToken } = await login2FA('2fabad@test.local');

    const verify = await request(app)
      .post('/api/usuario/verify-2fa')
      .send({ temporalToken, codigo: '000000' });

    expect(verify.status).toBe(400);
    expect(verify.body.error).toMatch(/inv[aá]lido|expirado/i);
  });

  test('verify-2fa rejects a garbage temporal token with 400', async () => {
    const verify = await request(app)
      .post('/api/usuario/verify-2fa')
      .send({ temporalToken: 'not-a-real-jwt', codigo: '123456' });

    expect(verify.status).toBe(400);
  });
});

describe('POST /api/usuario/resend-2fa', () => {
  test('re-emails a new 2FA code that completes login', async () => {
    await seed2FAUser({ email: '2faresend@test.local', username: '2faresenduser' });
    const { temporalToken } = await login2FA('2faresend@test.local');

    const resend = await request(app)
      .post('/api/usuario/resend-2fa')
      .send({ temporalToken });
    expect(resend.status).toBe(200);

    // Two 2FA emails now: the login one + the resend one; the latest one works.
    const codes = h.fake.sent.filter((s) => s.type === '2fa' && s.email === '2faresend@test.local');
    expect(codes).toHaveLength(2);
    const newCode = codes[1].codigo;
    expect(newCode).toBeTruthy();

    const verify = await request(app)
      .post('/api/usuario/verify-2fa')
      .send({ temporalToken, codigo: newCode });
    expect(verify.status).toBe(200);
    expect(typeof verify.body.token).toBe('string');
  });
});

describe('PATCH /api/usuario/me/2fa-toggle', () => {
  test('enabling 2FA flips the flag and notifies by email', async () => {
    const user = await f.seedUser({ email: '2fatoggle@test.local', username: '2fatoggleuser' });
    expect(user.dosFactoresActivado).toBe(false);

    const res = await request(app)
      .patch('/api/usuario/me/2fa-toggle')
      .set(f.authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.dosFactoresActivado).toBe(true);

    const reloaded = await Usuario.findByPk(user.id);
    expect(reloaded.dosFactoresActivado).toBe(true);

    const changes = h.fake.sent.filter((s) => s.type === '2faChange' && s.email === '2fatoggle@test.local');
    expect(changes).toHaveLength(1);
    expect(changes[0].activado).toBe(true);
  });
});
