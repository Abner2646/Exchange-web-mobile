require('../helpers/testEnv');
const request = require('supertest');
const { app, installAuthHarness } = require('../helpers/authHarness');
const { User } = require('../../models');

// Radar #14 — cambio de email (acción sensible): re-auth con password + código al
// email nuevo + notificación al viejo + cooldown de retiros. El fake de email
// captura el código (nunca se lee de la DB).
const h = installAuthHarness();

const registrar = async (email, username) => {
  const { token } = await h.registerAndGetCode({ email, username });
  return { Authorization: `Bearer ${token}` };
};
const codeFor = (email) => {
  const s = h.fake.sent.find((x) => x.type === 'cambioEmail' && x.email === email);
  return s && s.codigo;
};

describe('cambio de email — flujo feliz', () => {
  test('solicitar → confirmar: email actualizado + verificado, cooldown seteado, notifica al viejo', async () => {
    const auth = await registrar('a@test.local', 'usera');

    const req1 = await request(app).post('/api/user/me/email-change').set(auth)
      .send({ nuevoEmail: 'nuevo@test.local', passwordActual: 'password123' });
    expect(req1.status).toBe(200);
    const codigo = codeFor('nuevo@test.local');
    expect(codigo).toBeTruthy();

    const req2 = await request(app).post('/api/user/me/email-change/confirm').set(auth)
      .send({ codigo });
    expect(req2.status).toBe(200);

    const u = await User.findOne({ where: { email: 'nuevo@test.local' } });
    expect(u).not.toBeNull();
    expect(u.emailVerified).toBe(true);
    expect(u.pendingEmail).toBeNull();
    expect(u.withdrawalCooldownUntil).toBeTruthy();
    expect(new Date(u.withdrawalCooldownUntil).getTime()).toBeGreaterThan(Date.now());
    // notificó al email VIEJO (anti account-takeover)
    expect(h.fake.sent.some((s) => s.type === 'cambioEmailNotif' && s.email === 'a@test.local')).toBe(true);
  });
});

describe('cambio de email — rechazos', () => {
  test('contraseña actual incorrecta → 401 EMAIL_CHANGE_INVALID', async () => {
    const auth = await registrar('c@test.local', 'userc');
    const res = await request(app).post('/api/user/me/email-change').set(auth)
      .send({ nuevoEmail: 'otro@test.local', passwordActual: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('EMAIL_CHANGE_INVALID');
  });

  test('email nuevo ya en uso → 400', async () => {
    const auth = await registrar('d@test.local', 'userd');
    await registrar('taken@test.local', 'usertaken');
    const res = await request(app).post('/api/user/me/email-change').set(auth)
      .send({ nuevoEmail: 'taken@test.local', passwordActual: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMAIL_CHANGE_INVALID');
  });

  test('confirmar con código incorrecto → 400', async () => {
    const auth = await registrar('e@test.local', 'usere');
    await request(app).post('/api/user/me/email-change').set(auth)
      .send({ nuevoEmail: 'nuevoe@test.local', passwordActual: 'password123' });
    const res = await request(app).post('/api/user/me/email-change/confirm').set(auth)
      .send({ codigo: '000000' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMAIL_CHANGE_INVALID');
  });
});

describe('cambio de email — enforcement del cooldown de retiros', () => {
  test('tras confirmar el cambio, un retiro se rechaza con 403 WITHDRAWAL_COOLDOWN', async () => {
    const auth = await registrar('f@test.local', 'userf');
    await request(app).post('/api/user/me/email-change').set(auth)
      .send({ nuevoEmail: 'nuevof@test.local', passwordActual: 'password123' });
    await request(app).post('/api/user/me/email-change/confirm').set(auth)
      .send({ codigo: codeFor('nuevof@test.local') });

    // Retiro con body Joi-válido + Idempotency-Key; el check de cooldown corre
    // primero (fail-fast) → 403 antes de tocar validación de network.
    const res = await request(app).post('/api/transaccionBlockchain/withdraw')
      .set(auth).set('Idempotency-Key', 'cooldown-1')
      .send({
        cryptoId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        amount: 0.5,
        destinationAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('WITHDRAWAL_COOLDOWN');
  });
});
