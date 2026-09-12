# Backend changes that break the current frontend — remediation checklist

> **Purpose.** The backend matured a lot (Fases 0–4 + Radar #13/#14) while the web
> (`frontend/`) and mobile (`mobile/`) apps were built against an older backend.
> This is the **consolidated, frontend-oriented checklist** of every backend
> contract characteristic the old frontends will break on, with what the frontend
> must do. The chronological detail lives in
> [`backend-contract-changes.md`](./backend-contract-changes.md) (§1–§10) — this
> file is the "start here when fixing the integration" view.
>
> **Sequencing note (decided).** The backend will be **renamed to English in
> Fase 6.2** (routes, models, DB columns, response field names) — safely, backed by
> ~526 tests. So the frontend integration should be rebuilt **once, against the
> post-rename English contract**, not against today's Spanish routes/fields. Treat
> the routes/field names below as *today's* (Spanish); expect them to become English.
> Use this doc to understand *what* changed conceptually; pin exact names against the
> live OpenAPI (`/api-docs`, 209+ paths) at rebuild time.

Legend: 🔴 breaks silently / hard · 🟡 behavioral, handle it · 🆕 new capability.

---

## 1. 🔴 Error responses — canonical envelope (branch on `code`, not `message`)

Every error from the money-path controllers, P2P, and anything reaching the central
handler is now:

```json
{ "error": { "code": "STABLE_CODE", "message": "human message" } }
```

- **Frontend must branch on `error.code`** (stable machine string), never on the
  message text. Old code that read `res.data.error` as a *string*, or read a
  `{ success:false, message }` shape, **breaks**.
- Unexpected/internal errors: `{ "error": { "code": "INTERNAL_ERROR", "message": "...", "requestId": "<hex>" } }` — show a generic message + the `requestId` for support.
- P2P transaction business errors that used to be `500` are now typed `4xx`
  (`P2P_TX_INVALID_STATE`, `P2P_TX_FORBIDDEN`, `P2P_TX_OFFER_INACTIVE`,
  `P2P_TX_AMOUNT_OUT_OF_RANGE`, `P2P_TX_INSUFFICIENT_FUNDS`, …).
- **Caveat:** a few non-money controllers still return legacy shapes; build a
  tolerant error reader but treat the envelope as the target. (Detail: §1 of the
  change-log doc.)

## 2. 🔴 Money is canonical **strings**, not numbers

Balances, amounts, fees come back as exact decimal **strings** (`"0.69700000"`),
not JS numbers. The frontend must:
- Never do float math on them (use a decimal lib, e.g. decimal.js/big.js, for any
  arithmetic or comparison).
- Format for display per locale at render time (the value is canonical: `.`
  decimal, no thousands separator). i18n of number/date formatting is Fase 7.3.

## 3. 🔴 `Idempotency-Key` header REQUIRED on money POSTs

These 5 endpoints now **reject with 400 `IDEMPOTENCY_KEY_REQUIRED`** if the header
is missing:
- create spot order · create withdrawal · create transfer · swap (intercambio) ·
  Funding↔Spot compartment transfer.

Frontend must, per money action: generate a UUID and send it as `Idempotency-Key`;
**reuse the same key on retries** of the same intent. Handle:
- `409 IDEMPOTENCY_REQUEST_IN_PROGRESS` → the first request is still running; retry shortly.
- `422 IDEMPOTENCY_KEY_REUSED` → same key, different body (a bug in the client).
- A retry with the same key **replays the original response** (don't double-submit).
Also disable the submit button + show a "sending…" state (cheap first-line defense).

## 4. 🔴 Auth changes

- **Google login now requires a real `id_token`.** `POST /login/google` takes
  `{ idToken }` and verifies it server-side; the old `{ googleId, email, … }` body
  is gone (it was an account-takeover hole). Frontend must use Google Identity
  Services to obtain an `id_token` and send that. (Detail §7.)
- `requireEmailVerified` gates many authenticated endpoints → `403` with
  `requiresEmailVerification: true`; the frontend must route the user to the
  verify-email flow.
- 2FA (email-code), password reset, email verification are code-based flows —
  align the screens to the current endpoints (pin against `/api-docs`).

## 5. 🆕 Compartmentalized balances (Funding / Spot)

- `GET /balances/my/balances` (and the intercambio/usuario "my balances" endpoints,
  now unified) return an **additive compartmented shape**: per crypto, root totals
  (Funding+Spot) **plus** a per-compartment breakdown **plus** a `criptomoneda`
  object. Old code that read a flat `{ balanceDisponible }` still finds the root
  totals but must be updated to show/By-compartment where relevant.
- New self-service **Funding↔Spot transfer**: `POST /balances/my/transfer`
  `{ criptomonedaId, cantidad, origen, destino }` — **idempotent** (needs the header, §3).
- Trading order book reserves/settles in **Spot**; withdrawals are **Funding-only**;
  swap can be from funding or spot. (Detail §9.)

## 6. 🆕 User model — layered identity (Radar #14)

- **`username` is immutable** (login handle); **`displayName`** is a new editable,
  non-unique nickname (falls back to `username`). Profile edit (`PUT /usuario/me`)
  now whitelists `displayName`, `pais`, `estado`, `locale` — sending `username`/`rol`/
  limits is silently ignored (mass-assignment cut). Build the profile UI around the split.
- New CIP/KYC profile fields exist (`nombreLegal`, `fechaNacimiento`, `estado`,
  `taxId`, `nivelKyc` tier) — sensitive ones only for the owner/admin.
- **AML risk flag is NEVER in any response** (`Usuario.toJSON` strips it) — don't
  build UI expecting it.
- 🆕 **Email-change flow** (sensitive): `POST /usuario/me/email-change`
  `{ nuevoEmail, passwordActual }` → sends a code to the **new** email; then
  `POST /usuario/me/email-change/confirm` `{ codigo }` → updates the email, notifies
  the old one, and sets a **withdrawal cooldown**. During the cooldown, withdrawals
  return **`403 WITHDRAWAL_COOLDOWN`** — the frontend must surface this state.
  (Detail §10.)

## 7. 🆕 Operator / admin surface (affects an admin panel, not end users)

- Privileged admin actions (system withdrawal/scan triggers, admin balance
  adjust/block/unblock/transfer, master-wallet create, setup-wallets initialize,
  P2P force-status) now require the operator to have **2FA enabled** →
  `403 OPERATOR_MFA_REQUIRED` (or `403 OPERATOR_REQUIRED` for non-admins).
- 🆕 **Business config** admin CRUD: `GET/PUT /config/:clave` (operator-MFA guarded)
  — the admin panel can edit fees/limits/confirmations as data (Radar #13).

## 8. 🟡 Other behavioral changes

- **Rate limiting** is live on auth (login/register/2FA/reset) and withdrawals →
  handle `429` gracefully (backoff + message).
- **Swap preview matches execution** (§5) and the **daily-limit window is UTC** (§6).
- Email/username are **case-insensitive** for uniqueness/login (§4).

---

## How to use this at rebuild time

1. Rebuild the frontend's **API/HTTP layer** against the **English** contract
   (post-Fase-6.2) — base URL, the canonical error-envelope reader, the money-string
   handling, the `Idempotency-Key` interceptor for money POSTs, and the auth/token flow.
2. Pin exact route paths + request/response field names against the **live
   `/api-docs`** — do not hardcode from this doc (names change with the rename).
3. Re-flow the screens that touch: balances (compartmented), money POSTs
   (idempotency + string amounts), auth (Google id_token, email-verified gate),
   profile (username/displayName split + email-change + cooldown), and the admin
   panel (operator-MFA, business config).

---

## Fase 6.2 rename — applied changes (living, per domain)

> As each backend domain is renamed to English (chunked, ~526 tests green after
> each), its concrete old→new contract lands here. Domains not yet listed are still
> in Spanish. Pin exact names against live `/api-docs`.

### ✅ users / auth  (chunk 1 — done)

- **Route base:** `/api/usuario/*` → **`/api/user/*`** (all auth + profile + admin
  user endpoints: `register`, `login`, `login/google`, `logout`, `verify-email`,
  `resend-verification-email`, `forgot-password`, `verify-reset-code`,
  `reset-password`, `me`, `verify-2fa`, `resend-2fa`, `me/2fa-toggle`,
  `me/email-change`, `me/email-change/confirm`, `:id/role`, `:id/status`, …).
- **User object fields (response + request):**
  `rol`→`role`, `activo`→`active`, `pais`→`country`, `estado`→`state` (province),
  `emailVerificado`→`emailVerified`, `dosFactoresActivado`→`twoFactorEnabled`,
  `kycVerificado`→`kycVerified`, `nivelKyc`→`kycLevel`,
  `reputacionPromedio`→`averageRating`, `totalValoraciones`→`totalRatings`,
  `limiteDiarioUsd`→`dailyLimitUsd`, `nombreLegal`→`legalName`,
  `fechaNacimiento`→`dateOfBirth`, `emailPendiente`→`pendingEmail`,
  `cooldownRetiroHasta`→`withdrawalCooldownUntil`.
- **List response key:** `{ usuarios: [...] }` → **`{ users: [...] }`**.
- **Enum values:** `kycLevel` `ninguno|basico|completo` → **`none|basic|full`**.
- **Cross-cutting:** `active` / `role` / `country` are now the field names wherever
  they appear (also on other domains' objects that expose an active flag — those
  domains' full rename lands in later chunks).

### ✅ crypto / config  (chunk 2 — done)

- **Route base:** `/api/criptomoneda/*` → **`/api/crypto/*`**.
- **Crypto object fields:** `nombre`→`name`, `red`→`network`, `decimales`→`decimals`,
  `direccionContrato`→`contractAddress` (`symbol`, `iconUrl`, `active` already/prior).
- **Include alias (big one for the frontend):** objects that embed a currency now
  expose it under **`crypto`** instead of `criptomoneda` (e.g. offers, blockchain
  txs, deposit addresses: `{ ..., crypto: { symbol, name, network, ... } }`).
- **Cross-cutting:** `name` / `network` / `decimals` are now the field names wherever
  they appear (wallets, deposit addresses, payment methods expose `name`/`network`
  too; their model/route rename lands in later chunks).
- **Still Spanish (deferred to owning domains):** the FK `criptomonedaId` on other
  tables (renamed with each owning domain's chunk).
- **Business config (admin):** model `ConfiguracionNegocio`→`BusinessConfig`; columns
  `clave|valor|tipo|categoria|descripcion` → **`key|value|type|category|description`**;
  route param `/config/:clave` → **`/config/:key`** (`type` enum values unchanged).

### ✅ balances / ledger  (chunk 3 — done)

- **Transfer route base:** `/api/transferencia/*` → **`/api/transfer/*`** (`/`, `/:id/process`,
  `/my`, `/:id`, `/:id/cancel`, `/:id/resend-code`, `/verify-funds`, `/stats`).
- **Transfer create/verify-funds request body:** `criptomonedaId`→`cryptoId`, `cantidad`→`amount`,
  `concepto`→`concept` (`recipientId`, `verificationCode` unchanged).
- **Transfer object / responses:** `estado`→`status` with enum values
  **`pendiente|completada|fallida|cancelada` → `pending|completed|failed|cancelled`**;
  response keys `destinatario`→`recipient`, `cantidad`→`amount`, `estado`→`status`,
  `fecha`→`date`; list key `{ transferencias: [...] }` → **`{ transfers: [...] }`**;
  verify-funds keys `tieneFondos`→`hasFunds`, `cantidadSolicitada`→`requestedAmount`,
  `suficiente`→`sufficient`. Transfer include aliases `remitente/destinatario` →
  **`sender/recipient`**, `criptomonedaTransferencia` → **`crypto`**.
- **Balances — my balances (`GET /balances/my/balances`):** per-crypto breakdown key
  `compartimentos` → **`compartments`**; inner compartment keys
  `disponible/bloqueado/pendiente` → **`available/blocked/pending`** (root totals
  `availableBalance/blockedBalance/pendingBalance` unchanged). The `criptomonedaId` key
  on balance objects is still Spanish (deferred FK-echo, renamed with the crypto FK).
- **Balances — compartment transfer (`POST /balances/my/transfer`):** body
  `criptomonedaId`→`cryptoId`, `cantidad`→`amount`, `origen`→`from`, `destino`→`to`;
  response `data.{origen,destino}` → **`data.{from,to}`**.
- **Balances — admin ledger reads:** `getTotalBalance`/compartment reads now return
  `available/blocked/pending` (was `disponible/bloqueado/pendiente`); admin transfer body
  `criptomonedaId`→`cryptoId`; route params `/:criptomonedaId` → **`/:cryptoId`**;
  faucet response `cantidad`→`amount`. `updateBalance` `type` value
  `'disponible'|'bloqueado'` → **`'available'|'blocked'`**.
- **Internal (not client-facing, noted for parity):** models `BalanceUsuario`→`UserBalance`
  (ledger facade), `Transferencia`→`Transfer`, `CuentaLedger`→`LedgerAccount`,
  `AsientoLedger`→`LedgerEntry`, `MovimientoLedger`→`LedgerMovement`,
  `SaldoLedger`→`LedgerBalance`; ledger tables' columns to English
  (`proposito→purpose`, `cuenta_id→account_id`, `asiento_id→entry_id`, `monto→amount`,
  `saldo→balance`, `criptomoneda_id→crypto_id`, `referencia→reference`, `tipo→type`);
  ledger `proposito`/`tipo`/`referencia` **stored values are unchanged** (e.g.
  `'funding:disponible'`, `'reserva_orden'`), only names changed.
- **Still Spanish (deferred to owning domains):** the ledger's public operation param keys
  (`services/…/operations`: `usuarioId`, `criptomonedaId`, `cantidad`, `referencia`, …) —
  they carry data from not-yet-renamed domains (trading/p2p/blockchain/swap) and rename
  with those chunks; the `criptomonedaId` FK column echo on balance/transfer response objects.

### ✅ wallets / blockchain  (chunk 4 — done)

- **Withdraw route** `POST /api/transaccionBlockchain/withdraw` request body:
  `criptomonedaId`→`cryptoId`, `cantidad`→`amount` (`destinationAddress` unchanged).
- **Deposit-address route:** path param `/deposit-address/:criptomonedaId` →
  **`/deposit-address/:cryptoId`**; response `address`/`derivationIndex`/`crypto` (was
  `direccion`).
- **BlockchainTransaction object / responses:** `tipo`→`type` with enum values
  **`deposito|retiro` → `deposit|withdrawal`**; `estado`→`status` with
  **`pendiente|procesando|confirmado|completado|fallido` → `pending|processing|confirmed|completed|failed`**;
  `cantidad`→`amount`, `confirmaciones`→`confirmations`, `direccionDestino`→`destinationAddress`,
  `direccionOrigen`→`sourceAddress`, `feeBlockchain`→`blockchainFee`,
  `confirmacionesRequeridas`→`requiredConfirmations`, `requiereAprobacion`→`requiresApproval`,
  `aprobadoPor`→`approvedBy`, `fechaAprobacion`→`approvalDate`.
- **DepositAddress object:** `direccion`→`address` (also the column); FK `criptomonedaId`→`cryptoId`,
  `walletMaestraId`→`masterWalletId`. Include aliases `usuario`→`user`,
  `walletMaestra`→`masterWallet`, `crypto` unchanged.
- **MasterWallet object:** `direccionPublica`→`publicAddress`, `balanceTotal`→`totalBalance`,
  `descripcion`→`description`, FK `criptomonedaId`→`cryptoId` (`network`, `symbol`, `xpub`,
  `derivationPath`, `fingerprint`, `publicKey` unchanged). **HD-derivation values FROZEN**
  (paths like `m/44'/0'/0'`, xpub prefixes, network names — unchanged, only names/columns changed).
- **Association aliases (embed on User/Crypto):** `direccionesDeposito`→`depositAddresses`,
  `transaccionesBlockchain`→`blockchainTransactions`, `adminAprobador`→`adminApprover`,
  `transaccionesAprobadas`→`approvedTransactions`.
- **Internal:** models `WalletMaestra`→`MasterWallet`, `TransaccionBlockchain`→`BlockchainTransaction`,
  `DireccionDeposito`→`DepositAddress`; tables `wallets_maestras`→`master_wallets`,
  `transacciones_blockchain`→`blockchain_transactions`, `direcciones_deposito`→`deposit_addresses`,
  and their columns to English.
- **Still Spanish (deferred to owning domains):** the ledger's `operations()` param keys
  (`criptomonedaId`/`cantidad`/`referencia`) that the blockchain deposit/withdrawal flows pass —
  they belong to the ledger boundary and rename in a later ledger-interface pass.

### ✅ swap  (chunk 5 — done)

- **HTTP mount paths UNCHANGED** (deferred to the `/api/v1` versioning pass, same as chunk 4):
  the swap-execution endpoint stays `POST /api/intercambioExchange/` and the pair endpoints stay
  under `/api/parExchange/*`. Only field names, enum values, DB columns and internal names changed.
- **Swap execution** `POST /api/intercambioExchange/` request body:
  `tipo`→`type` with enum values **`compra|venta` → `buy|sell`**; `cantidadBase`→`baseAmount`
  (`pairId`, `compartimento` unchanged). Validation messages now name the English field/values.
- **Swap object / responses:** `tipo`→`type` (`buy|sell`), `estado`→`status` with enum values
  **`pendiente|completado|fallido` → `pending|completed|failed`**; `cantidadBase`→`baseAmount`,
  `cantidadQuote`→`quoteAmount`, `precio`→`price`, `comisionMonto`→`feeAmount`,
  `comisionPorcentaje`→`feePercent`; FK `usuarioId`→`userId`, `parId`→`pairId`.
- **List/filter query params:** `?estado=`→`?status=`, `?tipo=`→`?type=` (enum `buy|sell`),
  `?usuarioId=`→`?userId=`. (`fechaDesde`/`fechaHasta` date filters kept as-is.)
- **SwapPair object / responses:** `criptoBaseId`→`baseCryptoId`, `criptoQuoteId`→`quoteCryptoId`,
  `precioActual`→`currentPrice`, `precioAnterior`→`previousPrice`, `volumen24h`→`volume24h`,
  `volumenBase24h`→`volumeBase24h`, `cantidadOperaciones24h`→`operationsCount24h`,
  `precioMaximo24h`→`maxPrice24h`, `precioMinimo24h`→`minPrice24h`,
  `cambiosPorcentaje24h`→`changePercent24h`, `comisionPorcentaje`→`feePercent`,
  `ultimaActualizacion`→`lastUpdated`, `fuentePrecio`→`priceSource`, `simboloExterno`→`externalSymbol`
  (`active` unchanged).
- **Association aliases (embed on User/Crypto/SwapPair):** `intercambios`→`swaps`, `usuario`→`user`,
  `par`→`pair`, `criptoBase`→`baseCrypto`, `criptoQuote`→`quoteCrypto`,
  `paresComoBase`→`pairsAsBase`, `paresComoQuote`→`pairsAsQuote`.
- **Internal:** models `IntercambioExchange`→`Swap`, `ParExchange`→`SwapPair`; tables
  `intercambios_exchange`→`swaps`, `pares_exchange`→`swap_pairs`, and their columns to English;
  `intercambioSettlement.service`→`modules/swap/swapSettlement.service` (return key
  `cantidadFinal`→`finalAmount`). The ledger's swap-only `settleSwap()` now takes English params
  (`userId`/`baseCryptoId`/`baseAmount`/`type` with `buy|sell`); `compartimento`/`referencia`
  stay Spanish (shared ledger vocabulary). `priceService` stays under `services/` (shared infra).

### ✅ trading  (chunk 6 — done)

- **No client-facing field/enum changes.** The trading domain (order book / matching engine)
  was already written in English at the model/column/API level — `Order`, `Trade`, `TradingPair`,
  `PriceCandle`; fields like `orderType`, `side` (`buy|sell`), `quantity`, `price`, `status`,
  `feePercent`, `buyerId`/`sellerId`, `baseAssetId`/`quoteAssetId` were English already. Routes
  stay mounted at `/api/trading/*` (unchanged).
- **Internal only:** moved the domain into `modules/trading/` (controllers, models, entities, routes,
  and the six services from `services/trading/`). The trading-only ledger functions now take English
  params: `settleTrade({ buyerId, sellerId, baseAssetId, quoteAssetId, quantity, quoteAmount,
  buyerFee, sellerFee })`, `reserveForOrder`/`releaseReservation({ userId, cryptoId, quantity })`
  (`referencia` stays Spanish; persisted ledger `type` values `liquidacion_trade`/`reserva_orden`/
  `liberacion_reserva` unchanged — audit-trail semantics, frozen).
- **Still Spanish (deferred):** the `?criptomonedaId=` query param on the trading-balance read and
  the `balance.criptomonedaId` FK-echo — they rename with the crypto FK (balances-domain decision),
  not in this chunk.

### ✅ p2p  (chunk 7 — done)

- **HTTP mount paths UNCHANGED** (deferred to `/api/v1`, same as chunks 4-6): endpoints stay under
  `/api/ofertaP2P/*`, `/api/transaccionP2P/*`, `/api/metodoPago/*`, `/api/ofertaMetodoPago/*`,
  `/api/valoracion/*`. Only field names, enum values, DB columns and internal names changed.
- **P2POffer** (was `OfertaP2P`, table `ofertas_p2p`→`p2p_offers`): `tipo`→`type` with enum values
  **`compra|venta` → `buy|sell`**; `cantidadMin`→`minAmount`, `cantidadMax`→`maxAmount`,
  `precioUnitario`→`unitPrice`, `monedaFiat`→`fiatCurrency`, `condicionesAdicionales`→`additionalTerms`;
  FK `usuarioId`→`userId`, `criptomonedaId`→`cryptoId` (`active` unchanged).
- **P2PTransaction** (was `TransaccionP2P`, table `transacciones_p2p`→`p2p_transactions`): `estado`→`status`
  with enum values **`iniciada|cryptos_bloqueadas|pago_confirmado|completada|cancelada` →
  `initiated|crypto_locked|payment_confirmed|completed|cancelled`**; `cantidad`→`amount`,
  `precioUnitario`→`unitPrice`, `montoFiat`→`fiatAmount`, `monedaFiat`→`fiatCurrency`;
  FK `ofertaId`→`offerId`, `compradorId`→`buyerId`, `vendedorId`→`sellerId`, `criptomonedaId`→`cryptoId`,
  `metodoPagoId`→`paymentMethodId`; `fechaPagoConfirmado`→`paymentConfirmedAt`, `fechaCompletada`→`completedAt`.
- **PaymentMethod** (was `MetodoPago`, table `metodos_pago`→`payment_methods`): `descripcion`→`description`
  (`name`, `active` unchanged). **Rating** (was `Valoracion`, table `valoraciones`→`ratings`):
  `usuarioEvaluadorId`→`raterId`, `usuarioEvaluadoId`→`ratedUserId`, `puntuacion`→`score`,
  `comentario`→`comment`, FK `transaccionP2PId`→`p2pTransactionId`. **OfferPaymentMethod** (was
  `OfertaMetodoPago`, table `oferta_metodos_pago`→`offer_payment_methods`): `ofertaId`→`offerId`,
  `metodoPagoId`→`paymentMethodId`.
- **Association aliases (embed on User/Crypto/…):** `ofertas`→`offers`, `usuario`→`user`,
  `compras`→`purchases`, `comprador`→`buyer`, `ventas`→`sales`, `vendedor`→`seller`,
  `valoracionesDadas`→`ratingsGiven`, `valoracionesRecibidas`→`ratingsReceived`, `evaluador`→`rater`,
  `evaluado`→`ratedUser`, `oferta`→`offer`, `transacciones`→`transactions`, `transaccion`→`transaction`,
  `metodoPago`→`paymentMethod`, `metodosPago`→`paymentMethods`, `valoraciones`→`ratings`,
  `transaccionesP2P`→`p2pTransactions`. **User profile** (`GET /me`) now embeds `ratingsReceived`→`rater`.
- **Internal:** the swap/order-book naming aside, the p2p-only ledger `settleP2P()` now takes English
  params `{ sellerId, buyerId, cryptoId, amount }` (`referencia` stays Spanish; persisted `type` value
  `liquidacion_p2p` frozen). This closes the last deferred ledger boundary from chunk 3. `idempotencyKey`
  and `notificaciones` are not p2p — they move later (notifications = chunk 8).

### ✅ notifications  (chunk 8 — done, final domain chunk)

- **HTTP mount paths UNCHANGED** (deferred to `/api/v1`): endpoints stay under `/api/notificacion/*`
  (incl. the admin route param `/admin/user/:usuarioId`, kept — URL contract).
- **Notification object / responses** (`Notificacion`→`Notification`, table `notificaciones`→`notifications`):
  `usuarioId`→`userId`, `tipo`→`type` with enum values **`seguridad|transaccion|sistema` →
  `security|transaction|system`** (`kyc`, `p2p`, `exchange` unchanged); `titulo`→`title`,
  `mensaje`→`message`, `leida`→`read`, `importante`→`important`, `fechaEnviada`→`sentAt`.
- **Request bodies** (create / bulk / admin endpoints): the notification data keys are now
  `{ userId, type, title, message, important }` (or `{ template, templateData }`); bulk create takes
  `{ notifications: [...] }` (was `notificaciones`); the admin security/transaction endpoints take
  `userId` (+ `transactionId`, `status`). List filter keys are `type|read|important`.
- **Cross-domain callers updated:** `Notificaciones`→`Notification` everywhere (user, transfer, p2p);
  all `createNotification`/`notifyUsersByRole`/`notifyBothParties` call sites pass the English keys.
  Notification *template* event keys (e.g. `CAMBIO_PASSWORD`) and the Spanish title/message text stay
  as-is (internal / user-facing text, i18n = Fase 7.3).

---

**Fase 6.2 domain rename COMPLETE (chunks 1-8).** Every business domain now lives under
`backend/modules/<domain>/` with English identifiers, columns and enum values. Remaining Spanish is
intentional and tracked: HTTP mount paths + URL params (deferred to `/api/v1` versioning), a few
deferred FK-echoes tied to the crypto FK, persisted ledger `type` values (audit-trail, frozen), and
user-facing strings (Fase 7.3 i18n). `idempotencyKey` stays in `models/` (cross-cutting infra, already
English). `controllers/` is now empty and `routes/` holds only the aggregator `index.js`.
