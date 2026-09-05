# Business config inventory (Radar #13)

What is **business policy** (belongs in the DB, editable by an operator) vs
**infra/per-env** (stays in env — secrets, RPC URLs, DB creds; Fase 5.0). Business
policy that already has a natural home on an entity stays there; the rest goes to
the `configuracion_negocio` key-value table via `services/config/businessConfig.js`
(read with a fallback = the previous default, so migrating is non-breaking).

Admin CRUD: `GET/PUT /api/config/:clave` — guarded by `isAdmin + requireOperatorMFA`
(editing business policy is a privileged operator action, Fase 4.9).

| Parameter | Where today | Class | Status |
|---|---|---|---|
| Swap/exchange commission | `ParExchange.comisionPorcentaje` (per pair) | business | ✅ already DB (per-entity) |
| Trading pair fees / min order | `TradingPair.makerFeePercent/takerFeePercent/minOrderAmount` | business | ✅ already DB (per-entity) |
| Per-user daily limit | `Usuario.limiteDiarioUsd` | business | ✅ already DB (per-user) |
| **Required confirmations per network** | was hardcoded in `transaccionBlockchain.controller` | business | ✅ **migrated** → `confirmaciones.<red>` (default fallback preserved). Still hardcoded in the blockchain services (scan/confirmation paths) → follow-up |
| Default commission fallback | `'0.1'` hardcoded in `intercambioExchange.controller` | business | ⏳ follow-up → `comision.default` |
| Min/max withdrawal per op | env `MIN_WITHDRAWAL_*` (commented, not enforced) | business | ⏳ follow-up → config + enforce |
| AML rule thresholds (S1–S6) | n/a (design only) | business | ⏳ with the AML engine (§4.8) → config |
| Rate-limit windows/maxes | env `RATE_LIMIT_*` | infra/operational | stays env (per-env tuning) |
| BTC fee-per-byte | env `BTC_FEE_PER_BYTE` | operational | borderline; leave env for now |
| RPC URLs, API keys, private keys, JWT/session secrets, DB creds | env | **infra/secrets** | **stays env** (Fase 5.0) |

## Versioning note (don't silently rewrite history)

Changing a parameter must not alter how past operations were settled. This is
already handled where it matters by **storing the value on each executed row**
(e.g. `IntercambioExchange.comisionPorcentaje`/`comisionMonto` are persisted per
swap; a swap keeps the fee it was executed with even if the pair's fee changes
later). The `configuracion_negocio` table holds the *current* policy; historical
correctness comes from the per-row snapshots + (future) the audit trail on config
edits (Radar #3) once the admin panel logs who changed what (Fase 7.8).
