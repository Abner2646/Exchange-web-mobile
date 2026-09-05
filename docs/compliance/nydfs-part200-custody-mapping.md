# NYDFS BitLicense — 23 NYCRR Part 200 + custody guidance — control mapping

> **Pillar 2 of the audit binder** (see `README.md`). Part 200 is NY's
> virtual-currency business regime; its **custody guidance** is the piece that
> lands directly on this project's **custodial model** and on §4.2 (key
> management). Current custody guidance: NYDFS **Updated Guidance on Custodial
> Structures**, **Sept 30, 2025** (supersedes the Jan 23, 2023 letter).
>
> **Framing:** the developer is **not** a BitLicensee. Design-reference
> self-assessment. Licensing/capital/organizational controls are **N/A (org)** but
> kept visible; the substantive, backend-relevant part is **custody**.

**State:** ✅ implemented · 🟡 partial · 🔴 gap · ⚪ N/A (org / not licensed).

## Custody guidance — four customer-protection areas

| Area | Control | State | Evidence / notes | Pending |
|---|---|---|---|---|
| (i) | **Segregation & separate accounting of customer VC — internal ledger** | ✅ | The double-entry ledger keeps **per-user accounts distinct from house accounts** (`treasury`, `fee_revenue`, `suspense`) — customer holdings are separately accounted on the internal ledger by construction (`services/ledger/ledgerAccounts.js`, `services/ledger/postingService.js`) | Document the segregation model explicitly (disclosure) |
| (i) | **Segregation of customer VC — on-chain** | 🔴 | Customer crypto is **pooled in the master wallet** (`WalletMaestra`) on-chain — commingled, not per-customer on-chain segregation | Evaluate on-chain segregation / omnibus-with-controls; document the model (§4.2) |
| (ii) | VCE custodian's **limited interest/use** of customer VC | 🟡 | The ledger separates house funds from customer funds; the system does not lend/rehypothecate customer funds | Written policy that customer funds are not used; enforce/monitor |
| (iii) | **Sub-custody** arrangements + disclosure | ⚪ | Self-custody only — no third-party sub-custodian | If ever introduced, disclose terms + material risks |
| (iv) | **Customer disclosure** of custody practices | 🔴 | No custody disclosure; only a demo/portfolio disclaimer is planned (Radar #3) | Custody + risk disclosure copy (frontend, Fase 7) |

## Part 200 program areas (cross-referenced)

| Area | State | Notes |
|---|---|---|
| Cybersecurity program | 🟡 | Governed by Part 500 → see [`nydfs-part500-mapping.md`](./nydfs-part500-mapping.md) |
| AML / BSA program | 🔴 | See [`fincen-bsa-aml-mapping.md`](./fincen-bsa-aml-mapping.md) |
| Key management / safekeeping of assets | 🔴 | Private keys in env plaintext; no KMS/encryption-at-rest, no hot/cold split (baseline §11) — **§4.2 crown jewel** |
| Capital requirements, licensing, org controls, consumer protection filings | ⚪ | Not a licensee — design-reference only |

## Reading

The custodial design has a genuine strength worth surfacing in an interview: the
**double-entry ledger already provides separate, auditable accounting of customer
holdings vs house funds on the internal books** — exactly what the custody
guidance asks for on the ledger side. The open items are the ones §4.2 targets:
**on-chain commingling in the master wallet**, **key safekeeping** (encryption at
rest / KMS / hot-cold), and **customer disclosure**. That is a coherent, honest
custody story: strong internal accounting, immature on-chain segregation and key
protection.

## Sources

- [NYDFS — Updated Guidance on Custodial Structures (Sept 30, 2025)](https://www.dfs.ny.gov/industry-guidance/industry-letters/il20250930-updated-guidance-custodial-structures)
- [NYDFS — Guidance on custodial structures (Jan 23, 2023, superseded)](https://www.dfs.ny.gov/industry_guidance/industry_letters/il20230123_guidance_custodial_structures)
- [NYDFS — Virtual Currency Business Licensing (official)](https://www.dfs.ny.gov/virtual_currency_businesses)
- [Sullivan & Cromwell — NYDFS custody guidance analysis](https://www.sullcrom.com/SullivanCromwell/_Assets/PDFs/Memos/sc-publication-nydfs-issues-guidance-virtual-currency-custodial-structures.pdf)
