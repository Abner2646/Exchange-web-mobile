const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('./db');
const { createFakeEmailService } = require('./fakeEmailService');

// Shared lifecycle for the auth integration suites. Installs the email-fake seam
// (app.locals.emailService) + per-test DB reset, and exposes a register helper
// that reads verification codes from the fake (never from the DB). Each auth
// suite calls installAuthHarness() once at module top level.
//
// Splitting the old monolithic authFlow.integration.test.js into per-concern
// files (register / login / email-verification / 2fa) keeps each file small as
// the auth phase grows; this helper is the single place the shared seam lives.
function installAuthHarness() {
  const handle = { fake: null };

  beforeEach(async () => {
    await resetDb();
    handle.fake = createFakeEmailService();
    app.locals.emailService = handle.fake;
  });

  afterAll(async () => {
    // Restore the real email service on the shared app singleton so a later
    // suite in the same worker does not inherit this file's fake.
    app.locals.emailService = require('../../services/email.service');
    await sequelize.close();
  });

  // Registers via HTTP and returns the token + the verification code the fake
  // captured. Fails loudly here if registration did not return 201.
  handle.registerAndGetCode = async ({ email, username, password = 'password123' }) => {
    const res = await request(app).post('/api/usuario/register').send({ email, username, password });
    expect(res.status).toBe(201);
    const sent = handle.fake.sent.find((s) => s.type === 'verificacion' && s.email === email);
    return { res, token: res.body.token, code: sent && sent.codigo };
  };

  return handle;
}

module.exports = { app, installAuthHarness };
