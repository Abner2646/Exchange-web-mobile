// Fabricated admin data for the honeypot. Mirrors the REAL admin API shapes so the genuine
// admin UI renders identically — but every byte is invented and NO real DB row is read.
//
// Realism goals (to survive a careful attacker): valid UUID v4 ids, valid crypto addresses,
// ~90% Google-created users, high-entropy varied users, stats COMPUTED from the list (so they
// always agree), and a per-session seed (stable within a visit, different per attacker).
//
// Isolation vs "my own account should appear": we never read the real users table. Instead we
// MIRROR the attacker's OWN captured identity (the email/username they registered with, which
// they already know) as their account — so they see themselves in the list without any real
// PII leaking.
const crypto = require('crypto');

// ── Deterministic, VALID UUID v4 ────────────────────────────────────────────────
function uuidFrom(seed) {
  const h = crypto.createHash('md5').update('hp:' + seed).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16); // 8..b
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// ── Seeded PRNG (stable per seed) ───────────────────────────────────────────────
function rng(seedStr) {
  let s = 2166136261 >>> 0;
  for (const c of String(seedStr)) { s ^= c.charCodeAt(0); s = Math.imul(s, 16777619) >>> 0; }
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ── Valid crypto addresses (real bech32 for BTC; 0x for EVM) ─────────────────────
const B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function b32Polymod(v) { let chk = 1; const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]; for (const x of v) { const b = chk >> 25; chk = ((chk & 0x1ffffff) << 5) ^ x; for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= G[i]; } return chk; }
function b32HrpExpand(h) { const r = []; for (let i = 0; i < h.length; i++) r.push(h.charCodeAt(i) >> 5); r.push(0); for (let i = 0; i < h.length; i++) r.push(h.charCodeAt(i) & 31); return r; }
function b32Encode(hrp, data) { const v = b32HrpExpand(hrp).concat(data); const pm = b32Polymod(v.concat([0, 0, 0, 0, 0, 0])) ^ 1; const chk = []; for (let i = 0; i < 6; i++) chk.push((pm >> 5 * (5 - i)) & 31); let s = hrp + '1'; for (const d of data.concat(chk)) s += B32[d]; return s; }
function convertBits(data, from, to, pad) { let acc = 0, bits = 0; const ret = []; const max = (1 << to) - 1; for (const val of data) { acc = (acc << from) | val; bits += from; while (bits >= to) { bits -= to; ret.push((acc >> bits) & max); } } if (pad && bits > 0) ret.push((acc << (to - bits)) & max); return ret; }
function btcAddress(seed) {
  const bytes = Array.from(crypto.createHash('sha256').update('btc:' + seed).digest().slice(0, 20));
  return b32Encode('bc', [0].concat(convertBits(bytes, 8, 5, true)));
}
function ethAddress(seed) { return '0x' + crypto.createHash('sha256').update('eth:' + seed).digest('hex').slice(0, 40); }

// ── People ───────────────────────────────────────────────────────────────────
// Broad, international pools so a 1289-row user base has natural variety (no obvious repeats).
const FIRST = ['liam', 'noah', 'olivia', 'emma', 'ava', 'sophia', 'lucas', 'mateo', 'santiago', 'camila', 'wei', 'yan', 'chen', 'arjun', 'priya', 'aditya', 'ahmed', 'fatima', 'youssef', 'ivan', 'natalia', 'dmitri', 'hiroshi', 'yuki', 'kwame', 'amara', 'thiago', 'isabella', 'mohamed', 'sofia', 'daniel', 'ethan', 'mia', 'james', 'maria', 'michael', 'david', 'sarah', 'jessica', 'ryan', 'kevin', 'brian', 'laura', 'emily', 'tyler', 'austin', 'hannah', 'grace', 'nathan', 'jordan', 'carlos', 'diego', 'lucia', 'valentina', 'andres', 'gabriel', 'felipe', 'rafael', 'bruno', 'leonardo', 'min', 'jin', 'hao', 'feng', 'mei', 'ananya', 'rohan', 'kiran', 'vikram', 'neha', 'omar', 'layla', 'hassan', 'zainab', 'oleksandr', 'kateryna', 'sergei', 'anastasia', 'viktor', 'marco', 'giulia', 'luca', 'pierre', 'camille', 'lukas', 'anna', 'jan', 'eva', 'tomasz', 'chidi', 'ngozi', 'tunde', 'kofi', 'abena', 'haruto', 'sakura', 'ren', 'ji-woo', 'seo-yeon', 'budi', 'siti', 'nguyen', 'minh'];
const LAST = ['garcia', 'martinez', 'lopez', 'silva', 'santos', 'kim', 'park', 'chen', 'wang', 'li', 'patel', 'sharma', 'khan', 'ali', 'nguyen', 'tran', 'muller', 'rossi', 'dubois', 'ivanov', 'petrov', 'yamamoto', 'tanaka', 'okafor', 'mensah', 'cohen', 'levi', 'smith', 'brown', 'jones', 'oliveira', 'costa', 'williams', 'johnson', 'miller', 'davis', 'wilson', 'anderson', 'taylor', 'thomas', 'moore', 'jackson', 'white', 'harris', 'clark', 'lewis', 'walker', 'hall', 'young', 'king', 'wright', 'hill', 'green', 'baker', 'nelson', 'carter', 'mitchell', 'perez', 'roberts', 'gomez', 'fernandez', 'rodriguez', 'gonzalez', 'ramirez', 'torres', 'flores', 'rivera', 'morales', 'ortiz', 'gupta', 'singh', 'kumar', 'reddy', 'das', 'bose', 'kovalenko', 'shevchenko', 'novak', 'kowalski', 'schmidt', 'fischer', 'weber', 'meyer', 'bauer', 'hoffmann', 'bernard', 'martin', 'moreau', 'ferrari', 'russo', 'bianchi', 'eze', 'adeyemi', 'mwangi', 'sato', 'suzuki', 'takahashi', 'lee', 'cho', 'jung', 'wong', 'lim'];
// Breach-style domain long tail: free providers dominate, gmail most common, plus legacy ones.
const FREE_DOMAINS = ['gmail.com', 'gmail.com', 'gmail.com', 'yahoo.com', 'yahoo.com', 'hotmail.com', 'hotmail.com', 'outlook.com', 'outlook.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com', 'live.com', 'mail.com', 'gmx.com', 'yandex.com', 'zoho.com'];
const COUNTRIES = ['US', 'US', 'US', 'US', 'US', 'GB', 'GB', 'CA', 'CA', 'DE', 'FR', 'BR', 'BR', 'IN', 'IN', 'IN', 'NG', 'JP', 'AU', 'ES', 'MX', 'AR', 'TR', 'ID', 'IT', 'NL', 'PH', 'VN', 'KR', 'UA'];

function googleId(r) { return (BigInt(100000000000000000000n) + BigInt(Math.floor(r() * 9e19))).toString(); }

const NICK = ['crypto', 'hodl', 'moon', 'satoshi', 'degen', 'ape', 'whale', 'diamond', 'bull', 'ser', 'gm', 'wagmi', 'ngmi', 'lambo', 'rekt', 'fomo', 'alpha', 'chad', 'king', 'pro', 'trader', 'btc', 'eth', 'sol', 'x', 'the', 'mr', 'its'];
function makeUser(seed, role) {
  const r = rng('u:' + seed);
  const fn = FIRST[Math.floor(r() * FIRST.length)];
  const ln = LAST[Math.floor(r() * LAST.length)];
  const google = r() < 0.9; // ~90% created with Google
  const n = Math.floor(r() * 9900) + 10;
  const nick = r() < 0.2; // ~20% use a crypto-style handle (very common in breach dumps)
  const uStyle = Math.floor(r() * 5);
  const username = nick
    ? [`${NICK[Math.floor(r() * NICK.length)]}_${fn}${n % 100}`, `${fn}${NICK[Math.floor(r() * NICK.length)]}`, `${NICK[Math.floor(r() * NICK.length)]}${ln}${n % 1000}`, `x${fn}x`][Math.floor(r() * 4)]
    : [`${fn}${ln}`, `${fn}.${ln}`, `${fn}_${ln}`, `${fn}${ln}${n % 1000}`, `${fn}${n}`][uStyle];
  const domain = google ? (r() < 0.9 ? 'gmail.com' : 'googlemail.com') : FREE_DOMAINS[Math.floor(r() * FREE_DOMAINS.length)];
  // Breach reality: the email local-part is often the username itself.
  const local = r() < 0.5 ? username : `${fn}.${ln}${r() < 0.4 ? n : ''}`;
  const email = `${local}@${domain}`;
  const hasLimit = r() < 0.18;
  const limit = hasLimit ? [2500, 5000, 10000, 25000, 50000][Math.floor(r() * 5)] : 1000;
  const nRatings = r() < 0.45 ? Math.floor(r() * 60) : 0;
  const avg = nRatings === 0 ? 0 : 3.6 + r() * 1.4;
  return {
    id: uuidFrom('user:' + seed),
    username, email, role: role || 'normal',
    active: r() > 0.06,
    kycVerified: r() < 0.33,
    dailyLimitUsd: Number(limit).toFixed(2),
    averageRating: avg.toFixed(2),
    totalRatings: nRatings,
    country: COUNTRIES[Math.floor(r() * COUNTRIES.length)],
    googleId: google ? googleId(r) : null,
  };
}

// Simulated exchange size. The user base reads ~1289 accounts (stable, coherent with stats).
const TARGET_USERS = 1289;

// ctx = { seed, identity:{email,username}|null, ownAccounts:[...] }
//   ownAccounts = the attacker's OWN real accounts (same signup IP), fetched live by the guard.
//   identity    = the account they're currently "logged in" as (captured at register/login).
// The list = their own accounts (real + just-created) ∪ fabricated padding, de-duped by email.
// Their primary account shows as super_admin (consistent with /user/me). No other real customer
// is ever read — only the attacker's own rows.
function fakeUsers(ctx = {}) {
  const seed = ctx.seed || 'static';
  const own = Array.isArray(ctx.ownAccounts) ? ctx.ownAccounts : [];
  const identity = ctx.identity || null;
  const primaryEmail = (identity && identity.email) || (own[0] && own[0].email) || null;
  const r = rng('list:' + seed);
  const seen = new Set();
  const users = [];
  const push = (u) => {
    const e = String(u.email || '').toLowerCase();
    if (!e || seen.has(e)) return;
    seen.add(e);
    users.push({ ...u, dailyLimitUsd: String(u.dailyLimitUsd), averageRating: String(u.averageRating), totalRatings: u.totalRatings || 0 });
  };

  // 1) The account they're logged in as → super_admin, their own email (matches /user/me).
  if (primaryEmail) {
    const base = own.find((u) => String(u.email || '').toLowerCase() === primaryEmail.toLowerCase());
    push({
      id: (base && base.id) || uuidFrom('self:' + primaryEmail),
      username: (identity && identity.username) || (base && base.username) || primaryEmail.split('@')[0],
      email: primaryEmail, role: 'super_admin', active: true,
      kycVerified: base ? !!base.kycVerified : false,
      dailyLimitUsd: base && base.dailyLimitUsd != null ? base.dailyLimitUsd : '1000.00',
      averageRating: base && base.averageRating != null ? base.averageRating : '0.00',
      totalRatings: (base && base.totalRatings) || 0,
      country: (base && base.country) || null,
      googleId: /@(gmail|googlemail)\./i.test(primaryEmail) ? (base && base.googleId) || googleId(r) : base ? base.googleId : null,
    });
  }
  // 2) Their OTHER real accounts (same IP), exactly as they are.
  for (const u of own) push(u);
  // 3) Fabricated padding until the base reads ~TARGET_USERS. The loop keeps generating until
  //    enough UNIQUE emails land (push de-dupes), so the count is exact despite collisions.
  let i = 0;
  while (users.length < TARGET_USERS && i < TARGET_USERS * 4) {
    push(makeUser(seed + ':' + i, 'normal'));
    i += 1;
  }
  // Operators are OLD accounts → seed them DEEP in the list (never on page 1, which is newest),
  // so "sorted by newest" looks right. The attacker's own super_admin stays at the top.
  const r2 = rng('ops:' + seed);
  const opCount = 6 + Math.floor(r2() * 4); // 6–9 operators
  for (let k = 0; k < opCount; k += 1) {
    const idx = Math.floor(users.length * 0.45 + r2() * users.length * 0.5);
    if (users[idx] && users[idx].role === 'normal') users[idx].role = !primaryEmail && k === 0 ? 'super_admin' : 'admin';
  }
  return users;
}

// The admin list endpoint PAGINATES (real shape: { users, total, page, limit, totalPages },
// default limit 20). Mirror it exactly so an attacker inspecting the JSON sees total=1289 and
// a page of rows, and the real UI (which requests no params) shows page 1. Their own account,
// being newest, sits at the top of page 1.
function fakeUserPage(ctx = {}, query = {}) {
  const all = fakeUsers(ctx);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 200);
  const offset = (page - 1) * limit;
  return { users: all.slice(offset, offset + limit), total: all.length, page, limit, totalPages: Math.ceil(all.length / limit) };
}

function fakeUserCount() { return TARGET_USERS; }

// A single fabricated user (for mutation responses that echo "the affected user") — avoids
// generating the whole 1289-row list just to grab one sample.
function fakeSampleUser(ctx = {}, i = 2) {
  const u = makeUser((ctx.seed || 'static') + ':s' + i, 'normal');
  return { ...u, dailyLimitUsd: String(u.dailyLimitUsd), averageRating: String(u.averageRating) };
}

function fakeMe(ctx = {}) {
  const own = Array.isArray(ctx.ownAccounts) ? ctx.ownAccounts : [];
  const identity = ctx.identity || null;
  const email = (identity && identity.email) || (own[0] && own[0].email) || 'operator@bitflow.community';
  const username = (identity && identity.username) || (own[0] && own[0].username) || email.split('@')[0];
  return {
    id: uuidFrom('self:' + email), email, username, role: 'super_admin',
    emailVerified: true, kycVerified: true, active: true, twoFactorEnabled: true,
    dailyLimitUsd: '1000000.00', averageRating: '0.00', totalRatings: 0, country: null,
    googleId: /@(gmail|googlemail)\./i.test(email) ? '117394028561203947755' : null,
    // Backend-driven flag that makes the fake panel render the Treasury/withdraw surface. The
    // REAL /user/me never includes it, so the real admin panel never shows Treasury — only the
    // trap (and owner preview) do. Keeps the withdraw bait isolated to Mirage.
    treasuryEnabled: true,
  };
}

// Stats are COMPUTED from the same user list → they can never contradict it.
function fakeStats(users) {
  const map = new Map();
  for (const u of users) {
    const k = `${u.role}|${u.kycVerified}|${u.active}|${u.country || ''}`;
    const row = map.get(k) || { role: u.role, kycVerified: u.kycVerified, active: u.active, country: u.country, total: 0 };
    row.total += 1; map.set(k, row);
  }
  return [...map.values()].map((x) => ({ ...x, total: String(x.total) }));
}

function fakeGovernancePending(ctx = {}) {
  const seed = ctx.seed || 'static';
  const r = rng('gov:' + seed);
  const now = Date.now();
  const btcAmt = (0.2 + r() * 0.9);
  const usd = Math.round(btcAmt * 86000);
  return {
    pending: [
      {
        id: uuidFrom('gov1:' + seed), actionType: 'large_withdrawal_release', status: 'pending',
        amountUsd: usd.toFixed(2), makerUserId: uuidFrom('user:' + seed + ':7'), checkerUserId: null,
        payload: { crypto: 'BTC', amount: btcAmt.toFixed(8), destinationAddress: btcAddress('gov:' + seed), network: 'bitcoin' },
        rejectionReason: null, result: null,
        expiresAt: new Date(now + (14 + r() * 8) * 36e5).toISOString(), resolvedAt: null, created_at: new Date(now - (1 + r() * 4) * 36e5).toISOString(),
      },
      {
        id: uuidFrom('gov2:' + seed), actionType: 'admin_balance_update', status: 'pending',
        amountUsd: (4000 + Math.floor(r() * 16000)).toFixed(2), makerUserId: uuidFrom('user:' + seed + ':2'), checkerUserId: null,
        payload: { crypto: 'USDT', amount: (4000 + Math.floor(r() * 16000)).toFixed(6), targetUserId: uuidFrom('user:' + seed + ':11'), reason: 'reconciliation adjustment' },
        rejectionReason: null, result: null,
        expiresAt: new Date(now + (14 + r() * 8) * 36e5).toISOString(), resolvedAt: null, created_at: new Date(now - (3 + r() * 6) * 36e5).toISOString(),
      },
    ],
  };
}

function fakeReadiness(ctx = {}) {
  const ops = fakeUsers(ctx).filter((u) => u.role !== 'normal').slice(0, 5);
  return {
    ready: true, operatorCount: ops.length, enrolledCount: ops.length, minEnrolled: 2, pending: [],
    enrolled: ops.map((u) => ({ id: u.id, email: u.email, role: u.role, active: true, totpEnabled: true, twoFactorEnabled: true })),
    reasons: [],
  };
}

function fakeConfig() {
  return {
    data: [
      { key: 'withdrawal_fee_percent', value: '0.15', type: 'number', category: 'fees' },
      { key: 'trading_fee_maker_percent', value: '0.1', type: 'number', category: 'fees' },
      { key: 'trading_fee_taker_percent', value: '0.2', type: 'number', category: 'fees' },
      { key: 'min_withdrawal_usd', value: '20', type: 'number', category: 'limits' },
      { key: 'default_daily_limit_usd', value: '1000', type: 'number', category: 'limits' },
      { key: 'maintenance_mode', value: 'false', type: 'boolean', category: 'system' },
    ],
  };
}

const fakeAmlConfig = () => ({ monitoringEnabled: true, holdEnforcementEnabled: true });
function fakeDenylist(ctx = {}) {
  const seed = ctx.seed || 'static';
  return [
    { id: uuidFrom('dl1:' + seed), address: ethAddress('dl1:' + seed), network: 'ethereum', reason: 'OFAC SDN list', source: 'manual' },
    { id: uuidFrom('dl2:' + seed), address: btcAddress('dl2:' + seed), network: 'bitcoin', reason: 'ransomware cluster', source: 'chainalysis' },
    { id: uuidFrom('dl3:' + seed), address: ethAddress('dl3:' + seed), network: 'ethereum', reason: 'mixer / Tornado', source: 'trm' },
  ];
}
function fakeCases(ctx = {}) {
  const seed = ctx.seed || 'static';
  const r = rng('case:' + seed);
  return [
    { id: uuidFrom('case1:' + seed), status: 'open', userId: uuidFrom('user:' + seed + ':13'), riskScore: 70 + Math.floor(r() * 25), created_at: new Date(Date.now() - (1 + r() * 3) * 864e5).toISOString() },
  ];
}
// The audit log is a GLOBAL exchange artifact (same stream for everyone), so it's keyed off a
// deep virtual id space — not a per-session seed — to feel like a busy 1289-user exchange with
// constant money activity. Cursor (beforeId) + eventType filter are honored so "load more" and
// the type filter in the real UI both work against the fabricated stream.
const AUDIT_LATEST_ID = 48217;
const AUDIT_TYPES = [['TradeExecuted', 34], ['SwapExecuted', 22], ['DepositConfirmed', 18], ['WithdrawalRequested', 12], ['P2PTransactionCompleted', 9], ['WithdrawalCompleted', 3], ['AdminBalanceUpdate', 2]];
function hashInt(s, slice) { return parseInt(crypto.createHash('md5').update(s).digest('hex').slice(0, slice), 16); }
function auditTypeFor(id) {
  const h = hashInt('atype:' + id, 8) % 100;
  let acc = 0;
  for (const [t, w] of AUDIT_TYPES) { acc += w; if (h < acc) return t; }
  return 'TradeExecuted';
}
function fakeAudit(ctx = {}, query = {}) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 25, 1), 100);
  const filter = query.eventType || null;
  let id = query.beforeId ? Math.min(parseInt(query.beforeId, 10) || AUDIT_LATEST_ID, AUDIT_LATEST_ID) - 1 : AUDIT_LATEST_ID;
  const rows = [];
  while (rows.length < limit && id > 1) {
    const type = auditTypeFor(id);
    if (!filter || type === filter) {
      const secondsAgo = (AUDIT_LATEST_ID - id) * 210 + (hashInt('t:' + id, 4) % 120); // ~3.5 min apart, monotonic
      rows.push({
        id,
        eventId: uuidFrom('ev:' + id),
        eventType: type,
        aggregateId: uuidFrom('agg:' + id),
        occurredAt: new Date(Date.now() - secondsAgo * 1000).toISOString(),
        hash: crypto.createHash('sha256').update('hp:audit:' + id).digest('hex'),
        prevHash: crypto.createHash('sha256').update('hp:audit:' + (id - 1)).digest('hex'),
      });
    }
    id -= 1;
  }
  const nextBeforeId = rows.length === limit && id > 1 ? rows[rows.length - 1].id : null;
  return { rows, nextBeforeId };
}
const fakeAuditVerify = () => ({ ok: true, brokenAtSeq: null, checked: AUDIT_LATEST_ID });

// ── Treasury / withdrawal bait (fake-panel-only) ────────────────────────────────
// The attacker's OWN withdrawals ALWAYS stay 'pending' (nothing ever moves). We seed a history
// of OTHER withdrawals that look 'completed' to give social proof that "withdrawals work here"
// — but both the destination tail AND the txid are TRUNCATED so the attacker can never verify
// on-chain whether any of it was real (the txid is the real tracking vector, so it's masked too).
const PRICES = { BTC: 86000, ETH: 3200, USDT: 1 };
function fakeTxid(seed) { return crypto.createHash('sha256').update('txid:' + seed).digest('hex'); }
function maskAddress(a) { const s = String(a || ''); return s ? s.slice(0, 16) + '••••' : '—'; }
function maskTxid(t) { const s = String(t || ''); return s ? s.slice(0, 10) + '…' : null; }
function maskEmail(e) { const s = String(e || ''); const [l, d] = s.split('@'); return l && d ? l.slice(0, 1) + '•••@' + d : '—'; }

function fakeHotWallet() {
  return {
    custodyUsd: '4218500.00',
    assets: [
      { crypto: 'BTC', balance: '7.41203000', usd: '637435.00' },
      { crypto: 'ETH', balance: '82.55400000', usd: '264172.00' },
      { crypto: 'USDT', balance: '318400.00', usd: '318400.00' },
    ],
  };
}

function oneWithdrawal(seed) {
  const r = rng('wd:' + seed);
  const crypto_ = ['BTC', 'BTC', 'ETH', 'USDT', 'USDT'][Math.floor(r() * 5)];
  const amt = crypto_ === 'BTC' ? 0.02 + r() * 1.4 : crypto_ === 'ETH' ? 0.3 + r() * 12 : 200 + r() * 18000;
  const addr = crypto_ === 'BTC' ? btcAddress('wd:' + seed) : ethAddress('wd:' + seed);
  const h = r();
  const status = h < 0.82 ? 'completed' : h < 0.94 ? 'pending' : 'rejected';
  const createdAt = new Date(Date.now() - r() * 26 * 864e5);
  return {
    id: uuidFrom('wd:' + seed),
    crypto: crypto_,
    amount: amt.toFixed(crypto_ === 'USDT' ? 2 : 8),
    amountUsd: (amt * PRICES[crypto_]).toFixed(2),
    destination: maskAddress(addr),
    txid: status === 'completed' ? maskTxid(fakeTxid('wd:' + seed)) : null,
    status,
    requestedBy: maskEmail(makeUser('wreq:' + seed).email),
    createdAt: createdAt.toISOString(),
    completedAt: status === 'completed' ? new Date(createdAt.getTime() + (10 + r() * 120) * 6e4).toISOString() : null,
  };
}

// ctx + ownPending (the attacker's captured withdraw attempts) → the withdrawals table.
function fakeWithdrawals(ctx = {}, ownPending = []) {
  const seed = ctx.seed || 'static';
  const r = rng('wdlist:' + seed);
  const me = maskEmail(fakeMe(ctx).email);
  const rows = [];
  // The attacker's OWN withdrawals → ALWAYS pending. Never completes, nothing moves.
  for (const w of ownPending) {
    rows.push({
      id: w.id || uuidFrom('ownwd:' + (w.createdAt || '') + (w.destination || '')),
      crypto: w.crypto || 'BTC',
      amount: w.amount != null ? String(w.amount) : '—',
      amountUsd: null,
      destination: maskAddress(w.destination),
      txid: null,
      status: 'pending',
      requestedBy: me,
      createdAt: w.createdAt || new Date().toISOString(),
      completedAt: null,
      note: 'Pendiente: requiere segundo firmante (operator-MFA §500.12).',
    });
  }
  // Seeded history: mostly completed (masked), some pending, a few rejected.
  const n = 14 + Math.floor(r() * 10);
  for (let i = 0; i < n; i += 1) rows.push(oneWithdrawal(seed + ':' + i));
  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return rows;
}

// Opaque honeypot token (NOT signed with the real JWT_SECRET; the guard keys off IP/identity).
function fakeAdminToken(sessionId) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ id: uuidFrom('self:' + sessionId), role: 'super_admin', hp: sessionId, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const sig = crypto.createHash('sha256').update(head + body + 'mirage').digest('base64url');
  return `${head}.${body}.${sig}`;
}

module.exports = {
  fakeUsers, fakeUserPage, fakeUserCount, fakeSampleUser, fakeMe, fakeStats, fakeGovernancePending,
  fakeReadiness, fakeConfig, fakeAmlConfig, fakeDenylist, fakeCases, fakeAudit,
  fakeAuditVerify, fakeAdminToken, fakeHotWallet, fakeWithdrawals, uuidFrom, btcAddress, ethAddress,
};
