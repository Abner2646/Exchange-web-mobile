# Prompt de arranque — próxima sesión (rediseñar **Wallet**)

Pegá TODO este archivo como primer mensaje de la próxima sesión de Claude Code en
este repo. Supersede a `next-session-design-prompt.md` y
`next-session-redesign-prompt.md` (viejos).

---

## Rol y objetivo

Sos Claude Code en **crypto_exchange** (exchange custodial, audit-grade, EE.UU.;
dueño: Abner). **Chat en español; código/commits/PRs en inglés**, Conventional
Commits **sin atribución Claude** ni "Generated with…". El backend es la **fuente
de verdad** y **no se toca** sin aprobación explícita de Abner.

**Objetivo de esta sesión: rediseñar la página de Wallet (`/wallet`) al estándar
nuevo**, usando **Swap como implementación de referencia**. Wallet es **Caso B**
(el dominio cambió vs la V1: ahora hay compartimentos **Funding + Spot**).

### Lectura obligatoria antes de tocar nada
1. `docs/frontend-rebuild/redesign-methodology.md` — proceso y regla de oro (A/B/C).
2. `docs/frontend-rebuild/aesthetic-standard.md` — tokens/estética.
3. `docs/frontend-rebuild/rebuild-status.md` — estado + roadmap + el "estándar nuevo".
4. `docs/frontend-rebuild/lessons-swap-session.md` — errores a no repetir + gotchas.
5. Referencia viva del estándar: `web/src/features/swap/components/` (SwapForm,
   swap.module.css) y `web/src/shared/ui/feedback/SuccessFlash.tsx`.

### PASO 0 — disciplina de ramas
`git fetch origin`; confirmá que estás en `dev` (el rediseño vive local, `dev`
puede estar adelantada y sin pushear respecto de `origin`). Frontend sobre `dev`,
**sin tocar money-path ni backend**. Commit por chunk.

---

## Qué YA está hecho (no rehacer)
- Home `/`, Auth (login/register/verify-email/forgot-password/auth-success),
  Navbar + Footer (en todas las páginas), tema dark + toggle.
- **Swap `/swap`** rehecho a fondo: UI por monedas De/A con auto-cálculo estilo
  Uniswap, recibo en vivo a la derecha (= el review), `SuccessFlash` azul al
  ejecutar, selector de monedas **searchable + saldos + orden por saldo**, íconos
  del catálogo completo, botón "Swap" (precio en vivo, sin lock), paneles
  nunca-vacíos. **Es el molde a seguir.**
- Sandbox `/lab` para probar el flash y los íconos.

## El estándar a aplicar en Wallet (lo que hace a una página "terminada")
Ver `rebuild-status.md` §"estándar nuevo". En corto: tokens de estética; `Select`
(nunca nativo) con `searchable`/`meta` + `CoinLogo`; **money string-math +
redondeo a la precisión del backend antes de mandar**; `SuccessFlash` en todo
botón que finaliza transacción; paneles nunca vacíos; copy honesta (no filtrar
códigos, no prometer de más); `:focus-visible` + `prefers-reduced-motion`;
**verificación en vivo con Playwright + screenshots** antes de decir "terminada".

---

## Trabajo concreto — Wallet

La feature ya existe (`web/src/features/wallet/`): `BalancesView`,
`CompartmentTransferForm`, `WithdrawForm`, `DepositView`, `HistoryView`,
`WalletTabs` (+ queries + tests). **Se rediseña, no se construye de cero.**

**Primero investigá el backend** (como hicimos con swap) ANTES de diseñar:
- Endpoints de balances/transfer/withdraw/deposit (`backend/modules/balances/` y
  `backend/modules/wallet*` / `withdrawal*`). Mirá: validaciones de monto y
  **precisión de decimales** (redondeá en el front antes de mandar), compartimentos
  válidos, y si el retiro pasa por **maker-checker** / tiene estados
  (queued/pending). Reportá los hallazgos antes de tocar UI.

Alcance:
1. **Balances** (Funding + Spot: disponible/bloqueado/pendiente) con `CoinLogo`,
   cifras en `--font-num`, estados loading/empty/error.
2. **Transferencia Funding↔Spot**: al éxito → `SuccessFlash`. Redondear monto.
3. **Retiro** (solo desde Funding): al éxito → `SuccessFlash` (mensaje acorde al
   estado real que devuelva el backend, ej. "en cola"). Redondear monto.
4. **Depósito**: **cartel de "servicio no disponible en tu región"** y flujo
   **deshabilitado** (decisión de Abner). No cablear depósito on-chain. Dejar el
   componente listo para habilitarlo después, pero hoy bloqueado con el aviso.
5. **Historial**: tabla/timeline con estética nueva.

## Dev stack (para verificar en vivo)
Postgres del compose (`app_database`:5432) + backend desde el código
(`node server.js`:3001, con `backend/.env` local) + `next dev`:3000 (rewrite
`/api`→:3001). Usuario de prueba `grgurichabner@gmail.com` (super_admin, email
verificado) **ya fondeado con 2 BTC** y con **límite AML subido**. Faucet:
`POST /api/balances/testnet-faucet {symbol,amount}` (credita al user del token).
Para fondear a ese user en scripts, firmar JWT con `JWT_SECRET` desde `backend/`
(ver `lessons-swap-session.md`). Oracle con dev-bypass.

## e2e (gotchas, ya conocidos)
Route-stubbed contra `next dev`. **Stubeá TODO GET autenticado** que Wallet
dispare (balances, history, deposit-address, etc.) o el 401 desmonta `(app)`.
`gotoApp` ya está scopeado a la navbar primaria. En frío, la primera navegación a
`/wallet` puede tardar a compilar (no es bug). `loginViaUI` usa token fake.

## Cierre
- Correr `npm run typecheck`, `npx vitest run`, y los e2e afectados
  (`npx playwright test wallet.spec.ts` + full si tocaste algo compartido).
- Verificar en el navegador (screenshots) cada estado antes de dar por hecho.
- Commit(s) Conventional en inglés, sin atribución. Actualizar
  `backend-contract-changes.md` si cambia algún contrato de cliente.
- Al terminar: actualizar `rebuild-status.md` (marcar Wallet ✅) y dejar el prompt
  de la **siguiente** página (Trading).

---

## Mini-roadmap (lo que falta)
`Wallet (esta) → Trading → P2P → Profile → Admin`. Detalle y casos A/B/C en
`docs/frontend-rebuild/rebuild-status.md`.
