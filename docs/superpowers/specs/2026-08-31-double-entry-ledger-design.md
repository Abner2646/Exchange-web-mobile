# Diseño — Ledger de partida doble + wallets compartimentadas

**Fecha:** 2026-08-31
**Estado:** aprobado (brainstorming), pendiente de plan de implementación
**Radar:** #1 (ledger inmutable de partida doble) + #10 (compartimentos de saldo)
**Guardrail:** refuerza los controles de seguridad/regulatorios (FinCEN BSA/AML, NYDFS Part 500 §500.16 auditoría/logging, §5.6 reconciliación); no agrega riesgo.

---

## 1. Problema y objetivo

Hoy el saldo de cada usuario es una fila mutable `BalanceUsuario` — un par `(userId, criptomonedaId)` con `balanceDisponible` / `balanceBloqueado` (`DECIMAL(28,8)`) que se suma/resta con `UPDATE`. Un solo compartimento global, sin estado "pendiente". Esa mutabilidad fue la fuente estructural del race-condition del Críticos #5 (TOCTOU: dos requests leen el mismo saldo, las dos pasan la validación, las dos escriben). El fix actual lo mitiga con `SELECT ... FOR UPDATE`, pero el modelo sigue siendo "una única copia mutable de la verdad".

**Objetivo:** reemplazar el saldo mutable por un **ledger de partida doble append-only** como **fuente de verdad**, con **compartimentos** (Funding/Spot) y estados (disponible/pendiente/bloqueado) como subcuentas de ese libro. Esto:

- Elimina de raíz la clase *lost-update* (ya no se sobrescribe un saldo; solo se `INSERT`an movimientos).
- Da **historia inmutable y auditable** de cada movimiento de dinero (NYDFS Part 500 §500.16; base del audit trail Radar #3 y del monitoreo AML §4.8).
- Habilita **compartimentos** como subcuentas (Radar #10) y transferencias internas explícitas y trazables.
- Habilita **reconciliación** (interna y contra on-chain, §5.6).

**Meta de proyecto:** es la pieza central del camino "backend audit-grade que impresiona a un CTO". La partida doble es el sistema contable estándar de bancos y exchanges; no es una invención del proyecto.

### Decisiones tomadas en el brainstorming

1. **El ledger es la fuente de verdad.** `BalanceUsuario` deja de ser autoritativo (pasa a proyección derivada y finalmente se elimina).
2. **Compartimentos ahora: Funding + Spot.** El modelo de cuenta es genérico → Futuros/Earn (Fase 8) se agregan como datos, no como cambio de esquema.
3. **Estados como subcuentas:** disponible / pendiente / bloqueado por (usuario, compartimento, cripto).
4. **Migración incremental camino-por-camino** (no big-bang, no dual-write). No hay datos de producción que proteger, así que el parallel-run no se justifica.

---

## 2. Modelo de datos (el libro)

Tres tablas nuevas, **append-only** — nunca `UPDATE`/`DELETE` sobre asientos ni movimientos. Una corrección es un asiento reverso.

### `CuentaLedger` (`ledger_accounts`)
El catálogo de cuentas. Cada cuenta es la tripleta **(dueño, propósito, cripto)**.

| campo | tipo | notas |
|---|---|---|
| `id` | UUID PK | |
| `ownerId` | UUID nullable | `userId` para cuentas de usuario; `null` para cuentas de casa |
| `proposito` | STRING | compartimento+estado o cuenta de casa (ver taxonomía) |
| `criptomonedaId` | UUID FK | |
| `createdAt` | timestamp | |

- Índice único `(ownerId, proposito, criptomonedaId)`.
- El `proposito` codifica compartimento y estado: `funding:disponible`, `funding:pendiente`, `funding:bloqueado`, `spot:disponible`, `spot:bloqueado`; cuentas de casa: `external_onchain`, `fee_revenue`, `treasury`, `suspense`, `apertura`.
- Las cuentas se crean lazy (get-or-create) al primer movimiento que las toca.

### `AsientoLedger` (`ledger_transactions`)
El encabezado — **uno por evento de negocio**.

| campo | tipo | notas |
|---|---|---|
| `id` | UUID PK | |
| `tipo` | STRING/ENUM | `deposito`, `retiro`, `swap`, `reserva_orden`, `liberacion_reserva`, `liquidacion_trade`, `transferencia_compartimento`, `apertura`, `reverso`, `ajuste_legacy` |
| `referencia` | STRING | idempotency-key / id de la operación de dominio; **único** (dedup) |
| `descripcion` | STRING nullable | |
| `asientoReversadoId` | UUID nullable FK | apunta al asiento original si `tipo='reverso'` |
| `createdAt` | timestamp | |

### `MovimientoLedger` (`ledger_postings`)
Las líneas (débitos/créditos).

| campo | tipo | notas |
|---|---|---|
| `id` | UUID PK | |
| `asientoId` | UUID FK | |
| `cuentaId` | UUID FK | |
| `criptomonedaId` | UUID FK | denormalizado desde la cuenta para queries/constraint |
| `monto` | DECIMAL(28,8) | **con signo**: + crédito / − débito |
| `createdAt` | timestamp | |

### Invariantes de hierro
1. **Suma-cero por cripto dentro de cada asiento.** `Σ monto = 0` para cada `criptomonedaId` del asiento. Un swap cruza dos criptos: cada una cuadra sola. Enforced en el posting service; validado por la reconciliación; opcionalmente reforzado con constraint/trigger de DB (hardening).
2. **Append-only.** Saldo de una cuenta = `SUM(monto)` de sus movimientos. Sin campo de saldo autoritativo que competir → sin lost-updates.

### `SaldoLedger` (`ledger_balances`) — proyección derivada
Read-model, **no** una segunda verdad (reconstruible desde los movimientos).

| campo | tipo | notas |
|---|---|---|
| `cuentaId` | UUID PK/FK | |
| `saldo` | DECIMAL(28,8) | saldo corriente |
| `updatedAt` | timestamp | |

- Se actualiza **en la misma transacción** que inserta los movimientos.
- Las lecturas de saldo (`getMyBalances`, etc.) pegan a esta tabla.
- Invariante reconciliable: `SaldoLedger.saldo == SUM(MovimientoLedger.monto)` por cuenta, siempre.

---

## 3. Taxonomía de cuentas

**Cuentas de usuario** = compartimento × estado × cripto:

| compartimento | estados | contiene |
|---|---|---|
| **Funding** | disponible / pendiente / bloqueado | on/off-ramp: depósitos, retiros, P2P, transferencias |
| **Spot** | disponible / bloqueado | trading / swap |

`pendiente` de Spot no se modela hoy (no aplica); si algún producto lo requiere, es una fila nueva.

**Cuentas de casa/sistema** (la contrapartida que la partida doble exige):

| cuenta | rol |
|---|---|
| `external_onchain` (por cripto) | el "mundo on-chain". Un depósito debita acá y acredita al usuario; un retiro hace el inverso. Cierra el libro. |
| `fee_revenue` (por cripto) | ingresos de la casa por comisiones. La comisión del usuario acredita acá. |
| `treasury` (por cripto) | inventario propio del exchange; contraparte de los swaps (respaldado on-chain por custody). |
| `suspense` (por cripto) | **transitoria**: contrapartida de las mutaciones legacy de una sola pata durante la migración. Se vacía al completar la migración. |
| `apertura` (por cripto) | cuenta génesis del backfill inicial (asientos de apertura que replican los saldos actuales). |

**Reconciliación externa (§5.6):** `Σ pasivos-de-usuario == Σ cuentas-de-casa` (el libro cierra en cero) **y** el saldo on-chain real de las `WalletMaestra` **≥** lo que el ledger dice que la casa custodia. Un faltante se vuelve *detectable*.

---

## 4. Mapeo de operaciones a asientos

Cada operación = un asiento con líneas net-zero por cripto.

### Swap: compra de BTC con USDT (precio P, cantidad q, fee `f` en el activo recibido = BTC)

| cuenta | cripto | monto |
|---|---|---|
| `(user, spot:disponible, USDT)` | USDT | −(q·P) |
| `(casa, treasury, USDT)` | USDT | +(q·P) |
| `(casa, treasury, BTC)` | BTC | −q |
| `(user, spot:disponible, BTC)` | BTC | +(q−f) |
| `(casa, fee_revenue, BTC)` | BTC | +f |

USDT suma 0 · BTC suma 0. **La comisión es una línea más (no un tipo de asiento).** La venta es simétrica.

### Resto de los flujos

| operación | líneas (net-zero por cripto) |
|---|---|
| **Depósito detectado (sin confirmar)** | `external_onchain −A` · `funding:pendiente +A` |
| **Depósito confirmado** | `funding:pendiente −A` · `funding:disponible +A` |
| **Transferir Funding→Spot** | `funding:disponible −A` · `spot:disponible +A` (mismo user/cripto) |
| **Reservar para orden spot** | `spot:disponible −A` · `spot:bloqueado +A` |
| **Liberar reserva** | `spot:bloqueado −A` · `spot:disponible +A` |
| **Retiro solicitado** | `funding:disponible −A` · `funding:bloqueado +A` |
| **Retiro transmitido** | `funding:bloqueado −A` · `external_onchain +(A−wf)` · `fee_revenue +wf` (si hay fee de retiro) |
| **Trade spot (user↔user)** | patas base/quote de comprador y vendedor + una línea `fee_revenue` por lado (maker/taker) |

**Reverso** (ej. retiro que el reaper revierte): asiento nuevo `tipo='reverso'` con líneas invertidas y `asientoReversadoId` al original. Nunca se edita ni borra el original.

---

## 5. `LedgerService` — el único que escribe dinero

Módulo `services/ledger/` (ports & adapters, consistente con los puertos de blockchain y el seam de email). Es **lo único autorizado a insertar movimientos**.

### Primitiva de bajo nivel
```
postTransaction({ tipo, referencia, descripcion, lineas }, transaction)
```
- Valida invariantes: suma-cero por cripto; `lineas` no vacías; montos vía `money.js`.
- Dedup por `referencia` única → reintentar es no-op (no doble asiento). Engancha con el `Idempotency-Key` de Fase 1.
- Inserta asiento + movimientos; actualiza `SaldoLedger` de cada cuenta afectada **en la misma transacción**, bajo `SELECT ... FOR UPDATE` de la fila de proyección.
- **Anti-sobregiro:** para cuentas marcadas como no-negativas (las de usuario), tras aplicar el delta verifica `saldo >= 0`; si no, tira y hace rollback. El lock sobre la fila de proyección serializa por cuenta (misma protección que hoy, sobre un dato derivado y reconstruible).

### Operaciones de dominio (arman las líneas y llaman a la primitiva)
`registrarDepositoPendiente`, `confirmarDeposito`, `reservarParaOrden`, `liberarReserva`, `liquidarSwap`, `liquidarTrade`, `transferirEntreCompartimentos`, `registrarRetiro`, `marcarRetiroTransmitido`, `reversar(asientoId)`. Los money-paths llaman a **estas**, no a `BalanceUsuario.*`.

### Resolución de cuentas
Get-or-create lazy por `(ownerId, proposito, criptomonedaId)`.

### Qué exactamente mata el ledger del race-condition (honestidad)
- **Elimina de raíz:** la clase *lost-update* (sobrescritura destructiva). Ya no se escribe un saldo; se `INSERT`an movimientos, y un `INSERT` no pisa a otro. Era la mecánica exacta del Críticos #5.
- **Todavía requiere serialización:** las operaciones que no deben sobregirar necesitan que el chequeo "¿hay suficiente?" sea atómico con la escritura → `FOR UPDATE` sobre la fila de proyección de esa cuenta. El ledger da historia inmutable + cero lost-updates + auditabilidad + reconciliación; el anti-sobregiro sigue siendo un lock por cuenta, barato y correcto. **No** elimina todos los locks.

---

## 6. Plan de migración (incremental, campo de pruebas = swap)

### Fase 1 — ledger vivo detrás de un shim de compatibilidad (cero cambio de comportamiento)
- Crear las 4 tablas (`ledger_accounts`, `ledger_transactions`, `ledger_postings`, `ledger_balances`) + `LedgerService` + tests.
- Sembrar cuentas de casa.
- **Backfill:** un asiento `tipo='apertura'` por cada `BalanceUsuario` actual (`apertura → funding:disponible` por el disponible; `apertura → funding:bloqueado` por el bloqueado) → el ledger arranca idéntico a los saldos de hoy.
- **Lecturas** de saldo pasan a salir de `SaldoLedger`.
- **El shim opera enteramente dentro del compartimento Funding** (`funding:disponible`/`funding:bloqueado`), preservando el comportamiento de un-solo-compartimento de hoy (el API legacy no distingue compartimentos). La migración por camino (Fases 2..N) es la que reubica flujos específicos a Spot. Por eso el backfill manda disponible→`funding:disponible` y bloqueado→`funding:bloqueado`.
- Reimplementar `BalanceUsuario.updateBalance/blockBalance/unblockBalance` como **adaptadores finos que postean al ledger**:
  - `block/unblock` (dos patas: `funding:disponible`↔`funding:bloqueado`) → traducen directo a `transferencia`.
  - `updateBalance` de una sola pata → usa la cuenta `suspense` como contrapartida para cerrar el asiento en cero (`tipo='ajuste_legacy'`).
- Resultado: **el ledger ya es la fuente de verdad, con los 68 call sites intactos.** La reconciliación vigila el shim.

### Fases 2..N — enriquecer camino por camino
Cada money-path deja de llamar al shim y pasa a las operaciones ricas de `LedgerService`, con compartimento correcto y estado `pendiente` donde aplique. Orden:
1. **Swap** (`intercambioExchange`) — autocontenido, contra la casa, ya tiene tests de Fase 2 para portar.
2. **Depósitos / retiros** — estrenan `pendiente` + `external_onchain`.
3. **Trading** (order book / matching).
4. **P2P / transferencia.**

Cada migración es un refactor guardado por sus tests de integración. La cuenta `suspense` se va vaciando; la reconciliación confirma que llega a cero.

### Fase final — borrar lo viejo
Migrado el último camino: eliminar el modelo `BalanceUsuario`, el shim y la `suspense`. `SaldoLedger` queda como read-model de saldos.

### Contrato con el frontend
Cualquier cambio de forma de respuesta de saldos (ej. desglose por compartimento y estado en `getMyBalances`) se documenta en `docs/frontend-rebuild/backend-contract-changes.md` en el mismo commit.

---

## 7. Estrategia de testing

- **Unit:** invariantes del posting service (rechaza asiento desbalanceado; append-only; matemática de la proyección; anti-sobregiro bajo lock). Aritmética sobre `money.js`.
- **Integración (Postgres real):** cada camino migrado de punta a punta, aseverando el resultado de dominio **y** la correctitud del ledger (movimientos cuadran; `SaldoLedger == SUM(postings)`; la reconciliación cierra).
- **Concurrencia:** la regresión del Críticos #5 a nivel ledger — dos reservas/retiros concurrentes → exactamente uno gana, sin sobregiro, historia intacta.
- **Reconciliación como test de primera clase:** interno (`proyección == SUM`) y externo (`Σ usuarios == Σ casa`; on-chain ≥ custody del ledger).
- **Mutation testing (Stryker):** extendido al posting service (módulo de dinero, igual que `money.js`).
- **Disciplina:** TDD para el código nuevo del ledger; caracterización (test-after) al portar los tests existentes de swap/trading.

---

## 8. Fuera de alcance (explícito)

- Compartimentos **Futuros/Earn** (Fase 8) — el modelo de cuenta los soporta como datos, no se construyen ahora.
- **Constraint/trigger de DB** para suma-cero — hardening opcional; el posting service + la reconciliación ya lo garantizan. Evaluar en el plan.
- Migraciones/esquema versionado formal (Altos #12) — este diseño introduce tablas nuevas; si para entonces todavía se depende de `sequelize.sync`, se crean con el mismo mecanismo vigente y se anota la deuda, sin resolverla acá.
- Reconciliación on-chain **automática/alarmada** en producción (Sentry/§5.6 operacional) — el test/job de reconciliación se construye acá; la instrumentación de alarma es Fase 5.
