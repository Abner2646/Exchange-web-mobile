# Diseño — Activación del compartimento Spot + transferencias Funding↔Spot

**Fecha:** 2026-09-02
**Estado:** aprobado (brainstorming), pendiente de plan de implementación
**Radar:** #10 (compartimentos de saldo) — continúa el ledger de partida doble (`2026-08-31-double-entry-ledger-design.md`)
**Guardrail:** refuerza los controles de seguridad/regulatorios (segregación de fondos por propósito, trazabilidad de movimientos internos); no agrega riesgo. Los caminos de retiro/depósito/P2P quedan intactos.

---

## 1. Problema y objetivo

El ledger de partida doble ya define los propósitos `spot:disponible` y `spot:bloqueado`
(`services/ledger/ledgerAccounts.js`), pero **ningún camino de dinero los usa**: todo
(incluido el trading de order book) reserva y liquida en `funding:*`. El compartimento
Spot existe como constante muerta.

**Objetivo:** activar Spot como la **billetera de trading** y darle al usuario un mecanismo
explícito para mover fondos entre compartimentos:

- El **order book** reserva y liquida en Spot (`spot:disponible ↔ spot:bloqueado`).
- El **swap/convert** puede originarse desde Funding **o** Spot (a elección del usuario).
- **Funding sigue siendo el único on/off-ramp**: depósitos, retiros, P2P y transferencias
  user↔user viven en Funding, sin cambios.
- El usuario transfiere Funding↔Spot de forma instantánea, gratuita e interna.

Esto materializa la separación de compartimentos ya aprobada (Radar #10) y deja el modelo
listo para Futuros/Earn (Fase 8) como datos, sin cambio de esquema.

---

## 2. Decisiones de producto (tomadas en brainstorming)

| Decisión | Resultado |
|----------|-----------|
| ¿Dónde vive el swap/convert? | **Disponible en ambos** compartimentos. El endpoint recibe un `compartimento` origen (default `funding`); ambas patas del usuario (paga/recibe) ocurren en ese compartimento. |
| ¿Retiro desde Spot? | **No.** Retiros siguen saliendo de `funding:bloqueado`. Para retirar fondos de Spot, el usuario transfiere Spot→Funding primero. El camino de retiro **no se toca**. |
| Forma de la respuesta de balances | **Aditiva (1B).** Los campos de raíz (`disponible`/`bloqueado`/`pendiente`) pasan a ser la **suma** de ambos compartimentos (compatible con el frontend actual) + un sub-objeto `compartimentos: { funding, spot }` con el desglose. No rompe el contrato. |
| Saldos existentes | **Sin migración.** Todo el dinero actual queda en Funding; nadie ve su saldo moverse. El usuario transfiere a Spot cuando quiere operar en el order book. |

**Consecuencia visible de "sin migración":** tras el deploy, la primera orden de un usuario
con fondos sólo en Funding **falla por saldo insuficiente en Spot**. Es correcto por diseño;
el frontend debe guiar ("transferí a Spot para operar"). Se documenta como cambio de
comportamiento en el contrato del frontend.

---

## 3. Compartimentos (recordatorio del modelo aprobado)

| Compartimento | Estados | Contiene |
|---------------|---------|----------|
| **Funding** | disponible / pendiente / bloqueado | on/off-ramp: depósitos, retiros, P2P, transferencias user↔user |
| **Spot** | disponible / bloqueado | trading de order book; swap (opcional, a elección) |

`spot:pendiente` no se modela (no aplica hoy).

---

## 4. Arquitectura

Regla de aislamiento: los money-paths llaman a **operaciones de dominio** ricas
(`services/ledger/operations.js`), no a la fachada `BalanceUsuario`. La fachada queda para
lecturas y para los caminos legacy de Funding (P2P/retiro/admin). Este diseño agrega tres
operaciones nuevas y toca **un solo consumidor** de money-path (el servicio de trading).

### 4.1 Operaciones de dominio (`services/ledger/operations.js`)

Nuevas:

- **`transferirEntreCompartimentos({ userId, criptomonedaId, cantidad, origen, destino })`**
  Un asiento `tipo: 'transferencia_compartimento'`, net-zero para el mismo usuario:
  - `{origen}:disponible −A`
  - `{destino}:disponible +A`

  `origen`/`destino ∈ {funding, spot}` y deben diferir. Anti-sobregiro del origen: lo da
  `postTransaction` (`SELECT … FOR UPDATE` sobre la fila de proyección). Mismo patrón que
  `transferirInterno`, pero mismo usuario y distinto propósito.

- **`reservarParaOrden({ userId, criptomonedaId, cantidad })`**
  `spot:disponible −A → spot:bloqueado +A` (`tipo: 'reserva_orden'`).

- **`liberarReserva({ userId, criptomonedaId, cantidad })`**
  Inverso: `spot:bloqueado −A → spot:disponible +A` (`tipo: 'liberacion_reserva'`).

Cambios en operaciones existentes:

- **`liquidarTrade`** — las cuatro patas de usuario pasan de `FUNDING_*` a `SPOT_*`
  (`SPOT_BLOQUEADO`/`SPOT_DISPONIBLE`). Los dos lados del match ya reservaron en Spot, así
  que la liquidación es `spot:bloqueado → spot:disponible` + `fee_revenue` por lado (sin
  cambios en las patas de comisión de la casa).

- **`liquidarSwap`** — nuevo parámetro `compartimento` (`'funding'|'spot'`, default
  `'funding'`). Selecciona el propósito de las patas del usuario (`{comp}:disponible`). Las
  patas de la casa (`treasury`, `fee_revenue`) no cambian.

### 4.2 Servicio de trading (`services/trading/balanceManager.service.js`) — único repunte

- Reemplaza `BalanceUsuario.blockBalance/unblockBalance` por
  `reservarParaOrden/liberarReserva`.
- El chequeo previo de saldo lee `spot:disponible` (no `funding:disponible`).
- La llamada a `liquidarTrade` no cambia de firma (ahora liquida en Spot).

P2P (`transaccionesP2P.model.js`), retiros (`transaccionBlockchain.model.js`) y el
block/unblock admin (`balanceUsuario.controller.js`) **siguen usando** la fachada Funding
sin cambios.

### 4.3 Fachada de balances (`models/balanceUsuario.model.js`)

- Parametrizar el lector interno por compartimento (`leerFundingDesdeLedger` → lector
  genérico que también lee `spot:disponible`/`spot:bloqueado`).
- Nuevo método de lectura por compartimento que alimente la API con
  `{ funding: {…}, spot: {…} }` + los totales sumados.
- `hasAvailableBalance` gana una variante/param de compartimento para el pre-chequeo de
  trading en Spot. El resto de los callers de Funding no cambian.

### 4.4 Endpoints

- **`POST /balances/transfer`** (autenticado, self-only):
  body `{ criptomonedaId, cantidad, origen, destino }` → `transferirEntreCompartimentos`.
  Validaciones: `origen ≠ destino`, ambos ∈ `{funding, spot}`, `cantidad > 0`. Traduce el
  error `/sobregiro/` a un mensaje de "saldo insuficiente en {origen}".
- **GET de balances** (`getMyBalances` y admin): la respuesta gana el sub-objeto
  `compartimentos` y los totales de raíz pasan a ser la suma. **Cambio de contrato** →
  documentar en `docs/frontend-rebuild/backend-contract-changes.md` en el mismo commit.
- **Swap** (`intercambioExchange.controller.js`): acepta `compartimento` (default
  `funding`), lo valida y lo pasa a `liquidarSwap`.

### 4.5 Forma de la respuesta de balances (contrato)

```json
{
  "criptomonedaId": "…",
  "disponible": "4.5",   // suma funding+spot (compat con frontend actual)
  "bloqueado": "0.7",
  "pendiente": "0",
  "compartimentos": {
    "funding": { "disponible": "1.5", "bloqueado": "0.2", "pendiente": "0" },
    "spot":    { "disponible": "3.0", "bloqueado": "0.5" }
  }
}
```

---

## 5. Flujo de datos (ejemplos)

**Transferir Funding→Spot (A de BTC):**
`(user, funding:disponible, BTC) −A` · `(user, spot:disponible, BTC) +A`.

**Comprar en el order book (usuario quote-side):**
1. Reserva: `(user, spot:disponible, USDT) −q·P` · `(user, spot:bloqueado, USDT) +q·P`.
2. Match + liquidación (`liquidarTrade`): patas base/quote de comprador y vendedor sobre
   `spot:bloqueado → spot:disponible` + `fee_revenue` por lado.

**Retirar fondos que están en Spot:**
1. `transferirEntreCompartimentos` Spot→Funding.
2. Camino de retiro habitual sobre `funding:*` (sin cambios).

---

## 6. Manejo de errores

- **Sobregiro** en transfer/reserva: `postTransaction` lanza `/sobregiro/`; cada operación lo
  traduce al mensaje de dominio ("saldo insuficiente en {compartimento}"). El `FOR UPDATE`
  garantiza atomicidad frente a requests concurrentes (mismo control que hoy en Funding).
- **Parámetros inválidos** (`origen == destino`, compartimento desconocido, cantidad ≤ 0):
  400 antes de tocar el ledger.
- **Orden sin fondos en Spot** (usuario con saldo sólo en Funding): falla en el pre-chequeo
  de trading con "saldo insuficiente en Spot" — comportamiento esperado post-deploy.

---

## 7. Testing (TDD Red→Green; sostener el piso de cobertura)

**Unit sin-DB** (patrón `tests/ledgerOperations.test.js`) — mantiene el piso unit:
- Asiento exacto de `transferirEntreCompartimentos` (ambas direcciones).
- Asiento de `reservarParaOrden` y `liberarReserva`.
- `liquidarTrade` posteando en `SPOT_*` (no Funding).
- `liquidarSwap` con `compartimento: 'spot'` (patas de usuario en Spot, casa sin cambios).

**Integración:**
- Round-trip de transferencia Funding↔Spot (saldos y desglose por compartimento).
- Ciclo completo de orden en Spot: reserva → match → liquidación → balances.
- Swap originado desde Spot.
- Sobregiro rechazado en transferencia.
- Guard: un retiro sólo ve `funding:*` (fondos en Spot requieren transferir primero).

**CI:** correr `npm run test:coverage` y `npm run test:integration:coverage` (DB arriba),
ambos exit 0, antes de cada push. Código nuevo sólo-integración → sumar unit sin-DB.

---

## 8. Fuera de alcance (YAGNI)

- `spot:pendiente` (no aplica hoy).
- Retiro directo desde Spot (decisión: transferir a Funding primero).
- Migración/backfill de saldos existentes a Spot.
- Cambios de frontend (se entrega el contrato; el frontend en reconstrucción lo consume).
