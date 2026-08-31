require('../helpers/testEnv');
const request = require('supertest');
const { app, installAuthHarness } = require('../helpers/authHarness');
const bcrypt = require('bcrypt');
const f = require('../helpers/factories');

const h = installAuthHarness();

// Seeds an active, email-verified user with a real bcrypt hash of 'password123'
// (requestPasswordReset only finds users whose passwordHash is not null).
async function seedPasswordUser({ email, username }) {
  const passwordHash = await bcrypt.hash('password123', 12);
  return f.seedUser({ email, username, passwordHash });
}

// Requests a reset and returns the recovery code the fake captured.
async function forgotAndGetCode(email) {
  const res = await request(app).post('/api/usuario/forgot-password').send({ email });
  const sent = h.fake.sent.find((s) => s.type === 'recuperacion' && s.email === email);
  return { res, code: sent && sent.codigo };
}

async function login(email, password) {
  return request(app).post('/api/usuario/login').send({ emailOrUsername: email, password });
}

describe('POST /forgot-password → /verify-reset-code → /reset-password', () => {
  test('full recovery: emails a code, verifies it, resets the password; new password logs in, old one does not', async () => {
    await seedPasswordUser({ email: 'reset@test.local', username: 'resetpwuser' });

    const { res, code } = await forgotAndGetCode('reset@test.local');
    expect(res.status).toBe(200);

    // Exactly one recovery code emailed, and it is NOT leaked in the response.
    const codes = h.fake.sent.filter((s) => s.type === 'recuperacion' && s.email === 'reset@test.local');
    expect(codes).toHaveLength(1);
    expect(code).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain(code);

    const verify = await request(app)
      .post('/api/usuario/verify-reset-code')
      .send({ email: 'reset@test.local', codigo: code });
    expect(verify.status).toBe(200);
    expect(verify.body.valid).toBe(true);

    const reset = await request(app)
      .post('/api/usuario/reset-password')
      .send({ email: 'reset@test.local', codigo: code, newPassword: 'newpassword456', confirmPassword: 'newpassword456' });
    expect(reset.status).toBe(200);
    expect(typeof reset.body.token).toBe('string');

    // A change-password notification was emailed.
    const notices = h.fake.sent.filter((s) => s.type === 'cambioPassword' && s.email === 'reset@test.local');
    expect(notices).toHaveLength(1);

    // The new password works and the old one no longer does.
    expect((await login('reset@test.local', 'newpassword456')).status).toBe(200);
    expect((await login('reset@test.local', 'password123')).status).toBe(401);
  });

  test('forgot-password for an unknown email returns 200 without emailing (no account enumeration)', async () => {
    const res = await request(app).post('/api/usuario/forgot-password').send({ email: 'ghost@test.local' });

    expect(res.status).toBe(200);
    const codes = h.fake.sent.filter((s) => s.type === 'recuperacion');
    expect(codes).toHaveLength(0);
  });

  test('verify-reset-code rejects a wrong code with 400', async () => {
    await seedPasswordUser({ email: 'badreset@test.local', username: 'badresetuser' });
    await forgotAndGetCode('badreset@test.local');

    const verify = await request(app)
      .post('/api/usuario/verify-reset-code')
      .send({ email: 'badreset@test.local', codigo: '000000' });

    expect(verify.status).toBe(400);
    expect(verify.body.error).toMatch(/inv[aá]lido|expirado/i);
  });

  test('reset-password rejects mismatched confirmation with 400 and leaves the password unchanged', async () => {
    await seedPasswordUser({ email: 'mismatch@test.local', username: 'mismatchuser' });
    const { code } = await forgotAndGetCode('mismatch@test.local');

    const reset = await request(app)
      .post('/api/usuario/reset-password')
      .send({ email: 'mismatch@test.local', codigo: code, newPassword: 'newpassword456', confirmPassword: 'different789' });

    expect(reset.status).toBe(400);
    expect(reset.body.error).toMatch(/coinciden/i);

    // Original password still works.
    expect((await login('mismatch@test.local', 'password123')).status).toBe(200);
  });

  test('reset-password rejects a wrong code with 400', async () => {
    await seedPasswordUser({ email: 'wrongcode@test.local', username: 'wrongcodeuser' });
    await forgotAndGetCode('wrongcode@test.local');

    const reset = await request(app)
      .post('/api/usuario/reset-password')
      .send({ email: 'wrongcode@test.local', codigo: '000000', newPassword: 'newpassword456', confirmPassword: 'newpassword456' });

    expect(reset.status).toBe(400);
  });
});

describe('PATCH /api/usuario/me/change-password', () => {
  test('changes the password for an authenticated user, notifies by email; new password logs in, old one does not', async () => {
    const user = await seedPasswordUser({ email: 'changepw@test.local', username: 'changepwuser' });

    const res = await request(app)
      .patch('/api/usuario/me/change-password')
      .set(f.authHeader(user))
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' });

    expect(res.status).toBe(200);

    const notices = h.fake.sent.filter((s) => s.type === 'cambioPassword' && s.email === 'changepw@test.local');
    expect(notices).toHaveLength(1);

    expect((await login('changepw@test.local', 'newpassword456')).status).toBe(200);
    expect((await login('changepw@test.local', 'password123')).status).toBe(401);
  });

  test('rejects a wrong current password with 400', async () => {
    const user = await seedPasswordUser({ email: 'wrongcurrent@test.local', username: 'wrongcurrentuser' });

    const res = await request(app)
      .patch('/api/usuario/me/change-password')
      .set(f.authHeader(user))
      .send({ currentPassword: 'not-my-password', newPassword: 'newpassword456' });

    expect(res.status).toBe(400);
  });
});
