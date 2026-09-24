# Autonomous run — progress log

**Started:** 2026-09-23. Coordinator: Claude (Opus). Abner is away for several days; full autonomy.

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

- **NEXT:** dev→main merge per §5 authorization (review green).


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
