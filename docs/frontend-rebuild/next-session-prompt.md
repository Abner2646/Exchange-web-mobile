# Prompt de arranque — próxima sesión (rediseñar **P2P**)

Pegá TODO este archivo como primer mensaje de la próxima sesión de Claude Code en
este repo. Supersede al prompt de Trading (ya hecho).

---

## Rol y objetivo

Sos Claude Code en **crypto_exchange** (exchange custodial, audit-grade, EE.UU.;
dueño: Abner). **Chat en español; código/commits/PRs en inglés**, Conventional
Commits **sin atribución Claude** ni "Generated with…". El backend es la **fuente
de verdad** y **no se toca** sin aprobación explícita de Abner.

**Objetivo de esta sesión: rediseñar P2P (`/p2p`) al estándar nuevo**, usando
Swap/Wallet/Trading como referencia. P2P es **Caso B** (marketplace entre usuarios).

### Lectura obligatoria antes de tocar nada
1. `docs/frontend-rebuild/redesign-methodology.md` — proceso y regla de oro (A/B/C).
2. `docs/frontend-rebuild/aesthetic-standard.md` — tokens/estética.
3. `docs/frontend-rebuild/rebuild-status.md` — estado + roadmap + el "estándar nuevo".
4. `docs/frontend-rebuild/lessons-swap-session.md` — errores a no repetir + gotchas.
5. `docs/frontend-rebuild/known-issues.md` — **§C4 P2P** tiene la deuda anotada
   (separador en-dash hardcodeado, empty-state bajo el chrome de tabs/filtros,
   default tab = `sell`, `MyTransactionsView` usa `new Date()` en render, reutiliza
   `wallet.history.type` para la columna de rol, status = label simple no stepper,
   header "Buy/Sell" debería ser un solo key `type`). Y §C1 (casts `error as`).
6. Referencia viva del estándar: `web/src/features/{swap,wallet,trading}/components/`
   y `web/src/shared/ui/feedback/SuccessFlash.tsx`.

### PASO 0 — disciplina de ramas
`git fetch origin`; confirmá que estás en `dev` (el rediseño vive local, `dev`
está **adelantada y sin pushear** respecto de `origin`). Frontend sobre `dev`,
**sin tocar money-path ni backend**. Commit por chunk.

---

## Qué YA está hecho (no rehacer)
- Home `/`, Auth, Navbar + Footer, tema dark + toggle, **botón Deposit** en la navbar.
- **Swap `/swap`**, **Wallet `/wallet`**, **Trading `/trading`** — rehechos al
  estándar (molde: `Select` custom + `CoinLogo`, money string-math + redondeo a la
  precisión del backend, `SuccessFlash`, paneles nunca-vacíos, estados loading/empty/
  error, copy honesta). Trading unificó el selector de par (uno solo maneja todo).
- **Páginas públicas del footer** (help/academy/status/privacy/terms/cookies/aml/
  about/news) — básicas, hechas.

## El estándar a aplicar (lo que hace a una página "terminada")
Ver `rebuild-status.md` §"estándar nuevo". En corto: tokens; `Select` (**nunca
nativo**) searchable/meta + `CoinLogo`; **money string-math + redondeo a la precisión
del backend antes de mandar**; `SuccessFlash` en todo botón que finaliza transacción;
paneles nunca vacíos; copy honesta (no filtrar códigos, no prometer de más);
`:focus-visible` + `prefers-reduced-motion`; estados loading (skeletons)/empty/error;
**verificación en vivo con Playwright + screenshots** antes de decir "terminada".

---

## Trabajo concreto — P2P

La feature ya existe (`web/src/features/p2p/`): marketplace de ofertas, crear oferta,
mis ofertas, detalle de transacción, mis transacciones (+ queries + tests). **Se
rediseña, no se construye de cero.**

**Primero investigá el backend** (como en swap/wallet/trading) ANTES de diseñar:
- Endpoints de ofertas/transacciones P2P (`backend/modules/p2p*` / `transaccionP2P*`).
  Mirá: validaciones de monto y **precisión de decimales** (redondear en el front),
  estados de la oferta y de la transacción (open/pending/paid/released/disputed/…),
  métodos de pago, y el flujo de aceptar/liberar. **P2P accept ya tiene idempotencia
  backend** (`POST /transaccionP2P`, ver known-issues §B.2). Reportá los hallazgos
  **antes de tocar UI**.

Alcance tentativo (ajustar según hallazgos):
1. **Marketplace de ofertas** — lista/tabla al estándar, filtros por pills (no
   `<select>` nativo), `CoinLogo`, empty/error states.
2. **Crear oferta** — formulario con `Select` custom, redondeo, `SuccessFlash`.
   Arreglar el `<legend>` vacío del fieldset buy/sell (§C2).
3. **Aceptar oferta / transacción** — resolver el símbolo (no mostrar UUID),
   `SuccessFlash` al aceptar, copy honesta del estado real; detalle con stepper de
   estado si aporta.
4. **Mis ofertas / Mis transacciones** — tablas con badges de estado; sacar el
   `new Date()` del render si molesta en SSR.

## Dev stack (para verificar en vivo)
Postgres del compose (`app_database`:5432) + backend desde el código
(`node server.js`:3001, `backend/.env` local) + `next dev`:3000 (rewrite `/api`→:3001).
Usuario `grgurichabner@gmail.com` (super_admin, verificado), fondeado por faucet +
límite AML subido por DB. **El look se revisa sin backend; los Playwright E2E NO
necesitan backend** (route-stubbed contra `next dev`) — es el approach sancionado.

## e2e (gotchas, ya conocidos)
Route-stubbed contra `next dev`. **Stubeá TODO GET autenticado** que P2P dispare
(ofertas, mis ofertas, transacciones, balances, etc.) o el 401 real desmonta `(app)`.
`gotoApp` scopeado a la navbar primaria. **En frío la primera navegación a cada
página compila on-demand y puede vencer el timeout de `gotoApp` → re-correr tibio**
(no es regresión; CI usa retries). `loginViaUI` usa token fake. El `SuccessFlash` se
asierta con `page.getByRole('alert').filter({ hasText })`. **Gotcha de labels:** si un
segmento y el submit comparten texto (ej. "Buy"/"Comprar"), el submit se targetea con
`page.locator('form button[type="submit"]')` (pasó en Trading).

## Cierre
- Correr `npm run typecheck`, `npx vitest run --pool=forks`, y los e2e afectados
  (`npx playwright test p2p.spec.ts` + full si tocaste algo compartido como
  i18n/primitivos — y re-correr el full tibio si hay flake de compilación en frío).
- Verificar en el navegador (screenshots) cada estado antes de dar por hecho.
- Commit(s) Conventional en inglés, sin atribución. Actualizar
  `backend-contract-changes.md` si cambia algún contrato de cliente.
- Al terminar: actualizar `rebuild-status.md` (marcar P2P ✅) y dejar el prompt de la
  **siguiente** página (Profile).

---

## Mini-roadmap (lo que falta)
`P2P (esta) → Profile → Admin → segunda pasada del Home (Caso B: logueado + datos en
vivo)`. Detalle y casos A/B/C en `docs/frontend-rebuild/rebuild-status.md`.
