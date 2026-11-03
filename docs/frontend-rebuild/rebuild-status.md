# Estado del rehacer del frontend + roadmap de páginas

> Vivo. Qué páginas están rehechas al **estándar nuevo** (el de swap) y cuáles
> faltan. Leé junto a [`redesign-methodology.md`](./redesign-methodology.md)
> (proceso) y [`aesthetic-standard.md`](./aesthetic-standard.md) (estética).
> Lecciones y gotchas de la sesión de swap:
> [`lessons-swap-session.md`](./lessons-swap-session.md).

Última actualización: **2026-11-02** (fin de la sesión de P2P).

---

## El "estándar nuevo" (lo que define una página terminada)

Swap es la **implementación de referencia**. Una página se considera rehecha
cuando cumple, además de la paridad V1 / tech V2:

- **Tokens de estética** (`src/shared/styles/tokens.css`): `--bg-*`, `--brand-*`,
  `--text-*`, `--radius-*`, `--font-num` para cifras; dark por defecto + toggle.
- **Primitivo `Select`** (nunca `<select>` nativo): soporta `searchable` y slot
  `meta` (ej. saldo); íconos con `CoinLogo` (monograma siempre + imagen CDN).
- **Money-path**: `@/shared/money` string-math; **redondear a la precisión que
  acepta el backend antes de mandar** (swap: 8 decimales). Nunca `Number()` salvo
  estimaciones de display sancionadas.
- **`SuccessFlash`** (`useSuccessFlash().flash()`): **todo botón que finaliza una
  transacción** dispara el flash azul full-screen en `onSuccess`. No reinventar.
- **Paneles nunca vacíos** (mostrar estructura/tasas aunque los montos sean 0),
  **copy honesta** (no filtrar códigos de error, no prometer lo que el backend no
  hace), `:focus-visible` + `prefers-reduced-motion` en todo movimiento.
- **Verificación en vivo** (Playwright + screenshots) antes de decir "terminada".
- **e2e route-stubbed**: stubear **todo** GET autenticado que la página dispara
  (si no, el 401 real desmonta `(app)`); `gotoApp` scopeado a la navbar primaria.

---

## Roadmap de páginas

| # | Página | Ruta | Caso | Estado |
|---|--------|------|------|--------|
| — | Home | `/` | — | ✅ hecho (referencia estética inicial) |
| — | Auth (login/register/verify-email/forgot-password/auth-success) | `/(auth)/*` | A | ✅ hecho (paridad visual V1) |
| — | Navbar + Footer (todas las páginas) | layout | — | ✅ hecho |
| — | Tema dark + toggle | global | — | ✅ hecho |
| — | **Swap** | `/swap` | C→nuevo | ✅ **hecho a fondo** (referencia del estándar) |
| 1 | **Wallet** (balances, transfer, retiro, **depósito**, historial) | `/wallet` | **B** | ✅ **hecho** (verificado Playwright+screenshots, 2026-11-02) |
| 2 | **Trading** (order book, order form, trades) | `/trading` | B/C | ✅ **hecho** (terminal spot, selector único, verificado 2026-11-02) |
| 3 | **P2P** (ofertas, crear oferta, transacciones) | `/p2p` | B | ✅ **hecho** (marketplace + stepper de estado, verificado Playwright+screenshots 2026-11-02) |
| 4 | Profile (cuenta, seguridad/2FA, KYC, notificaciones) | `/profile` | B | ⏸️ **DIFERIDA** (Abner, 2026-11-03: saltar, no profundizar por ahora) |
| 5 | **Admin** (panel super_admin) | `/admin` | C | ✅ **hecho** (6 paneles al estándar, verificado Playwright+screenshots 2026-11-03) |

Todas las páginas de la 1 a la 5 ya tienen **feature V2 funcional** (componentes +
queries + tests); lo que falta es **rediseñarlas** al estándar de arriba, no
construirlas de cero.

### Orden sugerido
**Wallet → Trading → P2P → Profile → Admin.** Wallet primero porque es el core de
dinero (y donde viven depósitos/retiros).

### Páginas públicas del footer (hechas, básicas — 2026-11-02)
Creadas al shell compartido `app/_content/ContentPage` (reading-width, tokens,
navbar+footer del root layout): `/help`, `/academy`, `/status` (Recursos);
`/privacy`, `/terms`, `/cookies`, `/aml` (Legal, **placeholder + aviso de borrador**,
sin texto legal vinculante inventado); `/about`, `/news` (Empresa). Copy en español
(como el home marketing; no usan el catálogo i18n). Link `/terminos-y-condiciones`
del register reconciliado → `/terms`. **Omitidos a propósito:** `/blog` (decisión de
Abner) y `/download-app` (el home ya tiene sección de descarga + QR, la navbar no lo
linkea). Verificadas con `e2e/public-pages.spec.ts` + screenshots. Son páginas
básicas: no pasaron por el estándar completo del rebuild (no son money-path).

---

## Decisiones de producto fijadas

- **Depósitos: deshabilitados por ahora.** La pantalla de depósito (dentro de
  Wallet) muestra un **cartel de "servicio no disponible en tu región"** y no
  habilita el flujo real. Decisión de Abner (2026-10-31). No cablear depósito on-chain
  todavía.
- **Precio de swap**: NO está garantizado; se calcula en vivo al ejecutar (no hay
  quote-lock). El botón dice "Swap" (el recibo en vivo ES el review). Ver lecciones.
- **Límite diario de swap**: es un control **AML** (`users.daily_limit_usd`,
  default $1000). No se elimina del backend; para testear se sube el límite del
  usuario de prueba por DB. La UI no muestra el límite (sólo el error si se excede).

### Wallet (sesión 2026-11-02)
- **Retiro — estado real del backend**: NO es inmediato. La fila nace `pending` y
  puede quedar en hold por AML S5 (denylist) o **Maker-Checker** (USD > umbral $5k,
  techo $20k). Copy de éxito honesta = "solicitado, se procesa tras revisión" (flash
  `wallet.withdraw.flashTitle`), **nunca "enviado"**. Redondeo a **8 decimales**
  (Joi `precision(8)`, min `0.00000001`).
- **Transfer Funding↔Spot**: redondeo a `crypto.decimals` (cap 8) antes de mandar;
  `Idempotency-Key` ya cableado; éxito → `SuccessFlash`.
- **🔴 Bug de backend DIFERIDO (money-path, decisión de Abner 2026-11-02 = no tocar):**
  `validateWithdrawal` (`backend/modules/wallets/blockchainTransaction.model.js:~887`)
  arma su retorno con `balance`, variable **no declarada** (el `findOne` se removió en
  el write-flip) → `ReferenceError` atrapado → **todo retiro devuelve 400
  `WITHDRAWAL_VALIDATION_FAILED` ("balance is not defined"), incluido en prod**. El UI
  del retiro está rediseñado y verificado contra un retiro **mockeado** en e2e; el
  retiro en vivo sigue roto hasta una sesión de backend aparte. Ver `known-issues.md` §D.
- **Depósito**: deshabilitado (cartel región, `wallet.deposit.unavailable*`). El
  `DepositView` ya no llama a `/deposit-address`; el flujo real queda en git history.

### P2P (sesión 2026-11-02)
- **Caso B — marketplace entre usuarios.** 4 tabs: Browse · My Transactions ·
  My Offers · Create Offer. Chrome = header + pills (molde wallet).
- **Backend es la fuente de verdad** (sin tocar): rutas en español `/ofertaP2P/*`
  y `/transaccionP2P/*`. Máquina de estados real = `initiated → payment_confirmed →
  completed` (+ `cancelled` desde initiated/payment_confirmed). El enum DB tiene
  `crypto_locked` pero **nunca se asigna** (muerto). `POST /transaccionP2P` =
  money-path con **Idempotency-Key obligatorio** (dedup backend autoritativo).
- **Precisión monetaria (redondeo pre-envío):** oferta `minAmount`/`maxAmount` =
  `DECIMAL(18,8)` → **round(8)**; `unitPrice` = `DECIMAL(10,4)` → **round(4)**
  (el CreateOfferForm viejo NO redondeaba el precio → corregido); `amount` de
  aceptar = `DECIMAL(18,8)` → round(8). `fiatAmount` lo calcula el backend.
- **Estándar aplicado:** `Select` custom para método de pago (aceptar) y activo
  (crear); **chips toggle** para métodos de pago multi (no hay multi-select en el
  `Select`); filtro de activo por **pills** + toggle Buy/Sell segmentado; `CoinLogo`
  + `Badge` de tipo/estado; `SuccessFlash` en aceptar/crear/confirmar-pago/liberar;
  estados loading(skeleton)/empty/error con primitivos; **stepper de estado** en el
  detalle de transacción; `<legend>` del fieldset buy/sell con nombre accesible
  (fix §C2); casts `error as {...}` eliminados en P2P (fix §C1).
- **Decisiones:** tab por defecto = **Sell** (se mantiene; es product choice, no
  bug — invertir la semántica del filtro era riesgo innecesario). Columna única
  **Type** (badge) en vez del header "Buy/Sell" concatenado.
- **Gotcha e2e (arreglado, compartido):** `loginViaUI` stubeaba el login con
  `{ user: { username } }` **sin `id`** → el `useLogin` siembra la cache del user
  con eso y `staleTime` evita el refetch a `/me` → `currentUser.id` quedaba
  `undefined` y el gating buyer/seller del detalle no mostraba botones. El backend
  real devuelve el user completo en el login; se alineó el stub (`support.ts`) a
  devolver el user completo. Afecta a TODOS los specs que usan `loginViaUI`
  (verificado: p2p/wallet/swap/trading verdes).

---

## Próxima página — Profile (prompt de arranque)

Rediseñar `/profile` al estándar nuevo (molde Swap/Wallet/Trading/P2P). Es **Caso B**
(cuenta del usuario con datos del backend). La feature ya existe en
`web/src/features/profile/` (cuenta, seguridad/2FA TOTP, cambio de email/contraseña,
KYC, notificaciones) + queries + tests — se **rediseña**, no se construye.

**Lectura obligatoria antes de tocar:** `redesign-methodology.md`,
`aesthetic-standard.md`, este `rebuild-status.md` (el "estándar nuevo"),
`lessons-swap-session.md`, y `known-issues.md` (§C1 casts `error as`, §C2 a11y de
tabs/`useFormError`, §C4 Profile: `ProfileTabs` sin `styles.panel` wrapper, §C6
patrones de admin si aplica). Mirar la referencia viva en
`web/src/features/{swap,wallet,trading,p2p}/components/`.

**Investigar el backend ANTES de diseñar** (como siempre): endpoints de perfil,
seguridad (2FA TOTP enroll/verify/disable — ojo con el flujo de operator-MFA y el
`requireOperatorMFA`), cambio de email/contraseña (validaciones, pasos), KYC
(estados/niveles), notificaciones (marcar leído, contador). **2FA = Caso C** (no hay
V1). Reportar hallazgos antes de tocar UI.

**Alcance tentativo:** tabs al estándar (header + pills, con `styles.panel` wrapper
consistente); forms con `Field`/`Input`/`Select` custom + `SuccessFlash` en las
acciones que finalizan (cambio de email/contraseña, enroll/disable 2FA); badges de
estado para KYC; estados loading(skeleton)/empty/error; `KycStatusCard` ya arreglado
(error text, no "Loading…") — mantener; consolidar `error as {...}` casts (§C1).

**Cierre:** `npm run typecheck`, `npx vitest run --pool=forks src/features/profile`,
e2e afectados (si hay profile spec) + verificación en navegador con screenshots.
Commits Conventional en inglés sin atribución. Al terminar: marcar Profile ✅ acá y
dejar el prompt de **Admin** (la última antes de la 2ª pasada del Home).

### Admin (sesión 2026-11-03)
- **Caso C — panel super_admin interno, sin V1.** 5 tabs (Governance · Users ·
  Config · AML · Audit) al chrome estándar (header + pills). Superficie
  **seguridad/money-path** (Maker-Checker, AML, audit hash-chained): el rediseño
  es **100% visual**, sin tocar wiring/authz. Respetada la nota de seguridad del
  endpoint de users (devuelve el `token` del usuario target → NUNCA `setToken`).
- **Estándar aplicado:** tokens nuevos (antes `--color-*`/`--space-*`); `Badge`
  para estados (readiness ready/notReady, case open/resolved, user role/active/kyc,
  AML ON/OFF, operadores enrolled/pending); `Select` custom para el filtro de casos
  AML y el type del config (antes `<select>` nativo); `Input`/`Field` en todos los
  forms; `SuccessFlash` en approve/reject governance y resolve de casos AML;
  estados loading(skeleton+`role=status`)/empty(`EmptyState`)/error(`ErrorState`);
  tablas estándar con `tableWrap` (scroll horizontal en Users).
- **Bugs §C6 arreglados:** empty-states que renderizaban la **key del heading**
  (AmlOps denylist/cases → `admin.aml.*.empty`; AuditViewer → `admin.audit.empty`);
  `colSpan=0` inválido en UsersAdmin (el error ahora va en una fila propia con
  `colSpan={totalCols}`); `<select>` nativos → `Select` custom; casts `error as
  {...}` eliminados en los 4 paneles; `admin.module.css` migrado a tokens.
- **Gotcha e2e (shared, ya conocido de P2P):** el home dispara `GET
  /api/balances/my/balances`; sin stub → 401 → `notifyUnauthorized` limpia el token
  → navbar deslogueada (y el link **Admin vive en el dropdown de usuario**, no en la
  navbar primaria). Stubear balances en specs que lleguen a páginas autenticadas.
- Unit 623/623 + typecheck + screenshots de los 6 estados (incl. diálogo
  maker-checker TOTP). Pendiente de i18n: los labels de `User statistics` muestran
  las keys crudas del backend (`totalUsers`…) en MAYÚSCULA — cosmético, no i18n'd
  (stats son backend-driven); aceptable para herramienta interna.
