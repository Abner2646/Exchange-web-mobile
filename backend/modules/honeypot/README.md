# Honeypot "Mirage" — authoritative system documentation

> **Read this before touching anything in `backend/modules/honeypot/` or the frontend Mirage
> touchpoints.** This file is the single source of truth for how the deception works, what is
> safe to change, what is sacred, and how isolation from real money/data is guaranteed.

Mirage is an **audit-grade deception system**: when the trap is armed, an attacker who probes
the admin surface is seamlessly served a **fake admin panel that is visually identical to the
real one**, backed by fabricated-but-believable data, while every request they make is
captured as intelligence. They never touch real users, real balances, or the real ledger.

The real owner can always tell the two apart and can preview the fake panel on demand. A real
attacker can never discover that the panel is fake.

---

## 0. Current status — DORMANT

- **`HONEYPOT_ENABLED` is OFF in production.** While off, the guard is a **pure no-op** for
  everyone except an owner who explicitly opts into preview (see §7). Zero cost, zero risk.
- Activation (arming the trap for attackers) is a **deliberate manual step the owner approves**.
  See §11 for the exact procedure. Do **not** flip it on without the owner's explicit go-ahead.

---

## 1. Threat model & philosophy

- Real attackers on this deployment literally hit `/api/admin/*`, `/.env`, and send
  privilege-escalation payloads to `/register` (this is in the forensic logs; it's what the
  mass-assignment incident was). Mirage turns those probes into a controlled study instead of
  a dead 404/403.
- **Deception, not offense.** Mirage only *observes* and *misdirects*. It never attacks back,
  never scams, never phones home to third parties. It is a defensive control.
- **Coherence over temptation.** Fake data that contradicts itself (e.g. "1158 users" on one
  screen and 18 on another) blows the cover. Every number must agree with every other number.

---

## 2. Architecture at a glance

```
            Express  /api  router  (routes/index.js)
                         │
        ┌────────────────▼─────────────────┐
        │   honeypotGuard  (mounted FIRST)  │  ← every /api request passes through here
        └────────────────┬─────────────────┘
          owner? ────────┤ yes → real app (never trapped)        [§6 allowlist]
          owner+preview?─┤ yes → FAKE panel + watermark marker    [§7 preview]
          disabled? ─────┤ yes → next() (real app, no-op)
                         │ no (armed, non-owner)
          honeytoken? ───┤ yes → trap + serve bait               [§5a honeytokens.js]
          risk/exploit? ─┤ yes → mark the IP as trapped          [§5b risk + guard]
          trapped IP? ───┤ yes → FAKE admin + capture + classify [§8 fakeAdmin + fakeData]
                         └─ else → next() (real app)
```

Everything the guard decides is best-effort and wrapped so a bug in the honeypot can **never**
break real traffic — any thrown error falls through to `next()` (the real app).

---

## 3. File-by-file reference

### Backend (`backend/modules/honeypot/`)

| File | Role |
|------|------|
| `honeypotGuard.middleware.js` | **The orchestrator.** The decision tree in §2. Owner/preview gating, trigger evaluation, serves fake responses, threads `ctx` into the fake data. Mounted first in `routes/index.js`. |
| `honeytokens.js` | Bait **path detection** (`isBait`) + bait **responses** (`serveBait`) for fake endpoints that don't exist in the real API (`/admin/*`, `/.env`, `/wp-admin`, …). |
| `risk.service.js` | `score(signals)` → `{score, reasons, verdict}`. Weighted risk (bot UA, hosting/VPN, disposable email, …) + disposable-domain list. Used to classify/rank attackers. |
| `capture.service.js` | Marks trapped sessions and records every request. `findSession`, `markSession`, `logEvent`, `rememberIdentity`. **Reads/writes ONLY `honeypot_*` tables.** |
| `fakeAdmin.service.js` | **Dispatcher.** `respond(req, ctx)` maps every admin path to a fabricated, shape-correct response **and classifies the attacker's intent** (the `action` label + `highValue` flag). |
| `fakeData.js` | **The fabricated world.** Deterministic valid UUIDs, valid crypto addresses, the ~1289-user population, pagination, stats, governance, audit stream, etc. See §9. |
| `realMirror.service.js` | **The one controlled real-data read.** `ownAccountsByIp(ip)` returns the attacker's OWN accounts (same signup IP), excluding the owner. See §10 — read carefully. |
| `honeypot.entity.js` | Sequelize models: `honeypot_sessions`, `honeypot_events`. Fully isolated storage (no real-domain associations). |
| `honeypot.controller.js` | Owner-only intel read handlers: `stats`, `listSessions`, `getSessionEvents`. |
| `honeypot.routes.js` | `GET /honeypot/stats \| /sessions \| /sessions/:id/events`, gated `authenticateToken + isSuperAdmin`. Mounted after the guard. |

### Frontend (Mirage touchpoints)

| File | Role |
|------|------|
| `web/src/shared/mirage.ts` | Preview key helpers (`getPreviewKey/setPreviewKey/isPreview`, sessionStorage `bf_mirage_preview`). |
| `web/src/shared/api/client.ts` | Attaches the `X-Mirage-Preview` header when a preview key is set. |
| `web/src/features/admin/components/AdminTabs.tsx` | Real admin panel. Renders the **watermark** (backend-driven `__mirage`), the **"🍯 Ver panel falso"** owner button, and the exit-preview control. |
| `web/app/(app)/sentinel/page.tsx` | **Owner-only** intel route (`/sentinel`). Gated by `AdminGate` + `OwnerOnly` (email check). Code-split — NOT a tab in `/admin`. |
| `web/src/features/admin/components/HoneypotView.tsx` | Intel UI (stats + sessions + event drill-down) rendered inside `/sentinel`. |
| `web/src/features/admin/components/TreasuryPanel.tsx` | **Honeypot-only** Treasury tab (hot wallet + withdraw form + withdrawals history). Rendered only when the backend sends `treasuryEnabled`. See §9b. |
| `web/src/features/admin/components/WithdrawDialog.tsx` | Shared withdraw dialog (Treasury + per-user). Every submit returns **pending**; captures the attacker's destination wallet. |
| `web/src/features/admin/{types.ts,api.ts,queries.ts}` | Honeypot intel types + API calls + React Query hooks. |
| `web/app/robots.ts` | Disallows `/sentinel`. |

---

## 4. Config / environment

| Var | Meaning | Default |
|-----|---------|---------|
| `HONEYPOT_ENABLED` | Arms the trap for attackers. `true/1/yes` = on. | off |
| `HONEYPOT_ALLOWLIST` | Comma-separated extra user IDs that are never trapped (in addition to the owner). | empty |

- Injected in prod via **Doppler** (`doppler run`). There is **no `.env`** on the box.
- `OWNER_FALLBACK = '04956ec3-e52d-4f10-b0ec-2c2d7c95844c'` (hardcoded owner id in the guard) is
  always allowlisted even if `HONEYPOT_ALLOWLIST` is empty. `OWNER_EMAIL = 'grgurichabner@gmail.com'`
  is the owner-gate used by the frontend (`/sentinel`, the preview button).

---

## 5. How an attacker gets trapped (triggers) + false-positive analysis

Three triggers, **all engineered to be false-positive-safe for this web-only retail exchange**:

### 5a. Honeytoken (`honeytokens.js`)
Probing a bait path that doesn't exist in the real API: `/admin/*`, `/administrator`, `/v1/admin`,
`/internal`, `/.env`, `/config.json`, `/backup`, `/debug`, `/dump`, `/actuator`, `/.git`,
`/wp-admin`, `/phpmyadmin`.
→ **Safe:** the real app calls `/api/user`, `/api/config`, `/api/audit`, … none collide with a
bait path. Only a scanner/attacker hits these.

### 5b. Risk / exploit on auth endpoints (`honeypotGuard` + `signupIntel`/`risk.service`)
On `register`/`login`:
- **Exploit payload** — the body contains `role`, `emailVerified`, `kycVerified`,
  `dailyLimitUsd`, or `isAdmin` (the mass-assignment signature). → trigger `fake_exploit`.
- **Bot UA** — `parseUserAgent(ua).isBot` (curl/python/axios/headless/…). → trigger `risk_score`.

→ **Safe:** the real frontend register sends `{username,email,password,firstTouch}` and login
`{emailOrUsername,password}` — none of the exploit fields. Real users run in a **browser**, so
the UA is Chrome/Safari/Firefox (never `axios`/`curl` — those only appear server-side, and
register/login are client actions). Only scripts/attackers match.

### Once trapped
The IP is recorded in `honeypot_sessions` (`active: true`). Subsequent requests from that IP are
served the fake panel until the session is deactivated.

**Known tradeoff:** trapping is keyed by **IP**. If a trapped datacenter IP were later reused by
a legitimate user (rare — attackers use datacenter IPs, real users are residential), they'd see
fake data. Optional future hardening: a TTL on sessions. Accept or address before relying on it.

---

## 6. Owner is never trapped

`decodeUser(req)` verifies the Bearer JWT with `JWT_SECRET`. If `decoded.id` is in the
allowlist (`OWNER_FALLBACK` + `HONEYPOT_ALLOWLIST`), the guard returns the **real** app
immediately. The owner browsing normally is always on the real system.

---

## 7. Preview & the real/fake distinction (UX + security)

The owner must be able to (a) jump into the fake panel to inspect it and (b) always know which
panel they're on — while an attacker must **never** be able to tell.

- **Entering preview:** in the real admin header the owner sees a **"🍯 Ver panel falso"** button
  (`AdminTabs.tsx`). It sets the preview key and reloads; the API client then sends
  `X-Mirage-Preview`. The guard, seeing **owner JWT + preview header**, serves the fake panel.
  The button is gated by `user.email === OWNER_EMAIL && !preview` → it renders **only** in the
  real panel for the owner, never inside Mirage, never for an attacker.
- **The watermark ("🍯 PANEL FALSO …") is backend-gated.** The guard adds `__mirage: true` to
  `/user/me` **only** in the owner+preview branch. The frontend shows the banner iff
  `user.__mirage` is true.
  - **Why it can't leak to an attacker:** a trapped attacker is served the fake `/user/me` from
    the *trap* branch, which never sets `__mirage`. Even if an attacker sets the header
    themselves, they aren't the owner, so they fall through to the trap branch — no marker. The
    watermark is a **backend decision, not a client flag**. Never change it to a client-side flag.
- **Exiting preview:** the "Salir del preview" button clears the key and reloads.

---

## 8. Serving the fake panel (dispatcher)

For a trapped request the guard builds:

```js
ctx = {
  seed: session.id,                       // stable per attacker, varies per attacker
  identity: { email, username } | null,   // the account they're "logged in" as (captured)
  ownAccounts: [...],                      // their OWN real accounts by IP (see §10)
}
```

and calls `fakeAdmin.respond(req, ctx)`, which returns `{ status, body, action, highValue }`:
- `body` — a fabricated response matching the **real endpoint's shape** (so the real UI renders).
- `action` — the classified intent (`list_users`, `approve_withdrawal`, `escalate_role`,
  `attempt_withdraw`, `move_balance`, …) stored on the event.
- `highValue` — flags the dangerous actions for prioritised review.

Register stays **intercepted** when trapped (fake success granting a fake admin token). This is
required: a real register would create a *normal* account and the `AdminGate` would lock the
attacker out of the panel, defeating the deception.

---

## 9. The fabricated world (`fakeData.js`)

Everything is **deterministic** (seeded) so data is stable within a session but differs per
attacker. Key properties — keep all of these true:

- **Valid UUID v4** ids (`uuidFrom`) — a validator must not flag them.
- **Valid crypto addresses** — real inline **bech32** for BTC (`btcAddress`, verified against the
  BIP173 test vector) and `0x…` for EVM (`ethAddress`). Never ship an invalid address or the
  overused BIP example address.
- **~1289-user population** (`TARGET_USERS`). `fakeUsers(ctx)` builds the full ordered list;
  `fakeUserPage(ctx, query)` returns the **real paginated shape**
  `{ users, total, page, limit, totalPages }` (default limit 20 → 65 pages). The real admin UI
  requests no params, so it shows page 1 + aggregate stats — Mirage mirrors that exactly.
  - The attacker's own account sits at the **top of page 1** (newest). Fabricated **operators**
    (≈1 super_admin + ≈9 admins) are seeded **deep** in the list (old accounts) — never page 1.
  - **~90% Google** users (`googleId` set), breach-style email formats, broad international names.
    Emails are **SYNTHETIC** — see the hard rule in §12.
- **Stats are computed from the population** (`fakeStats`) → they always sum to the total. Never
  hardcode a total that the list can't reproduce.
- **Audit = a deep global stream** (`fakeAudit`): cursor (`beforeId`) + `eventType` filter honored,
  time-descending, money-event types weighted like a busy exchange. Makes "transactions" feel
  continuous. Dashboard bait numbers (custody/volume) are scaled to be coherent with ~1289 users.
- `fakeSampleUser(ctx, i)` returns one user without regenerating the whole list (for mutation
  responses). Use it instead of `fakeUsers(ctx)[i]`.

Generation is fast (~17 ms for the full list, a few ms for a page/audit) — fine for honeypot
traffic. If you grow the surface, keep it deterministic and keep the numbers coherent.

---

## 9b. The withdrawal bait (Treasury)

The strongest honeypot lure: what an attacker who "owns" the panel most wants is to **cash out**.
We give them a convincing withdrawal flow that **never moves anything** — its real purpose is to
capture **their destination wallet** (their cash-out address: actionable threat intel).

- **Surfaces (both fake-panel-only):**
  - A **Treasury tab** (`TreasuryPanel.tsx`): hot-wallet balances + a withdraw form + a
    withdrawals history.
  - A **per-user "Withdraw balance"** button in the users tab (`WithdrawDialog.tsx`), mimicking the
    real attack path (inflate a balance → withdraw it out).
- **How it's gated to the fake panel only:** `fakeMe` includes `treasuryEnabled: true`; the real
  `/user/me` never does. The frontend shows the Treasury tab / per-user button only when that flag
  is present. So the feature appears for a trapped attacker and in owner preview, **never** in the
  real admin.
- **Behaviour (the owner's spec):**
  - The attacker's OWN withdrawals **always** come back `pending` (`POST /treasury/withdraw`,
    `/user/:id/withdraw`, `/transaccionBlockchain/withdraw` → `attempt_withdraw`/`force_user_withdraw`,
    `highValue`). Nothing ever completes, nothing moves.
  - The history is seeded with **other** withdrawals that look `completed` — social proof that
    "withdrawals work here" — but **both the destination tail AND the txid are truncated/masked**
    (`maskAddress`, `maskTxid`). The txid is the real on-chain tracking vector, so masking it (not
    just the address) is what prevents the attacker from verifying that any withdrawal was real.
  - The attacker's submissions are reflected back into the history as pending via
    `capture.getWithdrawAttempts(session)` (reads their own `attempt_withdraw` events).
- **Intel:** the destination wallet is captured verbatim in `honeypot_events.body`
  (visible in the `/sentinel` event drill-down). A dedicated "cash-out addresses" view + a
  **manual, owner-approved** push to the real AML denylist is a sensible follow-up (keep it manual
  — never auto-write from the honeypot to real data).
- **Boundary (do not cross):** never ask the attacker to **deposit** or pay a "fee to unlock" — that
  is advance-fee fraud and is out of scope. A "pending / second-signer / manual review" message is
  fine; "send 0.1 BTC to release" is not.

## 10. The isolation model — **the sacred part**

> Mirage must **never** read, mutate, or expose real money or other customers' data. The entire
> point is that an attacker inside the trap is quarantined from reality.

**Invariants (do not break):**
1. **No money-path access.** The honeypot must never read or write the ledger, balances, wallets,
   swaps, orders, or withdrawals. No `require` of those modules from honeypot code. Mutations the
   attacker "performs" return fabricated success and change nothing real.
2. **Capture touches only `honeypot_*` tables** (`capture.service.js`, `honeypot.entity.js`).
3. **The fabricated world is self-contained** (`fakeData.js` imports only `crypto`).
4. **All honeypot work is best-effort** — any error falls through to the real app; a honeypot bug
   must never break or slow real traffic or tip off an attacker.
5. **The owner is never trapped; intel is owner-only** (`/sentinel`, `/honeypot/*` gated by
   `isSuperAdmin`, and the guard intercepts a trapped attacker before these routes).

### The ONE controlled real-data read — `realMirror.ownAccountsByIp(ip)`
There is exactly one deliberate exception, and it is tightly scoped:
- It reads the **users** table joined to `user_signup_info` to return **only the accounts that
  registered from the attacker's own IP**, and it **always excludes the owner**.
- **Why it's allowed:** those are the attacker's **own** accounts — data they already know. It
  lets their just-created account show up live in the fake panel so a multi-account attacker
  isn't tipped off. It is **read-only**, **IP-scoped**, and **never** returns another customer's
  row or any money-path data.
- **Decision history:** the owner explicitly chose this over dumping the whole real user table
  (which would leak other customers' PII to attackers). Do **not** widen it to all users.

---

## 11. Identity mirroring (the attacker's own account)

So an attacker sees "their" account without us leaking anyone else's:
- At register/login the guard calls `capture.rememberIdentity` → stores `captured_email` /
  `captured_username` on the session (first one wins).
- `fakeMe(ctx)` echoes that email/username as a **super_admin** (what they think they escalated to).
- `fakeUsers(ctx)` puts that account at the **top of page 1** and merges in any other same-IP
  real accounts from `realMirror`. De-duped by email. No other real customer is ever read.

---

## 12. Hard rules for any agent (DO / DON'T)

**DO**
- Keep every fabricated number **coherent** with every other (totals = sums, dashboard = list).
- Keep fake responses matching the **real endpoint shapes** (shape drift is a tell). If a real
  endpoint changes its contract, update the matching fake.
- Keep generation **deterministic** and keep the watermark **backend-gated**.
- Add new captured intent as new `action` labels in `fakeAdmin.service.js`.

**DON'T**
- ❌ **Never use real/leaked-database emails** for fabricated users. The owner once asked for this;
  it was rejected and must stay rejected: it exposes real people's PII, hands attackers a curated
  victim list for phishing, and if cross-referenced against known breach dumps it *blows the
  cover*. Synthetic emails are indistinguishable to anyone viewing the panel — same realism, zero
  harm. (Recorded in agent memory `honeypot-mirage-system`.)
- ❌ Never let the honeypot read/write real money-path data (§10).
- ❌ Never make the watermark a client-side flag, and never expose the "Honeypot/Mirage" concept as
  a visible tab or label in `/admin` (attackers see `/admin`). Intel lives at `/sentinel` only.
- ❌ Never arm `HONEYPOT_ENABLED` without the owner's explicit approval.
- ❌ Never add Telegram/third-party alerts — the owner opted out; intel is reviewed on `/sentinel`.

---

## 13. Activation / deactivation (ops)

**Arming (owner-approved):**
1. Set `HONEYPOT_ENABLED=true` in the **Doppler dashboard** (config `bitflow/prd`). The box's
   Doppler token is **read-only**, so this cannot be done from the box — it must be set in the
   dashboard.
2. Restart the backend so `doppler run` re-injects: `pm2 restart bitflow-backend --update-env`.
3. Run the controlled test in §14.

**Disarming:** set `HONEYPOT_ENABLED` back to off (or remove it) in Doppler and restart. The guard
instantly returns to a pure no-op.

---

## 14. How to test / verify

- **Owner preview (works even while disabled):** open `/admin` → "🍯 Ver panel falso", or hit any
  admin API with an owner JWT + `X-Mirage-Preview: on`. `/user` should return the paginated shape
  with `total: 1289`; `/user/admin/stats` should sum to 1289; `/audit` should stream with a cursor.
- **Go/no-go test once armed:**
  1. **Legit browser user** registers/logs in/browses → must get the **real** app (not trapped).
  2. **Simulated attacker** (bot UA + mass-assignment, or probe `/admin/*`) → must get the **fake**
     panel and produce a row in `honeypot_sessions` + `honeypot_events`.
  3. **Owner** browsing normally → **real** app (allowlist).
- **Review intel:** `/sentinel` (owner-only) or `GET /api/honeypot/{stats,sessions,sessions/:id/events}`.

---

## 15. Data model

**`honeypot_sessions`** — one row per trapped attacker: `id`, `ip`, `markedUserId`, `trigger`
(`honeytoken | risk_score | fake_exploit`), `riskScore`, `reason`, `userAgent`, `capturedEmail`,
`capturedUsername`, `ipCountry`, `ipIsp`, `eventCount`, `active`, `firstSeenAt`, `lastSeenAt`.

**`honeypot_events`** — every request a trapped attacker makes: `id`, `sessionId`, `ip`,
`userAgent`, `method`, `path`, `query`, `body` (the verbatim payload — it *is* the exploit,
capped), `headers`, `action` (classified intent), `statusServed`.

> **Prod schema note:** prod boots with `sequelize.sync()` (no alter). New **columns** on existing
> honeypot tables need a **manual `ALTER`** at deploy time (e.g. `captured_email/username` were
> added that way). New tables are created automatically.

---

## 16. Related agent memory

`honeypot-mirage-system` (design + status), `prod-deploy-access` (EC2/SSH/pm2),
`prod-schema-sync-no-alter`, `signup-intel-and-role-hardening`,
`security-incident-register-mass-assignment`.
