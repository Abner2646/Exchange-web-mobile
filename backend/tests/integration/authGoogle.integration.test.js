require('../helpers/testEnv');
const request = require('supertest');
const { app, installAuthHarness } = require('../helpers/authHarness');
const { createFakeGoogleVerifier } = require('../helpers/fakeGoogleVerifier');
const { Usuario } = require('../../models');
const userService = require('../../services/user.service');
const f = require('../helpers/factories');

installAuthHarness();

// The id_token verifier is the security boundary with Google: the endpoint
// verifies a Google-signed token server-side instead of trusting a client
// googleId. Inject a fake that maps known tokens to payloads and throws on the
// rest, so both the happy path and the reject-invalid-token path run offline.
let fakeGoogle;
beforeEach(() => {
  fakeGoogle = createFakeGoogleVerifier();
  app.locals.googleTokenVerifier = fakeGoogle;
});
afterAll(() => {
  app.locals.googleTokenVerifier = require('../../services/auth/googleTokenVerifier');
});

// A canonical passport-google-oauth20 profile is the architectural boundary with
// Google: passport does the OAuth handshake and hands us this object; our code
// starts here. So the Google flows are tested from the profile inward — there is
// no value (and much fragility) in driving a real OAuth handshake in a test.
function googleProfile({ id, email, displayName }) {
  return { id, displayName, emails: [{ value: email }] };
}

describe('userService.findOrCreateGoogleUser (the single Google brain)', () => {
  test('creates a new, email-verified, passwordless user from a Google profile', async () => {
    const result = await userService.findOrCreateGoogleUser(
      googleProfile({ id: 'google-new-1', email: 'alice@test.local', displayName: 'Alice' })
    );

    expect(result.isNewUser).toBe(true);
    expect(result.googleId).toBe('google-new-1');
    expect(result.email).toBe('alice@test.local');
    expect(result.username).toBe('alice');        // displayName becomes the username, normalized lowercase
    expect(result.emailVerificado).toBe(true);    // Google already verified the email
    expect(result.passwordHash).toBeNull();

    const inDb = await Usuario.findOne({ where: { googleId: 'google-new-1' } });
    expect(inDb).not.toBeNull();
    expect(inDb.emailVerificado).toBe(true);
    expect(inDb.passwordHash).toBeNull();
  });

  test('links an existing password account to Google by email and force-verifies it', async () => {
    const local = await f.seedUser({
      email: 'bob@test.local',
      username: 'bob',
      passwordHash: 'a-real-hash',
      emailVerificado: false,
    });

    const result = await userService.findOrCreateGoogleUser(
      googleProfile({ id: 'google-bob', email: 'bob@test.local', displayName: 'Bob' })
    );

    expect(result.isNewUser).toBe(false);
    expect(result.googleId).toBe('google-bob');
    expect(result.emailVerificado).toBe(true);

    // Same account, now linked and verified — no duplicate row created.
    const rows = await Usuario.findAll({ where: { email: 'bob@test.local' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(local.id);
    expect(rows[0].googleId).toBe('google-bob');
    expect(rows[0].emailVerificado).toBe(true);
  });

  test('returns the existing Google user on repeat login and back-fills emailVerificado', async () => {
    const existing = await f.seedUser({
      email: 'carol@test.local',
      username: 'carol',
      passwordHash: null,
      googleId: 'google-carol',
      emailVerificado: false,
    });

    const result = await userService.findOrCreateGoogleUser(
      googleProfile({ id: 'google-carol', email: 'carol@test.local', displayName: 'Carol' })
    );

    expect(result.isNewUser).toBe(false);
    expect(result.id).toBe(existing.id);
    expect(result.emailVerificado).toBe(true);

    const reloaded = await Usuario.findByPk(existing.id);
    expect(reloaded.emailVerificado).toBe(true);
  });
});

describe('POST /api/usuario/login/google (verifies a Google id_token)', () => {
  test('rejects an unverified / forged id_token with 401 and creates no user', async () => {
    const res = await request(app)
      .post('/api/usuario/login/google')
      .send({ idToken: 'forged-token' }); // not registered in the fake -> verify throws

    expect(res.status).toBe(401);

    const count = await Usuario.count();
    expect(count).toBe(0);
  });

  test('logs in an existing Google user from a verified token (isNew false, same account)', async () => {
    const existing = await f.seedUser({
      email: 'existg@test.local',
      username: 'existg',
      passwordHash: null,
      googleId: 'google-endpoint-exist',
    });
    fakeGoogle.register('good-token', {
      googleId: 'google-endpoint-exist',
      email: 'existg@test.local',
      name: 'existg',
      emailVerified: true,
    });

    const res = await request(app)
      .post('/api/usuario/login/google')
      .send({ idToken: 'good-token' });

    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(false);
    expect(res.body.user.id).toBe(existing.id);
    expect(typeof res.body.token).toBe('string');
  });
});
