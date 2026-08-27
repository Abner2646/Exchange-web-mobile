# Auth Flow — Etapa 2 (Email Verification) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover the email-verification flow end to end: register → capture the emailed code → verify-email → the account becomes verified and a `requireEmailVerified`-gated route flips 403 → 200; plus resend-verification re-emails a fresh working code.

**Architecture:** Supertest against the mounted `app.js` with the real test Postgres and the injected fake-email seam from Etapa 1 (`app.locals.emailService`, overwritten per-test with a fresh fake in `beforeEach`). Codes are captured from the fake, never read from the DB. Etapa 2 migrates one more email call site (resend) onto the seam.

**Tech Stack:** Node, Express, Sequelize, Jest, Supertest, the existing integration harness (`tests/helpers/testEnv`, `db`, `factories`, `fakeEmailService`, `disableRateLimit`).

## Global Constraints

- **Integration DB must be up:** `cd backend && npm run test:integration:up` (down later with `npm run test:integration:down`); port 55432; serial.
- **Run this suite:** `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`.
- **Email discipline:** capture codes from the fake (`fakeEmail.sent` / a helper), assert delivery (recipient + code), then use that captured code. Never read a code from the DB.
- **Fix-as-we-go (B):** if a characterization test reveals genuinely broken behavior, STOP and raise with the human before changing production behavior. A required test-enablement seam migration (resend → `req.app.locals.emailService`) is expected and allowed.
- **No rate-limiter change needed this etapa:** `verifyEmailCodeLimiter` and `resendVerificationEmailLimiter` key by `req.user.id` (confirmed `rateLimiters.js:113` and `:143`); each test uses a fresh user, so counters do not accumulate across tests.
- **Endpoints:** verify-email `POST /api/usuario/verify-email` (mounts `authenticateToken` — needs the register token); resend `POST /api/usuario/resend-verification-email` (also `authenticateToken`); gated route for the 403→200 check: `GET /api/transferencia/my` (`authenticateToken` + `requireEmailVerified`).
- **Conventions:** English code/comments/commits; Conventional Commits; work on `dev`.
- **Expected noise (not a failure):** verify-email calls `inicializarUsuarioCompleto`, which throws `'No hay criptomonedas activas'` on the truncated test DB and is swallowed by the controller's try/catch (verification still succeeds). It logs a `console.error`. This is acceptable, same class as Etapa 1's register-rejection logging.

## Confirmed behavior (from reading the code)

- `verifyEmail` controller (`usuario.controller.js:304`) reads `req.user.id` + `{ codigo }`; missing code → 400 `'codigo es requerido'`; delegates to `Usuario.verifyEmail(userId, codigo)` which throws `'Código inválido o expirado'` on a bad code (`usuario.model.js:268`), else sets `emailVerificado:true`, nulls the code, returns an updated token. Response: `{ message, user: { ..., emailVerificado }, token }`.
- `authenticateToken` sets `req.user.emailVerificado` from the **DB row** (`authMiddleware.js:41`), not the token payload — so after verification the SAME register token passes `requireEmailVerified`.
- `requireEmailVerified` returns 403 with `{ success:false, requiresEmailVerification:true, ... }` when unverified (`authMiddleware.js:64`).
- resend controller (`usuario.controller.js:348`) reads `req.user.id`, regenerates the code via `Usuario.resendEmailVerification` (invalidating the old one), and emails it through the **module-level** `emailService` (`:358`) — this call site must move onto the seam for Task 3.

---

## File Structure

- `backend/tests/integration/authFlow.integration.test.js` — **modify** (append Etapa 2 describe blocks; add a small register helper).
- `backend/controllers/usuario.controller.js` — **modify** (Task 3 only): resend call site (~line 358) → `req.app.locals.emailService`.

---

### Task 1: verify-email happy path + wrong-code rejection

**Files:**
- Test: `backend/tests/integration/authFlow.integration.test.js` (append a describe block)

**Interfaces:**
- Consumes: the running app + `fakeEmail` (file-level `let fakeEmail`, set in `beforeEach` from Etapa 1).
- Produces: a **file-scope** `registerAndGetCode({ email, username, password? })` → `{ res, token, code }` helper that Tasks 2 and 3 reuse (do not redefine it).

> These characterize existing behavior and should PASS on first run. If verify-email returns something other than 200 for a valid code, stop and raise per Constraint B.

- [ ] **Step 1a: Add the file-scope helper**

In `backend/tests/integration/authFlow.integration.test.js`, add this at **file scope** (below the `afterAll` block, above the first `describe`) so all Etapa 2 blocks can share it:

```js
// Registers via HTTP and returns the token + the verification code the fake
// captured (never read from the DB). Shared by the Etapa 2 describe blocks.
async function registerAndGetCode({ email, username, password = 'password123' }) {
  const res = await request(app).post('/api/usuario/register').send({ email, username, password });
  const sent = fakeEmail.sent.find((s) => s.type === 'verificacion' && s.email === email);
  return { res, token: res.body.token, code: sent && sent.codigo };
}
```

- [ ] **Step 1b: Write the tests**

Append to `backend/tests/integration/authFlow.integration.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests**

Run: `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`
Expected: PASS (all prior Etapa 1 tests + these 2). A `console.error` from `inicializarUsuarioCompleto` ('No hay criptomonedas activas') is expected noise on the happy-path test, not a failure. If verify returns non-200 for the valid code, stop and raise per Constraint B.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/authFlow.integration.test.js
git commit -m "test(auth): verify-email happy path + wrong-code rejection"
```

---

### Task 2: requireEmailVerified gate flips 403 → 200 across verification

**Files:**
- Test: `backend/tests/integration/authFlow.integration.test.js` (append a describe block)

**Interfaces:**
- Consumes: the file-scope `registerAndGetCode(...)` added in Task 1 (already in the file). Do not redefine it.

> Characterization; should PASS on first run. The key point: the SAME register token is used before and after verification, so the test proves the gate responds to the DB verification state, not to holding a new token.

- [ ] **Step 1: Write the test**

Append to `backend/tests/integration/authFlow.integration.test.js`:

```js
describe('requireEmailVerified gate (GET /api/transferencia/my)', () => {
  test('unverified user is 403, then 200 after verifying (same token)', async () => {
    const { token, code } = await registerAndGetCode({ email: 'gated@test.local', username: 'gateduser' });

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
```

- [ ] **Step 2: Run the tests**

Run: `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`
Expected: PASS. If the post-verification GET is not 200 (e.g. the controller errors for an unrelated reason), stop and raise per Constraint B rather than adapting the assertion.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/authFlow.integration.test.js
git commit -m "test(auth): requireEmailVerified gate flips 403 to 200 after verification"
```

---

### Task 3: resend-verification re-emails a fresh working code (seam migration)

**Files:**
- Modify: `backend/controllers/usuario.controller.js` (~line 358, `resendVerificationEmail`)
- Test: `backend/tests/integration/authFlow.integration.test.js` (append a describe block)

**Interfaces:**
- Consumes: the file-scope `registerAndGetCode(...)` added in Task 1 (already in the file). Do not redefine it.

> This task has a real RED → GREEN: resend currently emails via the module-level `emailService`, so the fake never sees it. The test goes RED (fake has no second verification email), then the seam migration makes it GREEN.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/integration/authFlow.integration.test.js`:

```js
describe('POST /api/usuario/resend-verification-email', () => {
  test('re-emails a new verification code that verifies the account', async () => {
    const { token } = await registerAndGetCode({ email: 'resend@test.local', username: 'resenduser' });

    const resend = await request(app)
      .post('/api/usuario/resend-verification-email')
      .set('Authorization', `Bearer ${token}`);
    expect(resend.status).toBe(200);

    // Two verification emails now: the register one + the resend one.
    const verifications = fakeEmail.sent.filter((s) => s.type === 'verificacion' && s.email === 'resend@test.local');
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`
Expected: FAIL — `expect(verifications).toHaveLength(2)` gets `1`, because `resendVerificationEmail` sends through the module-level `emailService` (real, swallowed), so the fake only recorded the register email.

- [ ] **Step 3: Migrate the resend call site onto the seam**

In `backend/controllers/usuario.controller.js`, in `resendVerificationEmail` (~line 358), change the module singleton to the injected one:

```js
    // Enviar código por email
    try {
      await req.app.locals.emailService.enviarCodigoVerificacionEmail(
        user.email,
        codigo,
        user.username
      );
```

Leave the rest of the function unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && npx jest --config jest.integration.config.js tests/integration/authFlow.integration.test.js`
Expected: PASS.

- [ ] **Step 5: Run the full suites (no regressions)**

Run: `cd backend && npx jest --config jest.integration.config.js && npm test`
Expected: all integration suites green (authFlow now larger), then unit 277 green.

- [ ] **Step 6: Commit**

```bash
git add backend/controllers/usuario.controller.js backend/tests/integration/authFlow.integration.test.js
git commit -m "test(auth): resend-verification re-emails a working code via the seam"
```

---

## Notes / flagged for later (do not act on in Etapa 2)

- **`inicializarUsuarioCompleto` throwing on the empty test DB** is swallowed and only produces log noise. If a later etapa wants clean output or to exercise address initialization, it must seed active criptomonedas + master wallets (and reckon with real HD derivation on `generarDireccionDerivada`). Out of scope here.
- Other still-unmigrated email call sites (`forgot-password`/reset in Etapa 4, 2FA in Etapa 3) remain on the module singleton until their etapas.
