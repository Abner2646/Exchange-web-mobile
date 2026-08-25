# Fase 2 Integration Test Harness (swap exemplar) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a reusable integration-test harness (dedicated test Postgres + mountable Express app + schema lifecycle + per-test isolation + seed/auth helpers) and prove it with the swap (`intercambioExchange`) flow end-to-end over HTTP.

**Architecture:** Extract the Express app into `app.js` (no listen/sync/jobs) so supertest can mount it. A disposable `postgres:15-alpine` (docker-compose.test.yml, port 55432) backs a separate jest integration project whose `globalSetup` syncs the schema once; each test truncates + re-seeds. Seed/auth factories keep tests short. The swap flow asserts exact canonical-string amounts through the real `DECIMAL(28,8)` round-trip.

**Tech Stack:** Node/CommonJS, Express 4, Sequelize 6 (Postgres), jest 29, supertest 6, jsonwebtoken, decimal.js (money.js). No new dependencies (supertest + pg already installed).

## Global Constraints

- Code and comments in **English**; commits **Conventional Commits** in English.
- **No new npm dependencies** — `supertest`, `pg`, `jsonwebtoken` are already installed.
- Money assertions are **exact canonical decimal strings** (e.g. `'0.67'`), never `Number`. Choose seed values so the naive float path would visibly diverge.
- Unit suite (`npm test`) stays **DB-free and green** (~275 tests). Integration tests live only under `backend/tests/integration/` and run via `npm run test:integration`.
- Test env vars are set in-process (via a required `testEnv.js`), not via shell env, so it works on Windows PowerShell without `cross-env`.
- No behavior change to production startup: `server.js` keeps the same authenticate → sync → listen → jobs sequence.

---

### Task 1: Extract `app.js`; prove the app is mountable

**Files:**
- Create: `backend/app.js`
- Modify: `backend/server.js`
- Create: `backend/tests/helpers/testEnv.js`
- Create: `backend/tests/appMountable.test.js`

**Interfaces:**
- Produces: `backend/app.js` exports a configured Express `app` (an Express application function) with all middleware, `/api` routes, `/health`, canonical 404, and the central `errorHandler` wired — but **no** `listen`, `sequelize.sync`, or `JobManager`.
- Produces: `testEnv.js` sets `JWT_SECRET`, `SESSION_SECRET`, `NODE_ENV=test` (only if unset) as a side effect of being required.

- [ ] **Step 1: Write the failing test**

`backend/tests/appMountable.test.js`:
```javascript
// The app must be importable and serve requests WITHOUT opening a port,
// connecting to a DB, or starting jobs — the precondition for supertest.
require('./helpers/testEnv');
const request = require('supertest');
const app = require('../app');

describe('app is mountable', () => {
  test('GET /health returns 200 without a DB connection', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  test('unknown route returns the canonical 404 envelope', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
});
```

- [ ] **Step 2: Create `testEnv.js`**

`backend/tests/helpers/testEnv.js`:
```javascript
// Sets the environment every test run needs, in-process (cross-platform,
// no shell env / cross-env). Only fills values that are not already set, so
// an explicit CI/dev override still wins. Required first thing by test files,
// setupFiles, and jest globalSetup.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest tests/appMountable.test.js`
Expected: FAIL — `Cannot find module '../app'`.

- [ ] **Step 4: Create `backend/app.js` by moving app construction out of `server.js`**

Move everything that builds the app into `app.js`. Keep the exact middleware order currently in `server.js`. Gate the noisy per-request `console.log` logger on non-test to keep test output clean.

`backend/app.js`:
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
require('dotenv').config();

// Environment validation (kept here so anything importing the app fails fast).
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET no configurado');
}

const configurePassport = require('./config/passport.config');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS (same policy as before)
const rawAllowed = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '';
const allowedOrigins = rawAllowed.split(',').map(s => s.trim()).filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('*');
}
app.use(cors({
  origin: function (origin, callback) {
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*')) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

app.use(passport.initialize());
app.use(passport.session());
configurePassport();

// Per-request log — skip in tests to keep output clean.
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`📱 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
    next();
  });
  app.use(morgan('combined'));
}

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use(errorHandler);

module.exports = app;
```

- [ ] **Step 5: Slim `backend/server.js` to import the app + keep startup**

Replace the whole app-construction block in `server.js` with an import of `./app`, keeping `startServer()` and the shutdown handlers unchanged.

`backend/server.js`:
```javascript
require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // ⚠️ TEMPORAL: Una sola vez para recrear ENUMs
    await sequelize.sync({ force: true });
    console.log('⚠️ Database reset (recreating ENUMs)');

    app.listen(PORT, '0.0.0.0', () => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    const JobManager = require('./jobs');
    await JobManager.startAll();
  } catch (error) {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await sequelize.close();
  process.exit(0);
});
```

- [ ] **Step 6: Run the smoke test to verify it passes**

Run: `cd backend && npx jest tests/appMountable.test.js`
Expected: PASS (both tests).

- [ ] **Step 7: Run the full unit suite to confirm no regression**

Run: `cd backend && npx jest`
Expected: PASS — same green as before plus the 2 new smoke tests (skipped integration files still skip).

- [ ] **Step 8: Commit**

```bash
git add backend/app.js backend/server.js backend/tests/helpers/testEnv.js backend/tests/appMountable.test.js
git commit -m "refactor(server): extract app.js so the Express app is mountable in tests"
```

---

### Task 2: Test Postgres + jest integration project + DB lifecycle

**Files:**
- Create: `docker-compose.test.yml`
- Create: `backend/jest.config.js`
- Create: `backend/jest.integration.config.js`
- Create: `backend/tests/helpers/db.js`
- Modify: `backend/package.json` (scripts)
- Create: `backend/tests/integration/harness.smoke.integration.test.js`

**Interfaces:**
- Consumes: `testEnv.js` (Task 1).
- Produces: `backend/tests/helpers/db.js` exports `{ globalSetup, globalTeardown, resetDb }`.
  - `globalSetup()` — async; requires `testEnv`, points DB env at the test container, `sequelize.authenticate()` + `sequelize.sync({ force: true })`, then closes its setup connection.
  - `resetDb()` — async; `sequelize.truncate({ cascade: true, restartIdentity: true })`.
- Produces: `npm run test:integration` runs only `backend/tests/integration/**/*.integration.test.js`.

- [ ] **Step 1: Create the disposable test database compose file**

`docker-compose.test.yml`:
```yaml
# Ephemeral Postgres for integration tests. No named volume → disposable.
services:
  test-db:
    image: postgres:15-alpine
    container_name: exchange_test_db
    environment:
      POSTGRES_DB: app_database_test
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: app_password
    ports:
      - "55432:5432"
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app_user -d app_database_test"]
      interval: 3s
      timeout: 5s
      retries: 10
```

- [ ] **Step 2: Point the test DB env at the container**

Append to `backend/tests/helpers/testEnv.js` (after the existing lines):
```javascript
// Point Sequelize's `test` config at the disposable docker-compose.test.yml DB.
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '55432';
process.env.DB_NAME = process.env.DB_NAME || 'app_database';   // config appends _test
process.env.DB_USER = process.env.DB_USER || 'app_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'app_password';
```
Note: `config/database.js` `test` uses `DB_NAME + '_test'` → `app_database_test`, matching the container.

- [ ] **Step 3: Write the DB lifecycle helper**

`backend/tests/helpers/db.js`:
```javascript
require('./testEnv');
const { sequelize } = require('../../models');

// Runs once before the whole integration run: create the schema fresh.
async function globalSetup() {
  await sequelize.authenticate();
  await sequelize.sync({ force: true });
  await sequelize.close();
}

// Runs once after the whole integration run.
async function globalTeardown() {
  // The setup connection is already closed; nothing global to tear down here.
}

// Per-test clean slate: wipe every table, reset identities.
async function resetDb() {
  await sequelize.truncate({ cascade: true, restartIdentity: true });
}

module.exports = { globalSetup, globalTeardown, resetDb, sequelize };
```

- [ ] **Step 4: Create the unit jest config (excludes integration)**

`backend/jest.config.js`:
```javascript
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/helpers/testEnv.js'],
  // Unit run: never touch the integration suites (they need a DB).
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.js$'],
};
```

- [ ] **Step 5: Create the integration jest config**

`backend/jest.integration.config.js`:
```javascript
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/helpers/testEnv.js'],
  // Only the integration suites under tests/integration/.
  testMatch: ['<rootDir>/tests/integration/**/*.integration.test.js'],
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
  globalTeardown: '<rootDir>/tests/helpers/globalTeardown.js',
  forceExit: true,
  testTimeout: 20000,
};
```

Create `backend/tests/helpers/globalSetup.js`:
```javascript
module.exports = async () => {
  await require('./db').globalSetup();
};
```

Create `backend/tests/helpers/globalTeardown.js`:
```javascript
module.exports = async () => {
  await require('./db').globalTeardown();
};
```

- [ ] **Step 6: Add npm scripts**

Modify `backend/package.json` `scripts` to:
```json
"test": "jest --config jest.config.js",
"test:integration": "jest --config jest.integration.config.js",
"test:integration:up": "docker compose -f ../docker-compose.test.yml up -d --wait",
"test:integration:down": "docker compose -f ../docker-compose.test.yml down -v"
```

- [ ] **Step 7: Write the harness smoke integration test**

`backend/tests/integration/harness.smoke.integration.test.js`:
```javascript
require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const { Criptomoneda } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('integration harness smoke', () => {
  test('connects, has a synced schema, and truncates between tests', async () => {
    await Criptomoneda.create({ symbol: 'BTC', nombre: 'Bitcoin' });
    const count = await Criptomoneda.count();
    expect(count).toBe(1);
  });

  test('previous test data is gone (resetDb ran)', async () => {
    const count = await Criptomoneda.count();
    expect(count).toBe(0);
  });
});
```
Note: if `Criptomoneda.create` needs more required columns, the implementer adds them per `backend/models/criptomoneda.model.js` (read it first).

- [ ] **Step 8: Bring up the test DB and run the smoke test (verify it passes)**

Run:
```bash
cd backend && npm run test:integration:up && npm run test:integration -- harness.smoke
```
Expected: test DB container healthy; both smoke tests PASS.

- [ ] **Step 9: Run the unit suite to confirm the split works**

Run: `cd backend && npm test`
Expected: PASS, and the integration suite is NOT run (no DB needed for `npm test`).

- [ ] **Step 10: Commit**

```bash
git add docker-compose.test.yml backend/jest.config.js backend/jest.integration.config.js backend/tests/helpers/db.js backend/tests/helpers/globalSetup.js backend/tests/helpers/globalTeardown.js backend/tests/helpers/testEnv.js backend/package.json backend/tests/integration/harness.smoke.integration.test.js
git commit -m "test(integration): add test Postgres, jest integration project, DB lifecycle"
```

---

### Task 3: Seed/auth factories

**Files:**
- Create: `backend/tests/helpers/factories.js`
- Create: `backend/tests/integration/factories.integration.test.js`

**Interfaces:**
- Consumes: models from `../../models`, `resetDb` from `./db`, `app` from `../../app`.
- Produces: `backend/tests/helpers/factories.js` exporting:
  - `seedUser({ emailVerificado = true, activo = true, limiteDiarioUsd = 1000000, rol = 'usuario' } = {})` → `Promise<Usuario>` (unique email/username per call).
  - `authTokenFor(user)` → `string` — `jwt.sign({ id: user.id }, process.env.JWT_SECRET)`.
  - `authHeader(user)` → `{ Authorization: 'Bearer <token>' }`.
  - `seedCripto(symbol)` → `Promise<Criptomoneda>`.
  - `seedPar({ base, quote, precio, comision })` → `Promise<ParExchange>` (`activo: true`).
  - `seedBalance(user, cripto, monto)` → `Promise<BalanceUsuario>` (`balanceDisponible: monto`, `balanceBloqueado: '0'`).
  - `seedWalletMaestra(cripto)` → `Promise<WalletMaestra>` (balance 0).
  - `getBalance(user, cripto)` → `Promise<BalanceUsuario|null>`.

- [ ] **Step 1: Write the failing test**

`backend/tests/integration/factories.integration.test.js`:
```javascript
require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('factories + auth helper', () => {
  test('authTokenFor mints a token the auth middleware accepts', async () => {
    const user = await f.seedUser();               // emailVerificado: true by default
    const res = await request(app)
      .get('/api/intercambioExchange/me/balances')
      .set(f.authHeader(user));
    expect(res.status).toBe(200);
  });

  test('seedBalance persists and getBalance reads it back as a canonical string', async () => {
    const user = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    await f.seedBalance(user, btc, '1.5');
    const bal = await f.getBalance(user, btc);
    expect(bal.balanceDisponible).toBe('1.50000000');
  });
});
```
Note: the exact returned decimal string (`'1.50000000'`) reflects `DECIMAL(28,8)`; if the column scale differs, adjust to the real round-tripped value the first run reports — but keep it an exact string assertion.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm run test:integration -- factories`
Expected: FAIL — `Cannot find module '../helpers/factories'`.

- [ ] **Step 3: Implement the factories**

`backend/tests/helpers/factories.js`:
```javascript
const jwt = require('jsonwebtoken');
const {
  Usuario, Criptomoneda, ParExchange, BalanceUsuario, WalletMaestra,
} = require('../../models');

let seq = 0;
const uniq = () => `${Date.now()}-${seq++}`;

async function seedUser(overrides = {}) {
  const n = uniq();
  return Usuario.create({
    email: `user-${n}@test.local`,
    username: `user_${n}`,
    password: 'hashed-not-used-in-token-auth',
    emailVerificado: true,
    activo: true,
    limiteDiarioUsd: 1000000,
    rol: 'usuario',
    ...overrides,
  });
}

function authTokenFor(user) {
  return jwt.sign({ id: user.id }, process.env.JWT_SECRET);
}

function authHeader(user) {
  return { Authorization: `Bearer ${authTokenFor(user)}` };
}

async function seedCripto(symbol) {
  return Criptomoneda.create({ symbol, nombre: symbol });
}

async function seedPar({ base, quote, precio, comision }) {
  return ParExchange.create({
    criptoBaseId: base.id,
    criptoQuoteId: quote.id,
    precioActual: precio,
    comisionPorcentaje: comision,
    activo: true,
  });
}

async function seedBalance(user, cripto, monto) {
  return BalanceUsuario.create({
    userId: user.id,
    criptomonedaId: cripto.id,
    balanceDisponible: monto,
    balanceBloqueado: '0',
  });
}

async function seedWalletMaestra(cripto) {
  return WalletMaestra.create({ criptomonedaId: cripto.id });
}

async function getBalance(user, cripto) {
  return BalanceUsuario.findOne({ where: { userId: user.id, criptomonedaId: cripto.id } });
}

module.exports = {
  seedUser, authTokenFor, authHeader, seedCripto, seedPar,
  seedBalance, seedWalletMaestra, getBalance,
};
```
Note: column names above match the models used elsewhere (`emailVerificado`, `userId`, `criptomonedaId`, `precioActual`, `comisionPorcentaje`, `balanceDisponible`). Before running, open each model file and add any additional `allowNull: false` columns the create needs (e.g. Usuario may require more fields; Criptomoneda/WalletMaestra a network/decimals field). Keep values minimal and valid.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm run test:integration -- factories`
Expected: PASS (both tests). Fix missing required columns surfaced by Sequelize validation errors until green.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/helpers/factories.js backend/tests/integration/factories.integration.test.js
git commit -m "test(integration): add seed/auth factories for the harness"
```

---

### Task 4: Swap buy happy-path integration test

**Files:**
- Create: `backend/tests/integration/intercambioExchange.integration.test.js`

**Interfaces:**
- Consumes: `app`, `resetDb`, factories (Task 3), models.
- Produces: the swap integration suite; extended by Task 5.

- [ ] **Step 1: Write the buy happy-path test**

`backend/tests/integration/intercambioExchange.integration.test.js`:
```javascript
require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const { IntercambioExchange, WalletMaestra } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

// BTC/USDT, precio 0.1, commission 10%. Buy 3 BTC:
//   cantidadQuote = 3 * 0.1   = 0.3
//   comision      = 0.3 * 10% = 0.03
//   required USDT = 0.3 + 0.03 = 0.33   (float path would give 0.32999999999999996)
async function seedBuyScenario() {
  const user = await f.seedUser();
  const btc = await f.seedCripto('BTC');
  const usdt = await f.seedCripto('USDT');
  const par = await f.seedPar({ base: btc, quote: usdt, precio: '0.1', comision: '10' });
  const wallet = await f.seedWalletMaestra(usdt);
  await f.seedBalance(user, usdt, '1');   // enough to cover 0.33
  return { user, btc, usdt, par, wallet };
}

describe('POST /api/intercambioExchange (swap) — buy', () => {
  test('debits quote by required, credits base, sends commission to wallet maestra', async () => {
    const { user, btc, usdt, par, wallet } = await seedBuyScenario();

    const res = await request(app)
      .post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'compra', cantidadBase: 3 });

    expect(res.status).toBe(201);

    // Exact canonical strings — proves money.js end-to-end through DECIMAL(28,8).
    const usdtBal = await f.getBalance(user, usdt);
    const btcBal = await f.getBalance(user, btc);
    expect(usdtBal.balanceDisponible).toBe('0.67000000');   // 1 - 0.33
    expect(btcBal.balanceDisponible).toBe('3.00000000');    // 0 + 3

    const walletAfter = await WalletMaestra.findByPk(wallet.id);
    // Assert the wallet's balance column increased by the commission 0.03.
    // Confirm the exact column name against walletMaestra.model.js.
    // expect(walletAfter.<balanceColumn>).toBe('0.03000000');

    const row = await IntercambioExchange.findOne({ where: { usuarioId: user.id } });
    expect(row).not.toBeNull();
    expect(row.estado).toBe('completado');
  });

  test('GET /me/balances returns the post-trade balances as canonical strings', async () => {
    const { user, usdt } = await seedBuyScenario();
    await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: (await require('../../models').ParExchange.findOne()).id, tipo: 'compra', cantidadBase: 3 });

    const res = await request(app).get('/api/intercambioExchange/me/balances').set(f.authHeader(user));
    expect(res.status).toBe(200);
    const usdtEntry = res.body.data.find((b) => b.criptomoneda.symbol === 'USDT');
    expect(usdtEntry.balanceDisponible).toBe('0.67000000');
  });
});
```
Note: the exact decimal scale (`'0.67000000'`) reflects `DECIMAL(28,8)`. Uncomment and complete the wallet-maestra assertion once the balance column name is confirmed. The `GET /me/balances` response shape (`res.body.data[].criptomoneda.symbol`, `.balanceDisponible`) must be confirmed against `getMyBalances` in the controller; adjust the accessor to the real shape.

- [ ] **Step 2: Confirm the money assertion can fail (guards against a trivially-passing test)**

Temporarily change `'0.67000000'` to `'0.68000000'`, run, and confirm FAIL; then restore.
Run: `cd backend && npm run test:integration -- intercambioExchange`
Expected: FAIL on the wrong value, PASS after restoring.

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd backend && npm run test:integration -- intercambioExchange`
Expected: PASS. (The endpoint already exists; this characterizes + regression-locks it.)

- [ ] **Step 4: Commit**

```bash
git add backend/tests/integration/intercambioExchange.integration.test.js
git commit -m "test(integration): swap buy happy-path (exact money assertions e2e)"
```

---

### Task 5: Swap sell + failure cases

**Files:**
- Modify: `backend/tests/integration/intercambioExchange.integration.test.js`

**Interfaces:**
- Consumes: everything from Task 4.

- [ ] **Step 1: Add the sell happy-path test**

Append inside the file a new `describe('... — sell')`:
```javascript
describe('POST /api/intercambioExchange (swap) — sell', () => {
  // BTC/USDT, precio 1, commission 1%. Sell 0.29 BTC:
  //   cantidadQuote = 0.29 * 1   = 0.29
  //   comision      = 0.29 * 1%  = 0.0029
  //   net USDT      = 0.29 - 0.0029 = 0.2871  (float path: 0.28709999999999997)
  test('debits base, credits quote by net (value - commission)', async () => {
    const user = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const par = await f.seedPar({ base: btc, quote: usdt, precio: '1', comision: '1' });
    await f.seedWalletMaestra(usdt);
    await f.seedBalance(user, btc, '0.29');

    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'venta', cantidadBase: 0.29 });

    expect(res.status).toBe(201);
    expect((await f.getBalance(user, btc)).balanceDisponible).toBe('0.00000000');
    expect((await f.getBalance(user, usdt)).balanceDisponible).toBe('0.28710000');
  });
});
```

- [ ] **Step 2: Add the failure-case tests**

Append a `describe('... — rejections')`:
```javascript
describe('POST /api/intercambioExchange (swap) — rejections', () => {
  async function seedPairOnly(overrides = {}) {
    const user = await f.seedUser(overrides.user);
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const par = await f.seedPar({ base: btc, quote: usdt, precio: '0.1', comision: '10' });
    await f.seedWalletMaestra(usdt);
    return { user, btc, usdt, par };
  }

  test('insufficient balance → 400 EXCHANGE_INSUFFICIENT_BALANCE, balances unchanged', async () => {
    const { user, usdt, par } = await seedPairOnly();
    await f.seedBalance(user, usdt, '0.1');   // < required 0.33

    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'compra', cantidadBase: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXCHANGE_INSUFFICIENT_BALANCE');
    expect((await f.getBalance(user, usdt)).balanceDisponible).toBe('0.10000000'); // rolled back
  });

  test('daily limit exceeded → 400 EXCHANGE_DAILY_LIMIT_EXCEEDED, balances unchanged', async () => {
    const { user, usdt, par } = await seedPairOnly({ user: { limiteDiarioUsd: 0.1 } });
    await f.seedBalance(user, usdt, '1');   // enough balance, but over daily limit

    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'compra', cantidadBase: 3 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXCHANGE_DAILY_LIMIT_EXCEEDED');
    expect((await f.getBalance(user, usdt)).balanceDisponible).toBe('1.00000000'); // rolled back
  });

  test('pair not found → 404 EXCHANGE_PAIR_NOT_FOUND', async () => {
    const user = await f.seedUser();
    const res = await request(app).post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .send({ parId: '00000000-0000-4000-8000-000000000000', tipo: 'compra', cantidadBase: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EXCHANGE_PAIR_NOT_FOUND');
  });

  test('no token → 401 (legacy auth shape, not the canonical envelope)', async () => {
    const res = await request(app).post('/api/intercambioExchange/')
      .send({ parId: '00000000-0000-4000-8000-000000000000', tipo: 'compra', cantidadBase: 1 });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);  // authMiddleware returns { success:false, message }
  });
});
```

- [ ] **Step 3: Run the full swap suite (verify it passes)**

Run: `cd backend && npm run test:integration -- intercambioExchange`
Expected: PASS — buy, sell, and all four rejection cases.

- [ ] **Step 4: Run the whole integration suite + the unit suite**

Run: `cd backend && npm run test:integration && npm test`
Expected: integration green (harness smoke + factories + swap); unit green (~277, DB-free).

- [ ] **Step 5: Commit**

```bash
git add backend/tests/integration/intercambioExchange.integration.test.js
git commit -m "test(integration): swap sell + rejection cases (rollback + envelopes)"
```

---

## Notes / accepted consequences

- The two pre-existing root-level `*.integration.test.js` (`balanceLockRace`, `usuarioAssociations`) are now excluded from `npm test` (unit config ignores `*.integration.test.js`) and are **not** matched by the integration config (which only matches `tests/integration/**`). They effectively stop running until a **follow-up** aligns them onto this harness (already a spec non-goal). They only ever self-skipped without a DB, so no real coverage is lost now.
- **Auth failures use a legacy shape** (`{ success:false, message }`), not the canonical envelope — pinned by the "no token" test. Migrating the auth middleware to the envelope is out of scope here.
- **Follow-ups after this plan:** align the 2 old integration tests; add trading/matching integration flow; withdrawal pipeline with injected blockchain provider; wire `test:integration` into CI (Fase 5).

## Self-Review

- **Spec coverage:** app.js extraction (Task 1) ✓; docker-compose.test.yml + jest split + DB lifecycle (Task 2) ✓; factories/auth helpers (Task 3) ✓; swap buy/sell/insufficient/daily-limit/pair-not-found/no-token (Tasks 4–5) ✓; truncate isolation (Task 2 `resetDb`, used in every suite) ✓; exact-string money assertions (Tasks 3–5) ✓. All spec sections mapped.
- **Placeholder scan:** the two "confirm against the model" notes (wallet-maestra balance column, `/me/balances` response shape, extra required columns) are explicit verification steps, not hidden work — the implementer resolves them against real files during the task. No `TBD`/`TODO` left as deliverables.
- **Type consistency:** factory signatures in Task 3's Interfaces match their usage in Tasks 4–5 (`seedUser`, `authHeader`, `seedCripto`, `seedPar`, `seedBalance`, `seedWalletMaestra`, `getBalance`); `resetDb`/`sequelize` from `db.js` used consistently; `authTokenFor` payload `{ id }` matches `authMiddleware` `decoded.id`.
```
