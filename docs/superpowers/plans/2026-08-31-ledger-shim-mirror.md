# Ledger Compatibility Shim (transitional CDC mirror) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the ledger a live, continuously-reconciled shadow of `BalanceUsuario` by mirroring EVERY balance write into the ledger via a Sequelize hook — with zero behavior change (reads still come from `balances_users`).

**Architecture:** A discovery during Plan 1 wrap-up: not all balance writes go through the `updateBalance`/`blockBalance`/`unblockBalance` static methods — `transaccionBlockchain.model.js` (deposit credit, withdrawal block/settle) and `usuario.controller.js` (provisioning) mutate `BalanceUsuario` with raw `.update()`/`.create()`. A shim on the 3 methods alone would miss those → split-brain. Instead, a model-level CDC hook (`afterCreate`/`afterUpdate`, with `beforeBulkUpdate` forcing `individualHooks`) computes the per-row delta and posts a balancing ledger transaction (Funding compartment, `suspense` counterparty) in the SAME transaction as the write. This captures 100% of writes at one place, with no money-path logic touched. Reads are unchanged. A parity reconciliation proves `ledger funding == balances_users` after every kind of write.

**This revises spec Fase 1** (`docs/superpowers/specs/2026-08-31-double-entry-ledger-design.md` §6): the shim is a CDC hook (not a reimplementation of the 3 methods), and the read-flip is deferred to a later plan (Plan 3). Rationale: the scattered raw writes make a global method-shim + immediate read-flip unsafe; a write-through shadow proven by reconciliation is the lower-risk path to the same end state.

**Tech Stack:** Sequelize hooks, `services/ledger/*` (Plan 1), `money.js`, integration harness.

## Global Constraints

- Language: Spanish identifiers/comments; English commits.
- Money via `money.js`; amounts as strings; `DECIMAL(28,8)`.
- Ledger append-only; the mirror posts `tipo:'ajuste_legacy'` asientos with a `suspense` counterparty.
- The mirror posting joins the caller's `options.transaction` (atomic with the balance write); it must NOT open its own.
- Git: direct to `dev`, Conventional Commits, push per chunk.
- Tests from `backend/`: integration DB up, `npx jest --config jest.integration.config.js <file>`.

## File Structure

**Create:**
- `backend/services/ledger/balanceMirror.js` — `registrarMirrorDeBalance(BalanceUsuario)` + the delta→posting logic.
- `backend/tests/integration/ledgerMirror.integration.test.js` — parity across every write path.

**Modify:**
- `backend/models/index.js` — call `registrarMirrorDeBalance(BalanceUsuario)` after the ledger models are initialized.

---

### Task 1: The CDC mirror hook + parity across write paths

**Files:**
- Create: `backend/services/ledger/balanceMirror.js`
- Create: `backend/tests/integration/ledgerMirror.integration.test.js`
- Modify: `backend/models/index.js`

**Interfaces:**
- Consumes: `PROPOSITOS`, `postTransaction`, `money`.
- Produces: `registrarMirrorDeBalance(BalanceUsuario)` — registers `afterCreate`/`afterUpdate`/`beforeBulkUpdate` hooks that mirror net balance deltas into the ledger Funding compartment against `suspense`, in `options.transaction`.

- [ ] **Step 1: Write the failing parity test**

`backend/tests/integration/ledgerMirror.integration.test.js`:
```js
require('../helpers/testEnv');
const { sequelize, BalanceUsuario } = require('../../models');
const { resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const posting = require('../../services/ledger/postingService');
const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');

beforeEach(resetDb);
afterAll(async () => { await sequelize.close(); });

async function fundingLedger(user, cripto) {
  return {
    disponible: await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: cripto.id }),
    bloqueado: await posting.getSaldoCuenta({ ownerId: user.id, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: cripto.id }),
  };
}

describe('balance mirror — ledger shadows every BalanceUsuario write', () => {
  test('create + updateBalance (static) mirror into funding:disponible', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '5.00000000', balanceBloqueado: '0' });
    await BalanceUsuario.updateBalance(user.id, cripto.id, '3.00000000', 'disponible');

    const l = await fundingLedger(user, cripto);
    const row = await BalanceUsuario.findOne({ where: { userId: user.id, criptomonedaId: cripto.id } });
    expect(l.disponible).toBe(String(row.balanceDisponible)); // 8.00000000
    expect(l.disponible).toBe('8.00000000');
  });

  test('blockBalance (static, two-sided) mirrors disponible->bloqueado', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '10.00000000', balanceBloqueado: '0' });
    await BalanceUsuario.blockBalance(user.id, cripto.id, '4.00000000');

    const l = await fundingLedger(user, cripto);
    const row = await BalanceUsuario.findOne({ where: { userId: user.id, criptomonedaId: cripto.id } });
    expect(l.disponible).toBe(String(row.balanceDisponible)); // 6
    expect(l.bloqueado).toBe(String(row.balanceBloqueado));   // 4
  });

  test('raw BalanceUsuario.update (the deposit/withdrawal path) is also mirrored', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    const b = await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '2.00000000', balanceBloqueado: '0' });
    // Mimic transaccionBlockchain deposit credit: raw bulk update by id.
    await BalanceUsuario.update({ balanceDisponible: '9.00000000' }, { where: { id: b.id } });

    const l = await fundingLedger(user, cripto);
    const row = await BalanceUsuario.findByPk(b.id);
    expect(l.disponible).toBe(String(row.balanceDisponible)); // 9
    expect(l.disponible).toBe('9.00000000');
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm run test:integration:up` then `npx jest --config jest.integration.config.js ledgerMirror`
Expected: FAIL — ledger funding is `'0'`/empty because no mirror exists yet (the static methods and raw update write only to `balances_users`).

- [ ] **Step 3: Implement the mirror**

`backend/services/ledger/balanceMirror.js`:
```js
const crypto = require('crypto');
const money = require('../../utils/money');
const { PROPOSITOS } = require('./ledgerAccounts');
const { postTransaction } = require('./postingService');

// Shim transicional (change-data-capture): espeja TODA escritura de
// BalanceUsuario al ledger, en la MISMA transaccion del write, para que el
// ledger corra como sombra reconciliada mientras las lecturas siguen saliendo
// de balances_users. Captura tanto los metodos (updateBalance/block/unblock)
// como las escrituras crudas (.update/.create de deposito/retiro/provisioning)
// sin tocar ningun call site. Se elimina cuando la migracion por-camino termina.
// El compartimento es Funding (preserva el comportamiento de un solo
// compartimento de hoy); la contrapartida es la cuenta de casa 'suspense', que
// se vacia al completar la migracion.
async function espejar(instance, options, isCreate) {
  const dispNew = String(instance.balanceDisponible ?? '0');
  const bloqNew = String(instance.balanceBloqueado ?? '0');
  const dispOld = isCreate ? '0' : String(instance.previous('balanceDisponible') ?? '0');
  const bloqOld = isCreate ? '0' : String(instance.previous('balanceBloqueado') ?? '0');
  const dDisp = money.subtract(dispNew, dispOld);
  const dBloq = money.subtract(bloqNew, bloqOld);
  if (money.compare(dDisp, '0') === 0 && money.compare(dBloq, '0') === 0) return;

  const lineas = [];
  if (money.compare(dDisp, '0') !== 0) {
    lineas.push({ ownerId: instance.userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: instance.criptomonedaId, monto: dDisp });
  }
  if (money.compare(dBloq, '0') !== 0) {
    lineas.push({ ownerId: instance.userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: instance.criptomonedaId, monto: dBloq });
  }
  // Contrapartida en suspense para cerrar el asiento en cero.
  const totalUser = money.add(dDisp, dBloq);
  lineas.push({ ownerId: null, proposito: PROPOSITOS.SUSPENSE, criptomonedaId: instance.criptomonedaId, monto: money.subtract('0', totalUser) });

  await postTransaction({
    tipo: 'ajuste_legacy',
    referencia: `mirror:${crypto.randomUUID()}`,
    descripcion: `Espejo transicional de balance (BalanceUsuario ${instance.id})`,
    lineas,
  }, options.transaction);
}

function registrarMirrorDeBalance(BalanceUsuario) {
  BalanceUsuario.addHook('afterCreate', 'ledgerMirror', (instance, options) => espejar(instance, options, true));
  BalanceUsuario.addHook('afterUpdate', 'ledgerMirror', (instance, options) => espejar(instance, options, false));
  // Los .update({}, {where}) crudos disparan bulk update: forzar individualHooks
  // para que afterUpdate corra por fila (con previous() disponible).
  BalanceUsuario.addHook('beforeBulkUpdate', 'ledgerMirrorBulk', (options) => {
    options.individualHooks = true;
  });
}

module.exports = { registrarMirrorDeBalance };
```

In `backend/models/index.js`, after the ledger models are initialized (after `const SaldoLedger = initSaldoLedger(sequelize);`), register the mirror:
```js
// Shim transicional: el ledger espeja toda escritura de BalanceUsuario.
require('../services/ledger/balanceMirror').registrarMirrorDeBalance(BalanceUsuario);
```

- [ ] **Step 4: Run — expect pass**

Run: `npx jest --config jest.integration.config.js ledgerMirror`
Expected: PASS (3 tests). If the raw-update test fails with ledger `'0'`, the `beforeBulkUpdate`→`individualHooks` trick isn't ffiring `afterUpdate`; verify the hook names and that `previous()` is available in that path.

- [ ] **Step 5: Full suite — the real regression gate**

Run: `npx jest --config jest.integration.config.js` then `npm test`
Expected: ALL green. The existing 94 integration tests exercise the real money-paths (swap, trading, deposits, withdrawals, transfer, P2P) — every balance write they trigger now also posts to the ledger via the mirror, inside the same transaction, and none of them should break. If any breaks, the mirror is throwing (likely a spurious overdraw or a delta bug) — investigate before proceeding.

- [ ] **Step 6: Commit + push**

```bash
git add backend/services/ledger/balanceMirror.js backend/models/index.js backend/tests/integration/ledgerMirror.integration.test.js
git commit -m "feat(ledger): transitional CDC mirror shadows every BalanceUsuario write"
git push origin dev
```

---

### Task 2: Parity reconciliation as a reusable check

**Files:**
- Modify: `backend/services/ledger/reconciliation.js`
- Modify: `backend/tests/integration/ledgerMirror.integration.test.js` (append)

**Interfaces:**
- Produces: `reconciliarConLegacy(transaction=null)` → `{ ok, discrepancias: [{ userId, criptomonedaId, campo, ledger, legacy }] }`. For every `BalanceUsuario` row, asserts ledger `funding:disponible == balanceDisponible` and `funding:bloqueado == balanceBloqueado`.

- [ ] **Step 1: Write the failing test**

Append to `ledgerMirror.integration.test.js`:
```js
const recon = require('../../services/ledger/reconciliation');

describe('reconciliarConLegacy', () => {
  test('reports parity after a mix of writes', async () => {
    const cripto = await f.seedCripto('BTC');
    const user = await f.seedUser();
    await BalanceUsuario.create({ userId: user.id, criptomonedaId: cripto.id, balanceDisponible: '10.00000000', balanceBloqueado: '0' });
    await BalanceUsuario.blockBalance(user.id, cripto.id, '3.00000000');
    await BalanceUsuario.updateBalance(user.id, cripto.id, '2.00000000', 'disponible');

    const res = await recon.reconciliarConLegacy();
    expect(res.ok).toBe(true);
    expect(res.discrepancias).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npx jest --config jest.integration.config.js ledgerMirror`
Expected: FAIL — `recon.reconciliarConLegacy is not a function`.

- [ ] **Step 3: Implement**

Append to `backend/services/ledger/reconciliation.js` (and add to exports):
```js
// Paridad transicional: mientras el shim CDC espeja balances_users al ledger,
// el ledger funding de cada (usuario, cripto) debe igualar la fila legacy.
// Es el gate que prueba que el shim captura el 100% de las escrituras.
async function reconciliarConLegacy(transaction = null) {
  const { BalanceUsuario } = require('../../models');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const { getSaldoCuenta } = require('./postingService');
  const filas = await BalanceUsuario.findAll({ transaction });
  const discrepancias = [];
  for (const b of filas) {
    const disp = await getSaldoCuenta({ ownerId: b.userId, proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: b.criptomonedaId }, transaction);
    const bloq = await getSaldoCuenta({ ownerId: b.userId, proposito: PROPOSITOS.FUNDING_BLOQUEADO, criptomonedaId: b.criptomonedaId }, transaction);
    if (money.compare(disp, String(b.balanceDisponible)) !== 0) {
      discrepancias.push({ userId: b.userId, criptomonedaId: b.criptomonedaId, campo: 'disponible', ledger: disp, legacy: String(b.balanceDisponible) });
    }
    if (money.compare(bloq, String(b.balanceBloqueado)) !== 0) {
      discrepancias.push({ userId: b.userId, criptomonedaId: b.criptomonedaId, campo: 'bloqueado', ledger: bloq, legacy: String(b.balanceBloqueado) });
    }
  }
  return { ok: discrepancias.length === 0, discrepancias };
}
```
Add `reconciliarConLegacy` to `module.exports`.

- [ ] **Step 4: Run — expect pass**

Run: `npx jest --config jest.integration.config.js ledgerMirror`
Expected: PASS.

- [ ] **Step 5: Commit + push**

```bash
git add backend/services/ledger/reconciliation.js backend/tests/integration/ledgerMirror.integration.test.js
git commit -m "feat(ledger): reconciliarConLegacy parity check (ledger vs balances_users)"
git push origin dev
```

---

## Acceptance criteria

- Every `BalanceUsuario` write (static methods AND raw `.update`/`.create`) posts a balancing ledger transaction in the same transaction.
- `reconciliarConLegacy` reports parity; the full existing suite (94 integration / 300 unit) stays green with the mirror active.
- Reads still come from `balances_users` (zero behavior change).

## Out of scope (next plans)

- **Plan 3 — read-flip:** route `getByUserAndCrypto`/`getTotalBalance`/`hasAvailableBalance` and the raw `findOne`/`findAll` read sites to the ledger projection; keep the mirror + parity as defense.
- **Plans 4+ — per-path enrichment:** swap first, then deposits/withdrawals (real `external_onchain` + `pending`), trading, P2P; each removes its `balances_users` writes; finally drop the mirror, `suspense`, and `BalanceUsuario`.
- Extend Stryker to the posting service once the ledger is money-authoritative (post read-flip).
