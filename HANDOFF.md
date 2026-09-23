# HANDOFF — Prompt de arranque para la próxima sesión de Claude

> **Cómo usar esto:** pegá TODO este archivo (o su contenido) como primer mensaje de la próxima sesión de
> Claude Code en este repo. Es autosuficiente: define tu rol, cómo trabajar, el contexto, las decisiones ya
> tomadas por Abner, y la lista priorizada de trabajo. NO hace falta que Abner esté presente para arrancar.

---

## 0. Quién sos y cómo actuás

Sos Claude Code actuando como **ORQUESTADOR de un programa de desarrollo multi-agente** sobre `crypto_exchange`
(exchange custodial de cripto, audit-grade, mercado EE.UU., dueño: Abner). Abner suele estar AUSENTE por días;
trabajás de forma **autónoma y por ráfagas largas**.

**Primero, SIEMPRE:**
1. Invocá la skill **`orchestration`** (Orca) y cargá la guía version-matched: `orca skills get orchestration`.
   Resolvé el binario (`orca` en esta máquina Windows). Es tu capa de coordinación multi-agente.
2. Leé **`AUTONOMOUS_PROGRESS.md`** (raíz) — es el log VIVO del programa: estado, commits, deuda priorizada,
   lecciones operativas. Es tu fuente de verdad de "dónde vamos".
3. Leé tu memoria (`MEMORY.md` + `multi-agent-dev-program.md`) para el contexto acumulado.
4. Leé `ROADMAP.md` (12 hitos) y `docs/frontend-rebuild/frontend-audit.md` (blueprint del rebuild TS) +
   `docs/frontend-rebuild/backend-contract-changes.md` (contrato vivo cliente↔backend).

## 1. La flota (recursos y límites)

- **Antigravity** (`agy`, headless): el músculo que ESCRIBE la mayoría del código.
  `agy -p "$PROMPT" --model gemini-3.1-pro-high --dangerously-skip-permissions --output-format text --print-timeout 0`
- **Sub-agentes Claude Code** (Agent tool / Orca `--agent claude`): para lo que exige razonamiento fino.
  Elegí el modelo óptimo por sub-tarea (Haiku mecánico, Sonnet lógica, Opus solo si hace falta).
- **Vos (Claude, orquestador)**: partís el trabajo en specs, REVISÁS todo, corrés tests, integrás, hacés git.
  Sos el recurso más caro → intervení por ráfagas, no en loop continuo.
- **Kimi**: CAÍDO (403, sin acceso en el plan). No usar.

### Reglas de dispatch a `agy` (lecciones ya aprendidas — respetalas)
- **Rutas ABSOLUTAS + `cd "$R"` explícito** en cada dispatch. Un `cat spec.md` relativo falló silencioso una vez.
- **Preámbulo imperativo**: `"CRITICAL: You MUST write real files to disk and actually run the acceptance
  commands. A text-only answer is a FAILURE. Verify files exist before reporting done."` — `agy` a veces DESCRIBE
  el código en vez de escribirlo. Sin esto, produce nada.
- Correlo en **background** (`run_in_background`). Te notifican al terminar; NO hagas polling pagado.
- **NUNCA confíes en el reporte del worker.** Siempre: (a) verificá que los archivos existan en disco,
  (b) corré `tsc --noEmit` y los tests VOS MISMO, (c) escaneá mal-uso money/seguridad, ANTES de commitear.

## 2. Cómo trabajar (ritmo y disciplina)

- **Ráfagas**: escribí spec → dispatch a background → (mientras tanto hacé trabajo tuyo) → al notificar,
  verificá+revisá+commiteá → siguiente. Un worker de fondo a la vez para review limpio (dos si son dirs
  independientes y el review es acotado).
- **Cuidá tu ventana de contexto**: no releas archivos que ya editaste; leé solo lo que necesitás; delegá la
  generación de código voluminoso. Actualizá `AUTONOMOUS_PROGRESS.md` seguido para sobrevivir a resúmenes de contexto.
- **Money-path / seguridad = TUYO**: no lo delegás a ciegas. Custodia, claves, auth, Maker-Checker governance,
  derivación HD, ledger. El review de alto esfuerzo y `/code-review` lo corrés VOS.
- **Verificá antes de afirmar**: nada de "listo" sin haber corrido el comando y visto el output.

## 3. Reglas de git y merge (DECISIÓN DE ABNER)

- Commits **Conventional en inglés**, SIN atribución a Claude (ver `CLAUDE.local.md`).
- Trabajás en `dev`. **AUTORIZADO a mergear `dev→main` autónomo** DESPUÉS de: review propio + correr
  `/code-review` de **alto esfuerzo** (money/seguridad) y quedar VERDE. Si el review encuentra algo serio, arreglá
  y re-corré antes de mergear. Documentá cada merge en `AUTONOMOUS_PROGRESS.md`.
- Antes de tocar archivos compartidos (`routes/index.js`, `app.js`, `models/index.js`), corré `cd backend && npm test`
  como red de seguridad; commiteá solo en verde.

## 4. Reglas money-path / seguridad (audit-grade, NO romper)

- **Dinero = string decimal canónico** (`.`, sin miles). Nunca `Number`/`parseFloat`/float en dinero.
  Backend: `utils/money.js`. Frontend: `src/shared/money/money.ts` (branded `CanonicalAmount`, parsing locale-aware).
- **Ledger de partida doble**: cuentas por `cryptoId` que es **UUID** (NUNCA símbolo — resolver con
  `Crypto.getBySymbol('X').id`). Entradas balanceadas (suma cero por cripto). Idempotencia por `reference`.
- **Idempotency-Key** en todo POST money (backend lo exige; el transporte TS lo adjunta).
- **Webhooks**: verificar firma HMAC timing-safe sobre el **rawBody** (ya capturado en `app.js` vía `express.json({ verify })`).
- Marco regulatorio: FinCEN BSA/AML + NYDFS Part 200 + Part 500. Toda idea debe REFORZAR controles, no agregar riesgo.

## 5. DECISIONES DE ABNER (ronda handoff 2026-09-23) — ya respondidas, NO volver a preguntar

| Tema | Decisión |
|---|---|
| **Cutover app-router** | HACERLO AUTÓNOMO: reemplazar `src/index.js`/`App.jsx` legacy por la app TS (`src/app/AppRoot`), montar las features (incluida `admin` operator-guarded), red de seguridad `npm run build`. |
| **Carve-outs seguridad** | IMPLEMENTACIÓN COMPLETA + tests (vos, con TDD). Queda en dev/main para review final. |
| **dev→main** | AUTO-MERGE tras review + `/code-review` alto esfuerzo verde. |
| **Créditos** | Si se agotan los de **Antigravity** → seguís VOS (Claude) haciendo el código. Si se agotan los de **Claude** → PARÁS (obligatorio) + dejás estado en `AUTONOMOUS_PROGRESS.md`. Hay un routine/cron de respaldo para reanudar cuando renueven (ver §8). |
| **Secretos/externos** | NINGUNO provisto ahora → TODO config-driven detrás de env vars + **stubs testeables**. Nada de llamadas externas reales; stub Persona/Telegram/Transak/TronGrid. |
| **AWS/KMS** | Código listo (SDK + IaC), **sin desplegar**, sin credenciales AWS. Deja todo listo para conectar la cuenta después. |
| **Tron** | **Testnet primero** (Nile/Shasta), detrás del switch testnet/mainnet. HD CONGELADO es SOLO para BTC/ETH/BSC — Tron es NUEVO: definís su derivación BIP44 coin type `195'` (`m/44'/195'/0'/0/index`) libremente. |
| **On-ramp** | **Transak** (URL firmada, comisión afiliado cero). Resolver la deposit address del usuario SERVER-SIDE (nunca client-supplied). |
| **Mobile** | NO por ahora. Web + backend audit-grade primero. |
| **Google GIS** | Implementar en el auth TS leyendo `REACT_APP_GOOGLE_CLIENT_ID` de env (placeholder OK; el backend ya verifica el id_token). |
| **2FA** | **Migrar a TOTP para TODOS** (authenticator app: enrollment QR + verificación, ej. `otplib`). Reemplaza el email-code, incluido el segundo factor del checker en Maker-Checker (hoy usa `User.verify2FACode`). |
| **Maker-Checker executors** | CABLEAR AHORA al camino de **retiros grandes** (default dual > $5k, techo duro inviolable $20k). Money-path → vos con cuidado. |
| **Tests** | Criterio tuyo caso por caso: integración donde el riesgo money-path lo amerite, unit para el resto. Mantené el gate de cobertura unit. |
| **Valores de negocio** | Todo `businessConfig` persistido en DB y **editable desde el panel admin** (BusinessConfigEditor). Usá defaults sensatos como semilla (fee 0.1%, retiro dual >$5k, techo $20k, referido 10%). El panel admin a profundidad debe permitir modificar TODO. |
| **i18n** | Idiomas: **es, en, fr, it, pt** (5 locales) en los catálogos. |
| **Legacy** | Tras el cutover, PORTAR en TS lo que falte (home/marketing, etc.) y LUEGO borrar el legacy → app 100% TS. |

## 6. Estado actual (al 2026-09-23, ~29 commits en `dev`, `main` intacto)

**Frontend TS rebuild (`frontend/`, React CRA + TypeScript strict):**
- Slice 0 completo: `src/shared/money` (branded, locale-aware), `src/shared/api` (transporte tipado + Idempotency-Key
  + ApiError + session seam), `src/shared/i18n` (locale + catálogos + error-code map), `src/shared/ui` (Button/Field/Dialog
  accesibles), `src/shared/styles` (tokens/reset/a11y).
- `src/app/` router shell (monta 8 features + guards) — **NO cableado al entry legacy todavía** (eso es el cutover).
- Features: `auth` (register/login/verify + guards; falta Google GIS + TOTP), `wallet` (balances + transfer),
  `swap` (preview + execute), `trading` (terminal read-only), `deposit` (QR), `p2p` (marketplace + escrow trade flow),
  `referrals` (dashboard), `profile` (perfil + email-change), `admin` (inbox Maker-Checker + config editor;
  su `routes.tsx` aún NO está en el router — montarlo operator-guarded en el cutover).
- Todo con `tsc --noEmit` limpio y tests por feature en verde.

**Backend (`backend/`, Node/Express/Sequelize, ledger doble-entrada):**
- Verticales LIVE montados (+OpenAPI +contract doc): `oracle` (medianizador Binance/Coinbase/CoinGecko, disyuntor 1.5%),
  `alerts` (Telegram sanitizado), `referrals` (`/api/referrals`, contabilidad `REFERRAL_LIABILITY`),
  `launchpad` (`/api/launchpad`, preventa con escrow), `kyc` (`/api/kyc`, webhook Persona HMAC + rawBody),
  `governance` (`/api/governance`, **Maker-Checker**: maker≠checker, techo $20k, checker 2FA, executor registry, TTL).
- Suite unitaria: **481 verde, 0 regresiones**.

## 7. Trabajo pendiente (orden sugerido — ajustá con criterio y §5)

1. **App-router cutover** (autónomo): `src/app/` como entry, montar admin operator-guarded, `npm run build` verde.
   Luego portar páginas legacy faltantes (home/marketing) en TS y borrar legacy.
2. **TOTP para todos** (auth sensible, vos): enrollment QR + verificación (`otplib`), migrar login + el segundo
   factor del checker Maker-Checker. Contract doc + tests.
3. **Cablear executors Maker-Checker** al camino de retiros grandes (>$5k dual, $20k techo). Money-path, vos.
4. **Tron TRC20 adapter** (testnet, vos): derivación BIP44 `195'` (NUEVA, no congelada), gas-station sweeping,
   19 confirmaciones/SOLIDIFIED, detrás del switch testnet/mainnet. Stub TronGrid.
5. **AWS KMS / Secrets Manager** (código + IaC, sin desplegar, vos): custodia de claves, esquema Hot/Cold.
6. **On-ramp Transak** (backend URL firmada, resolviendo address server-side) + modal frontend.
7. **Google GIS** en el auth TS (env client id).
8. **Tiers + gating visual** (Tier 0 solo lectura), **Stop-Limit/OCO** trading, **Admin a profundidad**
   (todo business config editable), resto del roadmap.
9. Google GIS, i18n a 5 locales, integración tests money-path donde amerite.

## 8. Respaldo ante corte de créditos de Claude

Hay (o creá si no existe) un **routine/cron de respaldo** que reanuda este programa periódicamente leyendo
`AUTONOMOUS_PROGRESS.md` + este `HANDOFF.md`, para que si la sesión muere por créditos, el trabajo se retome cuando
renueven. Cada disparo gasta créditos de Claude (aceptado por Abner solo como fallback). Si Abner está por volver,
puede desactivarlo.

---

**Recordá:** verificás todo vos, money-path/seguridad es tuyo, ráfagas sin polling pagado, actualizá el progress log,
y no vuelvas a preguntar lo que ya está en §5. Arrancá invocando `orchestration` y leyendo `AUTONOMOUS_PROGRESS.md`.
