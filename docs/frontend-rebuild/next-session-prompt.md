# Prompt de arranque — próxima sesión (rediseñar **Trading**)

Pegá TODO este archivo como primer mensaje de la próxima sesión de Claude Code en
este repo. Supersede al prompt de Wallet (ya hecho).

---

## Rol y objetivo

Sos Claude Code en **crypto_exchange** (exchange custodial, audit-grade, EE.UU.;
dueño: Abner). **Chat en español; código/commits/PRs en inglés**, Conventional
Commits **sin atribución Claude** ni "Generated with…". El backend es la **fuente
de verdad** y **no se toca** sin aprobación explícita de Abner.

**Objetivo de esta sesión: rediseñar la página de Trading (`/trading`) al estándar
nuevo**, usando **Swap y Wallet como implementaciones de referencia**. Trading es
**Caso B/C** (order book + order form + trades; la V1 no es referencia de layout).

### Lectura obligatoria antes de tocar nada
1. `docs/frontend-rebuild/redesign-methodology.md` — proceso y regla de oro (A/B/C).
2. `docs/frontend-rebuild/aesthetic-standard.md` — tokens/estética.
3. `docs/frontend-rebuild/rebuild-status.md` — estado + roadmap + el "estándar nuevo".
4. `docs/frontend-rebuild/lessons-swap-session.md` — errores a no repetir + gotchas.
5. `docs/frontend-rebuild/known-issues.md` — **§C4 Trading** tiene la deuda ya anotada
   (spread negativo en libro cruzado → `Math.abs`/guard, header de order-book
   duplicado, dos selectores de par widget-vs-form, poll 5s vs 10s, dead
   `parsedQty.ok` en el path de venta, cap 8-dec cliente vs precisión del par).
6. Referencia viva del estándar: `web/src/features/swap/components/` (SwapForm,
   swap.module.css), `web/src/features/wallet/components/` (cards + tabla + badges +
   `SuccessFlash`) y `web/src/shared/ui/feedback/SuccessFlash.tsx`.

### PASO 0 — disciplina de ramas
`git fetch origin`; confirmá que estás en `dev` (el rediseño vive local, `dev`
está **adelantada y sin pushear** respecto de `origin`). Frontend sobre `dev`,
**sin tocar money-path ni backend**. Commit por chunk.

---

## Qué YA está hecho (no rehacer)
- Home `/`, Auth, Navbar + Footer, tema dark + toggle.
- **Swap `/swap`** — molde de referencia (De/A auto-cálculo, recibo en vivo,
  `SuccessFlash` azul, `Select` searchable + saldos, íconos, paneles nunca-vacíos).
- **Wallet `/wallet`** — rehecho (cards de balance Funding/Spot con `CoinLogo` +
  ceros muted, transfer con `Select` + Máx + flash, retiro con copy honesta +
  aside informativo, depósito = cartel región deshabilitado, historial = tabla con
  badges de estado por tono + filtro por pills). Verificado Playwright+screenshots.
- Sandbox `/lab` para el flash y los íconos.

## El estándar a aplicar (lo que hace a una página "terminada")
Ver `rebuild-status.md` §"estándar nuevo". En corto: tokens de estética; `Select`
(**nunca nativo**) con `searchable`/`meta` + `CoinLogo`; **money string-math +
redondeo a la precisión del backend antes de mandar**; `SuccessFlash` en todo botón
que finaliza transacción; paneles nunca vacíos; copy honesta (no filtrar códigos, no
prometer de más); `:focus-visible` + `prefers-reduced-motion`; estados loading
(skeletons) / empty / error; **verificación en vivo con Playwright + screenshots**
antes de decir "terminada".

---

## Trabajo concreto — Trading

La feature ya existe (`web/src/features/trading/`): order form, order book, recent
trades, pair selector, mis órdenes (+ queries + tests). **Se rediseña, no se
construye de cero.**

**Primero investigá el backend** (como en swap/wallet) ANTES de diseñar:
- Endpoints de órdenes/matching/libro/trades (`backend/modules/trading*` /
  `orden*` / `matching*`). Mirá: **validaciones de precio/cantidad y precisión de
  decimales** (redondeá en el front antes de mandar), tipos de orden soportados
  (limit/market), estados de la orden (open/filled/partial/cancelled), compartimento
  que reserva/liquida (Spot), e **idempotencia** (`usePlaceOrder` ya la cablea).
  Reportá los hallazgos **antes de tocar UI**.

Alcance tentativo (ajustar según hallazgos):
1. **Order form** (limit/market, buy/sell) con `Select` de par + `CoinLogo`, Máx por
   saldo Spot, redondeo, `SuccessFlash` al colocar la orden.
2. **Order book** (bids/asks) con estética nueva; **guard de spread negativo** en
   libro cruzado (§C4).
3. **Recent trades** — tabla al estándar (no colapsar error→empty).
4. **Mis órdenes** — listado con estados (badges) + cancelar (si existe) → flash.
5. Unificar/decidir el **doble selector de par** (widget vs form) — es un trade-off
   MVP documentado; proponer resolución, no asumir.

## Dev stack (para verificar en vivo)
Postgres del compose (`app_database`:5432) + backend desde el código
(`node server.js`:3001, con `backend/.env` local) + `next dev`:3000 (rewrite
`/api`→:3001). Usuario de prueba `grgurichabner@gmail.com` (super_admin, verificado),
fondeado por faucet `POST /api/balances/testnet-faucet {symbol,amount}` y con límite
AML subido por DB. Oracle con dev-bypass. **Nota:** el look se revisa sin backend; la
funcionalidad en vivo necesita el stack. **Los Playwright E2E NO necesitan backend**
(route-stubbed contra `next dev`) — es el approach sancionado para verificar.

## e2e (gotchas, ya conocidos)
Route-stubbed contra `next dev`. **Stubeá TODO GET autenticado** que Trading dispare
(par/es, order book, trades, mis órdenes, balances, etc.) o el 401 real desmonta
`(app)`. `gotoApp` scopeado a la navbar primaria. **En frío la primera navegación a
cada página compila on-demand y puede vencer el timeout de `gotoApp` → re-correr con
el server tibio** (no es regresión; CI usa retries). `loginViaUI` usa token fake.
El `SuccessFlash` se asierta con `page.getByRole('alert').filter({ hasText })`.

## Cierre
- Correr `npm run typecheck`, `npx vitest run --pool=forks`, y los e2e afectados
  (`npx playwright test trading.spec.ts` + full si tocaste algo compartido como
  i18n/primitivos — y re-correr el full tibio si hay flake de compilación en frío).
- Verificar en el navegador (screenshots) cada estado antes de dar por hecho.
- Commit(s) Conventional en inglés, sin atribución. Actualizar
  `backend-contract-changes.md` si cambia algún contrato de cliente.
- Al terminar: actualizar `rebuild-status.md` (marcar Trading ✅) y dejar el prompt
  de la **siguiente** página (P2P).

---

## Mini-roadmap (lo que falta)
`Trading (esta) → P2P → Profile → Admin`. Detalle y casos A/B/C en
`docs/frontend-rebuild/rebuild-status.md`.
