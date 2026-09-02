# Spot Compartment Activation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the unused `spot:*` ledger compartment as the trading wallet, and give users an explicit Funding↔Spot transfer.

**Architecture:** Add three domain operations to the ledger (`transferirEntreCompartimentos`, `reservarParaOrden`, `liberarReserva`), switch order-book reservation/settlement from `funding:*` to `spot:*`, let swap originate from either compartment, and expose balances with an additive per-compartment breakdown. Only the trading balance service is repointed; P2P, withdrawals, and admin block/unblock stay in Funding.

**Tech Stack:** Node/Express, Sequelize/Postgres, Jest (unit `jest.config.js`, integration `jest.integration.config.js`), the double-entry ledger in `services/ledger/`.

## Global Constraints

- **Money math:** always via `utils/money` (`money.subtract('0', x)` for negation, `money.add`, `money.compare`, `money.multiply`). Never native `+`/`-` on amounts. Amounts are canonical strings.
- **Lazy requires inside operations:** `postingService` and `ledgerAccounts` are required *inside* each function in `services/ledger/operations.js` to avoid the `models ↔ services/ledger` cycle. Follow the existing pattern exactly.
- **Language:** code identifiers + comments in Spanish; commit messages in English (Conventional Commits), ending with the two trailers below.
- **Anti-overdraft:** the real guard is `postTransaction`'s `SELECT … FOR UPDATE` (raises `/sobregiro/`); pre-checks are only friendly early errors.
- **Compartments are `{funding, spot}` only.** `spot:pendiente` does not exist. Withdrawals read `funding:*` only — do not touch withdrawal code.
- **Coverage floor (CI):** before every push run **both** `npm run test:coverage` and (DB up) `npm run test:integration:coverage`, each exit 0. Code reachable only by integration lowers the unit floor → add a no-DB unit test (pattern: `tests/ledgerOperations.test.js`).
- **Commit trailer (every commit):**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01UuRS2CgVBw37aAAzqRavBB
  ```
- **Integration DB:** start once with `npm run test:integration:up` (docker), tear down with `npm run test:integration:down`.

---

## File Structure

- `backend/services/ledger/operations.js` — **Modify.** Add `transferirEntreCompartimentos`, `reservarParaOrden`, `liberarReserva`; switch `liquidarTrade` to `SPOT_*`; add `compartimento` to `liquidarSwap`.
- `backend/tests/ledgerOperations.test.js` — **Modify.** Unit asserts for the new/changed asientos.
- `backend/models/balanceUsuario.model.js` — **Modify.** Compartment-parameterized reader + Spot read methods + additive breakdown method.
- `backend/services/trading/balanceManager.service.js` — **Modify.** Repoint reservation/settlement/reads to Spot.
- `backend/controllers/balanceUsuario.controller.js` — **Modify.** New `transferMisCompartimentos`; additive shape in `getMyBalances`/`getTotalBalance`.
- `backend/routes/balanceUsuario.routes.js` — **Modify.** `POST /balances/my/transfer`.
- `backend/controllers/intercambioExchange.controller.js` — **Modify.** Accept `compartimento`, pass to `liquidarSwap`, check suffiency in the chosen compartment.
- `backend/tests/helpers/factories.js` — **Modify.** Add `seedSpotBalance`.
- `backend/tests/integration/spotCompartment.integration.test.js` — **Create.** Transfer round-trip, order lifecycle in Spot, swap-from-Spot, overdraft, `getMyBalances` shape.
- `docs/frontend-rebuild/backend-contract-changes.md` — **Modify.** Document the additive balance shape, the transfer endpoint, the swap `compartimento` param, and the "transfer to Spot to trade" behavior change.

---

### Task 1: `transferirEntreCompartimentos` domain operation

**Files:**
- Modify: `backend/services/ledger/operations.js`
- Test: `backend/tests/ledgerOperations.test.js`

**Interfaces:**
- Consumes: `postTransaction`, `PROPOSITOS` (existing).
- Produces: `transferirEntreCompartimentos({ userId, criptomonedaId, cantidad, origen, destino, referencia }, transaction = null)` — one `tipo:'transferencia_compartimento'` asiento, `{origen}:disponible −A` / `{destino}:disponible +A`, same user. `origen`/`destino ∈ {'funding','spot'}`, must differ. Throws `Error(/compartimento/i)` on invalid pair.

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/ledgerOperations.test.js`. First extend the import block:

```js
const {
  liquidarSwap, liquidarTrade, marcarRetiroTransmitido,
  registrarDepositoPendiente, confirmarDeposito, transferirInterno, liquidarP2P,
  acreditarFaucet, transferirEntreCompartimentos, reservarParaOrden, liberarReserva,
} = require('../services/ledger/operations');
```

Then append:

```js
describe('transferirEntreCompartimentos mueve disponible entre compartimentos (mismo user)', () => {
  test('funding→spot: funding:disponible −A, spot:disponible +A', async () => {
    await transferirEntreCompartimentos({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '2',
      origen: 'funding', destino: 'spot', referencia: 'transfer:1',
    }, 'tx');

    expect(postTransaction).toHaveBeenCalledTimes(1);
    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('transferencia_compartimento');
    expect(asiento.referencia).toBe('transfer:1');
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '-2' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'BTC', monto: '2' });
  });

  test('spot→funding: spot:disponible −A, funding:disponible +A', async () => {
    await transferirEntreCompartimentos({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '2',
      origen: 'spot', destino: 'funding', referencia: 'transfer:2',
    });
    const { lineas } = postTransaction.mock.calls[0][0];
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'BTC', monto: '-2' });
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '2' });
  });

  test('rechaza compartimentos iguales o desconocidos', async () => {
    await expect(transferirEntreCompartimentos({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '1', origen: 'spot', destino: 'spot', referencia: 'x',
    })).rejects.toThrow(/compartimento/i);
    await expect(transferirEntreCompartimentos({
      userId: 'u', criptomonedaId: 'BTC', cantidad: '1', origen: 'funding', destino: 'earn', referencia: 'x',
    })).rejects.toThrow(/compartimento/i);
    expect(postTransaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- tests/ledgerOperations.test.js -t transferirEntreCompartimentos`
Expected: FAIL — `transferirEntreCompartimentos is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `backend/services/ledger/operations.js`, add before `module.exports`:

```js
// Mapa compartimento→propósito del estado 'disponible'. Único punto de verdad
// para las operaciones que mueven saldo disponible entre compartimentos.
const DISPONIBLE_POR_COMPARTIMENTO = {
  funding: 'funding:disponible',
  spot: 'spot:disponible',
};

// Transferencia interna del MISMO usuario entre compartimentos (Funding↔Spot),
// misma cripto. Un asiento net-zero: {origen}:disponible −A → {destino}:disponible
// +A. Sin contraparte de casa (no cambia el patrimonio, sólo su ubicación). El
// anti-sobregiro del origen lo da postTransaction (FOR UPDATE sobre la fila).
async function transferirEntreCompartimentos({ userId, criptomonedaId, cantidad, origen, destino, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const propOrigen = DISPONIBLE_POR_COMPARTIMENTO[origen];
  const propDestino = DISPONIBLE_POR_COMPARTIMENTO[destino];
  if (!propOrigen || !propDestino || origen === destino) {
    throw new Error(`Compartimentos inválidos para transferencia: ${origen} → ${destino}`);
  }
  const monto = String(cantidad);
  const lineas = [
    { ownerId: userId, proposito: propOrigen, criptomonedaId, monto: money.subtract('0', monto) },
    { ownerId: userId, proposito: propDestino, criptomonedaId, monto },
  ];
  return postTransaction({ tipo: 'transferencia_compartimento', referencia, descripcion: `Transferencia ${origen}→${destino}`, lineas }, transaction);
}
```

Add `transferirEntreCompartimentos` to `module.exports`:

```js
module.exports = {
  liquidarSwap, liquidarTrade, marcarRetiroTransmitido,
  registrarDepositoPendiente, confirmarDeposito, transferirInterno, liquidarP2P,
  acreditarFaucet, transferirEntreCompartimentos,
};
```

Note: the literals `'funding:disponible'`/`'spot:disponible'` match `PROPOSITOS.FUNDING_DISPONIBLE`/`PROPOSITOS.SPOT_DISPONIBLE`; the test asserts against the `PROPOSITOS` constants, keeping them in sync.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- tests/ledgerOperations.test.js -t transferirEntreCompartimentos`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/ledger/operations.js backend/tests/ledgerOperations.test.js
git commit -m "feat(ledger): add transferirEntreCompartimentos (Funding↔Spot)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UuRS2CgVBw37aAAzqRavBB"
```

---

### Task 2: `reservarParaOrden` / `liberarReserva` (Spot reservation)

**Files:**
- Modify: `backend/services/ledger/operations.js`
- Test: `backend/tests/ledgerOperations.test.js`

**Interfaces:**
- Produces:
  - `reservarParaOrden({ userId, criptomonedaId, cantidad, referencia }, transaction = null)` — `spot:disponible −A → spot:bloqueado +A`, `tipo:'reserva_orden'`.
  - `liberarReserva({ userId, criptomonedaId, cantidad, referencia }, transaction = null)` — inverse, `tipo:'liberacion_reserva'`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/ledgerOperations.test.js`:

```js
describe('reservarParaOrden / liberarReserva mueven disponible↔bloqueado en Spot', () => {
  test('reservarParaOrden: spot:disponible −A → spot:bloqueado +A', async () => {
    await reservarParaOrden({ userId: 'u', criptomonedaId: 'USDT', cantidad: '100', referencia: 'reserva:1' }, 'tx');
    const [asiento, transaction] = postTransaction.mock.calls[0];
    expect(transaction).toBe('tx');
    expect(asiento.tipo).toBe('reserva_orden');
    expect(asiento.referencia).toBe('reserva:1');
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'USDT', monto: '-100' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId: 'USDT', monto: '100' });
  });

  test('liberarReserva: spot:bloqueado −A → spot:disponible +A', async () => {
    await liberarReserva({ userId: 'u', criptomonedaId: 'USDT', cantidad: '100', referencia: 'liberacion:1' });
    const asiento = postTransaction.mock.calls[0][0];
    expect(asiento.tipo).toBe('liberacion_reserva');
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId: 'USDT', monto: '-100' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'USDT', monto: '100' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- tests/ledgerOperations.test.js -t "reservarParaOrden / liberarReserva"`
Expected: FAIL — `reservarParaOrden is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `backend/services/ledger/operations.js`, add after `transferirEntreCompartimentos`:

```js
// Reserva de saldo para una orden del order book, dentro de Spot.
// spot:disponible −A → spot:bloqueado +A. El anti-sobregiro lo da postTransaction.
async function reservarParaOrden({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const monto = String(cantidad);
  const lineas = [
    { ownerId: userId, proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId, monto: money.subtract('0', monto) },
    { ownerId: userId, proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId, monto },
  ];
  return postTransaction({ tipo: 'reserva_orden', referencia, descripcion: 'Reserva de orden spot', lineas }, transaction);
}

// Libera una reserva de orden (cancelación / remanente). spot:bloqueado −A →
// spot:disponible +A.
async function liberarReserva({ userId, criptomonedaId, cantidad, referencia }, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const monto = String(cantidad);
  const lineas = [
    { ownerId: userId, proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId, monto: money.subtract('0', monto) },
    { ownerId: userId, proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId, monto },
  ];
  return postTransaction({ tipo: 'liberacion_reserva', referencia, descripcion: 'Liberación de reserva spot', lineas }, transaction);
}
```

Update `module.exports` to include both:

```js
module.exports = {
  liquidarSwap, liquidarTrade, marcarRetiroTransmitido,
  registrarDepositoPendiente, confirmarDeposito, transferirInterno, liquidarP2P,
  acreditarFaucet, transferirEntreCompartimentos, reservarParaOrden, liberarReserva,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- tests/ledgerOperations.test.js -t "reservarParaOrden / liberarReserva"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/ledger/operations.js backend/tests/ledgerOperations.test.js
git commit -m "feat(ledger): add reservarParaOrden/liberarReserva (Spot reservation)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UuRS2CgVBw37aAAzqRavBB"
```

---

### Task 3: Switch `liquidarTrade` settlement to Spot

**Files:**
- Modify: `backend/services/ledger/operations.js:78-85`
- Test: `backend/tests/ledgerOperations.test.js:59-91` (update existing asserts)

**Interfaces:**
- Consumes: same `liquidarTrade` signature (unchanged) — callers pass no compartment; settlement now lands in `spot:*`.
- Produces: `liquidarTrade` asiento uses `SPOT_BLOQUEADO`/`SPOT_DISPONIBLE` for the four user legs; `fee_revenue` legs unchanged.

- [ ] **Step 1: Update the existing test to expect Spot (now failing)**

In `backend/tests/ledgerOperations.test.js`, in the `liquidarTrade` describe (~lines 72-77), replace the four user-leg asserts `FUNDING_*` → `SPOT_*`:

```js
    // BASE: el vendedor libera bloqueado, el comprador recibe neto, la casa cobra el fee taker.
    expect(asiento.lineas).toContainEqual({ ownerId: 'vendedor', proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId: 'BTC', monto: '-1' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'comprador', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'BTC', monto: '0.999' });
    expect(asiento.lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: 'BTC', monto: '0.001' });
    // QUOTE: el comprador libera bloqueado, el vendedor recibe neto, la casa cobra el fee maker.
    expect(asiento.lineas).toContainEqual({ ownerId: 'comprador', proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId: 'USDT', monto: '-100' });
    expect(asiento.lineas).toContainEqual({ ownerId: 'vendedor', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'USDT', monto: '99.9' });
    expect(asiento.lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: 'USDT', monto: '0.1' });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- tests/ledgerOperations.test.js -t "liquidarTrade"`
Expected: FAIL — asiento still contains `FUNDING_*`, not `SPOT_*`.

- [ ] **Step 3: Update the implementation**

In `backend/services/ledger/operations.js`, in `liquidarTrade`'s `lineas` (~lines 78-85), change the four user legs:

```js
  const lineas = [
    // BASE: vendedor (bloqueado) → comprador (disponible) + fee_revenue.
    { ownerId: vendedorId, proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId: baseAssetId, monto: neg(cantidad) },
    { ownerId: compradorId, proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: baseAssetId, monto: baseNeto },
    // QUOTE: comprador (bloqueado) → vendedor (disponible) + fee_revenue.
    { ownerId: compradorId, proposito: PROPOSITOS.SPOT_BLOQUEADO, criptomonedaId: quoteAssetId, monto: neg(montoQuote) },
    { ownerId: vendedorId, proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: quoteAssetId, monto: quoteNeto },
  ];
```

Also update the function's header comment: replace the "funding: bloqueado→disponible" wording with "spot: bloqueado→disponible" (the two lines of comment above `async function liquidarTrade`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- tests/ledgerOperations.test.js -t "liquidarTrade"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/services/ledger/operations.js backend/tests/ledgerOperations.test.js
git commit -m "feat(ledger): settle order-book trades in Spot compartment

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UuRS2CgVBw37aAAzqRavBB"
```

---

### Task 4: `liquidarSwap` gains a `compartimento` parameter

**Files:**
- Modify: `backend/services/ledger/operations.js:26-57`
- Test: `backend/tests/ledgerOperations.test.js:20-57`

**Interfaces:**
- Produces: `liquidarSwap({ …existing, compartimento }, transaction)` where `compartimento ∈ {'funding','spot'}`, **default `'funding'`** (preserves current behavior). Only the user legs' `proposito` changes; treasury/fee_revenue legs unchanged. Throws `Error(/compartimento/i)` on unknown value.

- [ ] **Step 1: Write the failing test (add Spot case + default preserved)**

Append a describe to `backend/tests/ledgerOperations.test.js`:

```js
describe('liquidarSwap respeta el compartimento origen', () => {
  test("compartimento 'spot': las patas del usuario van a spot:disponible", async () => {
    await liquidarSwap({
      usuarioId: 'u', criptoBaseId: 'BTC', criptoQuoteId: 'USDT',
      cantidadBase: '3', cantidadQuote: '0.3', comisionMonto: '0.003',
      requiredQuote: '0.303', netQuote: '0.297', tipo: 'compra',
      compartimento: 'spot', referencia: 'swap:spot:1',
    });
    const { lineas } = postTransaction.mock.calls[0][0];
    // patas del usuario en Spot…
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'USDT', monto: '-0.303' });
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: 'BTC', monto: '3' });
    // …y ninguna pata de usuario en Funding.
    expect(lineas.some((l) => l.proposito === PROPOSITOS.FUNDING_DISPONIBLE)).toBe(false);
    // casa intacta.
    expect(lineas).toContainEqual({ ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: 'USDT', monto: '0.003' });
  });

  test('sin compartimento explícito, default = funding (comportamiento actual)', async () => {
    await liquidarSwap({
      usuarioId: 'u', criptoBaseId: 'BTC', criptoQuoteId: 'USDT',
      cantidadBase: '3', cantidadQuote: '0.3', comisionMonto: '0.003',
      requiredQuote: '0.303', netQuote: '0.297', tipo: 'compra', referencia: 'swap:def:1',
    });
    const { lineas } = postTransaction.mock.calls[0][0];
    expect(lineas).toContainEqual({ ownerId: 'u', proposito: PROPOSITOS.FUNDING_DISPONIBLE, criptomonedaId: 'BTC', monto: '3' });
  });

  test('compartimento desconocido → error, sin postear', async () => {
    await expect(liquidarSwap({
      usuarioId: 'u', criptoBaseId: 'BTC', criptoQuoteId: 'USDT',
      cantidadBase: '3', cantidadQuote: '0.3', comisionMonto: '0.003',
      requiredQuote: '0.303', netQuote: '0.297', tipo: 'compra',
      compartimento: 'earn', referencia: 'swap:bad:1',
    })).rejects.toThrow(/compartimento/i);
    expect(postTransaction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- tests/ledgerOperations.test.js -t "liquidarSwap respeta"`
Expected: FAIL — user legs still `FUNDING_DISPONIBLE` for the Spot case.

- [ ] **Step 3: Update the implementation**

In `backend/services/ledger/operations.js`, change `liquidarSwap` to accept and apply `compartimento` (default `'funding'`). Update the destructuring and derive the user-leg propósito:

```js
async function liquidarSwap({
  usuarioId, criptoBaseId, criptoQuoteId, cantidadBase,
  cantidadQuote, comisionMonto, requiredQuote, netQuote, tipo, referencia,
  compartimento = 'funding',
}, transaction = null) {
  const { postTransaction } = require('./postingService');
  const { PROPOSITOS } = require('./ledgerAccounts');
  const propUsuario = DISPONIBLE_POR_COMPARTIMENTO[compartimento];
  if (!propUsuario) {
    throw new Error(`Compartimento inválido para swap: ${compartimento}`);
  }
  const base = String(cantidadBase);
  const neg = (x) => money.subtract('0', String(x));

  let lineas;
  if (tipo === 'compra') {
    lineas = [
      { ownerId: usuarioId, proposito: propUsuario, criptomonedaId: criptoQuoteId, monto: neg(requiredQuote) },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoQuoteId, monto: String(cantidadQuote) },
      { ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: criptoQuoteId, monto: String(comisionMonto) },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoBaseId, monto: neg(base) },
      { ownerId: usuarioId, proposito: propUsuario, criptomonedaId: criptoBaseId, monto: base },
    ];
  } else {
    lineas = [
      { ownerId: usuarioId, proposito: propUsuario, criptomonedaId: criptoBaseId, monto: neg(base) },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoBaseId, monto: base },
      { ownerId: null, proposito: PROPOSITOS.TREASURY, criptomonedaId: criptoQuoteId, monto: neg(cantidadQuote) },
      { ownerId: usuarioId, proposito: propUsuario, criptomonedaId: criptoQuoteId, monto: String(netQuote) },
      { ownerId: null, proposito: PROPOSITOS.FEE_REVENUE, criptomonedaId: criptoQuoteId, monto: String(comisionMonto) },
    ];
  }

  return postTransaction({ tipo: 'swap', referencia, descripcion: `Swap ${tipo}`, lineas }, transaction);
}
```

Note: `DISPONIBLE_POR_COMPARTIMENTO` is defined in Task 1. `PROPOSITOS.FUNDING_DISPONIBLE === DISPONIBLE_POR_COMPARTIMENTO.funding`, so the existing swap tests (which assert `FUNDING_DISPONIBLE`) keep passing under the default. Also update the `liquidarSwap` header comment: the "(compartimento Funding — el compartimento Spot es una feature de producto separada)" line is now stale; replace with "(compartimento a elección del usuario: funding por default, o spot)".

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- tests/ledgerOperations.test.js`
Expected: PASS (all describes green, including the original swap tests under the default).

- [ ] **Step 5: Commit**

```bash
git add backend/services/ledger/operations.js backend/tests/ledgerOperations.test.js
git commit -m "feat(ledger): liquidarSwap accepts a source compartimento (funding|spot)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UuRS2CgVBw37aAAzqRavBB"
```

---

### Task 5: Compartment-aware reads in the balance facade

**Files:**
- Modify: `backend/models/balanceUsuario.model.js`
- Test: `backend/tests/ledgerOperations.test.js` is unit-only for operations; the facade reads hit the DB, so this task's dedicated coverage is the integration test in Task 6. To protect the **unit** floor, add a tiny no-DB unit test asserting the compartment→propósito mapping helper (below).

**Interfaces:**
- Produces (on `BalanceUsuario`):
  - `getSaldoCompartimento(userId, criptomonedaId, compartimento, options = {})` → `{ userId, criptomonedaId, compartimento, disponible, bloqueado, pendiente }` (strings; `pendiente` always `'0'` for spot). `options.transaction` respected.
  - `hasAvailableEnCompartimento(userId, criptomonedaId, amount, compartimento, transaction = null)` → boolean (`disponible >= amount`).
  - `getByUserIdCompartimento(userId, compartimento)` → `[{ criptomonedaId, disponible, bloqueado, pendiente }]` (one entry per crypto with an account in that compartment).
- Also exports helper `PROPOSITOS_POR_COMPARTIMENTO` for the unit test.

- [ ] **Step 1: Write the failing unit test (mapping helper, no DB)**

Create `backend/tests/balanceCompartimento.test.js`:

```js
// Unit sin-DB: fija el mapa compartimento→propósitos que usa la fachada de saldos
// para leer del ledger. Cazar acá un typo de propósito evita leer la cuenta
// equivocada en producción.
const { PROPOSITOS_POR_COMPARTIMENTO } = require('../models/balanceUsuario.model');
const { PROPOSITOS } = require('../services/ledger/ledgerAccounts');

test('funding mapea a disponible/bloqueado/pendiente', () => {
  expect(PROPOSITOS_POR_COMPARTIMENTO.funding).toEqual({
    disponible: PROPOSITOS.FUNDING_DISPONIBLE,
    bloqueado: PROPOSITOS.FUNDING_BLOQUEADO,
    pendiente: PROPOSITOS.FUNDING_PENDIENTE,
  });
});

test('spot mapea a disponible/bloqueado (sin pendiente)', () => {
  expect(PROPOSITOS_POR_COMPARTIMENTO.spot).toEqual({
    disponible: PROPOSITOS.SPOT_DISPONIBLE,
    bloqueado: PROPOSITOS.SPOT_BLOQUEADO,
    pendiente: null,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- tests/balanceCompartimento.test.js`
Expected: FAIL — `PROPOSITOS_POR_COMPARTIMENTO` is undefined (module exports a factory only).

- [ ] **Step 3: Implement the reader + methods + export**

In `backend/models/balanceUsuario.model.js`:

(a) Near the top (after the `require`s), add the map and a generic reader:

```js
// Mapa compartimento→propósitos por estado. Fuente única para leer saldos por
// compartimento desde la proyección del ledger. Spot no tiene 'pendiente'.
const { PROPOSITOS: _PROP } = require('../services/ledger/ledgerAccounts');
const PROPOSITOS_POR_COMPARTIMENTO = {
  funding: { disponible: _PROP.FUNDING_DISPONIBLE, bloqueado: _PROP.FUNDING_BLOQUEADO, pendiente: _PROP.FUNDING_PENDIENTE },
  spot: { disponible: _PROP.SPOT_DISPONIBLE, bloqueado: _PROP.SPOT_BLOQUEADO, pendiente: null },
};

// Lee disponible/bloqueado/pendiente de un compartimento desde la proyección del
// ledger. Require lazy de postingService por el ciclo models↔services/ledger.
async function leerCompartimento(userId, criptomonedaId, compartimento, transaction = null) {
  const { getSaldoCuenta } = require('../services/ledger/postingService');
  const props = PROPOSITOS_POR_COMPARTIMENTO[compartimento];
  if (!props) throw new Error(`Compartimento inválido: ${compartimento}`);
  const disponible = await getSaldoCuenta({ ownerId: userId, proposito: props.disponible, criptomonedaId }, transaction);
  const bloqueado = await getSaldoCuenta({ ownerId: userId, proposito: props.bloqueado, criptomonedaId }, transaction);
  const pendiente = props.pendiente
    ? await getSaldoCuenta({ ownerId: userId, proposito: props.pendiente, criptomonedaId }, transaction)
    : '0';
  return { disponible, bloqueado, pendiente };
}
```

(b) Inside `createBalanceUserModel`, add the three public methods (place them after `getByUserAndCrypto`):

```js
  // Lectura por compartimento (Spot activación): devuelve el saldo del
  // compartimento pedido. Usada por el servicio de trading (spot) y el endpoint
  // de transferencia entre compartimentos.
  BalanceUsuario.getSaldoCompartimento = async (userId, criptomonedaId, compartimento, options = {}) => {
    try {
      const { disponible, bloqueado, pendiente } = await leerCompartimento(userId, criptomonedaId, compartimento, options.transaction);
      return { userId, criptomonedaId, compartimento, disponible, bloqueado, pendiente };
    } catch (error) {
      throw new Error(`Error al obtener saldo de compartimento: ${error.message}`);
    }
  };

  // Chequeo rápido de suficiencia en un compartimento (early-error; el guard real
  // sigue siendo el FOR UPDATE de postTransaction).
  BalanceUsuario.hasAvailableEnCompartimento = async (userId, criptomonedaId, amount, compartimento, transaction = null) => {
    try {
      const { disponible } = await leerCompartimento(userId, criptomonedaId, compartimento, transaction);
      return money.compare(disponible, String(amount)) >= 0;
    } catch (error) {
      throw new Error(`Error al verificar saldo de compartimento: ${error.message}`);
    }
  };

  // Lista las criptos con cuenta en el compartimento pedido (una entrada por
  // cripto). Espejo de getByUserId pero scopeado a un compartimento.
  BalanceUsuario.getByUserIdCompartimento = async (userId, compartimento) => {
    try {
      const { CuentaLedger } = require('./index');
      const props = PROPOSITOS_POR_COMPARTIMENTO[compartimento];
      if (!props) throw new Error(`Compartimento inválido: ${compartimento}`);
      const propositos = [props.disponible, props.bloqueado, ...(props.pendiente ? [props.pendiente] : [])];
      const cuentas = await CuentaLedger.findAll({
        where: { ownerId: userId, proposito: propositos },
        attributes: ['criptomonedaId'],
        group: ['criptomonedaId'],
      });
      const salida = [];
      for (const c of cuentas) {
        const { disponible, bloqueado, pendiente } = await leerCompartimento(userId, c.criptomonedaId, compartimento);
        salida.push({ criptomonedaId: c.criptomonedaId, disponible, bloqueado, pendiente });
      }
      return salida;
    } catch (error) {
      throw new Error(`Error al obtener balances de compartimento: ${error.message}`);
    }
  };
```

(c) Export the map. At the bottom, change:

```js
module.exports = createBalanceUserModel;
module.exports.PROPOSITOS_POR_COMPARTIMENTO = PROPOSITOS_POR_COMPARTIMENTO;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- tests/balanceCompartimento.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/models/balanceUsuario.model.js backend/tests/balanceCompartimento.test.js
git commit -m "feat(balances): compartment-aware reads (getSaldoCompartimento, hasAvailableEnCompartimento)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UuRS2CgVBw37aAAzqRavBB"
```

---

### Task 6: Repoint the trading balance service to Spot

**Files:**
- Modify: `backend/services/trading/balanceManager.service.js`
- Modify: `backend/tests/helpers/factories.js` (add `seedSpotBalance`)
- Create: `backend/tests/integration/spotCompartment.integration.test.js` (order lifecycle in Spot)

**Interfaces:**
- Consumes: `reservarParaOrden`, `liberarReserva` (Task 2); `getSaldoCompartimento`, `hasAvailableEnCompartimento`, `getByUserIdCompartimento` (Task 5); `liquidarTrade` (Task 3, unchanged signature).
- Produces: `seedSpotBalance(user, cripto, monto)` in factories — apertura → `spot:disponible`.

- [ ] **Step 1: Write the failing integration test (order lifecycle in Spot)**

First add the factory helper. In `backend/tests/helpers/factories.js`, after `seedBalance`:

```js
// Siembra saldo directo en spot:disponible (apertura → spot). Para tests que
// necesitan fondos ya en el compartimento de trading sin pasar por la transferencia.
async function seedSpotBalance(user, cripto, monto) {
  const { postTransaction } = require('../../services/ledger/postingService');
  const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');
  const cryptoMod = require('crypto');
  return postTransaction({
    tipo: 'apertura',
    referencia: `seed-spot:${cryptoMod.randomUUID()}`,
    lineas: [
      { ownerId: null, proposito: PROPOSITOS.APERTURA, criptomonedaId: cripto.id, monto: `-${monto}` },
      { ownerId: user.id, proposito: PROPOSITOS.SPOT_DISPONIBLE, criptomonedaId: cripto.id, monto: String(monto) },
    ],
  });
}
```

Add `seedSpotBalance` to the `module.exports` list in factories.js.

Then create `backend/tests/integration/spotCompartment.integration.test.js`:

```js
require('../helpers/testEnv');
const { installAuthHarness } = require('../helpers/authHarness');
const f = require('../helpers/factories');
const balanceManager = require('../../services/trading/balanceManager.service');
const { BalanceUsuario } = require('../../models');
const recon = require('../../services/ledger/reconciliation');

installAuthHarness();

describe('Trading reserva y lee en el compartimento Spot', () => {
  test('lockBalanceForOrder falla si sólo hay saldo en Funding', async () => {
    const usdt = await f.seedCripto('USDT');
    const btc = await f.seedCripto('BTC');
    const pair = await f.seedTradingPair({ base: btc, quote: usdt });
    const user = await f.seedUser({ email: 'trader1@test.local', username: 'trader1' });
    await f.seedBalance(user, usdt, '1000'); // en Funding, NO en Spot

    const res = await balanceManager.lockBalanceForOrder({
      userId: user.id, tradingPair: pair, side: 'buy', quantity: '1', price: '100',
    });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/insuficiente/i);
  });

  test('con saldo en Spot, la reserva mueve spot:disponible → spot:bloqueado', async () => {
    const usdt = await f.seedCripto('USDT');
    const btc = await f.seedCripto('BTC');
    const pair = await f.seedTradingPair({ base: btc, quote: usdt });
    const user = await f.seedUser({ email: 'trader2@test.local', username: 'trader2' });
    await f.seedSpotBalance(user, usdt, '1000');

    const res = await balanceManager.lockBalanceForOrder({
      userId: user.id, tradingPair: pair, side: 'buy', quantity: '1', price: '100',
    });
    expect(res.success).toBe(true);

    const spot = await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'spot');
    expect(spot.disponible).toBe('900');
    expect(spot.bloqueado).toBe('100');
    // Funding intacto.
    const funding = await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'funding');
    expect(funding.disponible).toBe('0');
    expect((await recon.reconciliarInterno()).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (DB up): `cd backend && npm run test:integration:up && npm run test:integration -- tests/integration/spotCompartment.integration.test.js`
Expected: FAIL — the second test's `spot.bloqueado` is `'0'` because `lockBalanceForOrder` still reserves in Funding; the first test may pass or fail depending on funding read.

- [ ] **Step 3: Repoint the service to Spot**

In `backend/services/trading/balanceManager.service.js`:

Change imports at the top:

```js
const { BalanceUsuario, TradingPair } = require('../../models');
const { sequelize } = require('../../models');
const money = require('../../utils/money');
const crypto = require('crypto');
const { liquidarTrade, reservarParaOrden, liberarReserva } = require('../ledger/operations');
```

In `lockBalanceForOrder`, replace the balance check + block (the `hasAvailableBalance` + `blockBalance` block) with Spot equivalents:

```js
      // Verificar saldo disponible en Spot (early-error amigable).
      const hasBalance = await BalanceUsuario.hasAvailableEnCompartimento(
        userId, assetToLock, amountToLock, 'spot', transaction
      );

      if (!hasBalance) {
        return {
          success: false,
          error: 'Balance insuficiente en Spot para crear la orden (transferí fondos a Spot)'
        };
      }

      // Reservar en Spot (atómico: FOR UPDATE dentro de postTransaction).
      await reservarParaOrden(
        { userId, criptomonedaId: assetToLock, cantidad: amountToLock, referencia: `reserva:${crypto.randomUUID()}` },
        transaction
      );
```

In `unlockBalanceFromOrder`, replace the `BalanceUsuario.unblockBalance(...)` call with:

```js
      // Liberar la reserva en Spot.
      await liberarReserva(
        { userId: order.userId, criptomonedaId: assetToUnlock, cantidad: amountToUnlock, referencia: `liberacion:${crypto.randomUUID()}` },
        transaction
      );
```

In `checkSufficientBalance`, replace the `getByUserAndCrypto` read + `balance.balanceDisponible` with a Spot read:

```js
      const balance = await BalanceUsuario.getSaldoCompartimento(userId, assetNeeded, 'spot');
      const available = String(balance.disponible);
      const sufficient = money.compare(available, amountNeeded) >= 0;

      return {
        sufficient,
        required: amountNeeded,
        available,
        error: sufficient ? null : `Balance insuficiente en Spot. Requerido: ${amountNeeded}, Disponible: ${available}`
      };
```

(Delete the now-unused `if (!balance)` branch — `getSaldoCompartimento` always returns strings, `'0'` when empty.)

In `getTradingBalance`, replace with a Spot read:

```js
      const balance = await BalanceUsuario.getSaldoCompartimento(userId, criptomonedaId, 'spot');
      const available = String(balance.disponible);
      const locked = String(balance.bloqueado);
      return { available, locked, total: money.add(available, locked) };
```

(Delete its `if (!balance)` branch too.)

In `getAllTradingBalances`, replace `BalanceUsuario.getByUserId(userId)` with the Spot list and adjust the mapping:

```js
      const balances = await BalanceUsuario.getByUserIdCompartimento(userId, 'spot');
      return balances.map(balance => {
        const available = String(balance.disponible);
        const locked = String(balance.bloqueado);
        return {
          criptomonedaId: balance.criptomonedaId,
          available,
          locked,
          total: money.add(available, locked)
        };
      });
```

`updateBalancesAfterTrade` (the `liquidarTrade` call) needs no change — `liquidarTrade` now settles in Spot (Task 3). Update its comment: "Comprador↔vendedor (spot: bloqueado→disponible por cripto)".

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm run test:integration -- tests/integration/spotCompartment.integration.test.js`
Expected: PASS (2 tests). Then run the existing trading integration to catch regressions:
`npm run test:integration -- tests/integration/tradingMatching.integration.test.js`
Expected: PASS — **note:** if `tradingMatching.integration.test.js` seeds funds with `seedBalance` (Funding), it must be updated to `seedSpotBalance`. Make that substitution wherever the traders' tradeable funds are seeded, and re-run.

- [ ] **Step 5: Commit**

```bash
git add backend/services/trading/balanceManager.service.js backend/tests/helpers/factories.js backend/tests/integration/spotCompartment.integration.test.js backend/tests/integration/tradingMatching.integration.test.js
git commit -m "feat(trading): reserve, settle, and read order-book balances in Spot

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UuRS2CgVBw37aAAzqRavBB"
```

---

### Task 7: `POST /balances/my/transfer` (Funding↔Spot, self-service)

**Files:**
- Modify: `backend/controllers/balanceUsuario.controller.js`
- Modify: `backend/routes/balanceUsuario.routes.js`
- Modify: `backend/tests/integration/spotCompartment.integration.test.js` (add endpoint tests)

**Interfaces:**
- Consumes: `transferirEntreCompartimentos` (Task 1); `hasAvailableEnCompartimento` (Task 5).
- Produces: `transferMisCompartimentos(req, res)` controller; route `POST /api/balances/my/transfer` (auth, self). Body `{ criptomonedaId, cantidad, origen, destino }`. 400 on invalid params / same compartment / insufficient; 200 `{ message, data: { origen, destino } }` on success.

- [ ] **Step 1: Write the failing integration test**

Append to `backend/tests/integration/spotCompartment.integration.test.js`:

```js
const request = require('supertest');
const { app } = require('../helpers/authHarness');
const { PROPOSITOS } = require('../../services/ledger/ledgerAccounts');
const posting = require('../../services/ledger/postingService');

describe('POST /api/balances/my/transfer (Funding↔Spot)', () => {
  test('funding→spot mueve fondos y el libro cierra', async () => {
    const usdt = await f.seedCripto('USDT');
    const user = await f.seedUser({ email: 'mover@test.local', username: 'mover' });
    await f.seedBalance(user, usdt, '500');

    const res = await request(app)
      .post('/api/balances/my/transfer')
      .set(f.authHeader(user))
      .send({ criptomonedaId: usdt.id, cantidad: '200', origen: 'funding', destino: 'spot' });
    expect(res.status).toBe(200);

    expect((await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'funding')).disponible).toBe('300');
    expect((await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'spot')).disponible).toBe('200');
    expect(await posting.getSaldoCuenta({ ownerId: null, proposito: PROPOSITOS.SUSPENSE, criptomonedaId: usdt.id })).toBe('0');
    expect((await recon.reconciliarInterno()).ok).toBe(true);
  });

  test('sobregiro → 400, sin mover fondos', async () => {
    const usdt = await f.seedCripto('USDT');
    const user = await f.seedUser({ email: 'poor@test.local', username: 'poor' });
    await f.seedBalance(user, usdt, '10');

    const res = await request(app)
      .post('/api/balances/my/transfer')
      .set(f.authHeader(user))
      .send({ criptomonedaId: usdt.id, cantidad: '200', origen: 'funding', destino: 'spot' });
    expect(res.status).toBe(400);
    expect((await BalanceUsuario.getSaldoCompartimento(user.id, usdt.id, 'funding')).disponible).toBe('10');
  });

  test('mismo compartimento → 400', async () => {
    const usdt = await f.seedCripto('USDT');
    const user = await f.seedUser({ email: 'same@test.local', username: 'same' });
    await f.seedBalance(user, usdt, '10');
    const res = await request(app)
      .post('/api/balances/my/transfer')
      .set(f.authHeader(user))
      .send({ criptomonedaId: usdt.id, cantidad: '1', origen: 'funding', destino: 'funding' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm run test:integration -- tests/integration/spotCompartment.integration.test.js -t "my/transfer"`
Expected: FAIL — 404 (route missing).

- [ ] **Step 3: Implement controller + route**

In `backend/controllers/balanceUsuario.controller.js`, extend the top require:

```js
const { transferirInterno, transferirEntreCompartimentos } = require('../services/ledger/operations');
```

Add the controller (before `module.exports`):

```js
// Transferencia del usuario autenticado entre sus compartimentos (Funding↔Spot).
// Self-service: el userId sale del token, no del body.
const transferMisCompartimentos = async (req, res) => {
  try {
    const userId = req.user.id;
    const { criptomonedaId, cantidad, origen, destino } = req.body;

    const COMPARTIMENTOS = ['funding', 'spot'];
    if (!criptomonedaId || !cantidad || money.compare(String(cantidad), '0') <= 0) {
      return res.status(400).json({ error: 'Datos de transferencia incompletos' });
    }
    if (!COMPARTIMENTOS.includes(origen) || !COMPARTIMENTOS.includes(destino) || origen === destino) {
      return res.status(400).json({ error: 'Compartimentos inválidos (usá funding/spot, distintos)' });
    }

    // Early-error de suficiencia (el guard real es el FOR UPDATE del ledger).
    const alcanza = await BalanceUsuario.hasAvailableEnCompartimento(userId, criptomonedaId, cantidad, origen);
    if (!alcanza) {
      return res.status(400).json({ error: `Saldo insuficiente en ${origen} para transferir` });
    }

    await transferirEntreCompartimentos({
      userId, criptomonedaId, cantidad: String(cantidad), origen, destino,
      referencia: `compartimento:${crypto.randomUUID()}`,
    });

    res.json({ message: 'Transferencia entre compartimentos completada', data: { origen, destino } });
  } catch (error) {
    // /sobregiro/ del ledger (carrera) → 400 con mensaje de dominio.
    if (/sobregiro/i.test(error.message)) {
      return res.status(400).json({ error: 'Saldo insuficiente para transferir' });
    }
    res.status(400).json({ error: error.message });
  }
};
```

Add `money` to the requires at the top of the controller if not present:

```js
const money = require('../utils/money');
```

Add `transferMisCompartimentos` to `module.exports`.

In `backend/routes/balanceUsuario.routes.js`, add under the authenticated-user section (after the `/my/balances` route):

```js
// POST /api/balances/my/transfer - Transferir entre mis compartimentos (Funding↔Spot)
router.post('/my/transfer', authenticateToken, balanceUserController.transferMisCompartimentos);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm run test:integration -- tests/integration/spotCompartment.integration.test.js -t "my/transfer"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/balanceUsuario.controller.js backend/routes/balanceUsuario.routes.js backend/tests/integration/spotCompartment.integration.test.js
git commit -m "feat(balances): self-service Funding<->Spot transfer endpoint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UuRS2CgVBw37aAAzqRavBB"
```

---

### Task 8: Additive per-compartment balance response (1B) + contract doc

**Files:**
- Modify: `backend/models/balanceUsuario.model.js` (add `getBalancesConCompartimentos`)
- Modify: `backend/controllers/balanceUsuario.controller.js` (`getMyBalances`)
- Modify: `backend/tests/integration/spotCompartment.integration.test.js` (shape test)
- Modify: `docs/frontend-rebuild/backend-contract-changes.md`

**Interfaces:**
- Consumes: `leerCompartimento` / `PROPOSITOS_POR_COMPARTIMENTO` (Task 5).
- Produces: `BalanceUsuario.getBalancesConCompartimentos(userId)` → array of
  `{ criptomonedaId, disponible, bloqueado, pendiente, compartimentos: { funding:{disponible,bloqueado,pendiente}, spot:{disponible,bloqueado} } }` where root fields are the funding+spot sums. `getMyBalances` returns this array.

- [ ] **Step 1: Write the failing integration test (shape)**

Append to `backend/tests/integration/spotCompartment.integration.test.js`:

```js
describe('GET /api/balances/my/balances es aditivo (totales = suma + desglose)', () => {
  test('suma funding+spot en la raíz y expone compartimentos', async () => {
    const usdt = await f.seedCripto('USDT');
    const user = await f.seedUser({ email: 'shape@test.local', username: 'shape' });
    await f.seedBalance(user, usdt, '300');       // funding:disponible
    await f.seedSpotBalance(user, usdt, '200');    // spot:disponible

    const res = await request(app).get('/api/balances/my/balances').set(f.authHeader(user));
    expect(res.status).toBe(200);
    const fila = res.body.find((b) => b.criptomonedaId === usdt.id);
    expect(fila).toBeDefined();
    expect(fila.disponible).toBe('500'); // 300 + 200
    expect(fila.compartimentos.funding.disponible).toBe('300');
    expect(fila.compartimentos.spot.disponible).toBe('200');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm run test:integration -- tests/integration/spotCompartment.integration.test.js -t "aditivo"`
Expected: FAIL — current `getMyBalances` returns Funding-only rows without `compartimentos`.

- [ ] **Step 3: Implement the additive method + wire the controller**

In `backend/models/balanceUsuario.model.js`, inside `createBalanceUserModel` add:

```js
  // Respuesta aditiva (decisión 1B): por cada cripto con cuenta en Funding o Spot,
  // devuelve los totales de raíz (suma de ambos compartimentos, compatible con el
  // frontend actual) + el desglose por compartimento. Spot no tiene 'pendiente'.
  BalanceUsuario.getBalancesConCompartimentos = async (userId) => {
    try {
      const { CuentaLedger } = require('./index');
      const todos = [
        _PROP.FUNDING_DISPONIBLE, _PROP.FUNDING_BLOQUEADO, _PROP.FUNDING_PENDIENTE,
        _PROP.SPOT_DISPONIBLE, _PROP.SPOT_BLOQUEADO,
      ];
      const cuentas = await CuentaLedger.findAll({
        where: { ownerId: userId, proposito: todos },
        attributes: ['criptomonedaId'],
        group: ['criptomonedaId'],
      });
      const salida = [];
      for (const c of cuentas) {
        const funding = await leerCompartimento(userId, c.criptomonedaId, 'funding');
        const spot = await leerCompartimento(userId, c.criptomonedaId, 'spot');
        salida.push({
          criptomonedaId: c.criptomonedaId,
          disponible: money.add(funding.disponible, spot.disponible),
          bloqueado: money.add(funding.bloqueado, spot.bloqueado),
          pendiente: funding.pendiente, // sólo Funding tiene pendiente
          compartimentos: {
            funding: { disponible: funding.disponible, bloqueado: funding.bloqueado, pendiente: funding.pendiente },
            spot: { disponible: spot.disponible, bloqueado: spot.bloqueado },
          },
        });
      }
      return salida;
    } catch (error) {
      throw new Error(`Error al obtener balances con compartimentos: ${error.message}`);
    }
  };
```

In `backend/controllers/balanceUsuario.controller.js`, change `getMyBalances`:

```js
const getMyBalances = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await BalanceUsuario.getBalancesConCompartimentos(userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm run test:integration -- tests/integration/spotCompartment.integration.test.js -t "aditivo"`
Expected: PASS.

- [ ] **Step 5: Document the contract change + commit**

Append to `docs/frontend-rebuild/backend-contract-changes.md` a dated section covering:
- `GET /api/balances/my/balances` now returns, per crypto, root `disponible`/`bloqueado`/`pendiente` as the **sum** of Funding+Spot, plus a `compartimentos: { funding, spot }` breakdown (additive, non-breaking).
- New `POST /api/balances/my/transfer` `{ criptomonedaId, cantidad, origen, destino }` (`origen`/`destino ∈ {funding,spot}`).
- Swap accepts optional `compartimento` (default `funding`) — see Task 9.
- Behavior change: **order-book trading now requires funds in Spot**; a user with funds only in Funding must transfer to Spot first (withdrawals stay Funding-only).

```bash
git add backend/models/balanceUsuario.model.js backend/controllers/balanceUsuario.controller.js backend/tests/integration/spotCompartment.integration.test.js docs/frontend-rebuild/backend-contract-changes.md
git commit -m "feat(balances): additive per-compartment shape in getMyBalances + contract doc

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UuRS2CgVBw37aAAzqRavBB"
```

---

### Task 9: Wire `compartimento` through the swap endpoint

**Files:**
- Modify: `backend/controllers/intercambioExchange.controller.js`
- Modify: `backend/tests/integration/spotCompartment.integration.test.js` (swap-from-Spot)

**Interfaces:**
- Consumes: `liquidarSwap` `compartimento` param (Task 4); `getSaldoCompartimento` (Task 5).
- Produces: swap endpoint accepts optional `compartimento` (default `'funding'`); the suffiency pre-check and the settlement both use it.

- [ ] **Step 1: Write the failing integration test (swap from Spot)**

Append to `backend/tests/integration/spotCompartment.integration.test.js`. Use the existing swap route — confirm its path from `routes/` (e.g. `POST /api/exchange/`); adjust the path/body field names to match `intercambioExchange`'s controller (`cantidadBase`, `precio`, `tipo`, `parId`). Seed a trading pair via `f.seedPar` and a master wallet via `f.seedWalletMaestra`:

```js
const { IntercambioExchange } = require('../../models');

describe('Swap respeta el compartimento origen', () => {
  test("compartimento 'spot': debita/acredita Spot, no Funding", async () => {
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    await f.seedWalletMaestra(btc);
    await f.seedWalletMaestra(usdt);
    const par = await f.seedPar({ base: btc, quote: usdt, comision: '0.1' }); // ver firma real de seedPar
    const user = await f.seedUser({ email: 'swapspot@test.local', username: 'swapspot' });
    await f.seedSpotBalance(user, usdt, '1000');

    const res = await request(app)
      .post('/api/exchange/') // ajustar al path real del router de intercambio
      .set(f.authHeader(user))
      .send({ parId: par.id, tipo: 'compra', cantidadBase: '1', precio: '100', compartimento: 'spot' });
    expect(res.status).toBe(201);

    const spot = await BalanceUsuario.getSaldoCompartimento(user.id, btc.id, 'spot');
    expect(money.compare(spot.disponible, '0')).toBeGreaterThan(0); // recibió BTC en Spot
    const funding = await BalanceUsuario.getSaldoCompartimento(user.id, btc.id, 'funding');
    expect(funding.disponible).toBe('0'); // nada en Funding
  });
});
```

Note: read `f.seedPar`'s real signature and the intercambio route path before finalizing this test; fix names to match. The assertion intent (BTC lands in Spot, Funding untouched) is what matters.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm run test:integration -- tests/integration/spotCompartment.integration.test.js -t "Swap respeta"`
Expected: FAIL — swap ignores `compartimento`, credits Funding (or the suffiency check reads Funding and 400s).

- [ ] **Step 3: Implement the wiring**

In `backend/controllers/intercambioExchange.controller.js`:

(a) Read `compartimento` from the body and validate (near where `cantidadBase`, `precio`, `tipo` are destructured):

```js
const compartimento = req.body.compartimento || 'funding';
if (!['funding', 'spot'].includes(compartimento)) {
  await transaction.rollback();
  throw new AppError(400, errorCodes.EXCHANGE_INVALID_INPUT, 'Compartimento inválido (funding|spot)');
}
```

Use the actual invalid-input error code present in `errorCodes` (grep `errorCodes` in the file for the right constant; if none fits, reuse the existing validation error used elsewhere in this controller).

(b) Change the suffiency pre-check to read the chosen compartment. Replace the two `BalanceUsuario.getByUserAndCrypto(...)` reads (lines ~115 and ~122) with:

```js
      const balanceQuote = await BalanceUsuario.getSaldoCompartimento(usuarioId, criptoQuoteId, compartimento, { transaction });
      if (money.compare(String(balanceQuote.disponible), requiredQuote) < 0) {
```

and for the sell branch:

```js
      const balanceBase = await BalanceUsuario.getSaldoCompartimento(usuarioId, criptoBaseId, compartimento, { transaction });
      if (money.compare(String(balanceBase.disponible), String(cantidadBase)) < 0) {
```

(c) Pass `compartimento` to `liquidarSwap`:

```js
    await liquidarSwap({
      usuarioId, criptoBaseId, criptoQuoteId, cantidadBase, cantidadQuote,
      comisionMonto, requiredQuote, netQuote, tipo,
      compartimento,
      referencia: `swap:${newOrder.id}`,
    }, transaction);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npm run test:integration -- tests/integration/spotCompartment.integration.test.js`
Expected: PASS (whole file). Then the existing swap integration:
`npm run test:integration -- tests/integration/intercambioExchange.integration.test.js`
Expected: PASS — the default `compartimento='funding'` keeps current behavior; if any existing swap test now needs Spot funds it would only be new tests, not these.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/intercambioExchange.controller.js backend/tests/integration/spotCompartment.integration.test.js
git commit -m "feat(swap): accept a source compartimento (funding|spot) end to end

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UuRS2CgVBw37aAAzqRavBB"
```

---

### Task 10: Full-suite green + coverage floor + reconciliation

**Files:** none (verification task).

- [ ] **Step 1: Unit suite + coverage**

Run: `cd backend && npm run test:coverage`
Expected: PASS, exit 0, coverage floor met (the new no-DB unit tests in Tasks 1-5 keep the unit floor).

- [ ] **Step 2: Integration suite + coverage**

Run (DB up): `cd backend && npm run test:integration:coverage`
Expected: PASS, exit 0. Reconciliation assertions inside `spotCompartment.integration.test.js` confirm the book still closes (`reconciliarInterno().ok === true`).

- [ ] **Step 3: If either floor fails**

Identify integration-only new code and add a matching no-DB unit test (pattern: `tests/ledgerOperations.test.js` / `tests/balanceCompartimento.test.js`). Re-run both commands. Do not push until both are exit 0.

- [ ] **Step 4: Push**

```bash
git push origin dev
```

Then confirm CI: `gh run list --limit 1` → `success`.

---

## Self-Review

**Spec coverage:**
- Spot ledger ops (`transferirEntreCompartimentos`, `reservarParaOrden`, `liberarReserva`) → Tasks 1, 2. ✓
- Order book reserves/settles in Spot → Tasks 2 (reserve), 3 (settle), 6 (repoint). ✓
- Swap from either compartment (decision: both) → Tasks 4, 9. ✓
- Withdrawals Funding-only, untouched → respected (no withdrawal files modified); guard is the "funds only in Funding can't trade / must transfer" behavior tested in Task 6. ✓
- Additive balance response (1B) → Task 8. ✓
- No migration of existing balances → respected (no backfill task); behavior consequence tested in Task 6 (first order fails without Spot funds). ✓
- Transfer endpoint → Task 7. ✓
- Contract doc updated → Task 8 Step 5. ✓
- Testing: unit no-DB for the floor + integration lifecycle/round-trip/overdraft/reconciliation → Tasks 1-5 (unit), 6-9 (integration), 10 (floors). ✓

**Placeholder scan:** No TBD/TODO. Two spots require the implementer to confirm real names against the codebase before finalizing a test — Task 6 Step 4 (whether `tradingMatching` seeds Funding) and Task 9 (the intercambio route path + `seedPar` signature + exact `errorCodes` constant). These are explicit "verify then match" instructions with the assertion intent stated, not vague placeholders.

**Type consistency:** `DISPONIBLE_POR_COMPARTIMENTO` (Task 1) reused by `liquidarSwap` (Task 4). `PROPOSITOS_POR_COMPARTIMENTO` + `leerCompartimento` (Task 5) reused by `getSaldoCompartimento`/`hasAvailableEnCompartimento`/`getByUserIdCompartimento` (Task 5) and `getBalancesConCompartimentos` (Task 8). `getSaldoCompartimento` returns `{disponible,bloqueado,pendiente}` — consumers (Task 6 service, Task 7 controller, Task 9 swap) read `.disponible`/`.bloqueado` consistently (note: **not** `balanceDisponible`; the new methods use short keys). `reservarParaOrden`/`liberarReserva` param shape `{userId,criptomonedaId,cantidad,referencia}` consistent between Task 2 (def) and Task 6 (use).
