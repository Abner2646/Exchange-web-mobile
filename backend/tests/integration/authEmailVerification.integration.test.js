require('../helpers/testEnv');
const request = require('supertest');
const { app, installAuthHarness } = require('../helpers/authHarness');
const { Usuario } = require('../../models');

const h = installAuthHarness();

describe('POST /api/usuario/verify-email', () => {
  test('verifies the email with the emailed code and returns an updated token', async () => {
    const { token, code } = await h.registerAndGetCode({ email: 'verify@test.local', username: 'verifyuser' });
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
    const { token } = await h.registerAndGetCode({ email: 'badcode@test.local', username: 'badcodeuser' });

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

describe('requireEmailVerified gate (GET /api/transferencia/my)', () => {
  test('unverified user is 403, then 200 after verifying (same token)', async () => {
    const { token, code } = await h.registerAndGetCode({ email: 'gated@test.local', username: 'gateduser' });

    const before = await request(app)
      .get('/api/transferencia/my')
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(403);
    expect(before.body.requiresEmailVerification).toBe(true);

    const verify = await request(app)
      .post('/api/usuario/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: code });
    expect(verify.status).toBe(200);

    const after = await request(app)
      .get('/api/transferencia/my')
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(200);
  });
});

describe('POST /api/usuario/resend-verification-email', () => {
  test('re-emails a new verification code that verifies the account', async () => {
    const { token } = await h.registerAndGetCode({ email: 'resend@test.local', username: 'resenduser' });

    const resend = await request(app)
      .post('/api/usuario/resend-verification-email')
      .set('Authorization', `Bearer ${token}`);
    expect(resend.status).toBe(200);

    // Two verification emails now: the register one + the resend one.
    const verifications = h.fake.sent.filter((s) => s.type === 'verificacion' && s.email === 'resend@test.local');
    expect(verifications).toHaveLength(2);

    // The resend's code is the current valid one and verifies the account.
    const newCode = verifications[1].codigo;
    expect(newCode).toBeTruthy();

    const verify = await request(app)
      .post('/api/usuario/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ codigo: newCode });
    expect(verify.status).toBe(200);
    expect(verify.body.user.emailVerificado).toBe(true);
  });
});
