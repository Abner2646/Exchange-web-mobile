# AML signal catalog & monitoring design (Fase 4.8)

> **Scope for this phase (per ROADMAP §4.8): design, not engine.** While this is a
> demo/portfolio, no real AML engine runs and no SAR/STR is filed. The deliverable
> is (a) a documented, explicit **signal catalog** so the data needed is already
> being stored, and (b) the **account risk-flag** and **case-queue** design, ready
> to activate. Monitoring rules are **queries over the append-only ledger**
> (Radar #1) — not fragile reconstructions of a mutable balance. Feeds the FinCEN
> BSA/AML mapping (transaction monitoring, SAR). Companion to `fincen-bsa-aml-mapping.md`.

## Principles (fixed)

- **Signals → a case for human review and/or an account risk flag. Never an
  automatic action on funds** — at most a withdrawal *hold pending review* (a
  deliberate product decision, not default).
- **Readable rules, not ML.** Explicit thresholds over events that already exist.
- **Thresholds are business config**, not hardcode — they belong in the
  business-config-in-DB work (Radar #13), editable from the admin panel with an
  audit trail (Radar #3). Values below are placeholders/examples.

## Signal catalog

Each rule: what it detects · data source (and whether it's already stored) ·
example threshold · output.

| # | Signal | Detects | Data source (stored today?) | Example threshold | Output |
|---|---|---|---|---|---|
| S1 | **High volume per rolling window** | Volume inconsistent with the user's profile/KYC tier | Ledger postings (`ledger_postings`) / `IntercambioExchange.getDailyVolume`; per-user `limiteDiarioUsd` exists ✅ | Σ value over 24h/7d > tier limit ×N | risk=medio + case |
| S2 | **Structuring / smurfing** | Many transfers/withdrawals just under a reporting threshold to stay below it | `transaccion_blockchain` (retiros: monto, created_at) ✅ | ≥K withdrawals in [0.8×T, T) within 24h, Σ ≥ T (T = reporting threshold, e.g. CTR $10k) | risk=alto + case |
| S3 | **Deposit→withdrawal velocity (layering)** | Funds passing straight through (deposit then near-equal withdrawal quickly) | `transaccion_blockchain` deposits + withdrawals (amount, timestamp) ✅ | withdrawal ≥ 0.9×deposit within M minutes of a confirmed deposit | risk=alto + case |
| S4 | **Repeated P2P counterparty** | Same two parties trading P2P repeatedly (wash/collusion) | `transacciones_p2p` (compradorId, vendedorId) ✅ | ≥K P2P tx between the same pair in a window | risk=medio + case |
| S5 | **Withdrawal to flagged address** | Sending to a denylisted / sanctioned address | `transaccion_blockchain.direccionDestino` ✅ + a flagged-address list (to add) | destino ∈ denylist | risk=alto + case + withdrawal hold |
| S6 | **New-account large activity** | A just-created account moving large volume | `Usuario.created_at` ✅ + ledger volume | Σ value > V within D days of signup | risk=medio + case |

**Data readiness:** S1–S4 and S6 are computable **today** from the ledger + the
transaction tables — the append-only ledger is exactly the substrate that makes
these queries robust. S5 needs a flagged-address list (small, additive).

## Account risk flag (to model with Radar #14 — the user-model revision)

- Fields on `Usuario`: `nivelRiesgoAml` (ENUM `bajo`|`medio`|`alto`, default `bajo`)
  and `revisionAmlPendiente` (BOOLEAN, default `false`).
- **Must never be exposed to the user** (tipping-off): exclude from all
  user-facing serialization (like `passwordHash`/`kycData`); only operator/admin
  AML tooling reads it. This is why it lands with the Radar #14 work (which owns
  the user-model serialization by layer), not bolted onto a response today.

## Case queue (to build with the admin panel — Fase 7.8)

- `CasoAml` table: `id`, `usuarioId`, `tipo` (signal id S1…S6), `severidad`,
  `detalle` (JSONB: the evidence — amounts, tx ids, window), `estado`
  (`abierto`|`en_revision`|`cerrado`), `resueltoPor`, timestamps.
- Idempotent creation (don't reopen the same case for the same user/signal/window).
- Worked from the admin panel; resolution writes to the immutable audit trail
  (Radar #3).

## Activation (deferred — not this phase)

When activated: run the rules either **on-event** (e.g. after a withdrawal is
created) or via a **periodic job** (like the reconciliation alarm, §5.6) that
scans recent ledger activity and opens cases. Rules stay pure/testable functions;
the job/on-event wiring is the only "engine" part, added then. No mainnet keys or
real reporting are involved.

## Mapping

Populates `fincen-bsa-aml-mapping.md`: transaction monitoring, SAR design, risk
assessment. NYDFS Part 500 §500.6 (audit trail) underpins the case trail.
