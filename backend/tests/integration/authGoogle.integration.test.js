require('../helpers/testEnv');
const request = require('supertest');
const { app, installAuthHarness } = require('../helpers/authHarness');
const { Usuario } = require('../../models');
const userService = require('../../services/user.service');
const f = require('../helpers/factories');

installAuthHarness();

// A canonical passport-google-oauth20 profile is the architectural boundary with
// Google: passport does the OAuth handshake and hands us this object; our code
// starts here. So the Google flows are tested from the profile inward — there is
// no value (and much fragility) in driving a real OAuth handshake in a test.
function googleProfile({ id, email, displayName }) {
  return { id, displayName, emails: [{ value: email }] };
}

describe('userService.findOrCreateGoogleUser (the OAuth brain)', () => {
  test('creates a new, email-verified, passwordless user from a Google profile', async () => {
    const result = await userService.findOrCreateGoogleUser(
      googleProfile({ id: 'google-new-1', email: 'alice@test.local', displayName: 'Alice' })
    );

    expect(result.isNewUser).toBe(true);
    expect(result.googleId).toBe('google-new-1');
    expect(result.email).toBe('alice@test.local');
    expect(result.username).toBe('alice');        // displayName becomes the username, normalized lowercase
    expect(result.emailVerificado).toBe(true);   // Google already verified the email
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

// Path A (POST /login/google). NOTE (characterization, not endorsement): this
// endpoint trusts a client-supplied googleId with NO server-side verification of
// a Google-signed id_token — a real account-takeover vector, flagged in ROADMAP
// Radar. These tests pin current behavior; they do not bless the security model.
// Its create path is Usuario.createWithProvider (distinct from Path B's
// findOrCreateGoogleUser: createWithProvider keys only on googleId, not email).
// The endpoint's NEW-user path also runs user provisioning
// (inicializarUsuarioCompleto: deposit-address derivation + welcome notification),
// which is a separate concern needing crypto+wallet seeding — out of scope here,
// so new-user creation is characterized at the model level below.
describe('Google login (createWithProvider + POST /login/google)', () => {
  test('createWithProvider creates a new verified, passwordless Google user with a token', async () => {
    const { user, token, isNew } = await Usuario.createWithProvider({
      googleId: 'google-provider-new', email: 'provg@test.local', username: 'provg', pais: 'AR',
    });

    expect(isNew).toBe(true);
    expect(typeof token).toBe('string');
    expect(user.googleId).toBe('google-provider-new');
    expect(user.email).toBe('provg@test.local');
    expect(user.emailVerificado).toBe(true);
    expect(user.passwordHash).toBeNull();
  });

  test('logs in an existing Google user idempotently (isNew false, same account)', async () => {
    const existing = await f.seedUser({
      email: 'existg@test.local',
      username: 'existg',
      passwordHash: null,
      googleId: 'google-endpoint-exist',
    });

    const res = await request(app)
      .post('/api/usuario/login/google')
      .send({ googleId: 'google-endpoint-exist', email: 'existg@test.local', username: 'existg', pais: 'AR' });

    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(false);
    expect(res.body.user.id).toBe(existing.id);
    expect(typeof res.body.token).toBe('string');
  });
});
