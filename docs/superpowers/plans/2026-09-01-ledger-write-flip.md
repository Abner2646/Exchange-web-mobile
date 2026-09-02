# Ledger Write-Flip (Paso B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the double-entry ledger the *only* writer of user money: reimplement `BalanceUsuario.updateBalance/blockBalance/unblockBalance` to post to the ledger directly, convert the raw deposit/withdrawal writes and provisioning to those methods, and remove the transitional CDC mirror — so nothing reads or writes `balances_users` anymore.

**Architecture:** Reads already come from the ledger projection (Plan 3 + Paso A). Today every balance write ALSO lands in `balances_users` and is shadow-posted to the ledger by the CDC mirror (`services/ledger/balanceMirror.js`). This plan cuts the writes over to post to the ledger **directly** via `postingService.postTransaction` (Funding compartment; `suspense` counterparty for single-leg legacy adjustments, two user legs for block/unblock — identical math to `balanceMirror.espejar`). The anti-double-count invariant is: **a path posts to the ledger exactly once — directly OR via the mirror, never both.** It holds automatically because a path either writes `balances_users` (→ mirror posts) or posts directly (→ and stops writing `balances_users`); it never does both. The mirror is removed only once EVERY write is direct.

**Tech Stack:** Node/Express, Sequelize, Postgres, Jest + Supertest, `backend/utils/money.js` (decimal.js), `backend/services/ledger/*` (Plan 1), integration harness (`tests/helpers/testEnv`, `db`, `factories`).

## Global Constraints

- **Language policy:** code identifiers and comments in **Spanish** until the Fase 6.2 rename. Commit messages, branch names, PR descriptions in **English** (Conventional Commits).
- **Money arithmetic:** ALL arithmetic on monetary amounts goes through `backend/utils/money.js` (`add`, `subtract`, `multiply`, `compare`). Never `parseFloat`/`Number()` on money. Amounts flow as canonical **strings**.
- **`money.add`/`subtract` return `.toFixed()` WITHOUT a fixed scale** → they yield `'0'`, not `'0.00000000'`; values read from `DECIMAL(28,8)` columns DO come back with 8 decimals. Assert accordingly (e.g. `'6.00000000'` from a column read, but `'0'`/`'10'` from a fresh `money.add`).
- **`seedCripto('BTC')` takes the symbol POSITIONALLY** (`seedCripto(symbol)`), not `{ symbol }`.
- **The mirror skips zero deltas** → a balance row at 0 has NO ledger account (so `getByUserAndCrypto` returns an object-with-`'0'` and `getByUserId` does not list zero rows).
- **`services/ledger/*` requires `models`** → cycle with `models/index.js`: use **LAZY `require` inside functions** (not at module top) in code that `models/index.js` loads (the ledger services, `balanceUsuario.model.js`).
- **SENSITIVE:** do NOT touch HD-derivation values (paths / coin-types / indices) without the user.
- **Ledger append-only:** never `UPDATE`/`DELETE` a `ledger_transactions`/`ledger_postings` row. `ledger_balances` is a projection and IS updated in place.
- **Git:** work directly on `dev`. Conventional Commit per task; push per chunk.
- **Tests from `backend/`:** integration DB up once (`npm run test:integration:up`), run with `npx jest --config jest.integration.config.js <file>`, unit with `npx jest <file>`, full unit with `npm test`, tear down with `npm run test:integration:down`.
- **Regression gate every task:** the FULL suite (`npx jest --config jest.integration.config.js` + `npm test`) AND ledger self-consistency reconciliation (`reconciliarInterno` = projection==SUM, `reconciliarExterno` = book closes to zero) stay green. `reconciliarConLegacy` is transitional scaffolding removed in Task 5 — do NOT treat it as a gate once writes go direct.

---

## File Structure

**Modify:**
- `backend/models/balanceUsuario.model.js` — reimplement `updateBalance`/`blockBalance`/`unblockBalance` to post to the ledger (Task 3); flip `getAll`/`getUsersWithBalance`/`getBalanceStats`/`reclamarBtcGratis` reads to the ledger and remove `getById` (Task 1).
- `backend/controllers/balanceUsuario.controller.js` — remove `getBalanceById` (Task 1).
- `backend/routes/balanceUsuario.routes.js` — remove the `GET /:id` route (Task 1).
- `backend/tests/helpers/factories.js` — `seedBalance` seeds the ledger directly (Task 2).
- `backend/models/transaccionBlockchain.model.js` — deposit/withdrawal writes go through the methods (Task 4).
- `backend/controllers/usuario.controller.js` — drop the provisioning balance `create` (Task 4).
- `backend/models/index.js` — unregister the mirror (Task 5).
- `backend/services/ledger/reconciliation.js` — remove `reconciliarConLegacy` (Task 5).
- Several test files — see each task.

**Create:**
- `backend/tests/integration/ledgerWriteFlip.integration.test.js` — the write-flip behavior tests (Tasks 3–4).

**Delete:**
- `backend/services/ledger/balanceMirror.js` (Task 5).
- `backend/tests/integration/ledgerMirror.integration.test.js` (Task 5).
- `backend/tests/balanceUsuario.model.test.js` (Task 3 — its unit mocks no longer model reality; coverage moves to `ledgerWriteFlip`).

---

### Task 1: Complete the read-flip — admin reads + the reclaimBtc check

**Files:**
- Modify: `backend/models/balanceUsuario.model.js` (methods `getAll`, `getUsersWithBalance`, `getBalanceStats`, `reclamarBtcGratis`; remove `getById`)
- Modify: `backend/controllers/balanceUsuario.controller.js` (remove `getBalanceById`, drop from exports)
- Modify: `backend/routes/balanceUsuario.routes.js` (remove `GET /:id`)
- Test: `backend/tests/integration/ledgerReadFlip.integration.test.js` (append a describe block)

**Interfaces:**
- Consumes: `CuentaLedger`, `SaldoLedger` from `models`; `PROPOSITOS`, `HOUSE_OWNER_ID` from `ledgerAccounts`; `leerFundingDesdeLedger` (already in this file); `money`.
- Produces (unchanged signatures, ledger-backed):
  - `getUsersWithBalance(criptomonedaId, minAmount=0)` → `[{ userId, balanceDisponible, balanceBloqueado }]` for users whose `funding:disponible` > `minAmount`.
  - `getBalanceStats()` → `[{ criptomonedaId, totalUsers, totalDisponible, totalBloqueado }]` aggregated over the Funding projection.
  - `getAll(filters)` → `[{ userId, criptomonedaId, balanceDisponible, balanceBloqueado }]` from the projection (filters: `userId`, `criptomonedaId`, `minBalance`, `limit`, `offset`).
  - `reclamarBtcGratis` internal "already has balance" check now reads the ledger (`getByUserId`).
  - `getById` / `getBalanceById` / `GET /balances/:id` **removed** (a by-row-PK read has no ledger analog; admin-only, untested).

**Why remove `getById`:** it looks a balance up by the `balances_users` row PK, which does not exist in the ledger. It is admin-only and untested. Reimplementing it would mean inventing a synthetic id; retiring it is cleaner. (Autonomy call, non-product; documented in the commit + memory.)

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/integration/ledgerReadFlip.integration.test.js`:

```js
const posting = require('../../services/ledger/postingService');
const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');

describe('read-flip: admin aggregates and the reclaimBtc check read the ledger', () => {
  test('getUsersWithBalance reads the ledger projection, not balances_users (divergence proof)', async () => {
    const cripto = await f.seedCripto('BTC');
    const real = await f.seedUser();
    await f.seedBalance(real, cripto, '5'); // mirrored → ledger funding:disponible = 5
    const legacyOnly = await f.seedUser();
    await BalanceUsuario.create(
      { userId: legacyOnly.id, criptomonedaId: cripto.id, balanceDisponible: '9.00000000', balanceBloqueado: '0' },
      { hooks: false } // ledger knows nothing about this row
    );

    const rows = await BalanceUsuario.getUsersWithBalance(cripto.id, '0');
    const userIds = rows.map((r) => r.userId);
    expect(userIds).toContain(real.id);
    expect(userIds).not.toContain(legacyOnly.id); // legacy-only row absent from the ledger view
  });

  test('getBalanceStats aggregates the ledger Funding projection', async () => {
    const btc = await f.seedCripto('BTC');
    const u1 = await f.seedUser();
    const u2 = await f.seedUser();
    await f.seedBalance(u1, btc, '2');
    await f.seedBalance(u2, btc, '3');

    const stats = await BalanceUsuario.getBalanceStats();
    const btcStat = stats.find((s) => s.criptomonedaId === btc.id);
    expect(btcStat.totalUsers).toBe(2);
    expect(btcStat.totalDisponible).toBe('5'); // money.add sin escala fija
  });

  test('reclamarBtcGratis is blocked when the LEDGER shows a balance (not balances_users)', async () => {
    const btc = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, btc, '1'); // ledger funding = 1 → already has balance

    await expect(BalanceUsuario.reclamarBtcGratis(user.id)).rejects.toThrow(/ya tienes saldo/i);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --config jest.integration.config.js ledgerReadFlip`
Expected: FAIL — `getUsersWithBalance` includes the legacy-only user (reads `balances_users`); `getBalanceStats` aggregates the raw table; `reclamarBtcGratis` reads `balances_users` via `findAll`.

- [ ] **Step 3: Flip the reads in `balanceUsuario.model.js`**

Replace `getAll` (currently ~line 67), `getUsersWithBalance` (~244), `getBalanceStats` (~260), and the `reclamarBtcGratis` "tieneSaldo" check (~282), and DELETE `getById` (~29). Add a shared helper near `leerFundingDesdeLedger`:

```js
// Read-flip (write-flip Paso A/B): agrega la proyeccion Funding del ledger para
// las lecturas de admin. Devuelve, por (usuario, cripto) con cuenta funding, el
// disponible y bloqueado desde SaldoLedger. Require lazy por el ciclo
// models<->services/ledger.
async function agregarFundingLedger({ userId = null, criptomonedaId = null } = {}) {
  const { CuentaLedger, SaldoLedger } = require('./index');
  const { PROPOSITOS, HOUSE_OWNER_ID } = require('../services/ledger/ledgerAccounts');
  const where = { proposito: [PROPOSITOS.FUNDING_DISPONIBLE, PROPOSITOS.FUNDING_BLOQUEADO] };
  if (userId) where.ownerId = userId;
  else where.ownerId = { [Op.ne]: HOUSE_OWNER_ID }; // solo cuentas de usuario
  if (criptomonedaId) where.criptomonedaId = criptomonedaId;

  const cuentas = await CuentaLedger.findAll({
    where,
    include: [{ model: SaldoLedger, as: 'saldoProyectado', attributes: ['saldo'] }],
  });

  // Colapsar disponible/bloqueado por (ownerId, criptomonedaId).
  const porClave = new Map();
  for (const c of cuentas) {
    const clave = `${c.ownerId}:${c.criptomonedaId}`;
    if (!porClave.has(clave)) {
      porClave.set(clave, { userId: c.ownerId, criptomonedaId: c.criptomonedaId, balanceDisponible: '0', balanceBloqueado: '0' });
    }
    const entrada = porClave.get(clave);
    const saldo = c.saldoProyectado ? String(c.saldoProyectado.saldo) : '0';
    if (c.proposito === PROPOSITOS.FUNDING_DISPONIBLE) entrada.balanceDisponible = saldo;
    else entrada.balanceBloqueado = saldo;
  }
  return [...porClave.values()];
}
```

`getAll`:
```js
  BalanceUsuario.getAll = async (filters = {}) => {
    try {
      let filas = await agregarFundingLedger({ userId: filters.userId, criptomonedaId: filters.criptomonedaId });
      if (filters.minBalance) {
        filas = filas.filter((f) => money.compare(f.balanceDisponible, String(filters.minBalance)) >= 0);
      }
      const offset = filters.offset || 0;
      const limit = filters.limit || 50;
      return filas.slice(offset, offset + limit);
    } catch (error) {
      throw new Error(`Error al obtener todos los balances: ${error.message}`);
    }
  };
```

`getUsersWithBalance`:
```js
  BalanceUsuario.getUsersWithBalance = async (criptomonedaId, minAmount = 0) => {
    try {
      const filas = await agregarFundingLedger({ criptomonedaId });
      return filas
        .filter((f) => money.compare(f.balanceDisponible, String(minAmount)) > 0)
        .map((f) => ({ userId: f.userId, balanceDisponible: f.balanceDisponible, balanceBloqueado: f.balanceBloqueado }));
    } catch (error) {
      throw new Error(`Error al obtener usuarios con balance: ${error.message}`);
    }
  };
```

`getBalanceStats`:
```js
  BalanceUsuario.getBalanceStats = async () => {
    try {
      const filas = await agregarFundingLedger();
      const porCripto = new Map();
      for (const f of filas) {
        if (!porCripto.has(f.criptomonedaId)) {
          porCripto.set(f.criptomonedaId, { criptomonedaId: f.criptomonedaId, totalUsers: 0, totalDisponible: '0', totalBloqueado: '0' });
        }
        const s = porCripto.get(f.criptomonedaId);
        s.totalUsers += 1;
        s.totalDisponible = money.add(s.totalDisponible, f.balanceDisponible);
        s.totalBloqueado = money.add(s.totalBloqueado, f.balanceBloqueado);
      }
      return [...porCripto.values()];
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de balance: ${error.message}`);
    }
  };
```

In `reclamarBtcGratis`, replace the `balancesExistentes = await BalanceUsuario.findAll(...)` + `tieneSaldo` computation with a ledger read:
```js
      // Read-flip: el "ya tiene saldo" sale de la proyeccion del ledger.
      const balancesLedger = await BalanceUsuario.getByUserId(userId);
      const tieneSaldo = balancesLedger.some((b) => {
        const total = money.add(String(b.balanceDisponible), String(b.balanceBloqueado));
        return money.compare(total, '0') > 0;
      });
```

DELETE the `BalanceUsuario.getById` method entirely.

- [ ] **Step 4: Remove `getBalanceById` from the controller + route**

In `backend/controllers/balanceUsuario.controller.js`: delete the `getBalanceById` function (~lines 14–24) and remove `getBalanceById` from `module.exports`.

In `backend/routes/balanceUsuario.routes.js`: delete the line
`router.get('/:id', authenticateToken, isAdmin, balanceUserController.getBalanceById);`

- [ ] **Step 5: Run the read-flip tests + full suite**

Run: `npx jest --config jest.integration.config.js ledgerReadFlip`
Expected: PASS (divergence + aggregate + reclaim tests green).

Run: `npx jest --config jest.integration.config.js` then `npm test`
Expected: ALL green. `reclamarBtc.test.js` still passes (it seeds via the model → ledger, and asserts the reclaim path). No route test exercised `GET /balances/:id`.

- [ ] **Step 6: Commit + push**

```bash
git add backend/models/balanceUsuario.model.js backend/controllers/balanceUsuario.controller.js backend/routes/balanceUsuario.routes.js backend/tests/integration/ledgerReadFlip.integration.test.js
git commit -m "refactor(ledger): read-flip admin balance reads + reclaimBtc check to the projection"
git push origin dev
```

---

### Task 2: Decouple test seeding from the mirror

**Files:**
- Modify: `backend/tests/helpers/factories.js` (`seedBalance`)
- Test: `backend/tests/integration/ledgerWriteFlip.integration.test.js` (create; seed-decouple assertion)

**Interfaces:**
- Consumes: `postingService.postTransaction`, `PROPOSITOS`, `money`, `BalanceUsuario`.
- Produces: `seedBalance(user, cripto, monto)` → still returns the created legacy row, but now it (a) creates the `balances_users` row with `{ hooks: false }` (so the mirror does NOT double-post) and (b) posts an `apertura` asiento to the ledger directly (`apertura → funding:disponible`). After the mirror is removed (Task 5) seeded balances still reach the ledger.

**Why:** most tests seed balances via `BalanceUsuario.create`/`seedBalance` and rely on the mirror to populate the ledger. Task 5 removes the mirror. Decoupling seeding first keeps the whole suite green across mirror removal. Creating with `{ hooks: false }` + posting `apertura` directly gives the SAME ledger funding value with a house `apertura` counterparty (reconciles: book closes to zero; `funding == legacy row`).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/integration/ledgerWriteFlip.integration.test.js`:

```js
require('../helpers/testEnv');
const { sequelize, BalanceUsuario } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../services/ledger/postingService');
const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');
const recon = require('../../services/ledger/reconciliation');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

async function funding(user, cripto) {
  return {
    disponible: await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id }),
    bloqueado: await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id }),
  };
}

describe('seedBalance seeds the ledger directly (mirror-independent)', () => {
  test('seeds funding:disponible without relying on the mirror hook, and reconciles', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '7');

    const l = await funding(user, cripto);
    expect(l.disponible).toBe('7.00000000');
    // Not doubled: exactly 7 (would be 14 if both hooks:false-create-mirror AND apertura fired).
    expect((await recon.reconciliarInterno()).ok).toBe(true);
    expect((await recon.reconciliarExterno()).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest --config jest.integration.config.js ledgerWriteFlip`
Expected: FAIL — with the current `seedBalance` (create WITH hooks), the mirror posts `7` against `suspense`. That value is `7.00000000` so the disponible assertion PASSES, but there is no `apertura` posting; this test still passes today. **To make it a true RED for the decouple, first assert non-doubling under the NEW mechanism:** temporarily this passes — so instead verify the RED by changing the create to `{ hooks: false }` WITHOUT the apertura and observing `disponible === '0'`. Concretely: run the test after Step 3's `hooks:false` edit but BEFORE adding the `postTransaction`, expect `disponible` `'0'` (FAIL), then add the apertura post (GREEN). (If you prefer, keep Step 2 as a smoke run confirming the current mechanism yields `7`, then Step 3 swaps the mechanism and Step 4 re-confirms `7` from the new path.)

- [ ] **Step 3: Reimplement `seedBalance`**

In `backend/tests/helpers/factories.js`:
```js
async function seedBalance(user, cripto, monto) {
  // La fila legacy se crea con hooks:false (el mirror NO dispara) y el ledger se
  // siembra directo con un asiento 'apertura' → seedBalance no depende del mirror
  // (que se elimina en el write-flip). Mismo valor de funding, contrapartida en
  // la cuenta de casa 'apertura'.
  const { postTransaction } = require('../../services/ledger/postingService');
  const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');
  const crypto = require('crypto');
  const fila = await BalanceUsuario.create({
    userId: user.id,
    criptomonedaId: cripto.id,
    balanceDisponible: monto,
    balanceBloqueado: '0',
  }, { hooks: false });
  await postTransaction({
    tipo: 'apertura',
    referencia: `seed:${crypto.randomUUID()}`,
    lineas: [
      { ownerId: null, proposito: PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: `-${monto}` },
      { ownerId: user.id, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id, monto: String(monto) },
    ],
  });
  return fila;
}
```
(`BalanceUsuario`, `Criptomoneda`, etc. are already required at the top of `factories.js`.)

- [ ] **Step 4: Run the test + full suite**

Run: `npx jest --config jest.integration.config.js ledgerWriteFlip`
Expected: PASS (`disponible` `'7.00000000'`, reconciles).

Run: `npx jest --config jest.integration.config.js` then `npm test`
Expected: ALL green. Balances seeded by every integration test now reach the ledger via `apertura` instead of via the mirror; values are identical, so nothing else changes. `ledgerMirror.integration.test.js` still passes (it uses raw `create` WITH hooks + `blockBalance`, unaffected — those still go through the mirror).

- [ ] **Step 5: Commit + push**

```bash
git add backend/tests/helpers/factories.js backend/tests/integration/ledgerWriteFlip.integration.test.js
git commit -m "test(ledger): seed balances into the ledger directly, independent of the mirror"
git push origin dev
```

---

### Task 3: Write-flip the three static methods to post to the ledger

**Files:**
- Modify: `backend/models/balanceUsuario.model.js` (`updateBalance`, `blockBalance`, `unblockBalance`)
- Modify: `backend/tests/integration/ledgerMirror.integration.test.js` (trim the two method-based parity assertions)
- Delete: `backend/tests/balanceUsuario.model.test.js` (unit mocks no longer model reality)
- Test: `backend/tests/integration/ledgerWriteFlip.integration.test.js` (append method-behavior tests)

**Interfaces:**
- Consumes: `postTransaction` from `postingService`; `PROPOSITOS` from `ledgerAccounts`; `money`; `crypto.randomUUID`.
- Produces (signatures UNCHANGED — all existing callers keep working):
  - `updateBalance(userId, criptomonedaId, amount, type='disponible', transaction=null)` → posts one asiento: `funding:{disponible|bloqueado} += amount`, `suspense -= amount`. Throws `Error(/insuficiente/i)` if the user account would go negative. Returns `{ userId, criptomonedaId, balanceDisponible, balanceBloqueado }` (ledger read after posting).
  - `blockBalance(userId, criptomonedaId, amount, transaction=null)` → two user legs `funding:disponible -= amount`, `funding:bloqueado += amount`. Throws `Error(/insuficiente/i)` on insufficient disponible.
  - `unblockBalance(userId, criptomonedaId, amount, transaction=null)` → `funding:bloqueado -= amount`, `funding:disponible += amount`. Throws `Error(/insuficiente/i)` on insufficient bloqueado.
- The overdraw guard now lives in `postTransaction` (`FOR UPDATE` on the projection row → the Críticos #5 serialization, already proven at the ledger level). The methods translate its `/sobregiro/i` error into the legacy `/insuficiente/i` message to preserve the caller contract.

**Anti-double-count note:** after this task the three methods no longer write `balances_users`, so the mirror does not fire for them. The mirror is still registered and still shadows the raw deposit/withdrawal writes (converted in Task 4) and the `create` seeds in `ledgerMirror` / `usuarioAssociations` tests. Every path still posts exactly once.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/integration/ledgerWriteFlip.integration.test.js`:

```js
describe('write-flip: updateBalance/blockBalance/unblockBalance post to the ledger, not balances_users', () => {
  test('updateBalance credits the ledger and does NOT write balances_users', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '5'); // legacy row (hooks:false) = 5; ledger = 5

    await BalanceUsuario.updateBalance(user.id, cripto.id, '3.00000000', 'disponible');

    const l = await funding(user, cripto);
    expect(l.disponible).toBe('8.00000000'); // ledger moved

    // The legacy row is untouched (still 5) — the write went to the ledger only.
    const row = await BalanceUsuario.findOne({ where: { userId: user.id, criptomonedaId: cripto.id } });
    expect(String(row.balanceDisponible)).toBe('5.00000000');
  });

  test('updateBalance rejects an overdraw with an /insuficiente/ message', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '1');
    await expect(
      BalanceUsuario.updateBalance(user.id, cripto.id, '-2.00000000', 'disponible')
    ).rejects.toThrow(/insuficiente/i);
  });

  test('blockBalance moves disponible->bloqueado in the ledger', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '10');
    await BalanceUsuario.blockBalance(user.id, cripto.id, '4.00000000');

    const l = await funding(user, cripto);
    expect(l.disponible).toBe('6.00000000');
    expect(l.bloqueado).toBe('4.00000000');
  });

  test('blockBalance rejects blocking more than disponible', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '3');
    await expect(BalanceUsuario.blockBalance(user.id, cripto.id, '5')).rejects.toThrow(/insuficiente/i);
  });

  test('unblockBalance moves bloqueado->disponible in the ledger', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '10');
    await BalanceUsuario.blockBalance(user.id, cripto.id, '6.00000000');
    await BalanceUsuario.unblockBalance(user.id, cripto.id, '2.00000000');

    const l = await funding(user, cripto);
    expect(l.disponible).toBe('6.00000000');
    expect(l.bloqueado).toBe('4.00000000');
  });

  test('reconciliation holds after a mix of method writes', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await f.seedBalance(user, cripto, '10');
    await BalanceUsuario.updateBalance(user.id, cripto.id, '5', 'disponible');
    await BalanceUsuario.blockBalance(user.id, cripto.id, '4');
    await BalanceUsuario.unblockBalance(user.id, cripto.id, '1');

    expect((await recon.reconciliarInterno()).ok).toBe(true);
    expect((await recon.reconciliarExterno()).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --config jest.integration.config.js ledgerWriteFlip`
Expected: FAIL — the current methods write `balances_users` (so the "legacy row untouched" assertion fails: the row becomes 8), and `blockBalance`/`unblockBalance` read/write `balances_users` (the `funding` after a `seedBalance` created with `hooks:false` diverges — the method reads the legacy row `5`, not the ledger). This is the divergence the flip fixes.

- [ ] **Step 3: Reimplement the three methods**

At the top of `backend/models/balanceUsuario.model.js`, add `const crypto = require('crypto');` near the other requires. Then replace the three methods:

```js
  // Write-flip (Paso B): postea al ledger DIRECTO (compartimento Funding). Una
  // sola pata de usuario + contrapartida en 'suspense' para cerrar en cero (misma
  // logica que balanceMirror.espejar, ahora sin pasar por balances_users). El
  // guard de sobregiro vive en postTransaction (FOR UPDATE sobre la proyeccion);
  // se traduce su error /sobregiro/ al mensaje legacy /insuficiente/ del contrato.
  BalanceUsuario.updateBalance = async (userId, criptomonedaId, amount, type = 'disponible', transaction = null) => {
    const { postTransaction } = require('../services/ledger/postingService');
    const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
    const proposito = type === 'disponible' ? PROPOSITOS.FUNDING_DISPONIBLE : PROPOSITOS.FUNDING_BLOQUEADO;
    const monto = String(amount);
    try {
      await postTransaction({
        tipo: 'ajuste_legacy',
        referencia: `writeflip:${crypto.randomUUID()}`,
        lineas: [
          { ownerId: userId, proposito, criptomonedaId, monto },
          { ownerId: null, proposito: PROPOSITOS.SUSPENSE, criptomonedaId, monto: money.subtract('0', monto) },
        ],
      }, transaction);
    } catch (error) {
      if (/sobregiro/i.test(error.message)) {
        throw new Error(`Error al actualizar balance: Balance insuficiente. ${type}`);
      }
      throw new Error(`Error al actualizar balance: ${error.message}`);
    }
    const { balanceDisponible, balanceBloqueado } = await leerFundingDesdeLedger(userId, criptomonedaId, transaction);
    return { userId, criptomonedaId, balanceDisponible, balanceBloqueado };
  };

  // Bloquear: dos patas de usuario (disponible -A, bloqueado +A). Suma cero sin
  // suspense. El lock de la proyeccion serializa (Criticos #5 a nivel ledger).
  BalanceUsuario.blockBalance = async (userId, criptomonedaId, amount, transaction = null) => {
    const { postTransaction } = require('../services/ledger/postingService');
    const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
    const monto = String(amount);
    try {
      await postTransaction({
        tipo: 'reserva_orden',
        referencia: `block:${crypto.randomUUID()}`,
        lineas: [
          { ownerId: userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId, monto: money.subtract('0', monto) },
          { ownerId: userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId, monto },
        ],
      }, transaction);
    } catch (error) {
      if (/sobregiro/i.test(error.message)) {
        throw new Error('Error al bloquear balance: Balance disponible insuficiente para bloquear');
      }
      throw new Error(`Error al bloquear balance: ${error.message}`);
    }
    const { balanceDisponible, balanceBloqueado } = await leerFundingDesdeLedger(userId, criptomonedaId, transaction);
    return { userId, criptomonedaId, balanceDisponible, balanceBloqueado };
  };

  BalanceUsuario.unblockBalance = async (userId, criptomonedaId, amount, transaction = null) => {
    const { postTransaction } = require('../services/ledger/postingService');
    const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
    const monto = String(amount);
    try {
      await postTransaction({
        tipo: 'liberacion_reserva',
        referencia: `unblock:${crypto.randomUUID()}`,
        lineas: [
          { ownerId: userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId, monto: money.subtract('0', monto) },
          { ownerId: userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId, monto },
        ],
      }, transaction);
    } catch (error) {
      if (/sobregiro/i.test(error.message)) {
        throw new Error('Error al desbloquear balance: Balance bloqueado insuficiente para desbloquear');
      }
      throw new Error(`Error al desbloquear balance: ${error.message}`);
    }
    const { balanceDisponible, balanceBloqueado } = await leerFundingDesdeLedger(userId, criptomonedaId, transaction);
    return { userId, criptomonedaId, balanceDisponible, balanceBloqueado };
  };
```

Delete the now-unused local `field`/`findOrCreate`/`findOne`+`lock` bodies these replace. Keep the long Críticos #5 comment block trimmed to a one-line pointer to the ledger guard.

- [ ] **Step 4: Delete the stale unit test + trim the mirror parity test**

Delete `backend/tests/balanceUsuario.model.test.js` (its three describe blocks mock `findOrCreate`/`findOne` + `save`, which the methods no longer use; monetary precision is covered by `money.test.js` and the new `ledgerWriteFlip` integration tests).

In `backend/tests/integration/ledgerMirror.integration.test.js`, the two tests that assert the STATIC methods mirror into `balances_users` (`create + updateBalance (static)` and `blockBalance (static, two-sided)`) now break — the methods post to the ledger and do NOT write `balances_users`. Remove those two `test(...)` blocks. **Keep** the `raw BalanceUsuario.update (the deposit/withdrawal path) is also mirrored` test and the `reconciliarConLegacy` block, but change the `reconciliarConLegacy` test body so it uses only mirrored writes (raw `create`/`update`, no static methods):
```js
  test('reports parity after mirrored writes', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    const b = await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '10.00000000', balanceBloqueado: '0' });
    await BalanceUsuario.update({ balanceDisponible: '12.00000000' }, { where: { id: b.id } });

    const res = await recon.reconciliarConLegacy();
    expect(res.ok).toBe(true);
    expect(res.discrepancias).toEqual([]);
  });
```

- [ ] **Step 5: Run the write-flip tests, the trimmed mirror test, and the full suite**

Run: `npx jest --config jest.integration.config.js ledgerWriteFlip ledgerMirror ledgerReadFlip balanceLockRace`
Expected: `ledgerWriteFlip` PASS; `ledgerMirror` PASS (trimmed); `ledgerReadFlip` PASS; `balanceLockRace` — **expected to still pass** IF it reads the ledger; it currently reads `f.getBalance` (the legacy row) and asserts `20`/`80`. Because `seedBalance` now writes the legacy row with `hooks:false` at `100/0` and `blockBalance` no longer updates it, `f.getBalance` returns the stale `100/0` → this test FAILS. Fix it in the next step.

- [ ] **Step 6: Update `balanceLockRace.integration.test.js` to read the ledger**

Replace the two `f.getBalance(user, cripto)` assertions with ledger reads via `getByUserAndCrypto`:
```js
    const finalBalance = await BalanceUsuario.getByUserAndCrypto(user.id, cripto.id);
    expect(finalBalance.balanceDisponible).toBe('20.00000000');
    expect(finalBalance.balanceBloqueado).toBe('80.00000000');
```
and in the ten-blocks test:
```js
    const finalBalance = await BalanceUsuario.getByUserAndCrypto(user.id, cripto.id);
    expect(parseFloat(finalBalance.balanceDisponible)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(finalBalance.balanceBloqueado)).toBe(fulfilled.length * 15);
```
(The concurrency guarantee itself now comes from `postTransaction`'s `FOR UPDATE` on the projection row — the same mechanism already proven in `ledgerPosting`'s concurrency test.)

- [ ] **Step 7: Full suite gate**

Run: `npx jest --config jest.integration.config.js` then `npm test`
Expected: ALL green. Mock-based tests that assert `updateBalance` is CALLED (`balanceManager.test.js`, `createOrder.test.js`, `transaccionesP2P.model.test.js`) are unaffected — the signature is unchanged. Reconcile: run any of the ledger integration suites; `reconciliarInterno`/`reconciliarExterno` are asserted inside `ledgerWriteFlip`.

- [ ] **Step 8: Commit + push**

```bash
git add backend/models/balanceUsuario.model.js backend/tests/integration/ledgerWriteFlip.integration.test.js backend/tests/integration/ledgerMirror.integration.test.js backend/tests/integration/balanceLockRace.integration.test.js
git rm backend/tests/balanceUsuario.model.test.js
git commit -m "feat(ledger): write-flip updateBalance/blockBalance/unblockBalance to post to the ledger"
git push origin dev
```

---

### Task 4: Convert the raw deposit/withdrawal writes + provisioning to the methods

**Files:**
- Modify: `backend/models/transaccionBlockchain.model.js` (`_acreditarDeposito`, `createWithdrawal`, `completeWithdrawal`, `failWithdrawal`, `validateWithdrawal`)
- Modify: `backend/controllers/usuario.controller.js` (drop the provisioning balance `create`)
- Modify: `backend/tests/transaccionBlockchain.model.test.js` (rewrite to assert delegation to the methods)
- Test: `backend/tests/integration/ledgerWriteFlip.integration.test.js` (append deposit/withdrawal end-to-end ledger assertions)

**Interfaces:**
- Consumes: `BalanceUsuario.updateBalance/blockBalance/unblockBalance` (now ledger-backed, from Task 3).
- Produces: the four settlement methods post to the ledger via the static methods instead of raw `BalanceUsuario.update`. Provisioning no longer creates a `balances_users` row (a user's ledger accounts are created lazily on first real movement; `getByUserId` already omits zero rows).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/integration/ledgerWriteFlip.integration.test.js`:

```js
const { TransaccionBlockchain, Criptomoneda } = require('../../models');

describe('write-flip: deposit/withdrawal settlement posts to the ledger', () => {
  test('_acreditarDeposito credits funding:disponible in the ledger', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await TransaccionBlockchain._acreditarDeposito(
      { id: '11111111-1111-4111-8111-111111111111', userId: user.id, criptomonedaId: cripto.id, cantidad: '1.50000000', estado: 'confirmado' },
      null
    );
    const l = await funding(user, cripto);
    expect(l.disponible).toBe('1.50000000');
  });
});
```
(Withdrawal block/complete/fail are already covered end-to-end by `transaccionBlockchain`'s existing integration tests, which assert balances via ledger-backed reads — they exercise these paths.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest --config jest.integration.config.js ledgerWriteFlip -t "_acreditarDeposito"`
Expected: PASS actually IS possible today via the mirror (the raw update is mirrored). To make the RED meaningful, assert the LEGACY row is NOT written after conversion — but that assertion only holds post-change. Simplest: treat this as a characterization test that must stay green THROUGH the conversion (the ledger funding must remain `1.5` whether via mirror or direct). Proceed to Step 3; the real proof of "direct, not mirrored" is Task 5 (mirror removed) where this test must still pass.

- [ ] **Step 3: Convert `_acreditarDeposito`**

Replace the `findOrCreate` + raw `BalanceUsuario.update` + verification `findByPk` block (~lines 286–331) with a single call to the ledger-backed method:
```js
      // Write-flip: acreditar via el metodo (postea al ledger funding:disponible).
      await BalanceUsuario.updateBalance(transaccion.userId, transaccion.criptomonedaId, String(transaccion.cantidad), 'disponible', transaction);
```
Keep the surrounding `TransaccionBlockchain.update({ estado:'completado', ... })` and the symbol-logging block. Remove the DEBUG `console.log`s that referenced `balance.id`/`balanceVerificacion`.

- [ ] **Step 4: Convert `createWithdrawal`**

Replace the `findOne` sufficiency check + raw `BalanceUsuario.update` (block) (~lines 376–401) with:
```js
      // Write-flip: bloquear via el metodo (postea disponible->bloqueado; el guard
      // de sobregiro del ledger rechaza si no alcanza).
      await BalanceUsuario.blockBalance(data.userId, data.criptomonedaId, String(data.cantidad), transaction);
```
(The `blockBalance` overdraw guard replaces the manual `money.compare` check; its `/insuficiente/i` message preserves the "Balance insuficiente para retiro" semantics for the caller.)

- [ ] **Step 5: Convert `completeWithdrawal` and `failWithdrawal`**

`completeWithdrawal` (funds left the platform → remove from bloqueado, single leg). Replace the `findOne` + raw `update` (~lines 508–526) with:
```js
      // Write-flip: los fondos salieron on-chain → debitar bloqueado (una pata,
      // contrapartida suspense; Paso D lo enriquece a external_onchain).
      await BalanceUsuario.updateBalance(retiro.userId, retiro.criptomonedaId, money.subtract('0', String(retiro.cantidad)), 'bloqueado', transaction);
```

`failWithdrawal` (refund → bloqueado back to disponible). Replace the `findOne` + raw `update` (~lines 558–580) with:
```js
      // Write-flip: retiro fallido → devolver bloqueado a disponible.
      await BalanceUsuario.unblockBalance(retiro.userId, retiro.criptomonedaId, String(retiro.cantidad), transaction);
```

In `validateWithdrawal` (~line 755), remove the dead `const balance = await BalanceUsuario.findOne(...)` (its checks are commented out; it is an unused read of `balances_users`).

- [ ] **Step 6: Drop the provisioning balance create**

In `backend/controllers/usuario.controller.js` (~lines 68–78), remove the `BalanceUsuario.create({ ...balanceInicial... })` and the `balancesCreados.push(...)` (or keep `balancesCreados` reporting `0` addresses if the welcome message needs the count — simpler: delete both and drop `balancesCreados` from the message if referenced). A user's ledger accounts are created lazily on first movement; zero rows were never listed anyway.

- [ ] **Step 7: Rewrite the deposit/withdrawal UNIT test**

`backend/tests/transaccionBlockchain.model.test.js` mocks `BalanceUsuario.update`/`findOne`/`findByPk`. Rewrite it to mock the ledger-backed methods and assert delegation:
```js
  test('_acreditarDeposito delega en updateBalance con la cantidad exacta', async () => {
    BalanceUsuario.updateBalance = jest.fn().mockResolvedValue({});
    TransaccionBlockchain.update = jest.fn().mockResolvedValue([1]);
    sequelize.models.Criptomoneda.findByPk.mockResolvedValue({ symbol: 'BTC' });

    await TransaccionBlockchain._acreditarDeposito(
      { id: 't1', userId: 'u', criptomonedaId: 'c', cantidad: '0.2', estado: 'confirmado' }, {}
    );
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith('u', 'c', '0.2', 'disponible', {});
  });
```
and for `failWithdrawal`:
```js
  test('failWithdrawal delega en unblockBalance', async () => {
    sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() });
    TransaccionBlockchain.findByPk = jest.fn().mockResolvedValue({ userId: 'u', criptomonedaId: 'c', cantidad: '0.1' });
    BalanceUsuario.unblockBalance = jest.fn().mockResolvedValue({});
    TransaccionBlockchain.update = jest.fn().mockResolvedValue([1]);
    TransaccionBlockchain.getById = jest.fn().mockResolvedValue({ id: 'r1' });

    await TransaccionBlockchain.failWithdrawal('r1', 'razon');
    expect(BalanceUsuario.unblockBalance).toHaveBeenCalledWith('u', 'c', '0.1', expect.anything());
  });
```
(Adjust the `jest.mock('../models/index', () => ({ BalanceUsuario: {} }))` stub if needed so the methods are jest fns.)

- [ ] **Step 8: Run affected suites + full suite**

Run: `npx jest transaccionBlockchain.model` then `npx jest --config jest.integration.config.js ledgerWriteFlip transaccionBlockchain`
Expected: PASS. The deposit/withdrawal integration tests still assert the right balances (now ledger-backed, still mirrored redundantly-idle for any not-yet-removed path — but these paths post directly now, so the mirror does not fire for them).

Run: `npx jest --config jest.integration.config.js` then `npm test`
Expected: ALL green EXCEPT `walletMaestraProvisioning.integration.test.js:46` (asserts `BalanceUsuario.count > 0` after provisioning) — provisioning no longer creates rows. Fix it in the next step.

- [ ] **Step 9: Fix the provisioning test**

In `backend/tests/integration/walletMaestraProvisioning.integration.test.js`, replace the balance-count assertion with the provisioning's real deliverable (deposit addresses):
```js
    const { DireccionDeposito } = require('../../models');
    expect(await DireccionDeposito.count({ where: { userId: user.id } })).toBeGreaterThan(0);
```
(Remove the `BalanceUsuario.count` assertion. If `BalanceUsuario` becomes an unused import, drop it.)

- [ ] **Step 10: Full suite gate + commit**

Run: `npx jest --config jest.integration.config.js` then `npm test`
Expected: ALL green.

```bash
git add backend/models/transaccionBlockchain.model.js backend/controllers/usuario.controller.js backend/tests/transaccionBlockchain.model.test.js backend/tests/integration/ledgerWriteFlip.integration.test.js backend/tests/integration/walletMaestraProvisioning.integration.test.js
git commit -m "feat(ledger): route deposit/withdrawal settlement and provisioning through the ledger methods"
git push origin dev
```

---

### Task 5: Remove the mirror and retire the parity scaffolding

**Files:**
- Modify: `backend/models/index.js` (unregister the mirror)
- Delete: `backend/services/ledger/balanceMirror.js`
- Delete: `backend/tests/integration/ledgerMirror.integration.test.js`
- Modify: `backend/services/ledger/reconciliation.js` (remove `reconciliarConLegacy`)
- Modify: `backend/tests/integration/ledgerReadFlip.integration.test.js` (seed via the factory, not raw `create`)
- Modify: `backend/tests/balanceUsuarioLazyRequire.test.js` (`_acreditarDeposito` now asserts the LEDGER)

**Interfaces:**
- After this task NOTHING writes `balances_users` in a money path, so the mirror is dead. `reconciliarConLegacy` (mirror-parity) is obsolete. Seeds and reads that leaned on the mirror move to the ledger-direct factory.

- [ ] **Step 1: Migrate the remaining mirror-dependent test seeds**

`backend/tests/integration/ledgerReadFlip.integration.test.js` seeds the ledger via raw `BalanceUsuario.create(...)` WITH hooks (mirror). After the mirror is gone those creates won't reach the ledger. Replace each seeding `BalanceUsuario.create({ ...balanceDisponible... })` that is meant to fund the ledger with `f.seedBalance(user, cripto, monto)` (which seeds the ledger directly). Keep the `{ hooks: false }` divergence-row creates AS-IS (they intentionally do NOT reach the ledger). For a create that also sets `balanceBloqueado`, seed then block:
```js
// was: BalanceUsuario.create({ userId, criptomonedaId, balanceDisponible:'8', balanceBloqueado:'0' }); blockBalance(...,'3')
await f.seedBalance(user, cripto, '8');
await BalanceUsuario.blockBalance(user.id, cripto.id, '3.00000000');
```

`backend/tests/balanceUsuarioLazyRequire.test.js` — the `_acreditarDeposito escribe de verdad en balances_users` test (~line 66) reads `balances_users`. Rewrite it to assert the ledger, and rename:
```js
  test('_acreditarDeposito acredita de verdad en el ledger vía el modelo real de models/index.js', async () => {
    const user = await Usuario.create({ email: 'lazy@test.com', username: 'lazy_user', passwordHash: 'x', rol: 'normal' });
    const cripto = await Criptomoneda.create({ symbol: 'ETH', nombre: 'Ethereum', red: 'ethereum', decimales: 18 });

    await TransaccionBlockchain._acreditarDeposito(
      { id: '99999999-9999-4999-8999-999999999999', userId: user.id, criptomonedaId: cripto.id, cantidad: '1.50000000', estado: 'pendiente' },
      null
    );

    const posting = require('../services/ledger/postingService');
    const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');
    const disponible = await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id });
    expect(disponible).toBe('1.50000000');
  });
```
(The module-level-import assertion above it is unrelated and stays.)

- [ ] **Step 2: Run those tests (still with the mirror present) to confirm the seed migration is correct**

Run: `npx jest --config jest.integration.config.js ledgerReadFlip` and `npx jest --config jest.integration.config.js balanceUsuarioLazyRequire`
Expected: PASS — seeds now reach the ledger via `seedBalance`, independent of the mirror.

- [ ] **Step 3: Remove the mirror + `reconciliarConLegacy` + its test**

In `backend/models/index.js`, delete the line that registers the mirror:
```js
require('../services/ledger/balanceMirror').registrarMirrorDeBalance(BalanceUsuario);
```
Delete `backend/services/ledger/balanceMirror.js`.
Delete `backend/tests/integration/ledgerMirror.integration.test.js`.
In `backend/services/ledger/reconciliation.js`, remove the `reconciliarConLegacy` function and drop it from `module.exports`.

- [ ] **Step 4: Full suite gate**

Run: `npx jest --config jest.integration.config.js` then `npm test`
Expected: ALL green. With the mirror gone, `_acreditarDeposito`, withdrawals, swap, trading, P2P, transfer all post to the ledger directly (once), and every balance seed reaches the ledger via `seedBalance`. `reconciliarInterno`/`reconciliarExterno` (asserted in `ledgerWriteFlip`) still hold.

- [ ] **Step 5: Grep-verify no live path touches `balances_users` writes**

Run: `npx grep` (or ripgrep) for residual raw writes:
```bash
grep -rn "BalanceUsuario\.\(update\|create\|findOrCreate\)" backend --include=*.js | grep -v tests | grep -v "updateBalance\|blockBalance\|unblockBalance"
```
Expected: only `backend/scripts/cleanup-stuck-transactions.js` (an ops script, out of the request path) and `backend/services/ledger/backfill.js` (reads `balances_users` for the one-time opening backfill). **Note both in the commit body as Paso C cleanup** (the script should be converted to `updateBalance` or retired; `backfill.js` + `balances_users` are deleted in Paso C). Do NOT convert them here — that is Paso C's scope.

- [ ] **Step 6: Update the ledger-design memory + commit + push**

Update `docs/superpowers/plans/2026-09-01-ledger-write-flip.md` acceptance checkboxes if tracking, then:
```bash
git add backend/models/index.js backend/services/ledger/reconciliation.js backend/tests/integration/ledgerReadFlip.integration.test.js backend/tests/balanceUsuarioLazyRequire.test.js
git rm backend/services/ledger/balanceMirror.js backend/tests/integration/ledgerMirror.integration.test.js
git commit -m "refactor(ledger): remove the transitional CDC mirror; the ledger is now the sole money writer"
git push origin dev
```

---

## Acceptance criteria (whole plan)

- `BalanceUsuario.updateBalance/blockBalance/unblockBalance` post to the ledger (Funding compartment) and no longer write `balances_users`; signatures unchanged, so swap/trading/P2P/transfer callers are untouched.
- Deposit/withdrawal settlement and provisioning go through those methods (or create no row); the raw `BalanceUsuario.update`/`create` money writes are gone from the request path.
- The CDC mirror (`balanceMirror.js`) and `reconciliarConLegacy` are removed; `reconciliarInterno`/`reconciliarExterno` still pass.
- Admin reads (`getAll`/`getUsersWithBalance`/`getBalanceStats`) read the ledger; `getById` and its route are retired.
- The full suite is green at every task. No live money path reads or writes `balances_users` (only the ops script + the backfill tool remain, flagged for Paso C).

## Out of scope (later Pasos)

- **Paso C:** delete `balances_users` + the `suspense` house account (it empties out) + the `BalanceUsuario` model/entity + `backfill.js`; convert or retire `scripts/cleanup-stuck-transactions.js`.
- **Paso D (audit-enrichment):** replace the `suspense`/single-`funding` counterparties with rich per-operation accounts — swap → `treasury` + `fee_revenue` (⚠️ Fase 2 swap tests assert the fee in `WalletMaestra.balanceTotal`; update them); deposits/withdrawals → `external_onchain` + `pending`; trading maker/taker. Introduce the **Spot** compartment + Funding↔Spot transfers. Extend Stryker (`npm run test:mutation`) to the posting service.
