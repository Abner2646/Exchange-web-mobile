# FinCEN / BSA-AML — control mapping (MSB / money transmitter)

> **Pillar 1 of the audit binder** (see `README.md`). A crypto exchange that
> administers/exchanges virtual currency is a **money transmitter → an MSB**, and
> must run a risk-based AML program under the BSA.
>
> **Framing (matches ROADMAP §4.7/§4.8):** while this is a **demo/portfolio**, no
> real AML engine is contracted and **no regulatory reports (SAR/CTR/STR) are
> filed** — that is expensive and meaningless without real funds/users. This
> mapping therefore measures **design readiness**: the cheap-now / expensive-later
> items (data model, immutable trail, the ledger as an AML query substrate) are
> what's tracked, per the "prepare the design, don't operate" posture. Governance
> controls (BSA officer, training, board approval) are **N/A (org)** for a solo
> portfolio but kept visible.

**State:** ✅ implemented · 🟡 partial · 🔴 gap · ⚪ N/A (org / not operating as a registered MSB).

## AML program — the five pillars

| Pillar | Control | State | Evidence / notes | Pending |
|---|---|---|---|---|
| 1 | Internal policies, procedures & controls | 🔴 | No written AML program | Draft an AML design doc (design-reference) |
| 2 | Designated BSA/AML compliance officer | ⚪ | Solo project | Design-reference (intended owner role) |
| 3 | Ongoing training | ⚪ | Solo project | — |
| 4 | Independent testing / audit | 🔴 | None | Pre-mainnet: independent review |
| 5 | Customer Due Diligence (CDD/CIP, "fifth pillar") | 🔴 | `kycVerificado` field + `requireKYC` guard exist as scaffolding (`middleware/authMiddleware.js:107-112`); no identity verification provider | KYC/CIP integration (§4.7); jurisdiction fields on `Usuario` (Radar #14) |

## Specific BSA obligations

| Obligation | State | Evidence / notes | Pending |
|---|---|---|---|
| MSB registration (FinCEN Form 107, renew ~2 yrs) | ⚪ | Not operating as a registered MSB | N/A while portfolio |
| Customer identification (CIP/KYC/KYB) | 🔴 | Scaffolding only (above) | §4.7 KYC |
| Transaction monitoring | 🟡 | Per-user **daily USD limit** enforced under `FOR UPDATE` (AML-adjacent volume control) — `intercambioExchange.controller` daily-limit check (Radar #12d). **Signal catalog documented** ([`aml-signal-catalog.md`](./aml-signal-catalog.md)): 6 explicit rules (S1–S6) as queries over the append-only ledger, with the risk-flag + case-queue design | Build the engine (on-event/job) + case queue (admin panel, Fase 7.8) when activated |
| SAR — suspicious activity (FinCEN Form 111, ≥ $2,000) | 🔴/⚪ | No filing (portfolio posture) | Design: a **case queue + risk flag**, human review, not auto-action on funds (§4.8) |
| CTR — currency transactions > $10,000 (Form 112) | ⚪ | Largely N/A: crypto-only, no fiat cash handling | Note for any future fiat on/off-ramp |
| Recordkeeping | 🟡 | Double-entry **ledger is an append-only record of all money movements** (`services/ledger/`) — baseline §9,12; retention policy not formalized | Formal retention + immutable admin/action trail (Radar #3) |
| **Travel Rule** — 31 CFR 1010.410(f), transmittals ≥ $3,000 (2019 FinCEN VASP guidance) | 🔴 | Withdrawals do not attach originator/beneficiary (VASP) information | Design: capture + transmit required party info on transfers ≥ threshold |
| Risk assessment (basis of the risk-based program) | 🔴 | None formal | Document a money-laundering/TF risk assessment |

## Design-readiness items (cheap now, expensive on real data — Radar #3)

| Item | State | Evidence / notes |
|---|---|---|
| Immutable audit trail (admin + money actions) | 🔴 | Ledger covers money; admin-action trail removed in Fase 0 (Radar #3) |
| Ledger as AML query substrate (append-only) | ✅ | `services/ledger/` — monitoring rules become queries over postings, not fragile balance reconstructions |
| Jurisdiction data model (country/state, tax id) | 🔴 | Not on `Usuario` yet (Radar #14 / §4.7) — add before real users |
| Case queue + account risk flags (no auto-fund action) | 🟡 | **Designed** in [`aml-signal-catalog.md`](./aml-signal-catalog.md): `CasoAml` queue + `Usuario.nivelRiesgoAml`/`revisionAmlPendiente` (risk flag never exposed to the user — tipping-off; lands with Radar #14). Build with the admin panel (§7.8) |

## Reading

Consistent with the roadmap posture: **AML is deliberately design-only while this
is a portfolio.** The concrete, defensible present state is the **append-only
ledger** (the right substrate for monitoring) plus a **locked per-user daily
limit**; everything customer-facing (KYC/CIP, monitoring rules, Travel Rule,
jurisdiction model) is a documented gap landing in §4.7/§4.8 and Radar #14 —
cheap to design now, expensive to retrofit on real users later.

## Sources

- [FinCEN — Application of regulations to virtual currency (official guidance)](https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering)
- [IRS — MSB Information Center](https://www.irs.gov/businesses/small-businesses-self-employed/money-services-business-msb-information-center)
- [FinCEN cryptocurrency regulation overview — InnReg](https://www.innreg.com/blog/fincen-cryptocurrency-regulation)
- [Pending changes to AML program requirements for MSBs — Wilson Sonsini](https://www.wsgr.com/en/insights/pending-changes-to-anti-money-laundering-program-requirements-for-msbs-and-other-financial-institutions.html)
