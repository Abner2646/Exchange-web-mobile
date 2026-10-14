# Custodial Crypto Exchange — audit-grade, built to a US regulatory bar

A full-stack, **custodial cryptocurrency exchange** engineered solo as a deep systems/security portfolio project: double-entry money accounting, dual-control over privileged money movement, AML transaction monitoring, a tamper-evident audit trail, an event-driven backbone, and a server-rendered Next.js frontend — all modeled against a **US regulatory framework (FinCEN BSA/AML + NYDFS Part 200 / Part 500)**.

> **The point of this repo:** demonstrate that I can design and build the parts of a financial system where *correctness and controls actually matter* — money arithmetic, authorization, auditability, and regulatory posture — not just CRUD screens.

---

## Why this is worth 5 minutes of a reviewer's time

Most "crypto exchange" portfolio projects are a price chart and a fake order book. This one is built around the problems a real custodial venue has to get right:

- **Money is never a float.** All balances and amounts are canonical decimal **strings** end-to-end (`utils/money.js` on the backend, a branded `CanonicalAmount` with locale-aware parsing on the frontend). No `parseFloat` touches a balance, a fee, or an order.
- **Balances live in a double-entry ledger.** An append-only, double-entry ledger is the source of truth; balances are a projection. Accounts are keyed by crypto **UUID** (never a symbol), with `available` / `blocked` / `pending` compartments across Funding and Spot wallets, and idempotent postings keyed by reference.
- **No single operator can move money.** Every privileged single-operator money movement (large withdrawals, launchpad settlements, manual balance adjustments/transfers/blocks) routes through a **Maker-Checker (four-eyes) engine**: a maker proposes, a *distinct* checker authorizes with a fresh **TOTP** second factor, and the effect executes atomically with the approval.
- **It watches itself.** An **AML monitoring** pipeline (configurable rules, denylist screening, case management, withdrawal holds) plus a **hash-chained, tamper-evident audit log** that records every money event — so tampering with history is detectable, not silent.
- **It's event-driven where it counts.** A transactional **outbox** emits domain events in the same transaction as the ledger write, decoupling notifications/audit/AML from the money path without losing events.
- **It takes regulation seriously.** The design is mapped control-by-control to **FinCEN BSA/AML**, **NYDFS BitLicense (Part 200)**, and **NYDFS Part 500** (e.g. §500.7 access controls, §500.12 MFA) — a living "auditor's binder", not an afterthought.

---

## What's built

| Area | What's implemented |
|------|--------------------|
| **Money correctness** | Canonical decimal-string arithmetic, UTC normalization, case-insensitive asset handling, idempotency keys on every money-mutating `POST`. |
| **Double-entry ledger** | Append-only ledger as source of truth; balances as a projection; Funding + Spot compartments with available/blocked/**pending**; incremental write cutover with parity reconciliation. |
| **Dual control / governance** | Maker-Checker engine for privileged money moves; TOTP (`otplib`) second factor for checkers; anti-replay single-use codes; a deploy readiness gate that fails closed unless ≥2 operators are MFA-enrolled. |
| **AML** | Rule-based transaction monitoring, address denylist screening, case lifecycle (open → resolve → release/refund), withdrawal holds, all admin-gated with tipping-off protection. |
| **Audit trail** | Immutable, hash-chained audit log over the outbox event stream; a chain-verify routine that detects edited/deleted rows. |
| **Event-driven backbone** | Transactional outbox + in-process event bus; money events emitted atomically with the ledger; notifications/AML/audit as consumers. |
| **Custody & on-chain** | Custodial model (the venue holds keys; HD derivation for BTC / EVM chains); withdrawal lifecycle with an on-chain reaper; key management treated as the security crown jewel. |
| **Spot trading** | Order book with price/time matching, market & limit orders, maker/taker fees on the received asset, order lifecycle + cancellation. |
| **Swap** | Indicative quoting with fee/total disclosure, daily-limit feedback, idempotent execution against the house, and a first-class paused state on price-oracle divergence. |
| **P2P** | Offer browse/create, accept (locks the seller's funds), and a full initiated → payment-confirmed → completed / cancelled state machine with role-gated actions. |
| **Auth & identity** | Email/password + Google OAuth, email-verification gating, password recovery, email-2FA and TOTP enrollment, two-step email change with a withdrawal cooldown, least-privilege role hierarchy (`normal < admin < super_admin`). |
| **Admin panel** | Least-privilege routing, Maker-Checker review inbox, operator-MFA readiness, user management, editable business configuration, AML operations, and a read-only audit viewer with chain verification. |
| **Frontend (Next.js)** | Full re-platform from CRA to **Next.js App Router (SSR/SSG)**: public pages SSG for SEO, authenticated app client-rendered, same-origin `/api`. Verticals shipped: auth, wallet, swap, spot trading, P2P, profile/security, admin. |
| **Quality gates** | ~620 backend unit tests and ~580 frontend (Vitest + Testing Library) tests; TypeScript strict on the frontend; a CI coverage floor; mandatory code review on every `dev → main`. |

---

## Architecture

```
                         ┌──────────────────────────────┐
                         │            nginx              │
                         │   /  → Next.js (SSR/SSG)       │
                         │   /api → Express backend       │   same-origin
                         └───────────────┬───────────────┘
                 ┌───────────────────────┴───────────────────────┐
                 │                                                 │
        ┌────────▼────────┐                             ┌──────────▼─────────┐
        │  Next.js (web/) │                             │ Express (backend/) │
        │  App Router     │                             │ modular monolith   │
        │  React 18 / TS  │                             │ domain modules     │
        └─────────────────┘                             └──────────┬─────────┘
                                                                    │
                          ┌─────────────────────────────┬──────────┴──────────┐
                          │                             │                     │
                  ┌───────▼────────┐          ┌─────────▼────────┐   ┌────────▼───────┐
                  │  PostgreSQL    │          │ Double-entry     │   │  Transactional │
                  │  (Sequelize)   │          │ ledger + audit   │   │  outbox + bus  │
                  └────────────────┘          └──────────────────┘   └────────────────┘
```

- **Modular monolith, not microservices** — the architecture adopts the *principles* (event-driven, durable timers, least-privilege identity, observability/reconciliation) without the operational tax of distribution. Domain code lives under `backend/modules/<domain>/`.
- **Strangler migration** — the new Next.js app in `web/` was built slice-by-slice alongside the legacy CRA in `frontend/`; the planned final step flips nginx to Next and removes the CRA.

### Tech stack

**Backend:** Node.js · Express · Sequelize · PostgreSQL · Redis · JWT · otplib (TOTP) · ethers (EVM) · BIP32/39 HD derivation · Jest + Supertest
**Frontend:** Next.js 14 (App Router, RSC) · React 18 · TypeScript · TanStack Query · decimal.js · Vitest + Testing Library · Playwright
**Infra/Ops:** Docker Compose · nginx (reverse proxy, same-origin) · self-hosted on EC2 · swagger-jsdoc (OpenAPI)

---

## Security & compliance posture

This is the differentiator, so it's explicit:

- **Regulatory mapping (US):** FinCEN BSA/AML · NYDFS BitLicense (Part 200) · NYDFS Part 500 — maintained as a living control-by-control document.
- **Access control:** role hierarchy + per-route authorization; privileged money movement behind Maker-Checker dual control (NYDFS §500.7); MFA/TOTP for operators (§500.12).
- **Auditability:** hash-chained tamper-evident audit log over an event outbox; chain verification routine.
- **Money-path discipline:** decimal-string arithmetic, idempotency keys, atomic ledger postings, withdrawal holds and cooldowns.
- **Secrets & config:** no secrets in the repo; everything config-driven behind env vars with testable stubs for external providers.

---

## Project status

This is an **engineering & security showcase**, actively developed. It is **not a live service and does not custody real user funds.** The custodial model is implemented in code, but the system is not deployed to production users, and some external integrations (identity provider, fiat on-ramp, additional chains) are config-driven stubs. The "What's built" table reflects what exists and is tested on the default branch.

---

## Running it locally

**Backend**
```bash
cd backend
npm install
npm test                 # unit suite
npm run test:integration # integration suite (needs a Postgres test DB)
npm start                # serves the API on :3001 (see .env.example)
```

**Frontend (Next.js app)**
```bash
cd web
npm install
npm run dev              # Next dev server
npx vitest run           # unit/component tests
npx tsc --noEmit         # typecheck
npm run build            # production build (standalone output)
```

**Full stack (Docker Compose)**
```bash
cp .env.example .env     # fill in your values
docker-compose up -d     # nginx + backend + postgres + redis (+ pgAdmin)
```

API docs (OpenAPI/Swagger) are served at `/api-docs` when the backend is running.

---

## Repository layout

```
backend/            Express modular monolith
  modules/          domain modules: balances (ledger), wallets, swap, trading,
                    p2p, aml, governance (maker-checker), audit, events (outbox),
                    users, config, kyc, launchpad, notifications
  middleware/       auth, admin/role, operator-MFA, idempotency, rate limiting
  utils/            money.js (decimal strings), authz, errors
web/                Next.js App Router app (the current frontend)
  app/(public)/     SSG/ISR marketing + content
  app/(app)/        client-rendered authenticated app (wallet/swap/trading/p2p/profile/admin)
  src/features/*    per-feature api/queries/components
  src/shared/*      money, api transport, i18n, ui
frontend/           legacy CRA app (being strangled out)
docs/               design specs, implementation plans, regulatory mapping,
                    frontend contract, engineering notes
nginx/              reverse-proxy config (same-origin / → Next, /api → backend)
```

---

## A note on how it was built

Developed solo, with a disciplined workflow: trunk-ish flow (work on `dev`, PR only for `dev → main`), **mandatory code review on every merge to `main`**, Conventional Commits, test-driven on the money path, and living design/plan documents under `docs/`. The emphasis throughout is the highest achievable quality and security bar — the kind of bar a real custodial exchange would be audited against.
