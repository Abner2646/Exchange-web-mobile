# Design — Frontend re-platform to Next.js (SSR/SSG) via incremental strangler

**Date:** 2026-10-06
**Status:** approved (design), pending spec review → implementation plan
**Supersedes the renderer choice left open in** `docs/frontend-rebuild/frontend-audit.md` (Slice 0).

## Context

The web frontend exists in two forms: the legacy CRA app (`frontend/`, deployed, buggy,
client-side-rendered) and an in-progress TypeScript rebuild **also on CRA** (`frontend/src/{app,shared,features}`,
~95 TS files, `tsc` clean, 9 feature `routes.tsx`, app-router built but NOT the entry — `index.js` still
renders the legacy `App.jsx`). The audit (`frontend-audit.md`) mandates an **SSR/SSG-capable stack** for SEO
(Next.js/Remix), which plain CRA cannot provide. This design re-platforms the rebuild to **Next.js App Router**,
self-hosted on the existing EC2 box, migrated incrementally (strangler) so the CRA app stays deployable until
Next reaches parity.

## Decisions (locked)

| Decision | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js App Router** (RSC) | Native Metadata API (per-route SEO server-side), SSG/SSR/ISR per page, strongest hiring-market value, existing TS components port as client components. |
| Deployment | **Self-host on EC2** (2nd pm2 Node process behind nginx, same-origin) | One box, no CORS, cleaner path to the future HttpOnly-cookie/CSRF auth migration. Constraint: t3.micro 1GB → minimize per-request SSR cost. |
| Migration strategy | **Incremental strangler** | New `web/` app beside `frontend/` (CRA stays live until parity), port feature-by-feature, flip nginx + delete CRA at the end. Shippable at each step — appropriate for a money app. |
| Render split | **Public = SSG/ISR, authenticated app = client-rendered** | SSG/ISR public pages → full SEO at ~0 per-request SSR cost (fits the 1GB box); private app needs no SEO → static shell + hydration + same-origin `/api`. |

## 1. Repo structure & architecture

- New Next app in **`web/`** (App Router, TypeScript). `frontend/` (CRA) stays deployable until parity; nginx
  flip + `frontend/` deletion is the final step.
- Layout:
  - `web/app/(public)/*` — SSG/ISR routes (home, fees, FAQ, per-asset). Full SEO.
  - `web/app/(app)/*` — client-rendered routes (wallet, swap, trading, p2p, referrals, profile, admin): static
    shell + hydration, data via same-origin `/api`. No per-request SSR.
  - `web/src/features/*` — feature code ported from the CRA rebuild (components, `api.ts`, `queries.ts`).
  - `web/src/shared/*` — `api/` (transport, ApiError, session seam), `money/` (decimal.js), `i18n/`, `ui/`.

## 2. Code reuse (from the CRA rebuild)

- **Ports ~intact (as client components):** `shared/money`, `shared/api` (base URL becomes relative `/api`,
  same-origin), `shared/i18n`, `shared/ui`, and each feature's `api.ts`/`queries.ts`/components.
- **Replaced:** react-router `routes.tsx` → Next file-based routing (`app/.../page.tsx`); `RequireAuth` →
  client-side guard in the `(app)` layout.
- **Upgraded during the port:** `react-query v3` → **TanStack Query v5** (v3 is EOL; standard with Next).
  `react-router-dom` removed.

## 3. Auth under SSR

- Authenticated app is client-rendered → the current `localStorage` JWT model keeps working (no SSR reads
  storage). Guard lives in the `(app)` client layout: no token → redirect to `/login`.
- Public SSG pages need no auth.
- The HttpOnly-cookie + CSRF migration remains future backend/security work (as the audit states); this design
  does not fake that guarantee. Same-origin self-hosting makes that future migration cleaner.

## 4. SEO / metadata / rendering

- Next **Metadata API** per public route: `title`, description, canonical, Open Graph/Twitter — server-rendered.
- `robots.txt` + `sitemap.xml` as generated Next outputs (replace the current static stopgap, same prod URLs).
- **`noindex` on non-production/preview**; canonical host `bitflow.community`.
- Content pages (fees/FAQ/per-asset) that do not exist yet are created as SSG in the public slice.

## 5. Deployment (self-host EC2)

- `next.config` **`output: 'standalone'`** (minimal Node bundle). **Build locally** (not on the 1GB box) →
  `rsync` the standalone bundle → 2nd **pm2** process (`web`, port 3000).
- **nginx:** `/api` + `/health` → backend (3001); everything else → Next (3000). Same-origin.
- Memory: the Next process mostly serves static/ISR → light; monitor against swap. If it pressures the box,
  evaluate a larger instance (user decision at that point).

## 6. Slice order (high-level; detail in the implementation plan)

| Slice | Scope | Exit |
| --- | --- | --- |
| S0 | Scaffold `web/` (Next App Router, TS, tokens/reset/a11y, standalone) + port `shared/*` + **public home SSG with metadata/SEO** | End-to-end pipeline proven: SSG HTML with correct metadata; `shared/*` ported with tests; typecheck+build green. |
| S1 | Auth: register, verify-email, login/2FA, password recovery, Google (complete the gaps) | All server auth states actionable; errors by code; no missing routes. |
| S2 | Wallet: balances/compartments, Funding↔Spot transfer, deposit address/history, withdrawal | Correct compartments + pending; money mutation/idempotency tests; withdrawal guard states. |
| S3 | Swap | Indicative-quote disclosure, daily-limit feedback, canonical amounts, idempotent execution, **503 PRICE_ORACLE_DIVERGENCE paused state**. |
| S4 | Spot trading | Funding→Spot prerequisite, received-asset fee explanation, order lifecycle, accessible market data. |
| S5 | P2P | Offer/accept/payment/complete/cancel state machine; typed 4xx recovery. |
| S6 | Profile & security | displayName/locale/profile edits, email-change + cooldown messaging, notifications; KYC provider handoff. |
| S7 | Admin | Least-privilege routing, operator MFA state, business config, AML/KYC/audit ops (mount the already-built admin feature). |
| S8 | Marketing + legacy removal | Responsive marketing UX; nginx flip to Next; delete `frontend/` (CRA) and every replaced legacy file. |

**nginx cutover:** when S0–S2 reach usable parity (or at S8 — confirm at the time). Until then CRA serves prod.

## 7. Testing & release gates

- **Vitest + Testing Library** for unit/component (money parsers, every form state); **Playwright** for golden
  flows (auth, wallet, swap) before releasing each money screen.
- Per-slice gates (from the audit): typecheck + tests + production build green; a contract test per request
  shape / typed error / money field; keyboard-only + mobile viewport + visible focus; a user cannot submit a
  money op twice, mistake Funding for Spot, or read pending funds as spendable.
- The legacy implementation for a feature is deleted only in the commit that passes its replacement's
  acceptance test.

## Out of scope (tracked elsewhere)

- HttpOnly-cookie/CSRF auth migration, Google redirect-token removal, KYC provider integration, quote-lock —
  backend/security roadmap work. Designed-for here, not implemented.
- Mobile (Expo/React Native under `mobile/`) — excluded.
- CI debt (issue #40) — unrelated.
