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
const FIRST = ['liam', 'noah', 'olivia', 'emma', 'ava', 'sophia', 'lucas', 'mateo', 'santiago', 'camila', 'wei', 'yan', 'chen', 'arjun', 'priya', 'aditya', 'ahmed', 'fatima', 'youssef', 'ivan', 'natalia', 'dmitri', 'hiroshi', 'yuki', 'kwame', 'amara', 'lucas', 'thiago', 'isabella', 'mohamed', 'sofia', 'daniel', 'ethan', 'mia', 'james', 'maria'];
const LAST = ['garcia', 'martinez', 'lopez', 'silva', 'santos', 'kim', 'park', 'chen', 'wang', 'li', 'patel', 'sharma', 'khan', 'ali', 'nguyen', 'tran', 'muller', 'rossi', 'dubois', 'ivanov', 'petrov', 'yamamoto', 'tanaka', 'okafor', 'mensah', 'cohen', 'levi', 'smith', 'brown', 'jones', 'oliveira', 'costa'];
const FREE_DOMAINS = ['gmail.com', 'gmail.com', 'gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'yahoo.com', 'proton.me'];
const COUNTRIES = ['US', 'US', 'US', 'US', 'GB', 'GB', 'CA', 'DE', 'FR', 'BR', 'IN', 'IN', 'NG', 'JP', 'AU', 'ES', 'MX', 'AR', 'TR', 'ID'];

function googleId(r) { return (BigInt(100000000000000000000n) + BigInt(Math.floor(r() * 9e19))).toString(); }

function makeUser(seed, role) {
  const r = rng('u:' + seed);
  const fn = FIRST[Math.floor(r() * FIRST.length)];
  const ln = LAST[Math.floor(r() * LAST.length)];
  const google = r() < 0.9; // ~90% created with Google
  const n = Math.floor(r() * 9900) + 10;
  const uStyle = Math.floor(r() * 5);
  const username = [`${fn}${ln}`, `${fn}.${ln}`, `${fn}_${ln}`, `${fn}${ln}${n % 1000}`, `${fn}${n}`][uStyle];
  const domain = google ? (r() < 0.9 ? 'gmail.com' : 'googlemail.com') : FREE_DOMAINS[Math.floor(r() * FREE_DOMAINS.length)];
  const email = `${fn}.${ln}${r() < 0.4 ? n : ''}@${domain}`;
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

// ctx = { seed, identity:{email,username}|null }
function fakeUsers(ctx = {}) {
  const seed = ctx.seed || 'static';
  const r = rng('list:' + seed);
  const n = 46 + Math.floor(r() * 34); // 46–80
  const users = [];
  // The attacker's OWN account, mirrored from captured identity (no real-DB read, no PII leak).
  if (ctx.identity && ctx.identity.email) {
    users.push({
      id: uuidFrom('self:' + ctx.identity.email),
      username: ctx.identity.username || ctx.identity.email.split('@')[0],
      email: ctx.identity.email, role: 'super_admin', active: true, kycVerified: false,
      dailyLimitUsd: '1000.00', averageRating: '0.00', totalRatings: 0, country: null,
      googleId: /@(gmail|googlemail)\./i.test(ctx.identity.email) ? googleId(r) : null,
    });
  }
  for (let i = 0; i < n; i++) {
    const role = i === 0 ? 'super_admin' : i < 4 ? 'admin' : 'normal';
    users.push(makeUser(seed + ':' + i, role));
  }
  return users;
}

function fakeMe(ctx = {}) {
  const id = ctx.identity || {};
  const email = id.email || 'operator@bitflow.community';
  const username = id.username || (id.email ? id.email.split('@')[0] : 'operator');
  return {
    id: uuidFrom('self:' + email), email, username, role: 'super_admin',
    emailVerified: true, kycVerified: true, active: true, twoFactorEnabled: true,
    dailyLimitUsd: '1000000.00', averageRating: '0.00', totalRatings: 0, country: null,
    googleId: /@(gmail|googlemail)\./i.test(email) ? '117394028561203947755' : null,
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
function fakeAudit(ctx = {}) {
  const seed = ctx.seed || 'static';
  const r = rng('audit:' + seed);
  const types = ['WithdrawalRequested', 'TradeExecuted', 'DepositConfirmed', 'SwapExecuted', 'AdminBalanceUpdate', 'P2PTransactionCompleted'];
  const rows = Array.from({ length: 12 }).map((_, i) => ({
    id: 24000 - i, eventId: uuidFrom('ev:' + seed + ':' + i),
    eventType: types[Math.floor(r() * types.length)],
    aggregateId: uuidFrom('agg:' + seed + ':' + i),
    occurredAt: new Date(Date.now() - i * (18 + Math.floor(r() * 40)) * 6e4).toISOString(),
    hash: crypto.createHash('sha256').update('hp:' + seed + ':' + i).digest('hex'),
    prevHash: crypto.createHash('sha256').update('hp:' + seed + ':' + (i + 1)).digest('hex'),
  }));
  return { rows, nextBeforeId: rows[rows.length - 1].id };
}
const fakeAuditVerify = () => ({ ok: true, brokenAtSeq: null, checked: 23988 });

// Opaque honeypot token (NOT signed with the real JWT_SECRET; the guard keys off IP/identity).
function fakeAdminToken(sessionId) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ id: uuidFrom('self:' + sessionId), role: 'super_admin', hp: sessionId, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const sig = crypto.createHash('sha256').update(head + body + 'mirage').digest('base64url');
  return `${head}.${body}.${sig}`;
}

module.exports = {
  fakeUsers, fakeMe, fakeStats, fakeGovernancePending, fakeReadiness, fakeConfig,
  fakeAmlConfig, fakeDenylist, fakeCases, fakeAudit, fakeAuditVerify, fakeAdminToken,
  uuidFrom, btcAddress, ethAddress,
};
