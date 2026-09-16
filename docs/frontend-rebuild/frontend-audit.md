# Frontend rebuild audit

**Date:** 2026-09-16  
**Scope:** the Vite/TypeScript application currently loaded by `src/main.tsx`, the
legacy CRA application under `src/`, and the backend contract recorded in
[`backend-contract-changes.md`](./backend-contract-changes.md). This is a static
audit. It does not claim that a request succeeds until the replacement feature
has an integration test against the test backend.

## Executive assessment

The legacy frontend is not a safe migration target. Its API namespace predates
the backend module rename, money handling discards decimal precision, and the
styling model has no component boundary. The new Vite entry point is a suitable
foundation, but it deliberately contains placeholders; it is not yet a usable
exchange UI.

The rebuild must be a replacement, feature by feature. Do not re-enable a
legacy page simply because it renders: rendering is not evidence that its
backend contract, money semantics, authorization flow, or accessibility still
work.

## Findings

### P0 — do before enabling a money-moving screen

| Finding | Evidence | Required resolution |
| --- | --- | --- |
| Legacy monetary code loses precision. | There are 99 `parseFloat` uses under `frontend/src`, including swap, trading, transfer, withdrawal, P2P, balance valuation, and display helpers. The live API contract returns canonical decimal **strings**. | Remove all legacy money helpers from the new bundle. Use a decimal library for arithmetic and an exact string formatter for display. Network request/response money fields remain strings. |
| Idempotency is absent from legacy money requests. | `Idempotency-Key` has zero occurrences in the legacy client. The backend requires it for order, withdrawal, user transfer, swap, and Funding↔Spot transfer POSTs. | Every user intent owns a generated UUID, disables its submit control while pending, and reuses that UUID only for a retry of that same intent. Implement this in the shared mutation client, never ad hoc per page. |
| Legacy API routes are stale after the backend rename. | `src/api/endpoints.js` calls `/usuario/*`, `/criptomoneda/*`, `/transferencia/*`, and `/transactions/withdraw`; `backend/routes/index.js` mounts `/user`, `/crypto`, `/transfer`, and `/transaccionBlockchain`. | Retire `endpoints.js`; define typed endpoint modules beside their feature, with contract tests before a feature page is released. |
| The active authentication design stores a bearer JWT in `localStorage`. | Both the legacy `api/client.js` and the new `features/auth/AuthProvider.tsx` read/write `token` there. | Treat this as a security-design dependency, not a cosmetic frontend fix. Move to an `HttpOnly; Secure; SameSite` cookie plus CSRF design when the backend auth contract is changed. Until then, minimize XSS surface, never persist PII or tokens elsewhere, and do not call this production-ready. OWASP explicitly advises against storing JWTs/session identifiers in web storage. [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) |

### P1 — blocks a correct, trustworthy user experience

| Finding | Evidence | Required resolution |
| --- | --- | --- |
| Contract changes made in the backend are not represented in UI state. | Legacy balances assume one balance per asset; they do not model `funding`, `spot`, or `pending`. Profile/KYC UI uses an obsolete mock submission and fields such as `nombreCompleto`/document number rather than the current profile and provider-driven KYC flow. | Model the current balance shape and its missing-as-zero rule. Build funding↔spot transfer before trading; deposits show pending separately; withdrawals only offer Funding. Profile uses `displayName`, `pais`, `estado`, and `locale`; KYC is a provider flow, never a free-form PII mock. |
| Error handling is presentation-driven rather than contract-driven. | Legacy services branch on heterogeneous response shapes, toast raw messages, and emit 331 `console.*` calls. The backend has canonical `{ error: { code, message } }` errors. | Create a single `ApiError` decoder and i18n `code → message` catalog. Log sanitized, structured diagnostics only in development/approved telemetry; never surface unknown backend strings as product copy. |
| Important authentication routes are missing or misleading. | The legacy login links to `/forgot-password`, but `App.jsx` has no matching route. Email change, reset-password, recovery-code, and Google Identity Services flows are not represented as complete pages. | Rebuild account journeys together: register → verify email → login/2FA → recover password → email change confirmation. Google sign-in sends only the verified GIS `idToken`; never recreate the old client-supplied identity payload or JWT-in-query behavior. |
| Client routing is inconsistent with domain routing. | Legacy `/p2p/transaction/:id` is a page route but is also stored as `P2P_TRANSACCION_DETAILS` as if it were an API endpoint. New protected page names (`wallet`, `trade`) are intentionally placeholders and do not yet match a product information architecture. | Keep browser routes and API paths in separate modules and types. Define public, authenticated, verified-email, and operator routes explicitly. |
| New i18n is not yet functional. | `src/i18n/config.ts` has empty resources, no UI consumes translations, and `index.html` is fixed to `lang="en"`. | Translate all fixed copy from day one, set document language from the selected locale, format dates/numbers in the render layer, and localize inputs before converting them to canonical decimal strings. |

### P2 — architecture, maintainability, and visual-system debt

| Finding | Evidence | Required resolution |
| --- | --- | --- |
| Two applications coexist in `src/`. | Vite enters through `main.tsx`; CRA `index.js`/`App.jsx`, 121 JS/JSX files, and 38 stylesheet files remain. | The legacy subtree is reference-only until each replacement passes contract and UX acceptance. Delete a legacy feature in the same commit that replaces it. Do not import legacy services, hooks, contexts, or CSS into the new application. |
| CSS has global coupling and conflicting ownership. | `styles/global.css` imports duplicate font families and globally changes headings, inputs, scrollbars, `.container`, and `.card`; page styles repeat generic selectors such as `.form-group`, `.loading-spinner`, and modal classes. | Use a minimal global reset/tokens layer plus CSS Modules per component/page. Global selectors are reserved for tokens, reset, typography defaults, and accessibility primitives. CSS Modules provide the required component boundary; global CSS otherwise matches every node in the tree. [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scoping) |
| Test coverage is not commensurate with financial flows. | The new app has three unit assertions for exact formatting; the legacy frontend has no maintained component or end-to-end suite. | Add unit tests for API/money parsers, component tests for every form state, and Playwright golden flows before enabling wallet, swap, trading, P2P, or withdrawal pages. |
| The mobile navigation hides primary navigation without an alternative. | `src/app/global.css` hides `nav` below 700px. | Build an accessible menu with focus management, Escape-to-close, visible current location, and 44px touch targets. WCAG 2.2 also requires visible focus and at least 24px minimum pointer targets at AA. [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) |

## Backend-route compatibility matrix

The legacy constants must not be migrated mechanically. These namespace changes
are confirmed by `backend/routes/index.js`:

| Legacy namespace | Current backend namespace | Status |
| --- | --- | --- |
| `/usuario/*` | `/user/*` | Broken legacy calls: profile, register, login, verification, password, profile update, and search. |
| `/criptomoneda/*` | `/crypto/*` | Broken legacy calls: asset catalog, symbols, icon generation, P2P asset lookup. |
| `/transferencia/*` | `/transfer/*` | Broken legacy calls: create, history, funds verification, resend/process. |
| `/transactions/withdraw` | `/transaccionBlockchain/withdraw` | Broken legacy withdrawal. |
| `/balances/*` | `/balances/*` | Namespace retained, but response shape changed to consolidated totals plus compartments. |
| `/direccionDeposito/*` | `/direccionDeposito/*` | Namespace retained; verified-email requirements and address lifecycle must be respected. |
| `/intercambioExchange/*` and `/parExchange/*` | unchanged | Namespace retained; money fields are strings, swap execution needs idempotency, preview remains indicative. |
| `/trading/*` | unchanged | Namespace retained; orders use Spot and require idempotency. Legacy chart constants are reversed and `PAIR_STATS` has an extra `/i`. |
| `/ofertaP2P/*`, `/transaccionP2P/*` | unchanged | Namespace retained; state-machine errors are typed 4xx and must drive UI state. |

## Adopted rebuild standards

### Folder and dependency boundaries

```text
src/
  app/                 # providers, router, shell, global styles only
  features/
    auth/ wallet/ swap/ trading/ p2p/ profile/ admin/
      api.ts           # feature-local endpoint functions and DTO mapping
      queries.ts       # TanStack Query keys/hooks
      components/      # feature-private UI
      routes.tsx       # page composition and guards
      *.test.tsx
  shared/
    api/               # fetch transport, ApiError, auth/session seam
    money/             # canonical decimal parsing, comparison, display
    i18n/              # locale, translations, error-code copy
    ui/                # accessible primitives only (Button, Field, Dialog)
    styles/            # tokens.css, reset.css, a11y.css
    types/             # cross-feature DTOs; no backend model copies
  pages/               # thin route entry points only
```

- A feature may import `shared/*`, its own files, and public feature contracts;
  it may not import a sibling's implementation.
- HTTP access goes through `shared/api`; no direct `fetch`, Axios instance, or
  `window.location` in a feature component.
- Query keys and invalidation are declared centrally per feature. A mutation
  invalidates exactly the balances/history queries affected by its backend
  transaction.
- Use TypeScript DTOs at the API boundary; map them before UI rendering.
- Every new endpoint or client-visible contract change updates OpenAPI and
  `backend-contract-changes.md` in the backend commit.

### CSS and visual rules

- Use **CSS Modules** (`Component.module.css`) for all component/page styles.
  No new `src/styles/` page files and no generic global class names.
- `shared/styles/tokens.css` is the only owner of color, spacing, typography,
  elevation, radius, z-index, and motion tokens. Component code uses tokens;
  it does not invent raw hex values or spacing scales.
- `reset.css` and `a11y.css` are the only global selector files. They define
  `:focus-visible`, reduced motion, semantic element defaults, and no visual
  business components.
- Components have loading, empty, error, disabled, and success states designed
  before happy-state polish. Money confirmations are inline and persistent;
  toasts are supplementary, never the sole status channel.
- Meet WCAG 2.2 AA as the minimum: keyboard operation, semantic labels,
  visible focus, error association, live status messaging, contrast, and
  24px minimum targets. Use 44px for primary mobile actions.

### Money and mutation rules

- API money is a canonical decimal string. Never use `Number`, `parseFloat`,
  unary `+`, or native arithmetic for money. A decimal library is mandatory
  where arithmetic/comparison is needed.
- Locale formatting happens only at the render edge. Amount inputs parse the
  user locale into a validated canonical string before submission.
- A money mutation has: validated canonical values, an idempotency key,
  pending/duplicate/retry states, an explicit confirmation, and query
  invalidation after success. The UI must not optimistically invent a balance
  before authoritative server data returns.
- Swap clearly states that a preview is indicative until quote-lock/slippage
  support arrives. Trade explains that it consumes Spot; withdrawal explains
  that it consumes Funding and may be unavailable during email-change cooldown.

## Page-by-page replacement order

| Slice | Pages/journey | Exit criteria |
| --- | --- | --- |
| 0 | Shared API, exact money, i18n, accessible UI primitives, session seam | Contract tests for route/path/header/body mapping; no legacy imports. |
| 1 | Account: register, verify email, login/2FA, password recovery, Google | All server auth states are actionable; no missing routes; errors by code. |
| 2 | Wallet: balances, Funding↔Spot transfer, deposit address/history, withdrawal | Correct compartments and pending balances; money mutation/idempotency tests; withdrawal guard states. |
| 3 | Swap | Indicative quote disclosure, daily-limit feedback, canonical amounts, idempotent execution. |
| 4 | Spot trading | Funding→Spot prerequisite, received-asset fee explanation, order lifecycle and accessible market data. |
| 5 | P2P | Offer creation, accept, payment confirmation, completion/cancel state machine, typed 4xx recovery. |
| 6 | Profile and security | Display name/locale/profile edits, email change + cooldown messaging, notifications; KYC provider handoff only when §4.7 exists. |
| 7 | Admin | Least-privilege routing, operator MFA state, business config, AML/KYC/audit operations. |
| 8 | Home/marketing and legacy removal | Responsive marketing UX; every replaced legacy page, service, hook, context, and stylesheet deleted. |

## Release gates for every slice

1. Typecheck, unit/component tests, and production build pass.
2. A contract test covers each request shape, typed error, and money header.
3. Keyboard-only and mobile viewport checks pass; visible focus is not hidden.
4. A user cannot submit a money operation twice, mistake Funding for Spot, or
   interpret pending funds as spendable.
5. The legacy equivalent is removed only after the replacement passes its
   feature-level acceptance test.

## Follow-up scope outside the frontend

The cookie/CSRF migration, Google redirect-token removal, KYC provider
integration, and quote-lock are backend/security roadmap work. The frontend
must be designed for them now but must not fake their security guarantees.
