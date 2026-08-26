# Fase 2 — Auth flow integration — Design Spec

- **Date:** 2026-08-26
- **Phase:** Roadmap Fase 2 (Testing) — auth flow
- **Status:** Pending user review

## Problem

The auth subsystem — register, login, email verification, two-factor (2FA),
password reset, and Google login — is the gate to every authenticated money-path,
yet it has **zero integration coverage**. The historical `req.usuario` vs `req.user`
bug (Auditoría Altos #3: 401/500 on protected endpoints) has no regression test
pinning it shut.

The auth surface also depends on an external email side-effect
(`services/email.service.js`) that delivers verification, 2FA, and password-reset
codes. These codes travel **only by email** — the HTTP responses never return them
(register responds `requiresEmailVerification: true`, not the code). So the whole
"receive a code, then use it" half of auth is untestable end to end without a seam
to observe what was emailed.

## Decisions (user, 2026-08-26)

1. **Scope: full auth**, all six flows, delivered in phases (see Etapas below).
2. **Email seam: an injected fake email adapter** (ports & adapters, mirroring the
   blockchain `chainClient` precedent) — **not** `jest.mock`. Chosen for the highest
   "test green ⇒ it really works" fidelity: it exercises a production-shaped wiring
   path and lets the test assert real delivery, rather than swapping a module via
   test-runner magic. **Assertion discipline:** assert exactly-one email was
   delivered to the right recipient carrying a code, **then** use that captured code
   to drive verification — **never read the code from the DB** (reading the DB is
   exactly what would bypass a "code never sent / wrong code / wrong recipient" bug).
3. **Stance on findings: fix-as-we-go (B).** When a test surfaces genuinely broken
   or incoherent behavior, fix it inline with TDD before moving on — a deliberate
   **departure** from the characterize-don't-fix stance used for trading/matching.
   Nuance: deliberate-but-surprising design is respected, not "fixed" to taste (e.g.
   login not requiring a verified email is coherent — verification is enforced
   separately by the `requireEmailVerified` middleware on sensitive routes, not at
   login). Ambiguous "bug or intended?" forks are raised with the user **before**
   any behavior change. Any behavior change that alters the client contract updates
   `docs/frontend-rebuild/backend-contract-changes.md` in the same commit.

## Honesty caveat

The fake email adapter proves the app hands the **correct code to the correct
recipient at the email boundary**. It does **not** exercise real SMTP / nodemailer
delivery. Real delivery is smoke-test territory and never part of the CI gate —
the same caveat class as the blockchain signing/broadcast adapter.

## The email port (shared foundation — built in Etapa 1)

Current wiring: `usuario.controller.js` does
`const emailService = require('../services/email.service.js')` (a module singleton)
and calls it in ~5 places, all inside route handlers (so `req` is in scope).

**Seam:** expose the email service through Express `app.locals.emailService`,
defaulted in `app.js` to the real module. Controllers call
`req.app.locals.emailService.*` instead of the module-level `require`. Tests
override `app.locals.emailService = fakeEmailService` after mounting the app. This
is a real, production-shaped dependency seam (idiomatic Express DI), not a
test-runner interception — in production the default (real module) is used and
behavior is identical.

- **Port shape** = the functions the controller actually calls (audit exact
  signatures when implementing): `enviarCodigoVerificacionEmail(email, codigo,
  username)`, `enviarCodigo2FA(email, codigo, username)`,
  `enviarCodigoRecuperacion(...)`, `notificarCambioPassword(email, username)`,
  `notificar2FAChange(...)`.
- **Fake adapter** (`tests/helpers/fakeEmailService.js`): implements the same
  interface, records every call (recipient, code, which template), sends nothing,
  and exposes helpers like `lastCodeFor(email)` and `sentCount()` so tests assert
  what was delivered and that it was delivered exactly once.
- **Audit before wiring:** confirm **all** email sends happen inside request
  handlers. The grep found them all in `usuario.controller.js`; the Google path
  (`auth.controller.js` / `loginWithGoogle`) sends none — confirm. Any send from a
  model / service / job (no `req`) needs a different injection point — flag it if
  found rather than forcing `app.locals`.

## Etapa 1 — Register + Login (detailed)

Builds the email port + fake, then covers register, login (2FA-off happy path), an
authenticated request, the `req.usuario`/`req.user` regression, and rejections.

**Tests** (integration, real Postgres + fake email) — new
`backend/tests/integration/authFlow.integration.test.js`:

1. **Register happy path:** `POST /usuario/register` with a fresh
   email/username/password (≥8 chars) → success; a user row is created (assert the
   `activo` value the entity default produces — characterize it); response carries a
   token + `requiresEmailVerification: true` and does **not** leak the code; the fake
   email recorded **exactly one** `enviarCodigoVerificacionEmail` to that address
   with a non-empty code.
2. **Register rejections:** duplicate email/username → error (assert the real
   status + shape); weak password (<8) → error.
3. **Login happy path (2FA off):** seed a user via factory, `POST /usuario/login`
   with correct credentials → a token; then `GET /usuario/me` with the Bearer token
   → 200 with the user. This pins `req.user` and closes the `req.usuario` regression.
4. **Login rejections:** wrong password → 401; nonexistent user → 401.
5. **Auth-middleware rejections:** `GET /usuario/me` with no token → 401; with a
   garbage token → 401; (logout-invalidated token → 401 if cheap to set up).
6. **`req.usuario`/`req.user` regression:** explicitly hit a protected endpoint from
   the Altos #3 set and assert it works (GET /me covers the core; note the other
   affected endpoints in a comment).

**Factories:** reuse `seedUser` / `authHeader`. Likely add a small helper to register
via HTTP (to exercise the real register path) distinct from seed-direct (used to set
up login tests quickly).

**Fix-as-we-go watchpoints for Etapa 1** (raise before changing behavior):
- The legacy `{ success: false, message }` auth-error shape vs. the canonical error
  envelope — **flag as a decision, do not auto-fix** (it is currently pinned by an
  existing test; changing it is a contract change).
- The `activo` default on register (login gates on `activo: true`).
- That `GET /me` reads `req.user` correctly end to end.

## Etapas 2–5 (scoped; each gets its own implementation plan when reached)

- **Etapa 2 — Email verification:** register → capture the code from the fake →
  `POST /verify-email` → user becomes `emailVerificado: true` with an updated token;
  assert a `requireEmailVerified`-gated route returns 403 **before** and 200
  **after**; `resend-verification-email`.
- **Etapa 3 — 2FA:** enable 2FA (`toggle2FA`), login → `requires2FA` +
  `temporalToken` and the fake received the 2FA code → `POST /verify-2fa` with the
  code → real token; `resend-2fa`; wrong / expired code rejected.
- **Etapa 4 — Password reset:** `forgot-password` → fake received the recovery code
  → `verify-reset-code` → `reset-password` → old password fails, new one works;
  `notificarCambioPassword` delivered.
- **Etapa 5 — Google login:** `POST /login/google` with `googleId/email/username`
  (the controller reads these from the body — no real OAuth token verification, so
  no Google mock needed) → new user created + initialized (`emailVerificado: true`,
  `activo`), and a returning user logs in; `isNew` flag characterized.

## Risks / open decisions

- **Injection point assumes request context:** all known sends are in controllers;
  audit confirms it. If a job/model sends email, it needs a second seam — flag on
  discovery.
- **~5 call sites** in `usuario.controller.js` move to `req.app.locals.emailService`
  — mechanical but must catch every one; production default keeps behavior identical.
- **Error shapes:** Etapa 1 asserts the real current shapes. Fixing the legacy
  auth-error envelope is a flagged decision, not auto-done.
- **Multi-session block:** each etapa is independently shippable; stopping after any
  etapa leaves solid, green coverage.
