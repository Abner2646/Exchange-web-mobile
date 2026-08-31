# Ledger Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the append-only double-entry ledger core (tables, posting service, reconciliation, backfill) as a self-contained, fully-tested foundation — NOT yet wired to any money-path.

**Architecture:** Three append-only tables (`ledger_accounts`, `ledger_transactions`, `ledger_postings`) plus a derived projection (`ledger_balances`). A single `postingService.postTransaction` primitive is the only writer: it validates zero-sum-per-currency, inserts the asiento + postings, and updates the projection under a row lock, rejecting overdraws on user accounts. Reconciliation and a backfill of today's `BalanceUsuario` rows round out the foundation. This is Plan 1 of the ledger migration (spec: `docs/superpowers/specs/2026-08-31-double-entry-ledger-design.md`); the compatibility shim that routes `BalanceUsuario` through the ledger is a later plan.

**Tech Stack:** Node/Express, Sequelize, Postgres, Jest + Supertest, `backend/utils/money.js` (decimal.js), existing integration harness (`tests/helpers/testEnv`, `db`, `factories`).

## Global Constraints

- **Language policy:** code identifiers and comments in **Spanish** until the Fase 6.2 rename. Commit messages, branch names, PR descriptions in **English** (Conventional Commits).
- **Money arithmetic:** ALL arithmetic on monetary amounts goes through `backend/utils/money.js` (`add`, `subtract`, `multiply`, `compare`). Never `parseFloat`/`Number()` on money.
- **Money columns:** `DECIMAL(28, 8)`. Amounts flow as canonical **strings**, never JS numbers.
- **Append-only:** never `UPDATE`/`DELETE` a `ledger_transactions` or `ledger_postings` row. Corrections are new reversing asientos. (`ledger_balances` is a derived projection and IS updated in place.)
- **House owner sentinel:** house/system accounts use a fixed `ownerId` sentinel (`HOUSE_OWNER_ID`), not SQL NULL — Postgres treats NULLs as distinct in unique indexes, which would break account dedup. This is an intentional refinement of the spec's "ownerId null for house".
- **Git:** work directly on `dev`. Conventional Commit per task.
- **Tests:** integration tests need the test DB up: `npm run test:integration:up` (once), run with `npx jest --config jest.integration.config.js <file>`, tear down with `npm run test:integration:down`. Unit tests: `npx jest <file>`. All commands run from `backend/`.

---

## File Structure

**Create:**
- `backend/models/entities/cuentaLedger.entity.js` — `CuentaLedger` (ledger_accounts) schema.
- `backend/models/entities/asientoLedger.entity.js` — `AsientoLedger` (ledger_transactions) schema.
- `backend/models/entities/movimientoLedger.entity.js` — `MovimientoLedger` (ledger_postings) schema.
- `backend/models/entities/saldoLedger.entity.js` — `SaldoLedger` (ledger_balances) projection schema.
- `backend/services/ledger/ledgerAccounts.js` — purpose constants, `HOUSE_OWNER_ID`, `resolveAccount`, `isCuentaUsuario`.
- `backend/services/ledger/postingService.js` — `validarSumaCero`, `postTransaction`, `getSaldoCuenta`.
- `backend/services/ledger/reconciliation.js` — `reconciliarInterno`, `reconciliarExterno`.
- `backend/services/ledger/backfill.js` — `backfillSaldosDeApertura`.
- `backend/tests/ledgerZeroSum.test.js` — unit test for `validarSumaCero` (pure, no DB).
- `backend/tests/integration/ledgerPosting.integration.test.js` — `postTransaction` + projection + idempotency + overdraw.
- `backend/tests/integration/ledgerReconciliation.integration.test.js` — internal + external reconciliation.
- `backend/tests/integration/ledgerBackfill.integration.test.js` — backfill from `BalanceUsuario`.

**Modify:**
- `backend/models/index.js` — register the 4 new entities and their associations.

---

### Task 1: Ledger entities + model wiring

**Files:**
- Create: `backend/models/entities/cuentaLedger.entity.js`
- Create: `backend/models/entities/asientoLedger.entity.js`
- Create: `backend/models/entities/movimientoLedger.entity.js`
- Create: `backend/models/entities/saldoLedger.entity.js`
- Modify: `backend/models/index.js`
- Test: `backend/tests/integration/ledgerPosting.integration.test.js` (smoke portion only in this task)

**Interfaces:**
- Consumes: nothing.
- Produces: Sequelize models `CuentaLedger`, `AsientoLedger`, `MovimientoLedger`, `SaldoLedger`, exported from `models/index.js`. Field names (camelCase attribute → snake_case column): `CuentaLedger { id, ownerId(owner_id), proposito, criptomonedaId(criptomoneda_id), createdAt(created_at) }`, unique `(owner_id, proposito, criptomoneda_id)`. `AsientoLedger { id, tipo, referencia(unique), descripcion, asientoReversadoId(asiento_reversado_id), createdAt(created_at) }`. `MovimientoLedger { id, asientoId(asiento_id), cuentaId(cuenta_id), criptomonedaId(criptomoneda_id), monto, createdAt(created_at) }`. `SaldoLedger { cuentaId(cuenta_id, PK), saldo, updatedAt(updated_at) }`.

- [ ] **Step 1: Write the failing smoke test**

Create `backend/tests/integration/ledgerPosting.integration.test.js`:

```js
require('../helpers/testEnv');
const { sequelize, CuentaLedger, AsientoLedger, MovimientoLedger, SaldoLedger } = require('../../models');
const { resetDb } = require('../helpers/db');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

describe('ledger schema', () => {
  test('the four ledger models are registered and their tables exist', async () => {
    expect(CuentaLedger).toBeDefined();
    expect(AsientoLedger).toBeDefined();
    expect(MovimientoLedger).toBeDefined();
    expect(SaldoLedger).toBeDefined();
    // Tables created by sync: a count query must not throw.
    await expect(CuentaLedger.count()).resolves.toBe(0);
    await expect(AsientoLedger.count()).resolves.toBe(0);
    await expect(MovimientoLedger.count()).resolves.toBe(0);
    await expect(SaldoLedger.count()).resolves.toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration:up` then `npx jest --config jest.integration.config.js ledgerPosting`
Expected: FAIL — `CuentaLedger` is undefined (not yet exported from models).

- [ ] **Step 3: Create the four entity files**

`backend/models/entities/cuentaLedger.entity.js`:
```js
const { DataTypes, Model } = require('sequelize');

class CuentaLedger extends Model {}

function initCuentaLedger(sequelize) {
  CuentaLedger.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    ownerId: { type: DataTypes.UUID, allowNull: false, field: 'owner_id' }, // usuario, o HOUSE_OWNER_ID para casa
    proposito: { type: DataTypes.STRING, allowNull: false }, // ej. 'funding:disponible', 'fee_revenue'
    criptomonedaId: { type: DataTypes.UUID, allowNull: false, field: 'criptomoneda_id' },
  }, {
    sequelize,
    modelName: 'CuentaLedger',
    tableName: 'ledger_accounts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ unique: true, fields: ['owner_id', 'proposito', 'criptomoneda_id'] }],
  });
  return CuentaLedger;
}

module.exports = initCuentaLedger;
```

`backend/models/entities/asientoLedger.entity.js`:
```js
const { DataTypes, Model } = require('sequelize');

class AsientoLedger extends Model {}

function initAsientoLedger(sequelize) {
  AsientoLedger.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tipo: { type: DataTypes.STRING, allowNull: false },
    referencia: { type: DataTypes.STRING, allowNull: false, unique: true }, // idempotencia
    descripcion: { type: DataTypes.STRING, allowNull: true },
    asientoReversadoId: { type: DataTypes.UUID, allowNull: true, field: 'asiento_reversado_id' },
  }, {
    sequelize,
    modelName: 'AsientoLedger',
    tableName: 'ledger_transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
  return AsientoLedger;
}

module.exports = initAsientoLedger;
```

`backend/models/entities/movimientoLedger.entity.js`:
```js
const { DataTypes, Model } = require('sequelize');

class MovimientoLedger extends Model {}

function initMovimientoLedger(sequelize) {
  MovimientoLedger.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    asientoId: { type: DataTypes.UUID, allowNull: false, field: 'asiento_id' },
    cuentaId: { type: DataTypes.UUID, allowNull: false, field: 'cuenta_id' },
    criptomonedaId: { type: DataTypes.UUID, allowNull: false, field: 'criptomoneda_id' },
    monto: { type: DataTypes.DECIMAL(28, 8), allowNull: false }, // con signo: + credito / - debito
  }, {
    sequelize,
    modelName: 'MovimientoLedger',
    tableName: 'ledger_postings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['cuenta_id'] }, { fields: ['asiento_id'] }],
  });
  return MovimientoLedger;
}

module.exports = initMovimientoLedger;
```

`backend/models/entities/saldoLedger.entity.js`:
```js
const { DataTypes, Model } = require('sequelize');

class SaldoLedger extends Model {}

function initSaldoLedger(sequelize) {
  SaldoLedger.init({
    cuentaId: { type: DataTypes.UUID, primaryKey: true, field: 'cuenta_id' },
    saldo: { type: DataTypes.DECIMAL(28, 8), allowNull: false, defaultValue: 0 },
  }, {
    sequelize,
    modelName: 'SaldoLedger',
    tableName: 'ledger_balances',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at',
  });
  return SaldoLedger;
}

module.exports = initSaldoLedger;
```

- [ ] **Step 4: Wire the entities into `models/index.js`**

Find where other entities are required and initialized (e.g. `initBalanceUser`). Add the four requires near the other entity requires:
```js
const initCuentaLedger = require('./entities/cuentaLedger.entity');
const initAsientoLedger = require('./entities/asientoLedger.entity');
const initMovimientoLedger = require('./entities/movimientoLedger.entity');
const initSaldoLedger = require('./entities/saldoLedger.entity');
```

Where the other models are initialized with `sequelize`, add:
```js
const CuentaLedger = initCuentaLedger(sequelize);
const AsientoLedger = initAsientoLedger(sequelize);
const MovimientoLedger = initMovimientoLedger(sequelize);
const SaldoLedger = initSaldoLedger(sequelize);
```

Add associations near the other `.hasMany`/`.belongsTo` declarations:
```js
AsientoLedger.hasMany(MovimientoLedger, { foreignKey: 'asientoId', as: 'movimientos' });
MovimientoLedger.belongsTo(AsientoLedger, { foreignKey: 'asientoId', as: 'asiento' });
MovimientoLedger.belongsTo(CuentaLedger, { foreignKey: 'cuentaId', as: 'cuenta' });
CuentaLedger.hasMany(MovimientoLedger, { foreignKey: 'cuentaId', as: 'movimientos' });
CuentaLedger.hasOne(SaldoLedger, { foreignKey: 'cuentaId', as: 'saldoProyectado' });
SaldoLedger.belongsTo(CuentaLedger, { foreignKey: 'cuentaId', as: 'cuenta' });
```

Add all four to the `module.exports` object alongside the other models:
```js
CuentaLedger,
AsientoLedger,
MovimientoLedger,
SaldoLedger,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest --config jest.integration.config.js ledgerPosting`
Expected: PASS (4 models defined, 4 tables count 0).

- [ ] **Step 6: Commit**

```bash
git add backend/models/entities/cuentaLedger.entity.js backend/models/entities/asientoLedger.entity.js backend/models/entities/movimientoLedger.entity.js backend/models/entities/saldoLedger.entity.js backend/models/index.js backend/tests/integration/ledgerPosting.integration.test.js
git commit -m "feat(ledger): add append-only ledger tables and projection"
```

---

### Task 2: Account resolution + purpose constants

**Files:**
- Create: `backend/services/ledger/ledgerAccounts.js`
- Test: `backend/tests/integration/ledgerPosting.integration.test.js` (append a describe block)

**Interfaces:**
- Consumes: `CuentaLedger` from `models`.
- Produces:
  - `HOUSE_OWNER_ID` — string constant `'00000000-0000-0000-0000-000000000000'`.
  - `PROPOSITOS` — object: `{ FUNDING_DISPONIBLE:'funding:disponible', FUNDING_PENDIENTE:'funding:pendiente', FUNDING_BLOQUEADO:'funding:bloqueado', SPOT_DISPONIBLE:'spot:disponible', SPOT_BLOQUEADO:'spot:bloqueado', EXTERNAL_ONCHAIN:'external_onchain', FEE_REVENUE:'fee_revenue', TREASURY:'treasury', SUSPENSE:'suspense', APERTURA:'apertura' }`.
  - `resolveAccount({ ownerId, proposito, criptomonedaId }, transaction)` → `CuentaLedger` instance (get-or-create; `ownerId` falsy ⇒ `HOUSE_OWNER_ID`).
  - `isCuentaUsuario(cuenta)` → boolean (`cuenta.ownerId !== HOUSE_OWNER_ID`).

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/integration/ledgerPosting.integration.test.js`:
```js
const ledgerAccounts = require('../../services/ledger/ledgerAccounts');
const f = require('../helpers/factories');

describe('ledgerAccounts.resolveAccount', () => {
  test('get-or-creates an account and is idempotent on the natural key', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();

    const first = await ledgerAccounts.resolveAccount(
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id }
    );
    const again = await ledgerAccounts.resolveAccount(
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id }
    );

    expect(first.id).toBe(again.id);
    expect(await CuentaLedger.count()).toBe(1);
    expect(ledgerAccounts.isCuentaUsuario(first)).toBe(true);
  });

  test('a house account resolves under the sentinel owner', async () => {
    const cripto = await f.seedCripto('USDT');
    const casa = await ledgerAccounts.resolveAccount(
      { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.FEE_REVENUE, criptomonedaId: cripto.id }
    );
    expect(casa.ownerId).toBe(ledgerAccounts.HOUSE_OWNER_ID);
    expect(ledgerAccounts.isCuentaUsuario(casa)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config jest.integration.config.js ledgerPosting`
Expected: FAIL — cannot find module `services/ledger/ledgerAccounts`.

- [ ] **Step 3: Write the implementation**

`backend/services/ledger/ledgerAccounts.js`:
```js
const { CuentaLedger } = require('../../models');

// Las cuentas de casa/sistema usan un ownerId centinela en vez de NULL: Postgres
// trata cada NULL como distinto en un indice unico, lo que romperia la dedup de
// cuentas de casa (dos 'fee_revenue' BTC coexistirian). Con un UUID fijo el
// indice unico (owner_id, proposito, criptomoneda_id) funciona normal.
const HOUSE_OWNER_ID = '00000000-0000-0000-0000-000000000000';

const PROPOSITOS = {
  FUNDING_DISPONIBLE: 'funding:disponible',
  FUNDING_PENDIENTE: 'funding:pendiente',
  FUNDING_BLOQUEADO: 'funding:bloqueado',
  SPOT_DISPONIBLE: 'spot:disponible',
  SPOT_BLOQUEADO: 'spot:bloqueado',
  EXTERNAL_ONCHAIN: 'external_onchain',
  FEE_REVENUE: 'fee_revenue',
  TREASURY: 'treasury',
  SUSPENSE: 'suspense',
  APERTURA: 'apertura',
};

async function resolveAccount({ ownerId, proposito, criptomonedaId }, transaction = null) {
  const owner = ownerId || HOUSE_OWNER_ID;
  const [cuenta] = await CuentaLedger.findOrCreate({
    where: { ownerId: owner, proposito, criptomonedaId },
    defaults: { ownerId: owner, proposito, criptomonedaId },
    transaction,
  });
  return cuenta;
}

function isCuentaUsuario(cuenta) {
  return cuenta.ownerId !== HOUSE_OWNER_ID;
}

module.exports = { HOUSE_OWNER_ID, PROPOSITOS, resolveAccount, isCuentaUsuario };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config jest.integration.config.js ledgerPosting`
Expected: PASS (all describe blocks so far green).

- [ ] **Step 5: Commit**

```bash
git add backend/services/ledger/ledgerAccounts.js backend/tests/integration/ledgerPosting.integration.test.js
git commit -m "feat(ledger): account resolution and purpose constants"
```

---

### Task 3: Zero-sum validation (pure unit)

**Files:**
- Create: `backend/services/ledger/postingService.js` (partial — `validarSumaCero` only)
- Test: `backend/tests/ledgerZeroSum.test.js`

**Interfaces:**
- Consumes: `money` from `utils/money`.
- Produces: `validarSumaCero(lineas)` — throws `Error` if any currency's signed `monto` sum ≠ 0; returns nothing on success. `lineas` shape: `[{ criptomonedaId, monto }]` (`monto` is a signed string).

- [ ] **Step 1: Write the failing test**

`backend/tests/ledgerZeroSum.test.js`:
```js
const { validarSumaCero } = require('../services/ledger/postingService');

describe('validarSumaCero', () => {
  test('accepts a balanced single-currency asiento', () => {
    expect(() => validarSumaCero([
      { criptomonedaId: 'btc', monto: '-5.00000000' },
      { criptomonedaId: 'btc', monto: '5.00000000' },
    ])).not.toThrow();
  });

  test('accepts a balanced cross-currency asiento (each currency nets to zero)', () => {
    expect(() => validarSumaCero([
      { criptomonedaId: 'usdt', monto: '-100.00000000' },
      { criptomonedaId: 'usdt', monto: '100.00000000' },
      { criptomonedaId: 'btc', monto: '-1.00000000' },
      { criptomonedaId: 'btc', monto: '0.99900000' },
      { criptomonedaId: 'btc', monto: '0.00100000' },
    ])).not.toThrow();
  });

  test('rejects an unbalanced asiento', () => {
    expect(() => validarSumaCero([
      { criptomonedaId: 'btc', monto: '-5.00000000' },
      { criptomonedaId: 'btc', monto: '4.00000000' },
    ])).toThrow(/desbalanceado/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest ledgerZeroSum`
Expected: FAIL — cannot find module `services/ledger/postingService`.

- [ ] **Step 3: Write the implementation**

`backend/services/ledger/postingService.js`:
```js
const money = require('../../utils/money');

// Invariante de partida doble: dentro de un asiento, la suma con signo de los
// montos debe dar 0 POR CADA cripto (un swap cruza dos criptos y cada una
// cuadra sola).
function validarSumaCero(lineas) {
  const porCripto = {};
  for (const l of lineas) {
    porCripto[l.criptomonedaId] = money.add(porCripto[l.criptomonedaId] || '0', String(l.monto));
  }
  for (const [criptomonedaId, suma] of Object.entries(porCripto)) {
    if (money.compare(suma, '0') !== 0) {
      throw new Error(`Asiento desbalanceado en cripto ${criptomonedaId}: suma ${suma}`);
    }
  }
}

module.exports = { validarSumaCero };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest ledgerZeroSum`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/ledger/postingService.js backend/tests/ledgerZeroSum.test.js
git commit -m "feat(ledger): zero-sum-per-currency validation"
```

---

### Task 4: postTransaction — insert asiento + postings + projection

**Files:**
- Modify: `backend/services/ledger/postingService.js`
- Test: `backend/tests/integration/ledgerPosting.integration.test.js` (append)

**Interfaces:**
- Consumes: `validarSumaCero`; `resolveAccount`, `isCuentaUsuario` from `ledgerAccounts`; models `AsientoLedger`, `MovimientoLedger`, `SaldoLedger`, `sequelize`; `money`.
- Produces:
  - `postTransaction({ tipo, referencia, descripcion, asientoReversadoId, lineas }, transaction=null)` → `AsientoLedger`. `lineas` shape: `[{ ownerId, proposito, criptomonedaId, monto }]` (`monto` signed string). Opens its own transaction if none passed. Idempotent on `referencia` (returns the existing asiento, posts nothing). Throws on unbalanced asiento or on a user-account overdraw (projection would go negative).
  - `getSaldoCuenta({ ownerId, proposito, criptomonedaId }, transaction=null)` → string canonical amount (`'0'` if the account/projection doesn't exist).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/integration/ledgerPosting.integration.test.js`:
```js
const posting = require('../../services/ledger/postingService');

describe('postTransaction', () => {
  async function seedCryptoAndUser() {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    return { cripto, user };
  }

  test('posts a balanced transfer and updates both projections', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    // Fund the user first (apertura -> funding:disponible +10).
    await posting.postTransaction({
      tipo: 'apertura', referencia: 'seed-1', lineas: [
        { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: '-10.00000000' },
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '10.00000000' },
      ],
    });

    // Block 4: disponible -> bloqueado.
    await posting.postTransaction({
      tipo: 'reserva_orden', referencia: 'block-1', lineas: [
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '-4.00000000' },
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id, monto: '4.00000000' },
      ],
    });

    const disp = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    const bloq = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id });
    expect(disp).toBe('6.00000000');
    expect(bloq).toBe('4.00000000');
  });

  test('is idempotent on referencia (a replay posts nothing)', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    const lineas = [
      { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: '-3.00000000' },
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '3.00000000' },
    ];
    await posting.postTransaction({ tipo: 'apertura', referencia: 'dup-1', lineas });
    await posting.postTransaction({ tipo: 'apertura', referencia: 'dup-1', lineas }); // replay

    expect(await AsientoLedger.count()).toBe(1);
    const disp = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    expect(disp).toBe('3.00000000');
  });

  test('rejects an overdraw on a user account and rolls back the whole asiento', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    await expect(posting.postTransaction({
      tipo: 'reserva_orden', referencia: 'over-1', lineas: [
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '-5.00000000' },
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id, monto: '5.00000000' },
      ],
    })).rejects.toThrow(/sobregiro/i);

    expect(await AsientoLedger.count()).toBe(0); // rolled back
    expect(await MovimientoLedger.count()).toBe(0);
  });

  test('rejects an unbalanced asiento before touching the DB', async () => {
    const { cripto, user } = await seedCryptoAndUser();
    await expect(posting.postTransaction({
      tipo: 'apertura', referencia: 'bad-1', lineas: [
        { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '5.00000000' },
      ],
    })).rejects.toThrow(/desbalanceado/i);
    expect(await AsientoLedger.count()).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config jest.integration.config.js ledgerPosting`
Expected: FAIL — `posting.postTransaction is not a function`.

- [ ] **Step 3: Extend the implementation**

Replace the contents of `backend/services/ledger/postingService.js` with:
```js
const money = require('../../utils/money');
const { sequelize, AsientoLedger, MovimientoLedger, SaldoLedger } = require('../../models');
const { resolveAccount, isCuentaUsuario } = require('./ledgerAccounts');

// Invariante de partida doble: dentro de un asiento, la suma con signo de los
// montos debe dar 0 POR CADA cripto (un swap cruza dos criptos y cada una
// cuadra sola).
function validarSumaCero(lineas) {
  const porCripto = {};
  for (const l of lineas) {
    porCripto[l.criptomonedaId] = money.add(porCripto[l.criptomonedaId] || '0', String(l.monto));
  }
  for (const [criptomonedaId, suma] of Object.entries(porCripto)) {
    if (money.compare(suma, '0') !== 0) {
      throw new Error(`Asiento desbalanceado en cripto ${criptomonedaId}: suma ${suma}`);
    }
  }
}

// El UNICO escritor de dinero. Inserta el asiento + sus movimientos y actualiza
// la proyeccion de saldo de cada cuenta, todo en una transaccion. Idempotente
// por `referencia`. Rechaza asientos desbalanceados y sobregiros de cuentas de
// usuario.
async function postTransaction({ tipo, referencia, descripcion = null, asientoReversadoId = null, lineas }, transaction = null) {
  validarSumaCero(lineas);

  const propia = !transaction;
  const t = transaction || await sequelize.transaction();
  try {
    // Idempotencia: si ya existe un asiento con esta referencia, no se postea nada.
    const existente = await AsientoLedger.findOne({ where: { referencia }, transaction: t });
    if (existente) {
      if (propia) await t.commit();
      return existente;
    }

    const asiento = await AsientoLedger.create(
      { tipo, referencia, descripcion, asientoReversadoId }, { transaction: t }
    );

    for (const linea of lineas) {
      const cuenta = await resolveAccount(linea, t);
      await MovimientoLedger.create({
        asientoId: asiento.id,
        cuentaId: cuenta.id,
        criptomonedaId: linea.criptomonedaId,
        monto: String(linea.monto),
      }, { transaction: t });

      // Proyeccion bajo lock de fila: serializa por cuenta (anti-sobregiro).
      let saldo = await SaldoLedger.findOne({
        where: { cuentaId: cuenta.id }, transaction: t, lock: t.LOCK.UPDATE,
      });
      if (!saldo) {
        saldo = await SaldoLedger.create({ cuentaId: cuenta.id, saldo: '0' }, { transaction: t });
      }
      const nuevo = money.add(String(saldo.saldo), String(linea.monto));
      if (isCuentaUsuario(cuenta) && money.compare(nuevo, '0') < 0) {
        throw new Error(`Sobregiro en cuenta ${cuenta.proposito}: saldo ${saldo.saldo}, movimiento ${linea.monto}`);
      }
      saldo.saldo = nuevo;
      await saldo.save({ transaction: t });
    }

    if (propia) await t.commit();
    return asiento;
  } catch (error) {
    if (propia) await t.rollback();
    throw error;
  }
}

async function getSaldoCuenta({ ownerId, proposito, criptomonedaId }, transaction = null) {
  const { CuentaLedger } = require('../../models');
  const owner = ownerId || require('./ledgerAccounts').HOUSE_OWNER_ID;
  const cuenta = await CuentaLedger.findOne({ where: { ownerId: owner, proposito, criptomonedaId }, transaction });
  if (!cuenta) return '0';
  const saldo = await SaldoLedger.findOne({ where: { cuentaId: cuenta.id }, transaction });
  return saldo ? String(saldo.saldo) : '0';
}

module.exports = { validarSumaCero, postTransaction, getSaldoCuenta };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --config jest.integration.config.js ledgerPosting` and `npx jest ledgerZeroSum`
Expected: PASS (both files fully green; the unit `validarSumaCero` test still passes against the extended module).

- [ ] **Step 5: Commit**

```bash
git add backend/services/ledger/postingService.js backend/tests/integration/ledgerPosting.integration.test.js
git commit -m "feat(ledger): postTransaction with projection update, idempotency, overdraw guard"
```

---

### Task 5: Concurrency regression — no double-spend at the ledger level

**Files:**
- Test: `backend/tests/integration/ledgerPosting.integration.test.js` (append)

**Interfaces:**
- Consumes: `postTransaction`, `getSaldoCuenta`.
- Produces: nothing (regression test only). This is the Críticos #5 hazard re-expressed at the ledger: two concurrent blocks of the same funds must not both succeed.

- [ ] **Step 1: Write the failing-then-passing regression test**

Append to `backend/tests/integration/ledgerPosting.integration.test.js`:
```js
describe('postTransaction concurrency (Criticos #5 regression)', () => {
  test('two concurrent blocks of the same funds: exactly one succeeds, no overdraw', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    // Fund with exactly 5.
    await posting.postTransaction({ tipo: 'apertura', referencia: 'conc-seed', lineas: [
      { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: '-5.00000000' },
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '5.00000000' },
    ] });

    const bloquear = (ref) => posting.postTransaction({ tipo: 'reserva_orden', referencia: ref, lineas: [
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '-5.00000000' },
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id, monto: '5.00000000' },
    ] });

    const results = await Promise.allSettled([bloquear('conc-a'), bloquear('conc-b')]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    expect(ok).toBe(1);
    expect(failed).toBe(1);

    const disp = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    const bloq = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id });
    expect(disp).toBe('0.00000000');
    expect(bloq).toBe('5.00000000');
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest --config jest.integration.config.js ledgerPosting`
Expected: PASS — the `FOR UPDATE` lock on the projection row serializes the two blocks; the loser sees `disponible = 0` and its overdraw guard throws. (If it fails with both succeeding, the projection lock is not being applied — revisit Task 4 Step 3.)

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/ledgerPosting.integration.test.js
git commit -m "test(ledger): concurrency regression proves no double-block at ledger level"
```

---

### Task 6: Reconciliation (internal + external)

**Files:**
- Create: `backend/services/ledger/reconciliation.js`
- Test: `backend/tests/integration/ledgerReconciliation.integration.test.js`

**Interfaces:**
- Consumes: models `CuentaLedger`, `MovimientoLedger`, `SaldoLedger`, `sequelize`; `HOUSE_OWNER_ID`; `money`.
- Produces:
  - `reconciliarInterno(transaction=null)` → `{ ok: boolean, discrepancias: [{ cuentaId, proyeccion, suma }] }`. For every account, `SaldoLedger.saldo` must equal `SUM(MovimientoLedger.monto)`.
  - `reconciliarExterno(transaction=null)` → `{ ok: boolean, porCripto: { [criptomonedaId]: { usuarios, casa, neto } } }`. Per crypto, `SUM(user postings) + SUM(house postings) == 0` (the book closes to zero).

- [ ] **Step 1: Write the failing test**

`backend/tests/integration/ledgerReconciliation.integration.test.js`:
```js
require('../helpers/testEnv');
const { sequelize } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../services/ledger/postingService');
const ledgerAccounts = require('../../services/ledger/ledgerAccounts');
const recon = require('../../services/ledger/reconciliation');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

describe('reconciliation', () => {
  test('internal: projection equals the sum of postings for every account', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await posting.postTransaction({ tipo: 'apertura', referencia: 'rec-1', lineas: [
      { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: '-7.00000000' },
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '7.00000000' },
    ] });

    const res = await recon.reconciliarInterno();
    expect(res.ok).toBe(true);
    expect(res.discrepancias).toEqual([]);
  });

  test('external: the book closes to zero per crypto (sum of all postings is zero)', async () => {
    const cripto = await f.seedCripto('USDT');
    const user = await f.seedUser();
    await posting.postTransaction({ tipo: 'apertura', referencia: 'rec-2', lineas: [
      { ownerId: null, proposito: ledgerAccounts.PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: '-100.00000000' },
      { ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: '100.00000000' },
    ] });

    const res = await recon.reconciliarExterno();
    expect(res.ok).toBe(true);
    expect(res.porCripto[cripto.id].neto).toBe('0'); // money.add usa toFixed() sin escala fija
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config jest.integration.config.js ledgerReconciliation`
Expected: FAIL — cannot find module `services/ledger/reconciliation`.

- [ ] **Step 3: Write the implementation**

`backend/services/ledger/reconciliation.js`:
```js
const money = require('../../utils/money');
const { CuentaLedger, MovimientoLedger, SaldoLedger } = require('../../models');
const { HOUSE_OWNER_ID } = require('./ledgerAccounts');

// Interno: para toda cuenta, la proyeccion (SaldoLedger) debe ser igual a la
// suma de sus movimientos. Si difiere, la proyeccion se desincronizo (bug).
async function reconciliarInterno(transaction = null) {
  const cuentas = await CuentaLedger.findAll({ transaction });
  const discrepancias = [];
  for (const cuenta of cuentas) {
    const movimientos = await MovimientoLedger.findAll({ where: { cuentaId: cuenta.id }, transaction });
    let suma = '0';
    for (const m of movimientos) suma = money.add(suma, String(m.monto));
    const proy = await SaldoLedger.findOne({ where: { cuentaId: cuenta.id }, transaction });
    const proyeccion = proy ? String(proy.saldo) : '0';
    if (money.compare(proyeccion, suma) !== 0) {
      discrepancias.push({ cuentaId: cuenta.id, proyeccion, suma });
    }
  }
  return { ok: discrepancias.length === 0, discrepancias };
}

// Externo: por cada cripto, la suma de TODOS los movimientos (usuarios + casa)
// debe dar 0 — el libro cierra. Se reporta usuarios vs casa por transparencia.
async function reconciliarExterno(transaction = null) {
  const movimientos = await MovimientoLedger.findAll({
    include: [{ model: CuentaLedger, as: 'cuenta', attributes: ['ownerId'] }],
    transaction,
  });
  const porCripto = {};
  for (const m of movimientos) {
    const c = m.criptomonedaId;
    if (!porCripto[c]) porCripto[c] = { usuarios: '0', casa: '0', neto: '0' };
    const esCasa = m.cuenta.ownerId === HOUSE_OWNER_ID;
    if (esCasa) porCripto[c].casa = money.add(porCripto[c].casa, String(m.monto));
    else porCripto[c].usuarios = money.add(porCripto[c].usuarios, String(m.monto));
  }
  let ok = true;
  for (const c of Object.keys(porCripto)) {
    porCripto[c].neto = money.add(porCripto[c].usuarios, porCripto[c].casa);
    if (money.compare(porCripto[c].neto, '0') !== 0) ok = false;
  }
  return { ok, porCripto };
}

module.exports = { reconciliarInterno, reconciliarExterno };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config jest.integration.config.js ledgerReconciliation`
Expected: PASS (both reconciliation tests green).

- [ ] **Step 5: Commit**

```bash
git add backend/services/ledger/reconciliation.js backend/tests/integration/ledgerReconciliation.integration.test.js
git commit -m "feat(ledger): internal and external reconciliation"
```

---

### Task 7: Backfill opening balances from BalanceUsuario

**Files:**
- Create: `backend/services/ledger/backfill.js`
- Test: `backend/tests/integration/ledgerBackfill.integration.test.js`

**Interfaces:**
- Consumes: models `BalanceUsuario`; `postTransaction`; `PROPOSITOS`; `money`; `reconciliarInterno`/`reconciliarExterno` (assertions in test only).
- Produces: `backfillSaldosDeApertura(transaction=null)` → `{ asientos: number }`. For each `BalanceUsuario` row with a non-zero `balanceDisponible` and/or `balanceBloqueado`, posts one `apertura` asiento crediting the user's `funding:disponible` and `funding:bloqueado` (as applicable) against the `apertura` house account. Idempotent: `referencia = 'apertura:' + balance.id`.

- [ ] **Step 1: Write the failing test**

`backend/tests/integration/ledgerBackfill.integration.test.js`:
```js
require('../helpers/testEnv');
const { sequelize, BalanceUsuario } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../services/ledger/postingService');
const ledgerAccounts = require('../../services/ledger/ledgerAccounts');
const recon = require('../../services/ledger/reconciliation');
const { backfillSaldosDeApertura } = require('../../services/ledger/backfill');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

describe('backfillSaldosDeApertura', () => {
  test('mirrors each BalanceUsuario into funding disponible/bloqueado and reconciles', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({
      userId: user.id, criptomonedaId: cripto.id,
      balanceDisponible: '6.00000000', balanceBloqueado: '4.00000000',
    });

    const res = await backfillSaldosDeApertura();
    expect(res.asientos).toBe(1);

    const disp = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    const bloq = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id });
    expect(disp).toBe('6.00000000');
    expect(bloq).toBe('4.00000000');

    expect((await recon.reconciliarInterno()).ok).toBe(true);
    expect((await recon.reconciliarExterno()).ok).toBe(true);
  });

  test('is idempotent: running twice does not double the opening balances', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({
      userId: user.id, criptomonedaId: cripto.id,
      balanceDisponible: '3.00000000', balanceBloqueado: '0',
    });

    await backfillSaldosDeApertura();
    await backfillSaldosDeApertura();

    const disp = await posting.getSaldoCuenta({ ownerId: user.id, proposito: ledgerAccounts.PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    expect(disp).toBe('3.00000000');
  });

  test('skips zero balances (posts no asiento)', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({
      userId: user.id, criptomonedaId: cripto.id,
      balanceDisponible: '0', balanceBloqueado: '0',
    });

    const res = await backfillSaldosDeApertura();
    expect(res.asientos).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config jest.integration.config.js ledgerBackfill`
Expected: FAIL — cannot find module `services/ledger/backfill`.

- [ ] **Step 3: Write the implementation**

`backend/services/ledger/backfill.js`:
```js
const money = require('../../utils/money');
const { BalanceUsuario } = require('../../models');
const { postTransaction } = require('./postingService');
const { PROPOSITOS } = require('./ledgerAccounts');

// Backfill de apertura: replica cada BalanceUsuario existente como un asiento
// 'apertura' que acredita funding:disponible (+ funding:bloqueado si aplica)
// del usuario contra la cuenta de casa 'apertura'. Idempotente por referencia
// ('apertura:' + id del balance) — se puede correr N veces sin duplicar.
async function backfillSaldosDeApertura(transaction = null) {
  const balances = await BalanceUsuario.findAll({ transaction });
  let asientos = 0;

  for (const b of balances) {
    const disponible = String(b.balanceDisponible ?? '0');
    const bloqueado = String(b.balanceBloqueado ?? '0');
    const total = money.add(disponible, bloqueado);
    if (money.compare(total, '0') === 0) continue; // sin saldo, nada que abrir

    const lineas = [
      { ownerId: null, proposito: PROPOSITOS.APERTURA, criptomonedaId: b.criptomonedaId, monto: money.subtract('0', total) },
    ];
    if (money.compare(disponible, '0') > 0) {
      lineas.push({ ownerId: b.userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: b.criptomonedaId, monto: disponible });
    }
    if (money.compare(bloqueado, '0') > 0) {
      lineas.push({ ownerId: b.userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: b.criptomonedaId, monto: bloqueado });
    }

    await postTransaction({
      tipo: 'apertura',
      referencia: `apertura:${b.id}`,
      descripcion: 'Backfill de saldo inicial desde BalanceUsuario',
      lineas,
    }, transaction);
    asientos += 1;
  }

  return { asientos };
}

module.exports = { backfillSaldosDeApertura };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config jest.integration.config.js ledgerBackfill`
Expected: PASS (3 tests: mirror+reconcile, idempotent, skip-zero).

- [ ] **Step 5: Run the whole suite to confirm no regressions**

Run: `npx jest --config jest.integration.config.js` then `npm test`
Expected: integration all green (existing 81 + the new ledger suites); unit all green (existing 297 + `ledgerZeroSum`). Then tear down: `npm run test:integration:down`.

- [ ] **Step 6: Commit**

```bash
git add backend/services/ledger/backfill.js backend/tests/integration/ledgerBackfill.integration.test.js
git commit -m "feat(ledger): backfill opening balances from BalanceUsuario"
```

---

## Acceptance criteria (whole plan)

- The four ledger tables exist and are wired into `models/index.js`.
- `postTransaction` is the single writer: enforces zero-sum-per-currency, is idempotent on `referencia`, updates the projection under a row lock, and rejects user-account overdraws — proven by the concurrency regression.
- Reconciliation (internal projection==SUM, external book-closes-to-zero) passes.
- Backfill mirrors today's `BalanceUsuario` into `apertura` asientos, idempotently, and the result reconciles.
- Nothing in the existing money-paths is wired to the ledger yet (zero behavior change; the shim cutover is the next plan). Existing suites remain green: unit 297+1, integration 81+ (new ledger suites).

## Out of scope (this plan)

- The compatibility shim that routes `BalanceUsuario.updateBalance/blockBalance/unblockBalance` through the ledger and flips reads to the projection (next plan — completes spec Fase 1).
- Per-money-path enrichment (swap first, then deposits/withdrawals/trading/P2P) — spec Fases 2..N.
- DB-level zero-sum constraint/trigger (optional hardening).
- Reconciliation as a scheduled job / Sentry alarm (Fase 5 operational).
- Extending Stryker mutation testing to the posting service — do it once the shim makes the ledger money-critical (next plan).
