# Auth Flow — Etapa 1 (Register + Login) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration coverage for register and login, build the reusable fake-email seam, and pin the `req.usuario`/`req.user` regression shut.

**Architecture:** Supertest against the mounted `app.js` with a real test Postgres (existing harness). Email side-effects are captured through an injected fake exposed via `app.locals.emailService` (default in `app.js` is the real module — production unchanged). Tests assert what was emailed, never read codes from the DB.

**Tech Stack:** Node, Express, Sequelize, Jest, Supertest, bcrypt, the existing integration harness (`tests/helpers/testEnv`, `tests/helpers/db`, `tests/helpers/factories`).

## Global Constraints

- **Integration DB must be up before running any test in this plan:** `cd backend && npm run test:integration:up` (tear down later with `npm run test:integration:down`). The Docker Postgres listens on port 55432; suites run serially (`maxWorkers: 1`).
- **Run a single integration suite:** `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`.
- **Email assertion discipline:** assert exactly-one email delivered to the right recipient carrying the code, captured from the fake. **Never** read a verification/2FA/reset code from the DB in a test.
- **Fix-as-we-go (B):** if a characterization test reveals genuinely broken/incoherent behavior, **stop and raise it with the user before changing behavior.** Do NOT auto-change error shapes or the client contract. Deliberate-but-surprising design (e.g. login not requiring email verification) is respected, not "fixed".
- **Routes are mounted under `/api`** → auth endpoints are `/api/usuario/register`, `/api/usuario/login`, `/api/usuario/me`.
- **Conventions:** code, comments, and commit messages in English; Conventional Commits; work directly on `dev`.
- **Entity defaults (confirmed):** `activo` → `true`, `emailVerificado` → `false`, `dosFactoresActivado` → `false`, `pais` nullable. A freshly registered user is active and can log in.

---

## File Structure

- `backend/tests/helpers/fakeEmailService.js` — **new.** Fake implementing the subset of the email-service interface the auth flow calls; records sends, exposes query helpers. Reused by all auth etapas.
- `backend/app.js` — **modify** (one line): set `app.locals.emailService` default to the real module.
- `backend/controllers/usuario.controller.js` — **modify** (register path only, ~line 186): send the verification email through `req.app.locals.emailService`.
- `backend/tests/integration/authFlow.integration.test.js` — **new.** Etapa 1 tests (register, login, `/me`, rejections). Grows in later etapas.

---

### Task 1: Fake email seam, proven via register's verification email

**Files:**
- Create: `backend/tests/helpers/fakeEmailService.js`
- Modify: `backend/app.js:18` (add `app.locals.emailService` default right after `const app = express();`)
- Modify: `backend/controllers/usuario.controller.js:186` (register uses `req.app.locals.emailService`)
- Test: `backend/tests/integration/authFlow.integration.test.js`

**Interfaces:**
- Produces: `createFakeEmailService()` → object with `sent: Array<{type,email,codigo?,username?,activado?}>`, and methods `enviarCodigoVerificacionEmail(email,codigo,username)`, `enviarCodigo2FA(email,codigo,username)`, `enviarCodigoRecuperacion(email,codigo,username)`, `notificarCambioPassword(email,username)`, `notificar2FAChange(email,username,activado)`, plus `lastCodeFor(email)` and `countFor(email,type?)`.
- Produces: `app.locals.emailService` as the injection point (tests overwrite it per test).

- [ ] **Step 1: Create the fake email helper**

Create `backend/tests/helpers/fakeEmailService.js`:

```js
// Records email sends instead of delivering them. Implements the subset of the
// real services/email.service.js interface that the auth flows call. Never
// touches SMTP. Reused across all auth etapas.
function createFakeEmailService() {
  const sent = [];
  const recordCode = (type) => async (email, codigo, username) => {
    sent.push({ type, email, codigo, username });
  };
  return {
    sent,
    enviarCodigoVerificacionEmail: recordCode('verificacion'),
    enviarCodigo2FA: recordCode('2fa'),
    enviarCodigoRecuperacion: recordCode('recuperacion'),
    notificarCambioPassword: async (email, username) => {
      sent.push({ type: 'cambioPassword', email, username });
    },
    notificar2FAChange: async (email, username, activado) => {
      sent.push({ type: '2faChange', email, username, activado });
    },
    lastCodeFor(email) {
      const hits = sent.filter((s) => s.email === email && s.codigo);
      return hits.length ? hits[hits.length - 1].codigo : undefined;
    },
    countFor(email, type) {
      return sent.filter((s) => s.email === email && (!type || s.type === type)).length;
    },
  };
}

module.exports = { createFakeEmailService };
```

- [ ] **Step 2: Write the failing register test**

Create `backend/tests/integration/authFlow.integration.test.js`:

```js
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`
Expected: FAIL — `expect(verifications).toHaveLength(1)` gets `0`, because register still sends via the module-level `emailService`, not the injected fake (the real module's SMTP send is swallowed by register's try/catch).

- [ ] **Step 4: Wire the seam (app.js default + register call site)**

In `backend/app.js`, immediately after `const app = express();` (line 18) add:

```js
// Email side-effects go through app.locals so tests can inject a fake.
// Default is the real service module (production behavior unchanged).
app.locals.emailService = require('./services/email.service');
```

In `backend/controllers/usuario.controller.js`, in `registerUsuario` (~line 186), change the send from the module singleton to the injected one:

```js
    // Enviar código de verificación por email
    try {
      await req.app.locals.emailService.enviarCodigoVerificacionEmail(
        user.email,
        codigoVerificacion,
        user.username
      );
      console.log(`✅ Código de verificación enviado a ${user.email}`);
    } catch (emailError) {
      console.error('❌ Error enviando código de verificación:', emailError);
      // NO fallar el registro si el email falla, pero informar al usuario
    }
```

Leave the top-level `const emailService = require('../services/email.service.js')` and the other call sites untouched — later etapas migrate their own call sites as they add coverage.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/tests/helpers/fakeEmailService.js backend/app.js backend/controllers/usuario.controller.js backend/tests/integration/authFlow.integration.test.js
git commit -m "test(auth): register happy path + injectable fake email seam"
```

---

### Task 2: Register rejections (characterization)

**Files:**
- Test: `backend/tests/integration/authFlow.integration.test.js` (add a `describe` block)

**Interfaces:**
- Consumes: the running app + fake email from Task 1's `beforeEach`.

> These are **characterization** tests: the behavior already exists, so they should pass on first run (no RED step). If one fails, that is a finding — apply Global Constraint "Fix-as-we-go (B)": stop and raise it with the user before changing anything.

- [ ] **Step 1: Write the rejection tests**

Append to `backend/tests/integration/authFlow.integration.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests**

Run: `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`
Expected: PASS (characterizes current behavior). If either FAILS, stop and raise with the user per Constraint B.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/authFlow.integration.test.js
git commit -m "test(auth): characterize register rejections (duplicate, weak password)"
```

---

### Task 3: Login happy path + authenticated `/me` (req.user regression)

**Files:**
- Test: `backend/tests/integration/authFlow.integration.test.js` (add a `describe` block)

**Interfaces:**
- Consumes: `f.seedUser(overrides)` from `tests/helpers/factories`; `bcrypt` to seed a real password hash.

> `seedUser`'s default `passwordHash` is a placeholder string, not a real hash, so login-by-password needs a user seeded with a real bcrypt hash of a known password.

- [ ] **Step 1: Write the failing login + /me test**

Append to `backend/tests/integration/authFlow.integration.test.js` (add `const bcrypt = require('bcrypt');` and `const f = require('../helpers/factories');` to the imports at the top of the file):

```js
describe('POST /api/usuario/login + GET /api/usuario/me', () => {
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
```

- [ ] **Step 2: Run the tests to verify status**

Run: `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`
Expected: PASS. (These characterize the fixed `req.user` behavior; `getMyProfile` reads `req.user.id`, which the auth middleware sets. If `/me` returns 500/401 instead of 200, that is the `req.usuario`/`req.user` regression resurfacing — a genuine bug: apply Constraint B and raise it.)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/authFlow.integration.test.js
git commit -m "test(auth): login happy path + authenticated /me (req.user regression)"
```

---

### Task 4: Login and auth-middleware rejections

**Files:**
- Test: `backend/tests/integration/authFlow.integration.test.js` (add a `describe` block)

**Interfaces:**
- Consumes: `f.seedUser` + `bcrypt` (as in Task 3).

- [ ] **Step 1: Write the rejection tests**

Append to `backend/tests/integration/authFlow.integration.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests**

Run: `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`
Expected: PASS.

- [ ] **Step 3: Run the full unit + integration suites (no regressions)**

Run: `cd backend && npx jest --config jest.integration.config.js && npm test`
Expected: all integration suites green (now including `authFlow`), then unit 277 green.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/integration/authFlow.integration.test.js
git commit -m "test(auth): login and auth-middleware rejections"
```

---

## Notes / flagged for later (do not act on in Etapa 1)

- **`transferencia.model.js` sends email from a model (no `req`).** The `app.locals` seam cannot reach it. Out of scope for auth Etapa 1; when transferencia gets integration coverage it needs a different injection point (pass the service into the model method, or a module-level registry). Flagged, not touched.
- **Other `usuario.controller.js` email call sites** (resend-verification, forgot-password, notificarCambioPassword, 2FA in `loginStep1`/`resend2FA`) still use the module singleton. Etapas 2–4 migrate each to `req.app.locals.emailService` as they add tests.
- **`registerUsuario` opens a `sequelize.transaction()` that `createWithPassword` never uses** (the user is created outside the tx; only `commit()` runs). Possibly dead/misleading transaction handling — a fix-as-we-go candidate to raise before touching, since it is behavior-adjacent and out of Etapa 1's test scope.
- **Legacy auth-error shape** (`{ success: false, message }`) is intentionally left as-is (pinned elsewhere); changing it is a flagged contract decision.
```
