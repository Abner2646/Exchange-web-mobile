# Compliance & Security Control Mapping — audit binder (living document)

> **Status: scaffold (started 2026-09-03, entering Roadmap Fase 4).** This file is
> the home and structure of the control-by-control mapping. The control rows are
> populated as Fase 4 hardening lands and after the two prerequisites below are
> done. **No control text is transcribed from memory** — see prerequisite (1).

## Purpose

A single living artifact that is simultaneously:

- a **security roadmap** — every control the system is designed against, and what's left to do; and
- an **auditor's binder** — for each control: its **status**, the **evidence** that proves it (`file:line` or a test), and the **pending action**.

It grows with the Fase 4 hardening. See `ROADMAP.md` §4.0 for the full rationale.

## Scope & honest framing

- **System model:** a **custodial** exchange — the platform generates and holds the users' crypto keys (the user does not hold their seed) — targeting **real mainnet** (BTC / EVM). Custody is the heaviest regulatory trigger, which is why key management (§4.2) is the crown jewel.
- **Jurisdiction:** **United States** (the developer is US-based, targeting US fintech).
- **Framing (defensible, not overstated):** the developer is **not** a NYDFS-licensed entity. NYDFS BitLicense / Part 500 and the FinCEN/BSA framework are used as the **reference design standard** — the bar the system is audited *against* — not as legal obligations currently in force on this project. Consistent with §4.7/§4.8: while this is a demo/portfolio, no real AML engine is contracted and no regulatory reports (SAR/CTR/STR) are filed. **This mapping measures design readiness against the standard, not regulated operation.**

## Reference standards (the three pillars)

The specific, current control text for each is filled in **only after verification** (prerequisite 1) — the names and scope below come from the roadmap framing, not from transcribed regulation.

| Pillar | What it governs | Lands in |
|---|---|---|
| **FinCEN / BSA-AML** (federal, MSB) | KYC/CIP, transaction monitoring, SAR/CTR, recordkeeping, Travel Rule (31 CFR 1010.410(f)) | §4.7 KYC, §4.8 AML |
| **NYDFS BitLicense** (23 NYCRR Part 200) | Virtual-currency regime + custody guidance (segregation of customer assets, sub-custody) | §4.2 key management, custodial model |
| **NYDFS Cybersecurity** (23 NYCRR Part 500) | Access control, MFA, encryption, CISO, pentesting, audit trails, incident response, third-party risk — the most prescriptive, checklist-like technical standard | §4.1–§4.6 (technical backbone) |

**Optional later layer:** SOC 2 as an extra signal once the regulatory mapping matures — not core.

## Control table format (to be populated)

Each control is one row:

| Control (id + short name) | Status | Evidence | Pending action |
|---|---|---|---|
| e.g. `500.12` MFA | implemented / partial / gap | `file:line` or test name | what's left |

`Status` ∈ {`implemented`, `partial`, `gap`}. `Evidence` must be a concrete `file:line` or test — never an assertion without proof. New controls start as `gap` and move up as hardening lands (expected and correct early in Fase 4).

## Immediate next steps (prerequisites before writing control rows)

Per `ROADMAP.md` §4.0, two things must happen before a single control row is written, and they are the next work units for this deliverable:

1. **Verify the current regulatory text** — NYDFS Part 500 (Second Amendment, Nov 2023, with staggered 2024–2025 compliance dates) and current FinCEN/NYDFS guidance. **Do not write from memory; the regulation changes.** Use verified sources and cite them. This produces the concrete control list (especially the Part 500 checklist, the technical backbone).
2. **Survey the real backend security posture** — inventory what exists today (auth/session, password hashing, key storage, transport/HTTPS, input validation, error sanitization, rate limiting, admin authorization, audit trail, secrets handling) with `file:line`/test evidence, to seed the initial `Status`/`Evidence` columns with facts, not assumptions. Target: `docs/compliance/backend-security-baseline.md`.

Until both are done, this file stays a scaffold on purpose — populating it from memory would defeat its audit-grade point.
