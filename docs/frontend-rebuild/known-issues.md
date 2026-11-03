# Next.js `web/` migration — known issues & backlog

> Living doc. Captures (A) real bugs found & fixed during slice reviews, (B) known gaps / go-live must-fix items, and (C) the non-blocking Minor backlog for the transversal front-polish/a11y pass. Updated 2026-10-13 (through Slice 6). `dev == main == origin`; main NOT deployed (the CRA `frontend/` serves prod until the S8 nginx flip).

---

## A. Real bugs found in review and FIXED (lessons)

These were caught during per-task review, not in production. Documented so the pattern isn't repeated.

1. **NotificationsView — CSS was a plain-string object, not a CSS module → styling dead in prod** (Slice 6 Task 8, fixed `052cf91`).
   - The component defined `const notifStyles = { unread: 'notifItemUnread', ... }` (plain JS strings) and used `className={notifStyles.unread}`. Those classes were **not defined** in any `.module.css`, and CSS-module class names are hashed at build — so the notification styling, **including the unread highlight (a contract requirement), did not apply in the real app**.
   - The unit test passed anyway because it asserted `className` matched `/unread/i`, which the literal string `'notifItemUnread'` satisfied — a green test over a broken feature.
   - **Fix:** defined 11 real classes in `profile.module.css` and referenced them via the `styles` module import.
   - **Lesson:** className strings must come from a real `import styles from './x.module.css'`. A test asserting a class is present must go through the same module the component uses (this project's Vitest resolves module classes to strings containing the name, so `styles.txPending` → matches `/pending/i`) — never hand-roll a string object.

2. **KycStatusCard — query-error branch rendered the "Loading…" key inside the red error box** (Slice 6 Task 9, fixed `d9a2014`).
   - On a failed `GET /kyc/status`, the `role="alert"` / `styles.error` paragraph rendered `t('common.loading')` ("Loading…"). A user saw "Loading…" in red on failure.
   - The test only asserted the alert existed (non-empty), not its text — so it slipped through.
   - **Fix:** added `common.error` to both catalogs and used it; strengthened the test to assert the error copy (not the loading copy).
   - **Lesson:** error-state tests must assert the error TEXT, not just that an alert node exists.

3. **Minor review fixes applied inline during the slices** (not prod bugs, caught at review): P2P `deleteOffer` used the wrong client verb `del` → `delete` (S5 T1); P2P accept form showed the crypto **UUID** instead of the resolved symbol + rendered the `fiatOwed` i18n copy without its `{{amount}}/{{fiat}}` params (literal placeholders) + missing seller-side disclosure (S5 T6, `d6fb813`); ProfileForm locale option labels were hardcoded `English`/`Español` bypassing i18n (S6 T4, `92ea90e`); P2P mutations relied on the v5 default for no-retry → made `retry:false` explicit (S5 T2).

---

## B. Known gaps / GO-LIVE must-fix (block the S8 nginx flip, per [[frontend-nextjs-migration]] + HANDOFF §RESUME HERE 🚦)

1. ~~**Idempotency by INTENT on every money mutation.**~~ ✅ **DONE** (`web/src/shared/api/idempotencyManager.ts` + hook wiring). A per-mutation-hook manager maps each distinct payload fingerprint to a stable `Idempotency-Key`: reused on a manual retry of the identical payload (so the backend dedups instead of double-spending), a new key when the payload changes (avoids backend 422 `IDEMPOTENCY_KEY_REUSED`), and rotated (`reset()`) on success (so a later legitimately-identical op runs fresh). Wired into `useExecuteSwap`, `useCompartmentTransfer`, `useWithdraw`, `usePlaceOrder`, and `useAcceptOffer`. Covered by `idempotencyManager.test.ts` + `swap/queries.idempotency.test.tsx`.
2. ~~**⚠️ P2P accept has NO backend idempotency.**~~ ✅ **DONE** (backend + client). The idempotency middleware is now mounted on `POST /transaccionP2P` (`IDEMPOTENCY_KEY_REQUIRED` without the header; replay on same key; `422 IDEMPOTENCY_KEY_REUSED` on same key + different body). The key is completed **inside the fund-block transaction** (`P2PTransaction.createTransaction` finalize hook → `finalizeInTransaction`), so a crash in the post-commit window cannot leave it reclaimable and re-run. Client: `/transaccionP2P` in `isMoneyEndpoint` + `useAcceptOffer` per-intent key. Covered by `idempotencyP2PAcceptWiring.test.js` (unit), `transaccionesP2P.model.test.js` (finalize-in-tx), and `transaccionesP2P.integration.test.js` (double-submit blocks funds once + 422 on reuse — ✅ **VERIFIED end-to-end on the Postgres harness, 11/11 green** 2026-10-14).
3. ~~**`(app)` guard is not reactive / does not check `emailVerified`.**~~ ✅ **DONE** (`web/app/(app)/layout.tsx`). `authed` is now React state seeded from `session.hasToken()` and updated via `session.onUnauthorized` → a 401-driven token clear anywhere re-renders the guard and redirects to `/login`. An authenticated-but-unverified user (`user.emailVerified === false`) is redirected to `/verify-email` (optimistic render while the user query loads). Covered by `app/(app)/guard.test.tsx` (5 cases).
4. ~~**Playwright E2E of all money flows** (auth/wallet/swap/trading/p2p) green.~~ ✅ **DONE** (2026-10-14, 8/8 green). The harness is **route-stubbed** (`page.route('**/api/...')` returns canned JSON against the Next dev server — no backend/DB needed), so it runs on the dev box. Specs: `e2e/{auth,wallet,swap,trading,p2p}.spec.ts` + shared `e2e/support.ts`. Each money flow drives the real UI (login via UI → nav-link SPA navigation to avoid a hydration mismatch) and **asserts the `Idempotency-Key` header is attached** on the money POST (transfer/withdraw/swap-execute/place-order/p2p-accept). Run with `npm run e2e` (in `web/`). NOTE: pre-seeding a token + `page.goto` a protected page triggers a Next-dev hydration-overlay (SSR renders null without the token, client renders the nav) — tests log in through the UI instead.
5. **Evaluate Next 16 / React 19** — ✅ **EVALUATED** (2026-10-14). `next build` on **14.2.35 succeeds** (17 routes, incl. `/admin` + `/verify-email`). `npm audit` flags critical/high advisories on the 14.x line **with no 14.x fix** (14.2.35 is the latest 14.x; the fix is Next 16.x, which requires React 19 — in conflict with the LOCKED React 18/Next 14.2.35 port decision). **Applicability is LOW for our deployment:** the app uses **none** of the vulnerable features — no `next/image` (Image-Optimizer DoS / `remotePatterns` SSRF / image-cache growth N/A), no `rewrites` (request-smuggling N/A), no `middleware` file (proxy cache-poisoning / i18n-bypass N/A), no `beforeInteractive`/CSP-nonce (those XSS N/A). Residual surface = RSC DoS/cache-poisoning, mitigated since the authenticated app is client-rendered and public pages are SSG. **DECISION (Abner, 2026-10-14): launch on 14.2.35**, schedule the Next 16/React 19 migration as post-launch hardening. "Run the build/SSR on the 1 GB EC2 box" remains a deploy-env step (no EC2 access locally; `output:'standalone'` build is proven locally).
6. **`npm run check:operator-mfa` green** + set `external_symbol` on USD(T) pairs. **Deploy-day OPERATIONAL step** (not a code task): the script authenticates against the live DB and verifies ≥2 operators self-enrolled TOTP — it can only pass against the deploy database (no operators/DB locally). The gate tooling already exists and works (`backend/scripts/checkOperatorMfaReadiness.js` + `operatorReadiness.service`). Run it on deploy day after operators enroll; set `external_symbol` on USD(T) pairs if the swap oracle breaker is enabled.

---

## C. Non-blocking Minor backlog (transversal front-polish / a11y pass)

Grouped by theme; none block a merge. Pull these into the dedicated polish pass (and the a11y refactor to a shared `useFormError()` + per-field `aria-describedby`).

### C1. Recurring code smell — unnecessary `error as { code?: string }` casts
The mutation/query error is already typed `ApiError`, so `(error as { code?: string }).code` / `(error as { requestId?: string }).requestId` casts are redundant. Present in: swap SwapForm, profile TwoFactorSettings (`activeError`). ~~trading OrderForm~~ (fixed), ~~P2P AcceptOfferForm / TransactionDetail / MyOffersView / CreateOfferForm~~ (fixed in the P2P redesign 2026-11-02 — all use `mutation.error.code` / typed `ApiError | null` now). ChangePasswordForm/EmailChangeForm/KycStatusCard already do it right (`mutation.error.code`, no cast). **Consolidate** the remaining two, or extract a shared `errorMessage(err: ApiError)` helper.

### C2. a11y
- Tabs (wallet WalletTabs, profile ProfileTabs): no roving-tabindex arrow-key nav (buttons are Tab+Enter focusable — acceptable, but not ARIA-ideal). ~~p2p P2PTabs~~ (P2P tabs kept as plain `role=tab` buttons; the segmented buy/sell toggle in OffersList is a `radiogroup`/`tablist` — acceptable).
- ~~CreateOfferForm: empty `<legend>` on the buy/sell fieldset~~ (FIXED 2026-11-02: the fieldset has a real `<legend>` = `p2p.create.typeLegend` + `role=radiogroup` with `aria-label`).
- Shared `useFormError()` + per-field `aria-describedby` refactor (go-live a11y item).

### C3. Test hygiene / coverage gaps
- P2P queries: 9 hooks untested for wiring (only 3 mandated). P2P api: `getOffers`/`getOffer`/`getMyOffers`/`getTransaction`/`toggleOffer` untested.
- Profile queries: `useMarkRead` invalidation + `useRequestEmailChange` arg untested; `useUnreadCount` typed `{count}|number` (union leaks indecision).
- NotificationsView: `markUnread`/`deleteRead` `isPending` not tested.
- KycStatusCard: mutation-error test asserts non-empty, not exact `tError` content.
- CreateOfferForm: dead `fillCommonFields` helper in the test (latent-buggy — delete).
- OffersList: dead `usePaymentMethods` mock in the test.
- OfferDetail: buy fixture uses `direccionFiat: null` → weaker gate coverage (doesn't prove the gate is type-driven).
- ProfileForm: no direct locale-prefill assertion.
- ChangePasswordForm: `isSameAsCurrent` disables submit silently (no advisory key).
- EmailChangeForm: no empty-field gate on the request step (server-authoritative); `done` step is terminal (remount to redo).

### C4. UX / cosmetic
- Swap: pair-level `oraclePaused` shows empty-quote text, not an explicit paused message (mitigated by the PairSelect pause marker + disabled submit + the 503-from-execute panel); SwapHistory renders a raw ISO date (no shared formatDate util); `check-limit` fires per quote keystroke.
- Trading: RecentTradesView collapses error→empty (weaker than OrderBook); OrderBookView can render a negative spread on a crossed book (needs `Math.abs`/guard); two pair selectors (widget vs form — documented MVP trade-off); duplicate order-book table header; orderbook poll cadence 5s vs 10s; dead `parsedQty.ok` branch in the sell path; client 8-decimal cap vs pair precision (conservative, server authoritative).
- ~~P2P~~ (REDESIGNED 2026-11-02 to the standard): ~~empty-state rendered below the tab/filter chrome~~ (now `EmptyState` primitive); ~~reuses `wallet.history.type` for the role column~~ (own `p2p.myTx.buyer/seller` Badge); ~~TransactionDetail status is a single label~~ (now a visual **stepper**); ~~MyOffers/OffersList "Buy/Sell" header~~ (now a single **`p2p.offers.type`** column with a Badge). Still present (benign): OffersList uses a literal `–` range separator; default browse tab = `sell` (kept — product choice); MyTransactionsView `new Date()` in render (fine — `'use client'`).
- Profile: ProfileTabs single-component panels lack the `styles.panel` wrapper (spacing inconsistency vs the security tab).
- `es` catalog: `profile.notifications.type.exchange` = `'Exchange'` (product-name autonym — acceptable).

### C5. Shared-code DRY (extract later)
- TradingPairSelect is a near-copy of swap/PairSelect; a `num()` formatter is duplicated → extract a shared pair-select + number formatter.
- `TradingPairDTO`/`TradingPair` field duplication (intersection type).

### C6. Admin (Slice 7) — from per-task + final `/code-review` (all Minor; 0 Critical/Important)
> **Admin redesigned to the standard 2026-11-03** — the visual items below are fixed; the remaining (non-visual / behavioural) ones are kept.
- ~~**Empty-state copy renders a heading/column i18n key**~~ (FIXED): `AmlOps` denylist/cases now use `admin.aml.denylist.empty` / `admin.aml.cases.empty`; `AuditViewer` uses `admin.audit.empty` (all added en/es via `EmptyState`).
- ~~`UsersAdmin` `colSpan={isSuperAdmin ? 1 : 0}` emits an invalid `colSpan=0`~~ (FIXED): the mutation error now renders in its own row with `colSpan={totalCols}`.
- ~~Native `<select>`~~ (FIXED): AmlOps cases filter + BusinessConfig type are now the custom `Select`.
- ~~`error as {...}` casts~~ (FIXED in all admin panels) + ~~`admin.module.css` on legacy `--color-*`/`--space-*`~~ (FIXED: migrated to standard tokens) + ~~`common.cancel`/`common.confirm` hardcoded fallbacks in UsersAdmin~~ (FIXED: `common.confirm` added, fallbacks dropped).
- `GovernanceInbox` uses one shared approve/reject mutation instance for the whole list → `anyPending` disables every row's buttons during any single action (false-busy at scale; fine for a short inbox). Consider per-row mutation state.
- `api.ts` `getConfig`/`getCases`/`getAudit` query-param values are not `encodeURIComponent`'d (safe for current values; inconsistent with `searchUsers`).
- `es` catalog: `admin.readiness` "enrollados/enrollar" → rioplatense "enrolados/enrolar".
- `AuditViewer` eventType filter fires on every keystroke (no debounce); `appendedBeforeId` ref not reset on a background refetch (benign for an immutable log).
- `UsersAdmin` `common.cancel`/`common.confirm` hardcoded string fallbacks (keys outside `admin.*`); business-config edit row stays open after a successful save; `AdminGate` redundant `user !== undefined` guard (harmless); legacy `AdminUser.dailyLimit` shim (drop once the backend emits `dailyLimitUsd` exclusively); `admin.module.css` tab rules one-line density.

### C7. Go-live gate self-review follow-ups (2026-10-14, all Minor — 0 bugs)
From the `/code-review high` of the §B.1–B.3 gate diff. The two confirmed correctness findings were fixed in-branch (logout-redirect regression + the `undefined`/`null` fingerprint edge); these remaining items are quality-only:
- **DRY** — the five money-mutation hooks (`useExecuteSwap`, `useCompartmentTransfer`, `useWithdraw`, `usePlaceOrder`, `useAcceptOffer`) each repeat the same idempotency wiring (`const idem = useIdempotencyKey()` + `idem.keyFor(vars)` in `mutationFn` + `idem.reset()` in `onSuccess`). All five are correct today (verified: every one has both `keyFor` and `reset`), but a shared `useMoneyMutation(fn, { invalidate })` that bakes in keyFor+reset would make a future omission impossible. Extract in the polish pass.
- **Guard no-ops on a non-401 `/me` failure** — if `useCurrentUser` errors with e.g. 503, `user` stays `undefined`, so `mustVerifyEmail` is false and the `(app)` layout renders optimistically. An unverified user on a flaky backend would briefly get app access. Low risk (freshly-registered = no funds; every money POST is backend-guarded by `requireEmailVerified`), and blocking-on-error would lock out *verified* users on any transient `/me` hiccup — a worse trade-off. Left as optimistic-on-error by design; revisit if the frontend gate ever needs to be authoritative.
- Minor/cosmetic (no action): `isMoneyEndpoint` P2P pattern `/\/transaccionP2P$/` has no explicit `/api/` variant like the other 5 (it already suffix-matches both, so it's actually *more* robust); `retry:false` is set explicitly on some mutation hooks and inherited from the global default (`providers.tsx`) on others — consistent behavior, inconsistent style; the P2P `finalizeInTransaction` is injected via a model `options.finalize` callback (forced by the model owning its own tx) rather than called directly like the other controllers — correct but a unique pattern, already commented.

---

## D. Backend bugs found during the rebuild (DEFERRED — not touched, need a backend session)

These are **real backend bugs** surfaced while rebuilding a page. Per the methodology the
frontend sessions do **not** touch the backend; Abner decides whether/when to fix. Logged here
so they are not lost.

1. **🔴 Withdrawals are broken server-side — `validateWithdrawal` references an undeclared `balance`** (found 2026-11-02, wallet rebuild; **Abner's decision: do NOT fix now**).
   - `backend/modules/wallets/blockchainTransaction.model.js` (~line 887): `validateWithdrawal` returns `{ valid: true, …, usuario, crypto, balance }`, but `balance` was never declared in scope — the `findOne` that defined it was removed in the ledger write-flip. Reading an undeclared identifier throws `ReferenceError`, caught by the function's own `try/catch`, which returns `{ valid: false, message: 'Error en validación: balance is not defined' }`.
   - **Effect: every withdrawal fails with `400 WITHDRAWAL_VALIDATION_FAILED` — in production too** (`bitflow.community`). The withdraw path is dead until fixed.
   - **Fix (when scheduled): one line** — drop `balance` from the returned object (and `fee`/`usuario`/`crypto` are the only fields callers use; `createWithdrawal` re-reads balances itself). It is **money-path → run `/code-review high effort`** and treat as a backend task, separate from the frontend redesign.
   - **Frontend status:** the redesigned withdraw UI (Select + Max + rounding + honest "requested/under review" flash) is complete and verified against a **mocked** success in `e2e/wallet.spec.ts`. The live flow stays broken until the backend fix.

---

## How to use this doc
- Before the **S8 go-live flip**, section B must be fully green (that is the gate).
- The **transversal front-polish/a11y pass** (sprint item, run when convenient) burns down section C.
- When an item is fixed, delete it here (or move a B item to A with its fix commit).
