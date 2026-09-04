# Backend Security Baseline (evidence survey)

> **Prerequisite (2) of ROADMAP §4.0.** A factual inventory of the backend's
> security posture *today*, with `file:line`/test evidence, to seed the control
> mapping's `Status`/`Evidence` columns. Findings are facts, not assumptions.
> Living document — grows/corrects as the code changes. Paths are relative to
> `backend/` unless noted. Snapshot: 2026-09-04 (`dev`).

Legend — **State**: ✅ implemented · 🟡 partial · 🔴 gap.

## 1. Authentication — 🟡
- JWT (HS256) verified with `process.env.JWT_SECRET`; Bearer token, user loaded by id and checked `activo` — `middleware/authMiddleware.js:20-25,82-84`.
- **Logout invalidation:** tokens issued before `user.ultimoLogout` are rejected — `authMiddleware.js:28-30` (per-user timestamp, not a per-token blocklist).
- Email-verification gate `requireEmailVerified` (Google users auto-verified) — `authMiddleware.js:52-74`.
- Auth failures return 401 and log server-side; no internal detail leaked to client — `authMiddleware.js:46-49`.
- Full auth flows (register/login/verify/2FA-email/reset/Google OAuth) covered by integration tests — `tests/integration/auth*.integration.test.js`.
- 🔴 Gaps: no refresh-token rotation / short-lived access tokens; invalidation is per-user not per-token; JWT_SECRET strength depends on env provisioning; Google callback (path B) passes JWT in the redirect query string (Radar #12c, open).

## 2. Password storage — ✅ (with items to confirm)
- `bcrypt` hash on register / reset / change; `bcrypt.compare` on login — `models/usuario.model.js:3,77,120,297,422,728,738`.
- `passwordHash` excluded from user reads — `usuario.model.js:555,607`.
- Non-Google users cannot be created without a password hash (beforeCreate guard).
- 🟡 To confirm: `saltRounds` value (target ≥ 12) and any server-side password-strength policy.

## 3. Authorization — 🟡
- **Centralized policy layer (Fase 4.3, 2026-09-04):** `utils/authz.js` — `isAdmin`/`isSuperAdmin`/`owns`/`canAccessResource`, hierarchy-aware (normal < admin < super_admin), unit-tested (`tests/authz.test.js`). The scattered inline role checks across ~10 controllers (`req.user.rol !== 'admin'`, `['admin','super_admin'].includes(...)`) now delegate to it — this also fixed real inconsistencies (several sites treated `super_admin`, or the `Usuario` role, incorrectly).
- Route-level guards: `requireRole`, `adminMiddleware.isAdmin/isSuperAdmin`; money-path ownership checks (P2P, transfers) in controllers.
- Admin-route authorization bypass fixed and pinned — Fase 0 Críticos #7, `tests/intercambioExchangeAdminAuthz.test.js`.
- `requireKYC` / `requireActiveAccount` scaffolding for Fase 4.7 (not yet wired) — `authMiddleware.js:107-120`.
- 🔴 Remaining: consolidate the two role helpers (`authz.js` + `adminMiddleware`) so the middleware also uses `authz`; no privileged-access review; no least-privilege for operators/services (Fase 4.9).

## 4. Transport & HTTP headers — 🟡
- `helmet()` security headers — `app.js:50`.
- CORS allowlist enforced in production (`origin` callback); dev allows all — `app.js:34-48`. `credentials: true`.
- JSON body size limit `10mb` — `app.js:52`.
- Session cookie `secure`/`sameSite` hardened in production — `app.js:55-63`.
- 🔴 Gaps to confirm/force: explicit HTTPS + HSTS enforcement across all non-dev environments (Fase 4.1); dev-mode CORS `*`.

## 5. Rate limiting — ✅
- `express-rate-limit` tiers: general 100, withdrawal 10, admin 200, system 20, scan 5 (per 15 min, env-configurable) — `middleware/rateLimit.middleware.js`.
- Auth-specific limiters (register/login) reconnected and pinned — Fase 0 Altos #11, `tests/authRateLimiting.test.js`, `tests/withdrawalRateLimiting.test.js`.
- 🟡 Store is in-memory (per-instance) — needs a shared store (Redis) when multi-instance (Fase 5/6).

## 6. Input validation — 🟡
- Joi on `POST /usuario/login` and `POST /transaccionBlockchain/withdraw` — `tests/joiValidationReconnected.test.js`; `express-validator` on trading routes.
- 🟡 Gap: mixed validation systems; not every endpoint validates before touching the DB (convergence pending — Fase 0 note / roadmap).

## 7. Error handling & information leakage — ✅
- Canonical envelope `{ error: { code, message } }`; unexpected errors → sanitized `500 INTERNAL_ERROR` with a `requestId`, never leaking raw internals — `middleware/errorHandler.js`.
- All 7 money-path controllers migrated, plus P2P transactions (2026-09-04) — `tests/*ErrorEnvelope.test.js`, `tests/integration/transaccionesP2P.integration.test.js`.

## 8. Idempotency (money-path integrity) — ✅
- `Idempotency-Key` required on the 5 money POSTs (trading/withdraw/transfer/swap/compartment-transfer); replay returns the stored response — `middleware/idempotency.middleware.js`.
- **Transactional finalize** closes the crash-post-commit double-spend window on all 5 (2026-09-03/04) — `tests/integration/idempotencyTransactional.integration.test.js`.

## 9. Money correctness (supporting control) — ✅
- Double-entry ledger: append-only, single writer, zero-sum + overdraw guard, projection under `FOR UPDATE` — `services/ledger/`, `tests/integration/ledger*.test.js`.
- Exact decimal arithmetic via `money.js` (no float on money) — `utils/money.js` (mutation-tested 100%).

## 10. Secrets management — 🔴 (gap, Fase 4.1 / 5)
- `JWT_SECRET`, `SESSION_SECRET`, API keys and all private keys live in `.env` **plaintext**.
- 🔴 Action: move to a managed secret store (AWS Secrets Manager) + envelope encryption; remove secrets from `.env` (lands with Fase 5 infra).

## 11. Custodial key management — 🔴 (CROWN JEWEL, Fase 4.2)
- Master private keys (`BTC_PRIVATE_KEY`, `ETH_PRIVATE_KEY`, `BNB_PRIVATE_KEY`, `BTC_MASTER_XPUB`) live in env **plaintext**; no encryption at rest, no KMS, no hot/cold split, no multisig/threshold.
- ✅ Derivation is documented and **frozen** — `docs/wallet-derivation.md` (values tied to externally-recreated wallets; do not change).
- 🔴 Action (Fase 4.2): envelope encryption + KMS/Secrets Manager; evaluate hot/cold segregation, multisig/threshold, per-wallet withdrawal limits. Open residual: BNB backup mnemonic not persisted (Críticos #3).

## 12. Audit trail — 🔴 (gap, Radar #3)
- `LogAdmin` / `LogTransaccion` were dead code (Fase 0) and were removed, not reconnected — no immutable trail of admin actions today.
- 🟡 Partial: the double-entry ledger is an append-only record of money movements (an audit trail for funds, not for admin/authz actions).
- 🔴 Action: immutable audit trail for admin actions + sensitive operations (feeds AML §4.8 and NYDFS Part 500 audit-trail controls).

---

### How this feeds the mapping
Each row above maps to one or more controls in `README.md` once the regulatory
control list is verified (prerequisite 1). The `Evidence` column there should
cite the `file:line`/test references collected here; the 🔴 items are the initial
`gap` rows and the Fase 4 backlog.
