# Autonomous run — progress log

**Started:** 2026-09-23. Coordinator: Claude (Opus). Abner is away for several days; full autonomy.

## ▶️ SESSION 2026-10-10 — Next.js Slice 3 (SWAP) COMPLETE + MERGED to main (PR #42)
PASO 0 clean (dev==main+2 docs-only, all pushed). Built the swap vertical subagent-driven (11 tasks, fresh
implementer + spec/quality review per task; money-path tasks 6/execute + 10/SwapForm reviewed line-by-line by me).
Plan: `docs/superpowers/plans/2026-10-10-nextjs-slice-3-swap.md` (grounded in the REAL backend swap contract —
read swap.routes/controller/model/settlement + oracle breaker, not the stale OpenAPI `number` typing).
- **Delivered:** pick pair → **indicative** quote (fee/total disclosure, no quote-lock) → daily-limit advisory
  → idempotent execute vs the house; **503 PRICE_ORACLE_DIVERGENCE** paused state first-class. `/swap` route +
  nav link + i18n (en/es) + contract doc §19. Mirrors the S2 wallet feature.
- **Money-path (mine, TDD):** amounts only via `@/shared/money` canonical strings; `baseAmount` STRING on the wire
  to `/calculate` + `/intercambioExchange`; ONE sanctioned `Number()` at the advisory `check-limit` boundary
  (backend rejects non-numbers; advisory-only, never the gate — backend counts **quoteAmount** pre-fee, so I
  REJECTED the opus review's "use finalAmount" finding as server-divergent). Exact sufficiency gate (buy→quote
  asset vs finalAmount, sell→base asset vs entered amount), blocks on unknown balance. Idempotency-Key
  auto-attached + no-retry mutation + disabled-while-pending = double-submit guard.
- **Task 1 review adjudication:** `QuoteResponse.calculo.baseAmount` kept `string|number` (backend echoes
  parseFloat→number; "string" would be a false type) — guardrail comment + QuoteDisplay takes a canonical
  `baseAmount` prop, never formats the echo.
- **Gate (HEAD):** tsc 0, Vitest **205/205** (42 files), `next build` OK (`/swap` 4.68 kB). Disk was HEALTHY
  this session (127 GB free) — the chronic ENOSPC did not bite.
- **Final opus whole-branch review:** 0 Critical. 2 Important adjudicated vs real contract (both advisory-UX,
  not safety): #1 rejected (quoteAmount basis correct), #2 half-fixed (dead `remainingLimit` copy now rendered).
- **`/code-review` high-effort (PR #42, by me):** correctness finder 7 candidates / 0 Critical money-path
  (cleanup finder hit the session limit; recovered). Fixed 2: explicit paused message for list-level
  oraclePaused (was dead `swap.form.paused` key) + gated the advisory check-limit on `amountOk` (stale-quote
  re-fire). Backlog (non-blocking): idempotency.ts auto-attaches key to /calculate+/check-limit (pre-existing
  S0, inert); SwapHistory formatDisplay would throw on a non-canonical backend amount (same pattern as merged
  wallet); advisory non-DAILY_LIMIT errors intentionally silent; QuoteDisplay isFetching masks a non-oracle
  error during refetch.
- **✅ dev→main MERGED (`82dd79a`, --no-ff, PR #42).** tsc re-verified on the merged tree; main pushed, dev
  fast-forwarded; `dev == main == origin` (0 0). **main NOT deployed** (CRA serves prod until the S8 nginx flip).
- **NEXT:** Slice 4 (Spot trading) per the sprint order (S3→S4→…→S8 go-live). Money-path → mine, TDD.

## ▶️ SESSION 2026-10-08 — Next.js migration Slice 1 (auth journey) COMPLETO (en `dev`)
Subagent-driven (igual que Slice 0): writing-plans → 10 tareas, implementer fresco + review por tarea
(spec+calidad) + review final whole-branch (opus). Todo en `dev`, pusheado commit a commit. Commits
`d080e80..754978d` (14). **Nada deployado** (el CRA legacy sigue en prod).
- **Plan:** `docs/superpowers/plans/2026-10-08-nextjs-slice-1-auth.md`. **Ledger por tarea:** `.superpowers/sdd/progress.md`.
- **Diseño:** login y recuperación son páginas de **PASO ÚNICO con estado interno** → el `temporalToken` (2FA)
  y el `codigo` de reset viven SOLO en React state (nunca URL/storage; verificado en review). Guardia cliente
  en `(app)/layout.tsx` + `/dashboard` stub como destino. Google gated por `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- **Bug de contrato corregido en el port:** el CRA mandaba `{code}` a verify-email; el backend lee `{codigo}`.
  Ahora `codigo` en verify-email/verify-2fa/verify-reset-code/reset-password.
- **Entregado:** providers (TanStack Query v5 + Locale + Google) · `authApi` tipado + types · 12 query hooks ·
  i18n auth (en+es) · guardia `(app)` + dashboard + chrome `(auth)` · register+verify-email · login+2FA
  (email+TOTP) · recuperación 3-pasos + botón Google · build gate + contract doc §17 · Playwright E2E.
- **Gates verdes:** Vitest **103/103** (19 files), `next build` OK (11 páginas, 5 rutas auth), Playwright
  **E2E 3/3** (`/api` stubbed vía page.route).
- **Fixes de review aplicados:** verifyResetCode codigo test (T2) · `waitFor` en guard (T5) · rename
  `describe→showError` en Login+Forgot (T7/T8) · **commit de higiene** `2a04315` que destrackeó
  `.agents/`/`.claude/`/`skills-lock.json` (barridas por un `git add` amplio de un subagente) + reglas .gitignore.
- **⚠️ MÁQUINA LOCAL (no es de la migración):** el disco C: estaba al 100% (**0 bytes libres de 476GB**) → la
  instalación del navegador de Playwright fallaba en silencio (ENOSPC) y dejó un chromium-1140 corrupto. Reclamé
  ~1.6GB (borré chromium-1228 de más + headless-shell + npm cache), reinstalé chromium-1140 limpio, corrí el E2E.
  Sigue MUY justo (~1.6GB libres). **Flag a Abner:** afectará builds/instalaciones futuras.
- **SIGUIENTE:** review final whole-branch (opus) → aplicar must-fix si hay. dev→main se acumula hasta tener
  un slice usable (ya hay auth; evaluar PR en S2 wallet o antes si Abner lo pide). Después Slice 2 (wallet).

## ▶️ SESSION 2026-10-06/07 — Next.js migration kickoff + Slice 0 COMPLETO (en `dev`)
Interactiva con Abner. Brainstorming → spec → plan → ejecución subagent-driven del **re-plataformado del
frontend a Next.js** (el CRA legacy sigue intacto en prod; strangler).
- **Decisiones locked:** Next App Router · React 18 / Next **14.2.35** (no React 19 en el port; eval Next16/React19
  pre-deploy) · **self-host EC2** (Next 2º pm2 detrás de nginx, same-origin) · strangler incremental (`web/` junto a
  `frontend/`, borrar CRA en S8) · split render público=SSG / app-autenticada=client.
- **Spec:** `docs/superpowers/specs/2026-10-06-nextjs-migration-design.md` (slices S0–S8). **Plan S0:**
  `docs/superpowers/plans/2026-10-06-nextjs-slice-0.md`. **Ledger:** `.superpowers/sdd/progress.md`.
- **Slice 0 (10 tareas, subagent-driven, review por tarea + final opus "ship it"):** app `web/` Next 14.2.35
  App Router (`output: standalone`); port `shared/{money(39/39, byte-idéntico),api(17/17),i18n(5/5),ui(9/9)}`;
  Vitest harness; home pública SSG + Metadata API; robots/sitemap (noindex no-prod). **74 tests verdes**, build +
  prueba SSG/SEO sin JS OK. Pusheado; `dev` 13 adelante de `main`. Nada deployado.
- **Follow-ups (ledger, no bloquean):** dedupe interpolate(); barrel i18n 'use client' (no importar desde server
  components); a11y Dialog; doc-drift idempotency (5 vs 6 endpoints); **pre-deploy: eval Next16/React19**.
- **SIGUIENTE:** Slice 1 (auth journey) — writing-plans + subagent-driven. Ver `HANDOFF.md` §RESUME HERE.

## ▶️ SESSION 2026-10-05 — Fase 1 "barrido" (MERGED a main, PR #39, `3735bcd`) + fix CI integración
Sesión interactiva con Abner (no autónoma). Tres cierres money-path/seguridad, TDD, `dev→main` vía PR con
`/code-review` alto esfuerzo (corrido por Claude). Estado final: `dev == main == origin == 3735bcd`.
- **[#1 seguridad] `0208c1b`:** los códigos verificación/2FA/recuperación/transferencia se logueaban en texto
  plano en CADA envío (en prod → logs de pm2, vector account-takeover). Helper `logDevCode` gateado por
  `NODE_ENV !== 'production'`. +3 unit.
- **[#2 oracle circuit breaker, Hito 2] `5741668`:** job en background (`oracleBreaker.job`, `ORACLE_SWEEP_INTERVAL_MS`
  60s) que valúa cada par de swap con `externalSymbol` vía la mediana multi-fuente, FUERA del hot-path.
  Divergente (>1.5%, config `oracle_divergence_threshold_pct`) o indisponible → **pausa** el par (precio
  congelado) + evento `PRICE_ORACLE_DIVERGENCE` (outbox atómico) + alerta Telegram; swap execute/preview → 503.
  Migración aditiva (`oracle_paused/reason/checked_at`, default false). CoinGecko symbol-map extendido a majors.
  Review fixes (`51119ba`): guard de quote-no-stable (la mediana es USD → corromper precio en cross) + alerta de
  recuperación. +9 unit.
- **[#3 referidos] `7d38452`:** `accrueCommission` cableado event-driven sobre `SwapExecuted` (era código muerto);
  valúa el fee (quote asset) en USD≈USDT; idempotente por sourceRef. Order-book `TradeExecuted` = follow-up (sin
  trades aún). +5 unit.
- **⚠️ PASO DE DEPLOY (en DEPLOY_CONTEXT §6 + comment de PR #39):** las 3 columnas de `swap_pairs` NO las aplica
  el `sequelize.sync()` plano de prod → ALTER manual obligatorio antes de reiniciar el backend, o rompe swaps.
- **[CI] `091addf`:** el `globalSetup` de integración hacía `sync({force:true})` sin cargar los modelos lazy
  (governance/referrals/launchpad/kyc) → faltaban tablas (`pending_admin_actions`…) → **143 fallos** de integración
  (CI rojo en main hacía commits, docs incluidos). Fix: `require('../../routes')` antes del sync → **143→18 fallos**.
- **Deuda CI pendiente → issue #40:** los 18 fallos restantes (retiros/TOTP/AML, pre-existentes, ajenos a Fase 1)
  + dependency audit (subir axios, 19 advisories). NO bloquean Fase 1 (gate = /code-review + unit verde).

## ▶️ SESSION 2026-10-02→05 — prod live (bitflow.community): Doppler + email + catálogo + SEO
MVP **DESPLEGADO Y FUNCIONAL** en https://bitflow.community (t3.micro, infra en DEPLOY_CONTEXT.local.md).
Cierre de esta tanda (todo en `main`, `5232bc2`; prod==main):
- **Doppler fuente única de secretos** (proyecto `bitflow/prd`): pm2 arranca `deploy/start-backend.sh` →
  `doppler run`, nada en disco. Token read-only, sesión amplia deslogueada (mínimo privilegio). 25 vars app.
- **Email funciona** (Gmail SMTP del .env dev, verificado). `JWT_SECRET`+`SESSION_SECRET` rotados (un valor se
  coló en output de `doppler secrets upload`). `TOTP_ISSUER=BitFlow`. `COINGECKO_API_KEY` cargada.
- **Catálogo completo**: 20 cryptos + 20/20 logos (spothq SVG / coincap PNG para SHIB/PEPE/ARB/OP) + 380 swap
  pairs (precio>0) + 85 trading pairs (lastPrice=0 = esperado sin trades) + 9 formas de pago. Seeders:
  `scripts/seedCatalogNoCustody.js`, `scripts/seedLogosAndPaymentMethods.js`.
- **Cuenta owner:** grgurichabner@gmail.com (`abner`) = super_admin, email_verified=true.
- **SEO (paso 1)**: robots.txt + sitemap.xml reales (3 URLs: home/register/login — resto es app privada,
  no indexable), meta/OG/canonical reales, `<meta robots index,follow>`. Enviado a Search Console. Front es
  CSR (CRA) → documentado en frontend-audit.md que el rebuild TS DEBE ser SSR/SSG (Slice 0).
- **Fixes de frontend legacy** en el camino: `.env.production` (REACT_APP_API_URL, git-bash manglaba /api→C:),
  ErrorBoundary, flatten del error-envelope (React #31), `refetch` en Activos, CORS `ALLOWED_ORIGINS`.
- **Bugs reales arreglados** (money/infra): `config/database.js` DB_SSL=false (runtime), de-flake swaggerProdGate.

### Pendientes al cerrar (NO bloqueantes; para la próxima)
- **Custodia/KMS**: depósitos/retiros on-chain OFF hasta AWS KMS (decisión Abner). Claves reales NO en prod.
- **email.service.js loguea el código de verificación en texto plano** antes del send → bajar a debug (follow-up seguridad).
- **Google login**: credenciales en Doppler-pendiente; necesita whitelistear redirect URI en Google Console.
- **businessConfig** vacío (usa defaults del código; el panel admin lo muestra vacío hasta setearlo).
- **SEO**: solo home indexable sin SSR; páginas de contenido (fees/FAQ/por-activo) = trabajo del rebuild TS.
- **Gmail SMTP** sirve para beta (~500/día, riesgo spam) → SES para escala.
- Higiene: en la máquina local hay copia de la SSH key en `/tmp/bitflow_key.pem` (usada para operar el server).

## ▶️ SESSION 2026-10-01 (cont.) — dev→main consolidado + verificación prod==main
Pedido de Abner: pushear todo lo no-mergeado a `main` y "deployar main". Estado:
- 17 commits de `dev` sin mergear (deploy/frontend/config/docs — NADA money-path nuevo; A1/A2 ya en main).
- `/code-review` del delta: inline (no money-path), limpio. Riesgo verificado: nada lee `data.error` como
  objeto (el flatten del interceptor es seguro).
- **Merge dev→main (`839a029`→`93547ff`), suite 594 green.** De-flakeado `swaggerProdGate` (mock del spec
  swagger; bajó de 739ms a 16ms). `dev == main == origin == 93547ff`.
- **Verificado prod == main:** checksums de 9 archivos runtime clave del server vs main → 8 byte-idénticos,
  1 (`apiDocs.js`) idéntico en contenido (solo CRLF vs LF). Producción YA corría el tip de dev = main → sin
  re-deploy necesario.
- **Bono de bienvenida (faucet) CONFIRMADO off en prod:** `claimBtc`/`claimTestnetFaucet` tienen
  `if (NODE_ENV==='production') return 404`; el server corre NODE_ENV=production. (Test en vivo dio 401 por
  el `authenticateToken` que corre antes del gate, pero un user autenticado recibe 404 = no reclamable.)

## ▶️ SESSION 2026-10-01 — MVP deploy en AWS t3.micro (54.146.193.5), driven por Claude
Deploy real a un t3.micro (1GB, Ubuntu 24.04). INFRA TERMINADA: swap 2GB, Node20/PG16/nginx, DB
`bitflow_prod` localhost (secretos generados en el box), esquema vía `sequelize.sync()` (35 tablas),
backend bajo pm2 (1 instancia fork, reboot-persistente `pm2-ubuntu.service`, estable 109MB), nginx
reverse proxy + TLS self-signed (sin dominio aún), **solo 80/443 públicos** (3001/5432 filtrados, verificado
desde afuera). NODE_ENV=production (decisión de Abner: producción estricta, sin faucet, fondos vía admin).
- **Bug encontrado+arreglado (`e62c93b`):** el runtime usa `config/database.js` (no `config/config.js`);
  forzaba SSL → DEPTH_ZERO_SELF_SIGNED_CERT contra el PG local. `DB_SSL=false` ahora honrado ahí. +2 tests, 594 green.
- **BLOQUEO (decisión de Abner):** catálogo vacío — `seedInitialData.js` PASO 1 (`setupWallets`) exige claves
  de custodia reales (`BTC_MNEMONIC/PRIVATE_KEY/BTC_MASTER_XPUB/BITCOIN_WALLET_ADDRESS` + ETH/BSC). NO se inventan.
- Artefactos del deploy en `deploy/` (+ `bitflow-selfsigned.conf`). Clave SSH del box: `Clave privada.pem` (de Abner).
- **✅ DEPLOY FUNCIONAL COMPLETO:**
  - Catálogo sin custodia sembrado (`2b64df0`): **20 cryptos, 380 swap pairs, 85 trading pairs** vía
    `scripts/seedCatalogNoCustody.js` (exporté `CRIPTOMONEDAS_BASICAS`). Sin wallets maestras → depósitos/retiros
    on-chain OFF hasta KMS; fondos para la beta vía panel admin.
  - Frontend legacy (CRA) buildeado local + servido en `/var/www/bitflow` (`<title>BitFlow</title>`, bundle real).
    Fix build-breaking `6909c2a`: `refetch` no destructurado en `Activos.jsx`.
  - Verificado desde afuera: `https://54.146.193.5/` sirve la SPA; `/api/parExchange` devuelve los 380 swap pairs;
    `/health` OK; 3001/5432 filtrados. Backend estable (~133MB), RAM 498/909MB, swap casi sin usar.
- **✅ HTTPS VÁLIDO (2026-10-01):** dominio `bitflow.community` (comprado en Vercel, A→54.146.193.5) + `certbot --nginx` → cert Let's Encrypt (exp 2026-12-30, auto-renew). HTTP→301→HTTPS. La app está LIVE en https://bitflow.community. (`www` apunta a Vercel, no al server — solo apex por ahora.)
- **PENDIENTE (requiere a Abner):** (1) **dominio** → `A → 54.146.193.5` + `certbot --nginx` (hoy cert self-signed,
  el browser avisa); (2) **custodia/KMS** para habilitar depósitos/retiros on-chain reales; (3) price feed
  (API key) para precios de swap reales — hoy los pares tienen precio sembrado placeholder; (4) acreditar saldo
  a los usuarios beta vía panel admin. El frontend legacy puede tener más bugs (el rebuild TS sigue pendiente).

## ▶️ SESSION 2026-09-30 — cost/consumption tuning for low-traffic deploy (user-directed, en `dev`)
Pedido de Abner (primer deploy = 5 usuarios). Cambios NO money-path, TDD, quedan en `dev` (sin merge a main
por pedido explícito). `perf(ops)` `fd39be5`:
- `ORDER_MATCH_INTERVAL_MS` (default 100ms) + `PRICE_UPDATE_INTERVAL_MS` (default 10000ms) → env-configurables
  (el matching disparaba ~864k SELECT/día sobre book vacío a 10x/s; un deploy chico setea 3000ms).
- `DB_POOL_MAX`/`DB_POOL_MIN` env para el pool de producción (defaults 10/2).
- OpenAPI `/api-docs` NO se monta en producción (ahorra escaneo swagger-jsdoc al boot + memoria UI + oculta
  superficie). Gate extraído a `config/apiDocs.js` (`mountApiDocs`), testeable aislado.
- Defaults preservan el comportamiento actual. 11 unit tests nuevos; suite **590 green**. `.env.template` documentado.
- Nota sync: al retomar, `dev` tenía 3 commits ajenos sin pushear (`chore: add use strict...`, author Abner2646,
  27–29/09 — probablemente el cron de respaldo §8); verificados triviales y pusheados (PASO 0).
- Contexto: análisis de costo AWS de este deploy → ~$5/mes año 1 (free tier) / ~$12/mes (Lightsail 1 caja) /
  ~$35–48/mes EC2 lean. Lista completa de reducción de consumo entregada en chat (infra + env + código + externos).

## ▶️ SESSION 2026-09-26 — control-parity burst (§7A), MINE, TDD
Sync check first (clean): dev 1 ahead of origin/main (docs-only `16d4672`), origin/dev==dev, no stray
tracked changes. Branches healthy, no stale base. Task ordering: (1) finish what's open → the §7A
control-parity thread (money-path, mine).

- **[A1] Large-withdrawal cancel+refund compensator — DONE, pushed `f10a5a3` (dev):** closes the
  stranded-funds gap flagged last session. A rejected/expired `large_withdrawal_release` had NO
  compensator → the held withdrawal stayed `pending`+`dualControlPending` forever with the user's funds
  blocked (same class as the launchpad F1 fix; the mechanism existed but withdrawal registered none).
  - `BlockchainTransaction.cancelDualControlHold(id, tx)`: cancels a still-held withdrawal
    (`status='failed'`, `dualControlPending=false`) + returns blocked→available in the ledger, atomically
    inside the passed reject/expire tx. Conditional guard (`status='pending' AND dual_control_pending=true`)
    under a row lock → idempotent + money-safe (double/late/already-released run = no-op, returns 0, never
    double-unblocks). Mirrors `failWithdrawal`'s refund semantics but tx-aware (no nested tx).
  - `withdrawalDualControl.cancelCompensator` + `register()` now registers it under `large_withdrawal_release`
    (boot wiring in routes/index.js unchanged — register does both executor + compensator).
  - **Verified:** service unit RED→GREEN; integration 8/8 vs docker test DB (reject→cancel+refund,
    expiry→cancel+refund, released row never double-refunded). Full unit **565 green**, coverage gate OK.
    Contract doc §"large-withdrawal release" updated (rejected/expired → `failed` + refund).
  - NOTE: local jest FULL integration suite still hits the pre-existing `truncate` harness quirk
    (23 suites fail at resetDb, identical on clean HEAD baseline — NOT my change; my file passes 8/8 alone).

- **[A2] Admin single-operator balance-mutation endpoints → Maker-Checker — DONE, pushed `b7452ec` (dev).**
  Bigger asymmetry than launchpad was. `updateBalance` (manual credit/debit — money creation), `transferBalance`
  (cross-user), `blockBalance`/`unblockBalance` (within-user available↔blocked) now dual-controlled above a
  server-computed USD magnitude.
  - New `modules/balances/adminBalanceDualControl.service.js`: `evaluate` (USD of |amount| via amlValuation,
    threshold `admin_balance_dual_control_usd_threshold` default $5k + shared $20k ceiling, fail-closed on
    stale/unvaluable), per-action executors (update/block/unblock/transfer), `register()` (boot wiring in
    routes/index.js).
  - **Design: DEFER the whole ledger posting.** propose records the exact mutation in the payload; NOTHING moves;
    the executor posts inside the checker's approval tx. No held state → NO compensator needed (reject/expire =
    money never moved). Ledger FOR UPDATE overdraft guard still protects execution. Transfer reference fixed at
    propose + carried in payload → idempotency-by-reference (double approval can't double-post).
  - Controllers return 202 `{pending, actionId}` above threshold, else 200 immediate. adminDualControl required
    LAZILY in handlers (keeps governance.model out of the controller's unit-test load graph — same dodge as
    createWithdrawal). OpenAPI added for the 4 endpoints (200/202); contract doc §14 updated.
  - **Verified:** service unit 14 (RED→GREEN); integration 6/6 vs docker DB (propose moves nothing, distinct
    checker approval posts adjustment/transfer/block, reject moves no money, 4-eyes blocks self-approval).
    Full unit **579 green**, coverage gate OK.

### [GATE] dev↔main delta (A1+A2) — /code-review high-effort DONE, one fix applied
Delta from origin/main `0b4c7e4`: `f10a5a3` (withdrawal compensator) + `b7452ec` (admin balance dual control).
Ran high-effort review inline (warm context on the just-written delta, 8 angles). Verdict: no money-path
correctness blockers. One fix applied + documented follow-ups:
- **[FIXED, review]** `cancelDualControlHold` unblocked funds BEFORE the conditional status UPDATE. Safe
  under the row lock, but reordered to fail-closed (flip guarded status first, refund only if it transitioned)
  so a lost race can never unblock without cancelling — no double-spend. `e-see-git`, 8/8 integ green.
- **[follow-up, altitude]** valuation-trust (stale-price fail-closed) logic is duplicated between
  `withdrawalDualControl.evaluate` and `adminBalanceDualControl.evaluate`. Deliberately did NOT refactor the
  freshly-shipped withdrawal path mid-burst; behavior parity is guaranteed by the shared `requiresDualControl`.
  Extract a shared USD-magnitude gate next to prevent security-logic drift.
- **[follow-up, minor UX]** an admin mutation that becomes unfundable between propose and approve surfaces as a
  500 at approval (executor OVERDRAFT not mapped to a clean error). No money moves; map it when convenient.
- **[follow-up, pre-existing]** no UUID-format validation on admin balance `:userId/:cryptoId` params (malformed
  → 500 not 404); same gap the governance controller already closed for its `:id`.

- **✅ dev→main MERGED (`bab68ae`, `--no-ff`).** Aligned local main to origin/main (`0b4c7e4`), merged dev,
  re-ran full unit suite on the merged tree (**579 green**, coverage gate OK), pushed main, fast-forwarded dev.
  Final: `dev == main == origin/main == origin/dev == bab68ae` (all `0 0`). Delta shipped: §7A control-parity
  complete — large-withdrawal cancel+refund compensator + admin balance-mutation dual control (update/transfer/
  block/unblock) + the fail-closed-ordering review fix.
- **§7A control-parity thread CLOSED.** Every privileged single-operator money movement now routes through
  Maker-Checker (large withdrawals + their compensator, large presale resolutions + compensator, admin balance
  adjustment/transfer/block/unblock). **NEXT BURST** = §7B roadmap (order: app-router cutover, or the deferred
  follow-ups above — extract shared USD-magnitude gate is the cheapest control-parity polish). Pick per the
  task-ordering rule from a fresh context.

## ✅ SESSION 2026-09-25 — close the governance/dual-control/TOTP thread (§7 A/B/C)
Sync check first (clean): dev 1 ahead of origin/main (docs-only `cc044dc`), origin/dev==dev, no stray
tracked changes. Branches healthy, no stale base. All work below is MINE (money-path/auth), TDD, pushed
after each commit.

- **[A] Operator MFA readiness gate — `merged to main 0b4c7e4`:** resolves the deploy precondition (after the TOTP
  migration every operator is un-enrolled → a held large withdrawal can never be released). Audit-grade choice:
  do NOT generate operator secrets in a script (that would leak secret material to logs) — enrollment stays
  self-service via `/api/user/me/totp/{setup,enable}`. Added instead:
  - `modules/governance/operatorReadiness.service.js`: pure `assessMfaReadiness(operators, {minEnrolled=2})` —
    dual control is usable only when ≥2 distinct operators are fully enrolled (`totpEnabled && twoFactorEnabled`),
    matching what releasing a held withdrawal actually requires (requireOperatorMFA + totp.verifyForUser + 4-eyes).
    Thin `loadOperators` DB wrapper kept separate so the invariant is unit-tested without a DB.
  - `scripts/checkOperatorMfaReadiness.js` (`npm run check:operator-mfa`): read-only deploy gate, fails closed
    (exit 1) until ready, prints NO secret material.
  - Runbook `docs/runbooks/operator-totp-enrollment.md`.
  - Verified: unit +8 green, coverage OK.
- **[B] Control parity — large presale resolution now dual-controlled — `merged to main 0b4c7e4`:** launchpad `resolve`
  is a privileged BULK money movement (raised USDT → house TREASURY on success; refunds on failure) that a single
  operator could settle at any size — asymmetric vs large withdrawals. Fixed:
  - `resolvePresale` HOLDS a large resolution (`status='RESOLUTION_PENDING'`, STRING field, no migration) and
    proposes a `large_presale_resolve` Maker-Checker action ATOMICALLY instead of settling. Contributions are USDT
    (~USD 1:1) so `totalRaisedUsdt` is the USD magnitude directly — no oracle. `makerChecker.requiresDualControl`
    enforces `launchpad_dual_control_usd_threshold` + the inviolable $20k hard ceiling. A distinct checker approves
    with TOTP → registered executor `settlePresaleExecutor` settles atomically; it re-asserts RESOLUTION_PENDING so
    a replayed/concurrent approval can never double-settle. Settlement extracted to shared `settlePresale(presale,tx)`.
  - Executor registered at boot in `routes/index.js`. Controller returns 202 `{pending,actionId,presale}` when held.
  - Fixed a latent bug: launchpad `validateUUID` referenced `errorCodes` without importing it (ReferenceError on a
    malformed id). OpenAPI + frontend contract doc updated for the 202 path.
  - Verified: unit +8 green, coverage OK.
- **[C] Hardening — `merged to main 0b4c7e4`:** `utils/uuid.isUuid` shared helper replaces the identical UUID regex
  copy-pasted in governance/launchpad/swap (callers keep their own throw semantics). `totpSetupLimiter`
  (5/15min per user) on POST /me/totp/setup (was unlimited secret+QR churn). Evaluated closing the legacy
  email-2FA path (`twoFactorMethod`): KEPT — only revealed post-password (not pre-auth enumeration) and it's the
  intentional no-lockout fallback during TOTP migration; removal belongs to migration completion. Unit +4 green.

### [GATE] /code-review high-effort on the dev↔main delta — DONE, all real findings FIXED
Ran 3 parallel finder agents (money-path launchpad, operator-readiness/rate-limiter, UUID refactor) +
my own state-machine/lifecycle angle. UUID refactor: clean (behavior-preserving, verified byte-equivalent).
The gate itself is sound (no dual-control bypass, atomic hold+propose, no double-settle). Three REAL findings,
all fixed with TDD (`<review-fix commit>`, re-verified 562 green):
- **[F1, stranded funds — the material one]** a rejected/expired `large_presale_resolve` left the presale in
  RESOLUTION_PENDING forever, locking buyers' USDT in escrow (worse than a held withdrawal — a shared singleton
  with no retry). Fixed at altitude: general **compensator** hook in the Maker-Checker engine
  (`registerCompensator`), run atomically inside reject() + expireStale() (refactored to per-row, re-locked).
  Launchpad registers a compensator that reverts a held presale to ACTIVE. Also fixes the class systemically.
- **[F2, false-positive READY]** operator readiness counted deactivated (un-authenticatable) operators →
  `active` now required in `isEnrolled` + query filter/projection.
- **[F3, fail-open]** `OPERATOR_MFA_MIN_ENROLLED` negative bypassed the gate → clamped in both script + pure fn.
- Low-severity note (not fixed, correct as-is): dual-control keys on gross `totalRaisedUsdt` (auditor-trail only;
  $0/null settlement moves no money).

- **✅ dev→main MERGED (`0b4c7e4`, `--no-ff`).** Re-ran full unit suite on the merged tree (**562 green**, coverage
  gate OK), pushed main, fast-forwarded dev. Final: `dev == main == origin/main == origin/dev == 0b4c7e4` (all 0 0).
  Delta shipped: operator MFA readiness gate + runbook, launchpad large-resolution dual control, shared UUID helper,
  TOTP-setup rate limiter, + Maker-Checker compensator lifecycle (reject/expiry releases held resources).

### Deferred follow-ups (documented, NOT silent gaps) — next control-parity targets
- **Admin balance-mutation endpoints are still single-operator** (bigger asymmetry than launchpad was):
  `PUT /balances/user/:userId/crypto/:cryptoId` (updateBalance — directly sets a balance), `POST .../block`,
  `POST .../unblock`, `POST /balances/user/transfer` (admin transfer between users). Each is operator+MFA but
  no 4-eyes. Route the large-magnitude ones through Maker-Checker next (each needs a held/deferred posting +
  executor + TDD — its own careful money-path burst; not rushed here).
- Operator MFA is still flag-only (no fresh per-action step-up) — ROADMAP §4.9 (operator realm / Cognito).
- **Withdrawal dual-control compensator:** the Maker-Checker compensator mechanism now exists, but the
  `large_withdrawal_release` action registers NONE — a rejected/expired large withdrawal stays `dualControlPending`
  (held) as before. Its compensation (cancel the withdrawal + refund the user's held funds to available) needs its
  own state-machine design + TDD; wire it once designed (now cheap: just `registerCompensator('large_withdrawal_release', ...)`).

## ✅ SESSION 2026-09-23 (evening) — launchpad admin + Maker-Checker→withdrawals wiring
Sync check first (clean): dev 7 ahead of origin/main (TOTP epic), origin/dev==dev, no stray tracked changes.
- **[B] Launchpad admin lifecycle (delegated to Antigravity, my review) — `727a0d4`:** operator-gated
  `POST /api/launchpad/presales` (create, full caps/price/date validation, tokenCryptoId resolved vs Crypto,
  all money via utils/money), `/:id/activate` (PENDING→ACTIVE), `/:id/resolve` (wires existing resolvePresale).
  UUID :id validation, OpenAPI, contract doc. agy wrote it; I verified files+diff+tests myself (15/15).
- **[C] Maker-Checker → large-withdrawal release (MINE, money-path, TDD) — `90faa99`:** dual control now
  wired to withdrawals. New `dual_control_pending` column (migration `20260923100000`) INDEPENDENT of the AML
  `requires_approval` hold (both must be false to transmit → neither control releases the other). In
  `createWithdrawal`: USD magnitude computed **server-side** via `amlValuation.getUsdValue` from the REAL
  crypto+amount (never maker-declared); if > threshold (config `withdrawal_dual_control_usd_threshold`, default
  $5k) or > $20k hard ceiling → row is HELD + `makerChecker.propose('large_withdrawal_release')` **atomically**
  in the same tx. A DISTINCT checker approves with TOTP → registered executor `releaseDualControlHold` clears the
  hold atomically → claimable. Unvaluable asset fails CLOSED (config `withdrawal_dual_control_on_unvaluable`,
  default true). Also: `markWithdrawalAsSent` guard rejects held rows; `claimForProcessing` WHERE now filters
  both holds; governance `:id` UUID validation (500→404); `makerChecker.propose` accepts a transaction.
  Executor registered at boot in `routes/index.js`.
  - **Verification:** unit 529 green (new: withdrawalDualControl.service 9, governance.controller 3,
    makerChecker +2). Coverage gate OK (functions 22% > 14% floor). Integration suite added
    (`withdrawalDualControl.integration.test.js`, runs on CI). Local jest integration harness quirk persists
    (truncate) → verified the full money-path (hold/propose/transmit-block/distinct-checker-release/4-eyes/
    ceiling) with a standalone script vs the real docker test DB: **18/18 checks passed**.
  - **DECISION for Abner (documented, reversible via config):** unvaluable-asset withdrawals fail CLOSED
    (route to dual control) by default. Rationale: can't prove it's under the ceiling. Toggle:
    `withdrawal_dual_control_on_unvaluable`.
- **[GATE] `/code-review` high-effort on the dev↔main delta (8 finder angles) — DONE.** Real findings FIXED
  (TDD, `11a5c91`), re-verified green:
  - **TOTP single-use (regression):** old email code was deleted on use; TOTP had NO replay guard. Added
    `totp_last_used_step` (migration `20260923110000`); verify/enable/disable consume the matched 30s step and
    reject replay; callers (login `verify2FA`, governance `approve`) now `await` (a dropped await would slip a code).
  - **2FA-toggle bypass:** `PATCH /me/2fa-toggle` could disable 2FA with NO code while TOTP enrolled (stripping the
    login gate, bypassing code-guarded `totp.disable`). `toggle2FA` now refuses to disable while `totpEnabled`.
  - **Dual-control stale-price bypass (MINE):** a frozen/stale pair price could undervalue a large withdrawal below
    the threshold/ceiling and skip 4-eyes. `evaluate()` now trusts only a stable valuation or a fresh (<1h) pair
    price; stale/untrusted → fail closed.
  - **Transmit-query parity (MINE):** eth/bsc/bitcoin `processPendingWithdrawals` now also filter
    `dualControlPending=false` (defense-in-depth alongside `claimForProcessing`).
  - **Dead code:** removed `User.verify2FACode`. **Doc:** fixed TOTP paths `/api/usuario`→`/api/user`.
  - Verified: unit 533 green, coverage gate OK; full money-path/auth re-verified 8/8 against the real DB.

### ⚠️ DEPLOY PRECONDITION for Abner (from the review — NOT a code bug, do NOT skip)
The Maker-Checker **checker second factor is TOTP** (Abner's §5 decision), and large withdrawals now REQUIRE a
checker approval to be released. **After the TOTP migration every operator has `totpEnabled=false`** → until at least
one operator (distinct from the withdrawing maker) enrolls TOTP (`/api/user/me/totp/{setup,enable}`), a held large
withdrawal cannot be released and its funds stay blocked. **Before relying on dual control in any deployed env, enroll
operator TOTP first.** Follow-up idea: a seed/onboarding step that provisions operator TOTP.

### Deferred review findings (documented follow-ups, not blockers)
- Launchpad `resolve` (money movement) is single-operator + MFA-flag, NOT dual-controlled like large withdrawals
  (asymmetric control). Consider routing large presale settlements through Maker-Checker.
- Operator MFA is flag-only (no fresh per-action step-up) — ROADMAP §4.9 (operator realm / Cognito).
- TOTP `setup` endpoint has no rate limiter; `twoFactorMethod` in loginStep1 enables 2FA-method enumeration; UUID
  `:id` guard duplicated across launchpad/governance/swap controllers (extract a shared helper). All minor hardening.

- **✅ dev→main MERGED (`efa99ee`, `--no-ff`).** Aligned local main to origin/main (`1f178d1`), merged dev,
  re-ran full unit suite on the merged tree (**533 green**), pushed main, fast-forwarded dev. Final state:
  `dev == main == origin/main == origin/dev == efa99ee` (all `0 0`). Delta shipped: TOTP-for-all epic + launchpad
  admin lifecycle + Maker-Checker large-withdrawal dual control + the 6 high-effort review fixes.
- **NEXT BURST candidates:** (1) enroll/seed operator TOTP (unblocks the deploy precondition above); (2) route
  large launchpad `resolve` settlements through Maker-Checker (control parity with withdrawals); (3) rest of §7 —
  Tron testnet adapter, AWS KMS (code-only), on-ramp Transak, Google GIS, i18n 5 locales; (4) minor hardening
  (extract shared UUID guard, TOTP setup rate limit).


## ⚠️ 2026-09-23 (session resume) — BRANCH RECONCILIATION (important, read first)
The HANDOFF premise "main intacto" was **WRONG**. Reality found on resume:
- `dev` was built on a **stale base** (`f4d2e5a`, pre-PR #31). Meanwhile `origin/main`
  advanced **36 commits** via PRs #31–#37: AML perf pass (`3472239`), `PeriodicJob` base
  class refactor, swap/balance controller fixes, testnet faucet + catalog seeding, staging
  docs (`AGENTS.md`, `PROJECT_VISION.md`, `DEPLOYMENT_STAFF_STAGING.md`, `backend/README.md`).
- dev had 33 unique commits (this run's frontend TS rebuild + oracle/alerts/referrals/
  launchpad/kyc/governance backend modules) that main lacks.
- **They reconcile cleanly**: main made ZERO net frontend changes vs base, so dev's 106-file
  TS rebuild does not collide. Trial merge = 0 conflicts.
- **ACTION TAKEN:** merged `origin/main` → `dev` (merge commit, `ort` strategy, clean).
  dev is now `0` behind / `34` ahead of origin/main. **main was NOT touched.**
- **VERIFIED GREEN post-merge:** frontend `tsc --noEmit` exit 0; backend unit **481 passed,
  3 skipped, 0 failures** (94 suites, 52s). Both main-only (`backend/jobs/PeriodicJob.js`,
  staging docs) and dev-only (governance/kyc/launchpad/referrals, `money.ts`, `src/app`)
  artifacts confirmed present in the merged tree — merge is genuine, no anomaly.
- **Local `dev` was 37 commits ahead of `origin/dev` — the ENTIRE run was unpushed (data-loss
  risk).** Pushed: `30db5f4..d54e9d7  dev -> dev` (clean fast-forward). origin/dev == local dev now.
- **dev→main NOT done** — deferred to a dedicated next burst: run `/code-review` high-effort on
  the dev↔main delta (whole frontend rebuild + 6 backend modules is money/security-heavy), fix
  findings, then auto-merge per Abner's §5 authorization. Not rushed into this session's tail.
- Junk untracked scratch files in repo root (fix*.js/py, clean.js, untitled*.md, test_fix.py)
  are NOT mine and NOT committed — left in place, flagged for Abner.


**Standing rules (from Abner):**
- Fleet: Antigravity (`agy` headless) + Claude Code sub-agents. Kimi is DOWN (403). No other agents.
- Delegate everything EXCEPT security/custody/keys/auth/Maker-Checker/HD-derivation → those are mine.
- Nothing merges to `main`. Accumulate reviewed work on `dev` only. No autonomous dev→main.
- Depth over breadth: audit-grade, finished features (wired + tested + OpenAPI/contract docs).
- Frontend = TypeScript rebuild, following `docs/frontend-rebuild/frontend-audit.md` (Slice order 0→8).
- Money/data-types treated as a SECURITY concern (locale decimal separator, float `0,300 != 0.300001`).
- Secrets: never invent/commit; build config-driven behind env vars + stubs; leave SETUP notes.
- When credits run out (Antigravity or Claude): STOP and leave a report here. No paid polling / self-wakeups.
- Commits: Conventional English, NO Claude attribution (per CLAUDE.local.md).

**Reliability notes (agy dispatch):**
1. `agy -p` sometimes DESCRIBES code instead of writing files. ALWAYS verify files exist on disk + run tests
   myself before trusting a worker report. Use a "you MUST write files and run tests" preamble; re-dispatch if empty.
2. Background Bash cwd is NOT guaranteed to be repo root. ALWAYS use ABSOLUTE paths in dispatch commands
   (`cat "$R/spec.md"`, `> "$R/log"`) and `cd "$R"` first — a relative `cat spec.md` silently failed once
   (AGY_EXIT=1, no files). agy itself is healthy (credits fine as of 2026-09-23).

## Committed to `dev` this run
- `3581931` feat(oracle): multi-source median price oracle + divergence breaker (1.5%). 5/5 tests. NOT wired to swap yet.
- `03b9fbe` feat(alerts): sanitized Telegram operational alert service (uses businessConfig.getBoolean + env). 10/10 tests.
- `fc521d7` feat(frontend): TS canonical money core `src/shared/money/money.ts` — branded `CanonicalAmount`,
  locale-aware `parseInput` (deterministic per-locale separator resolution), strict validation, `formatDisplay`.
  39/39 tests + `tsc --noEmit` clean. Added TypeScript devDeps + `frontend/tsconfig.json`. Replaced legacy money.js.

## 🔬 dev→main gate — high-effort /code-review findings (2026-09-23) — MONEY-PATH, MINE, TDD
Ran 4 parallel finder agents on the money/security backend surface (governance, launchpad+referrals,
kyc+oracle, migrations+wiring). Verified against source myself. **dev is NOT mergeable until these are
fixed.** Triaged fix queue (fix with TDD, commit+push each):

REAL — ✅ ALL FIXED (TDD, committed+pushed 2026-09-23):
- [x] **referrals** (`4b7768d`): require `sourceRef` (drop random-UUID fallback); idempotency guard
  (check existing ledger entry before touching `ReferralBalance` → no balance/ledger divergence);
  self-referral guard (`sponsor===invitee` → no commission); + define `errorCodes.VALIDATION_ERROR`
  (was undefined → `code:undefined` in every launchpad/referrals validation response).
- [x] **oracle** (`8121731`): gate each source price to finite & >0 (invalid → source unavailable);
  treat non-finite divergence as divergent → `"NaN"`/`"0"` can no longer be reported reliable.
- [x] **kyc** (`a7699f3`): controller drops `JSON.stringify` fallback; service fails closed if rawBody
  absent; event-record + tier-upgrade in ONE tx (failed upgrade rolls back the event row); unique
  event_id race → idempotent 200 not 500.
- [x] **launchpad** (`0fc22e9`): reject `amountUsdt <= 0` outright (prevents mint via negated legs).
- [x] **alerts** (`912364e`): expanded custody-secret denylist, evaluated FIRST (walletPrivateKey etc.
  can't leak through the wallet/address branch).
- [x] **governance** (`912364e`): normalize maker vs checker ids (case/representation) — 4-eyes control.

FOLD INTO TOTP carve-out (next big task — resolves these too):
- **governance checker 2FA** reuses login-only `User.twoFactorCode` (null for logged-in operators) → approve
  unusable / no approval-bound step-up. TOTP-for-all gives a proper time-based step-up. + fix the 2FA-consume
  vs governance-tx atomicity (finding #5) as part of that.

DEFER to Maker-Checker→withdrawal wiring task (§7 #3):
- **amountUsd is self-declared metadata**, decoupled from payload; the ceiling/threshold decision must be
  computed SERVER-SIDE from the real withdrawal in the wiring, not trusted from maker input. `requiresDualControl`
  is correct but currently uncalled (wiring pending). Decide there whether >$20k is dual-control-mandatory
  (current design) vs hard-blocked.
- listPending exposes full payloads + no UUID-format validation on `:id` (500 vs 404). Minor; handle in wiring.

## ✅ TOTP-for-all backend epic — DONE (2026-09-23), merged path on `dev`
Completed in 5 pushed slices (unit 506 green; login logic verified end-to-end against a real DB):
- `9b21f14` TOTP service (otplib v12 + qrcode): secret + otpauth URI + verify (±1 window, fails closed). 12 unit tests.
- `42454b9` migration + `totp_secret`/`totp_enabled` columns + user-instance orchestration
  (beginEnrollment/enable/verifyForUser/disable); `toJSON` strips `totpSecret`; TOTP error codes.
- `94fb874` **governance checker second factor → TOTP** (FIXES the unusable-approve bug).
- `7d49c22` self-service enrollment endpoints `POST /user/me/totp/{setup,enable,disable}` + OpenAPI + contract §15.
- `b75b2c3` **login second factor → TOTP** (dual-path: prefers TOTP if enrolled, falls back to email code
  otherwise → no user lockout). Integration tests added for TOTP login + enrollment endpoints.
- **Local jest integration harness quirk:** ALL integration suites fail in beforeEach `truncate` with an
  empty-message pg error (pre-existing; direct DB sync+truncate works fine; unit suite unaffected). Verified
  slice-5 login logic via a standalone script on an alternate Postgres (port 15432) → all checks passed.
- TOTP FOLLOW-UPS: (a) frontend enrollment UI (delegable); (b) optional hardening — remove the legacy
  email-code login path once TOTP enrollment is universal (currently dual-path by design); (c) encrypt
  `totp_secret` at rest when AWS KMS lands.

## ▶️ NEXT BURST — start here (spec)
Ordered by priority. dev green (506 unit) + pushed (`origin/dev == dev`); dev==main was merged earlier (`1f178d1`)
but dev has since advanced with the review fixes + TOTP epic (a fresh dev→main merge is due — run /code-review
high-effort on the new delta first).

1. **Launchpad admin lifecycle (delegable feature, my review) — launchpad is dead-on-arrival.**
   No HTTP surface exists to create/activate/resolve a presale (presales default `PENDING`; `buy`
   requires `ACTIVE`; `resolvePresale` exists in the service but has NO route). Add operator-gated
   (`requireOperatorMFA`, as governance does) routes: `POST /api/launchpad/presales` (create),
   `POST /api/launchpad/presales/:id/activate` (PENDING→ACTIVE with validation), `POST /:id/resolve`
   (calls existing `resolvePresale`). TDD + OpenAPI + contract doc. Money logic already exists/tested.
3. **DEFERRED (from review, do with the withdrawal wiring, §7 #3, MINE):** Maker-Checker `amountUsd`
   is self-declared metadata — when wiring executors to the withdrawal path, compute the USD amount
   SERVER-SIDE from the real withdrawal and enforce the ceiling there (don't trust maker input).
   Also add UUID-format validation on governance `:id` params (500→clean 404) + consider narrowing
   `listPending` payload exposure. `requiresDualControl` is correct but still uncalled until this wiring.
4. Then rest of §7: Tron testnet adapter, AWS KMS (code-only), on-ramp Transak, Google GIS, i18n 5 locales.

## ✅ dev→main MERGED (2026-09-23) — per Abner's direct instruction
High-effort /code-review DONE (4 finder agents over the money/security delta); all 9 real findings
FIXED + green FIRST. Then merged **`dev`→`main`** (explicit merge commit `1f178d1`, `--no-ff`):
- aligned local main to origin/main, merged dev, re-ran full suite on the merged tree (**494 green,
  0 fail**), pushed `main` (`34f3ed6..1f178d1`), then fast-forwarded `dev` to main.
- Final state: `dev == main == origin/main == origin/dev` (all `0 0`).
- **KNOWN LIMITATION shipped (documented, accepted by Abner):** the Maker-Checker `approve` checker
  second factor still uses the login-only `User.twoFactorCode` (null for logged-in operators) → approve
  is effectively unusable until **TOTP-for-all** lands (▶️ NEXT BURST item 1). Governance is
  operator-gated and NOT wired to any money path yet, so this is latent, not dangerous. Fix it next.

## Status board
| Item | Owner | State |
|---|---|---|
| Frontend Slice 0: money core | Me | DONE + committed `fc521d7`. |
| Frontend Slice 0: shared/api (TS transport + Idempotency-Key + ApiError + session seam) | Antigravity + my review | DONE + committed `03998d8` (17/17 tests, tsc clean). |
| Frontend Slice 0: i18n layer + style tokens | dispatched | IN PROGRESS (worker). |
| Frontend Slice 0: accessible UI primitives (Button/Field/Dialog) | — | TODO (a11y-sensitive; me or Claude sub-agent + review). |
| Oracle → swap wiring (pause + PRICE_ORACLE_DIVERGENCE + Telegram) [money-path=mine] | Me | TODO. |
| Backend breadth: Referrals (H8), Launchpad (H10), KYC toggle+Tiers (H6/7) | — | TODO (money-path → my review). |

## Known follow-ups (seams, not bugs)
- shared/api: the transport auto-generates an Idempotency-Key per call; the RETRY-reuse guarantee (same key for the same user intent) must be owned by the feature mutation layer (TanStack Query hooks) passing `idempotencyKey` explicitly. Transport already supports it; tests cover the mechanism.
- **Referrals INTEGRATION pending (mine):** module committed but NOT wired — must (a) register `ReferralLink`/`ReferralBalance` entities + associations in `backend/models/index.js`, (b) mount `referrals.routes` in app.js under `/api/referrals` with auth + idempotency middleware, (c) add OpenAPI annotations + update `backend-contract-changes.md`, (d) call `accrueCommission` from the trade-fee flow (money-path). Until then it is dead code.
- **Referrals DESIGN decision for Abner:** claim draws USDT from house `FEE_REVENUE` (overdraft-protected). Consider a dedicated `REFERRAL_LIABILITY` purpose funded at accrual time for cleaner audit-grade accounting. Left a `// REVIEW:` in referrals.service.js.
- Review WIN: worker used `cryptoId: 'USDT'` (symbol) but the ledger keys accounts by crypto UUID → would create unreconcilable accounts. Fixed to resolve `Crypto.getBySymbol('USDT').id`. Unit tests mock the ledger so they did NOT catch it — caught by reading the real ledger entity.

## Committed to `dev` (cumulative this run)
oracle · alerts · money core TS · shared/api TS · i18n+tokens · UI primitives · referrals module (unwired)
· wallet balances view (read-only) · swap preview widget (read-only).

## HANDOFF — read `HANDOFF.md` for the full next-session prompt + ALL of Abner's decisions (round 3, 2026-09-23)
Key round-3 decisions: dev→main AUTO-MERGE after review+/code-review; app-router cutover AUTONOMOUS; security carve-outs
FULL impl+tests (mine); if Antigravity credits run out → Claude continues; if Claude credits run out → STOP (+ backup
routine); NO real secrets (all config-driven + stubs); AWS code-ready no-deploy; Tron testnet-first (HD free — frozen
is only BTC/ETH/BSC); on-ramp=Transak (server-side address); mobile=later; Google GIS via env client id; **2FA→TOTP for
everyone** (replaces email-code incl. Maker-Checker checker factor); wire Maker-Checker executors to large withdrawals
(>$5k dual, $20k ceiling); tests=my judgment; business values=all businessConfig/DB editable from admin panel;
i18n=es/en/fr/it/pt; legacy=port missing then delete → 100% TS. Suggested order in HANDOFF.md §7.

## Abner directives 2026-09-23 (round 2)
- App-router shell: DELEGATE to a worker, I review + integrate.
- Security carve-outs (Maker-Checker, Tron/gas-station, AWS KMS/custody): **I (Claude) advance them myself** with TDD,
  max attention, land on `dev` for Abner's final review. Do NOT delegate these to workers.
- Keep producing delegable verticals: Admin dashboard, P2P transaction flow (escrow), On-ramp + Tiers.
- Referrals accounting: use a **dedicated `REFERRAL_LIABILITY` ledger purpose**, funded at ACCRUAL time (not drawn from
  FEE_REVENUE at claim). Audit-grade. This is a money-path refactor of the referrals module I just shipped — mine.

## Path to a RUNNABLE app (important sequencing)
The built TS features (wallet/swap/p2p/deposit/trading/referrals + launchpad-to-come) each export a `routes.tsx`
but NONE are mounted — the legacy `App.jsx` still owns routing. To make the new TS app runnable requires:
1. Slice 1 (auth journey: register/login/verify-email + guards) — IN PROGRESS (dispatched). Prerequisite: no app
   cutover without auth.
2. `src/app/` router shell (QueryClientProvider + LocaleProvider + react-router v6) mounting auth + all feature
   routes, then swap `index.js` entry. This REPLACES the legacy app → do it only after auth exists, carefully,
   with `npm run build` as the safety net. App-wide = mine, careful. Legacy pages not yet rebuilt (admin, profile,
   home) must be ported or kept before full cutover.

## Backend verticals LIVE (mounted + OpenAPI + contract doc + unit tests green)
- Referrals: `/api/referrals/*` (+ REFERRAL_LIABILITY accounting refactor `e62acf7`). Launchpad: `/api/launchpad/*`.
  KYC: `/api/kyc/*` (Persona HMAC + rawBody fix). Governance: `/api/governance/*` (Maker-Checker). Full unit suite 481 pass.
- **Maker-Checker DONE (security carve-out #1, by me, TDD):** `backend/modules/governance/` — engine with maker≠checker
  hard rule, $20k inviolable ceiling (`requiresDualControl`), TTL expiry, checker 2FA (reuses `User.verify2FACode`),
  atomic executor registry, `expireStale` for a job. 12/12 unit. Mounted, operator+MFA gated. NEXT for it: register
  real executors (large-withdrawal release, fee change) — per-action wiring is follow-up.
- App-router shell DONE `1d1ca02`: `src/app/` mounts all 8 feature routes + auth guards, tsc clean, 3/3. Entry-point
  switch (replace legacy index.js/App.jsx) deferred to Abner review.

## Admin dashboard DONE `eee00b9`
`features/admin/` — Maker-Checker inbox (approve w/ 2FA dialog, reject, error-code mapping) + business config editor.
Consumes `/governance/*` and `/config`. tsc clean, 4/4. NOTE: `features/admin/routes.tsx` is NOT mounted in
`src/app/router.tsx` yet (router predates it) — add it (operator-guarded) during the app-router cutover.

## On-ramp (Hito 9) — DEFERRED with reason
On-ramp signed-URL backend (Transak/MoonPay) should resolve the user's Funding deposit address SERVER-SIDE and
inject it into the signed provider URL — never trust a client-supplied address (a user could direct fiat-bought
crypto to an arbitrary address). That resolution couples to the custody/deposit-address module, so it belongs to a
custody-aware fresh-context step, not a rushed end-of-session build. Service should sign the URL (HMAC) from provider
config in env (`ONRAMP_PROVIDER`, `*_API_KEY`, `*_SECRET`) and 503 cleanly when unconfigured.

## Remaining security carve-outs (mine, TDD, when I return to them)
- Tron TRC20 adapter + gas-station sweeping (Hito 4) — HD derivation values are FROZEN (see memory), do not change them.
- AWS KMS / Secrets Manager custody (Hito 12).
- Wire Maker-Checker executors into the withdrawal path (large withdrawals) — money-path.

## Frontend integration debt (mine, next fresh-context burst)
- `features/wallet/routes.tsx` and `features/swap/routes.tsx` are NOT mounted in the app router (legacy `App.jsx`).
  Building the new `app/` router shell + mounting these (public/auth/verified guards) is a careful, app-wide step.
- Money MUTATION features deferred (need idempotency-per-intent handled in a mutation hook layer): wallet Funding↔Spot
  transfer modal, swap execute. Do these WITH careful review.

## INTEGRATION status
1. Referrals wiring — DONE `a41dd66`: mounted at `/api/referrals` in `routes/index.js` (models self-register lazily;
   route already had `@openapi` + correct auth/idempotency middleware matching transfer/trading). Contract doc updated.
   Verified: `node -e require('routes/index.js')` loads OK + `npm test` 460/463 pass (3 skipped), 0 regressions.
   REMAINING (money-path, deeper): the `accrueCommission`-from-trade-fee hook is NOT wired yet.
2. Oracle→swap wiring — TODO (money-path, mine, fresh context): on divergence pause swap + emit `PRICE_ORACLE_DIVERGENCE`
   via events/outbox + fire Telegram alert.
3. Frontend app router — TODO: build `app/` shell + mount `features/*/routes.tsx` (wallet, swap, p2p) with guards.
   Touches legacy `App.jsx`/`index.js` (app-wide) — careful, fresh context.
Always run `cd backend && npm test` (unit, no DB) after any shared-file change; commit only on green.

## Review findings log
- Oracle: CoinGecko `symbolMap` defaulted to 'bitcoin' for unknown symbols → fixed to throw. Threshold 2%→1.5% (roadmap).
- Legacy frontend `money.js`: `Number()`-based validation accepted Infinity/hex/sci; separator ambiguity resolved by
  heuristic not locale; no types. → All fixed by the TS rewrite (locale is now a required `parseInput` option).
- Telegram service: verified `../config/businessConfig` + `getBoolean` are real (test auto-mocked them, so I checked the
  real module) — integration is correct, not a latent prod crash.

## Next actions (ordered)
1. Review + integrate shared/api TS port when worker finishes; commit.
2. Build rest of Slice 0 (i18n skeleton, UI primitives, tokens) — delegable.
3. Wire oracle→swap (money-path, mine): pause swap on divergence, emit PRICE_ORACLE_DIVERGENCE via events module, fire Telegram alert. Needs OpenAPI/contract-doc updates.
4. Backend breadth: Referrals, Launchpad, KYC toggle+Tiers (each delegated, my review, own migration).

## 2026-10-09 — Next.js Slice 2 (wallet) COMPLETE + first web→main merge (PR #41)
Slice 2 built subagent-driven (12 tasks, fresh implementer + spec/quality review per task; the 2 money-path
tasks reviewed carefully by me). Delivered the `login → real balances` vertical: compartmented balances
(Funding/Spot, available/blocked/pending display-only), Funding↔Spot transfer, deposit address + history,
on-chain withdrawal (Funding-only). All money is `@/shared/money` decimal strings (no float); idempotency
auto-attached by the shared client; audit guards (no double-submit, Funding/Spot never conflated, pending
never spendable) enforced + behaviorally tested.

Reviews: opus whole-branch final = Ready to merge (0 Critical/Important). `/code-review` high-effort (run by
Claude) on PR #41 found 1 real Slice-2 bug — wallet `tError()` omitted `{requestId}` → `INTERNAL_ERROR` (500)
rendered literal `{{requestId}}` — FIXED across transfer/deposit/withdraw; also hardened the money submit guard
(require a known available balance), fixed a misleading nav aria-label, exported `walletDepositKey`.

Gate (merge): tsc 0, Vitest 182/182 (28 files), `next build` OK (`/wallet` present). Merged PR #41 dev→main
(`e7cc59c`); dev fast-forwarded; `dev==main==origin`, all pushed. main is NOT deployed (CRA still serves prod).

MUST-FIX before the web is deployed (tracked):
1. Idempotency per-INTENT key reused across retries — `shared/api/idempotency.ts` currently generates a fresh
   UUID per fetch; a manual re-submit after a client-perceived failure uses a new key → if the first request
   actually landed server-side, a double money op is possible. Mitigated now by disabled-while-pending +
   backend per-key dedup + retry:false. Proper fix = key tied to the submission intent in the mutation layer.
2. `(app)` guard checks only token presence — not `emailVerified`, and not reactive to a 401-triggered clear.
3. Playwright wallet E2E (Task 12) deferred — local disk was full (ENOSPC risk). Backfill: `cd web && npx playwright test`.
4. Pre-deploy: evaluate Next 16 / React 19 (npm audit of the 14.x line).

NEXT: Slice 3 per the design spec (swap/trading), OR de-risk the web money-path (must-fix #1) first if prioritized.

## 2026-10-10 — SPRINT DEFINED (Abner): "Complete & ship the Next.js frontend"
Direction chosen = path A (build out the whole new frontend + go live). Sprint scope, in order:
S3 Swap → S4 Spot trading → S5 P2P → S6 Profile/security → S7 Admin → S8 marketing + delete CRA + NGINX FLIP (go live),
plus a front-fixes/polish pass. Each slice: subagent-driven, dev→main per PR with /code-review, accumulates on main
UNDEPLOYED. Stop "accumulate-without-deploy" at S8 — the sprint's end state is PRODUCTION on the new web.

GO-LIVE GATE (non-negotiable before the S8 nginx flip): (1) per-intent idempotency key on every money mutation
(deferred during feature-building by Abner's call, required before deploy); (2) (app) guard redirects on
emailVerified=false + reactive to 401 clear; (3) Playwright E2E green for all money flows; (4) Next 16/React 19 eval +
1GB-box build check; (5) check:operator-mfa green.

START = Slice 3 (Swap), money-path (mine, TDD): writing-plans grounded in backend/modules/swap/* + the oracle breaker
(503 PRICE_ORACLE_DIVERGENCE). Full startup prompt rewritten in HANDOFF.md (§RESUME HERE → "EL SPRINT"); design-spec
§6 cutover note updated; frontend-nextjs-migration memory updated.
