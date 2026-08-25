# Fase 2 — Integration Test Harness (swap exemplar) — Design Spec

- **Date:** 2026-08-24
- **Phase:** Roadmap Fase 2 (Testing) — integration layer, first slice
- **Status:** Approved (design), pending implementation plan

## Problem

`backend/tests/` has 57 test files but they are almost entirely **unit** tests
(mocked models, no DB). The two `*.integration.test.js` files that do hit a real
Postgres are model-level (`new Sequelize(...)` + one model synced), not
full-request tests, and they self-skip when no DB is present. There is no way to
exercise a money-moving flow **end-to-end through Express + a real Postgres** —
which is exactly the layer that catches the class of bug the audit found (buy
executed as sell, withdrawal pipeline broken, req.usuario vs req.user): a single
HTTP request asserting a status code / final balances would have caught them.

Two concrete blockers to writing such tests today:

1. **`server.js` does not export the app.** Requiring it runs `startServer()` at
   module load: `sequelize.sync({ force: true })`, `app.listen(...)`, and
   `JobManager.startAll()`. There is no way to mount the Express app in supertest
   without opening a real port and starting the background jobs.
2. **No test-DB harness.** No dedicated test Postgres, no schema-sync lifecycle,
   no per-test isolation, no seed/auth helpers. Each would-be integration test
   would have to reinvent all of it.

## Goal

Stand up a reusable **integration test harness** (dedicated test Postgres + a
mountable Express app + schema lifecycle + per-test isolation + seed/auth
helpers) and prove it with the **swap** (`intercambioExchange`) flow end-to-end
over HTTP. The swap is the exemplar because it is self-contained (one endpoint,
no matching engine, no counterparty), deterministic (we seed the pair price), and
was just migrated to money.js — so the integration test also locks in that fix
through the full stack, including the `DECIMAL(28,8)` round-trip in real
Postgres, which a mock cannot prove.

This spec establishes the **pattern**. Later specs reuse the harness for other
flows.

### Non-goals (deferred)

- **Spot trading / matching engine** integration — a separate flow/engine
  (order book, counterparty matching), tangled with the Fase 0 "choose one
  engine" debt. Next spec, not this one.
- **Withdrawal pipeline** integration and **blockchain provider injection** —
  the other big Fase 2 piece; separate spec.
- **Auth flow** integration (login/register/2FA/Google) — reuse the harness later.
- **CI wiring** (Fase 5) — the design enables it (a separate `test:integration`
  stage bringing up the test compose) but does not implement it here.
- **Migrating the 2 existing `*.integration.test.js`** onto the new harness —
  follow-up, to avoid widening this slice.
- **Deep mid-transaction fault-injection** rollback tests — follow-up; rollback
  is validated here via the pre-write rejection cases (insufficient / daily-limit).

## Architecture & components

### a) `backend/app.js` (new) — the enabler

Extract the Express app construction into `app.js`, which **exports the
configured app** and nothing else: CORS, helmet, body parsers, session, passport,
request log, `/api` routes, `/health`, canonical 404, and the central
`errorHandler` — in the same order they are wired today. It does **not** call
`listen`, `sequelize.sync`, or `JobManager`. No behavior change for production.

### b) `backend/server.js` (slimmed)

`const app = require('./app')` + `startServer()` retaining the current startup
sequence (`sequelize.authenticate()` → `sync` → `listen` → `JobManager.startAll()`)
and the SIGTERM/SIGINT graceful-shutdown handlers. Only the app *construction*
moves out; runtime startup is unchanged.

### c) `docker-compose.test.yml` (new) — dedicated test DB

A single `postgres:15-alpine` service, **ephemeral** (no persistent named volume →
fast, disposable), published on port **55432** (matches the port the existing
integration tests already assume), `POSTGRES_DB=app_database_test`, user/password
aligned with `config/database.js`'s `test` block. Brought up/down by npm scripts.

### d) Jest split (unit vs integration)

- `jest.config.js` — default project for `npm test`: current behavior, **excludes**
  `*.integration.test.js`. Stays fast, DB-free (the ~275 unit tests).
- `jest.integration.config.js` — runs **only** `*.integration.test.js`, with a
  `globalSetup` (connect + `sync({ force: true })`) and `globalTeardown` (close).
  **Fails loudly if the DB is unreachable** (in CI we want real coverage, not a
  silent skip).
- `package.json` scripts: `test` (unit), `test:integration`, `test:integration:up`,
  `test:integration:down`.

### e) `backend/tests/helpers/` (new) — the harness surface

- `testApp.js` — exports the mountable app (`require('../../app')`) and a supertest
  agent factory.
- `db.js` — `globalSetup`/`globalTeardown` and `resetDb()` (`sequelize.truncate({
  cascade: true, restartIdentity: true })`).
- `factories.js` — `seedUser({ emailVerified = true })`, `authTokenFor(user)`
  (mints a JWT the same way the auth middleware verifies it), `seedCripto(symbol)`,
  `seedPar({ base, quote, precio, comision })`, `seedBalance(user, cripto, monto)`,
  `seedWalletMaestra(cripto)`, `getBalance(user, cripto)`.

Each test then reads as "seed this → POST → assert final balances", short and
focused.

## DB lifecycle & isolation

- **Once (`globalSetup`):** connect to the test DB (`NODE_ENV=test` + env pointing
  at the `55432` container), `sequelize.sync({ force: true })` to create all tables
  + ENUMs. **`globalTeardown`:** close the connection.
- **Per test (`beforeEach`):** `resetDb()` → truncate all tables (cascade,
  restart identity) → re-seed the scenario via factories.
- **Why truncate, not transaction-per-test:** the swap's `createOrder` opens its
  **own** `sequelize.transaction()` inside the controller; an outer wrapping test
  transaction does not compose with that (an inner `commit()` breaks the
  isolation, and forcing the app's transactions into an outer one needs CLS and is
  fragile). Truncating from the outside is agnostic to how the app manages its own
  transactions. Transaction-per-test stays reserved for model/service tests that
  accept an injected `transaction` (e.g. the existing balance-lock race test).

## The swap exemplar flow

Endpoint: `POST /api/intercambioExchange/` with body `{ parId, tipo, cantidadBase }`,
protected by `authenticateToken` + `requireEmailVerified`. Balances read back via
`GET /api/intercambioExchange/me/balances` and asserted directly against the DB.

Baseline seed: an email-verified user, a `BTC/USDT` pair with seeded `precioActual`
and `comisionPorcentaje`, a `WalletMaestra` for the quote asset, and balances per
case. Requests go through supertest with `Authorization: Bearer <jwt>`.

**Money assertions are exact canonical strings** — this is the point: it proves
the money.js settlement end-to-end, including the `DECIMAL(28,8)` round-trip
through real Postgres (a mock cannot). Concrete values chosen so the naive float
path would visibly diverge (as in `intercambioSettlement.test.js`).

Cases:

1. **Buy (happy):** sufficient quote balance. → 201; quote debited by
   `cantidadQuote + comisión` (exact string), base credited by `cantidadBase`,
   `WalletMaestra` quote credited by `comisión`, an `IntercambioExchange` row in
   `completado`. Verified via `GET /me/balances` **and** direct DB read.
2. **Sell (happy):** symmetric; quote credited by `cantidadQuote − comisión`
   (exact string), base debited.
3. **Insufficient balance** → 400 `{ error: { code: 'EXCHANGE_INSUFFICIENT_BALANCE' } }`;
   **balances unchanged** (validates rollback against real Postgres).
4. **Daily limit exceeded** → 400 `EXCHANGE_DAILY_LIMIT_EXCEEDED`; balances unchanged.
5. **Pair not found** → 404 `EXCHANGE_PAIR_NOT_FOUND`.
6. **No token** → 401.

## File structure

```
backend/
  app.js                         (new — exports the Express app)
  server.js                      (slimmed — require('./app') + startServer)
  jest.config.js                 (new — unit project, excludes *.integration)
  jest.integration.config.js     (new — only *.integration, globalSetup/teardown)
  tests/
    helpers/
      testApp.js
      db.js
      factories.js
    integration/
      intercambioExchange.integration.test.js   (new — the swap flow)
docker-compose.test.yml          (new)
package.json                     (scripts: test, test:integration[:up|:down])
```

## Risks / open decisions

- **`truncate cascade` + FK order:** resolved by `cascade`; low risk.
- **`requireEmailVerified`:** the seeded user must have a verified email; `seedUser`
  sets that by default.
- **Speed:** truncate+seed per test is slower than rollback but negligible at this
  scale; if it ever bites, seed static reference data once and truncate only the
  mutable tables.
- **`config/database.js` `test` block:** currently `DB_NAME + '_test'`; the harness
  points env at the `55432` container (`DB_NAME=app_database_test`, `DB_PORT=55432`).
  A minor pre-existing quirk (`process.env.DB_NAME + '_test' || ...` never falls
  back) is irrelevant once env is set explicitly by the scripts.
- **`JWT_SECRET` in test env:** `app.js` (like `server.js`) requires it; the test
  scripts set a fixed test secret so `authTokenFor` and the auth middleware agree.
```
