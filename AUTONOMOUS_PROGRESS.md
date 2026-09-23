# Autonomous run — progress log

**Started:** 2026-09-23. Coordinator: Claude (Opus). Abner is away for several days; full autonomy.

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
