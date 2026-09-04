# NYDFS Cybersecurity — 23 NYCRR Part 500 — control mapping

> **Pillar 3 of the audit binder** (see `README.md`). Part 500 (Second Amendment,
> adopted **Nov 1, 2023**, with staggered 2024–2025 compliance dates) is the
> prescriptive, checklist-like technical standard — the backbone of this mapping.
>
> **Framing:** the developer is **not** a Covered Entity under Part 500. This is a
> **design-reference** self-assessment — the bar the backend is measured against —
> not a regulatory filing. Governance/organizational controls (CISO, board
> oversight, personnel, superintendent notices) are marked **N/A (org)** for a
> solo portfolio project, kept visible so the design intent is on record.
>
> **Source verification:** section titles/structure verified against DFS-referenced
> summaries (Nov 2023 Second Amendment). The official DFS text
> (`dfs.ny.gov/system/files/documents/2023/03/23NYCRR500_0.pdf`) blocks automated
> fetch (403) — **re-verify exact sub-requirement wording against the official PDF
> before any formal/non-portfolio use.** Sources listed at the bottom.

**State:** ✅ implemented · 🟡 partial · 🔴 gap · ⚪ N/A (org / not a Covered Entity).
Evidence cites `backend-security-baseline.md` (§N) and/or `file:line`.

| § | Control | State | Evidence / notes | Pending action |
|---|---|---|---|---|
| 500.2 | Cybersecurity program | 🟡 | Real controls exist (auth, rate limiting, error sanitization, idempotency, ledger) — baseline §1–9; no *documented* program | This binder is the start; formalize as controls land |
| 500.3 | Cybersecurity policy (annual, board-approved) | 🔴 | No written policy | Draft a policy doc under `docs/compliance/` (design-reference) |
| 500.4 | CISO / governance / senior-body reporting | ⚪ | Solo project — no CISO/board | Design-reference only; note the intended owner role |
| 500.5 | Vulnerability mgmt & penetration testing (annual) | 🟡 | Automated tests + mutation testing on money modules; `/security-review` available. No formal pentest / periodic vuln scans | Add dependency scanning (npm audit in CI) + a documented pentest pass pre-mainnet |
| 500.6 | Audit trail | 🔴 | `LogAdmin`/`LogTransaccion` removed (Fase 0); double-entry ledger is an append-only **money** trail only — baseline §12 | Immutable audit trail for admin/sensitive actions (Radar #3) |
| 500.7 | Access privileges & management (least privilege, periodic review) | 🟡 | **Centralized authz policy layer `utils/authz.js` (§4.3, hierarchy-aware, unit-tested)** adopted across controllers — baseline §3; still no privileged-access review | Consolidate with `adminMiddleware`; least-privilege per service (§4.9); privileged-access review |
| 500.8 | Application security (secure SDLC) | 🟡 | Input validation (Joi/express-validator), sanitized error envelope, idempotency, TDD/CI — baseline §6,7,8 | Converge validation; SAST in CI; security tests as controls land |
| 500.9 | Risk assessment (periodic) | 🔴 | None formal | Document a risk assessment feeding the control priorities |
| 500.10 | Cybersecurity personnel | ⚪ | Solo project | Design-reference only |
| 500.11 | Third-party service provider security | 🟡 | External deps: RPC/explorer APIs, email, Google OAuth — injected via seams; no formal TPRM/contractual review | Document a third-party inventory + risk notes |
| 500.12 | Multi-factor authentication | 🟡 | Email-code 2FA for user login exists — baseline §1, `tests/integration/auth2FA...`; **no MFA on privileged/admin/operator access** | Operator MFA + least-privilege (§4.9) |
| 500.13 | Asset management & data retention | 🔴 | No asset inventory; idempotency keys have 24h TTL (partial retention) | Asset/data inventory + retention/disposal policy |
| 500.14 | Monitoring & training | 🟡 | Rate limiting + request logging (`morgan`); no centralized monitoring/alerting; training N/A (solo) | Structured logging + Sentry + reconciliation alarm (§5.6 / Radar #2) |
| 500.15 | Encryption of nonpublic information (at rest + in transit) | 🔴 | Passwords bcrypt-hashed (baseline §2); TLS/helmet in transit (baseline §4, to force HSTS). **Secrets and custodial private keys in env plaintext — no encryption at rest** (baseline §10,11) | Envelope encryption + KMS/Secrets Manager (§4.1/§4.2/§5) — **crown jewel** |
| 500.16 | Incident response & business continuity (BCDR) | 🔴 | No IR/BCDR plan; backups pending | IR plan + backups/restore drill (RPO/RTO — §5.2) |
| 500.17 | Notices to superintendent (72h incident, ransomware) | ⚪ | Not a Covered Entity | Design-reference only |
| 500.18–500.23 | Confidentiality, exemptions, enforcement, effective/transitional dates | ⚪ | Administrative / not applicable to a non-Covered-Entity portfolio | — |

## Reading of this mapping

The backend is **strong on money-path integrity and app-level hygiene**
(500.8-adjacent: validation, error sanitization, idempotency, the double-entry
ledger) and **weakest exactly where Fase 4 targets**: encryption-at-rest of
secrets/keys (500.15 → §4.1/§4.2, the crown jewel), audit trail (500.6 → Radar #3),
and access governance (500.7/500.12 → §4.3/§4.9). That is the expected shape
entering Fase 4 — real controls to evidence, concrete gaps to close.

## Sources

- [NYDFS 23 NYCRR Part 500 overview — Hyperproof](https://hyperproof.io/23-nycrr-500-cybersecurity-regulation/)
- [What Is 23 NYCRR 500 — SaltyCloud](https://www.saltycloud.com/blog/what-is-23-nycrr-500/)
- [NYDFS finalizes Second Amendment (Nov 2023) — WilmerHale](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20231128-nydfs-finalizes-amendments-to-cybersecurity-regulations)
- [NYDFS Cybersecurity Resource Center (official)](https://www.dfs.ny.gov/cybersecurity) — official text to re-verify sub-requirement wording (PDF blocks automated fetch)
