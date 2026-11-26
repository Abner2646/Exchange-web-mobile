// Fabricated admin data for the honeypot. Mirrors the REAL admin API response shapes so the
// genuine admin UI renders identically — but every byte here is invented. No real users,
// balances, or PII. Deterministic (stable across requests) so the fake panel feels real.
const crypto = require('crypto');

function uuidFrom(seed) {
  const h = crypto.createHash('md5').update('hp:' + seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const FIRST = ['james', 'mary', 'john', 'patricia', 'robert', 'jennifer', 'michael', 'linda', 'william', 'elizabeth', 'david', 'susan', 'richard', 'jessica', 'thomas', 'sarah', 'chen', 'wei', 'ahmed', 'olga'];
const LAST = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis', 'rodriguez', 'martinez', 'hernandez', 'lopez', 'wang', 'kumar', 'nguyen', 'kim', 'ivanov', 'santos', 'khan', 'cohen'];
const COUNTRIES = ['US', 'GB', 'CA', 'DE', 'AU', 'AR', 'BR', 'IN', 'JP', 'FR', 'ES', 'MX'];

// A stable roster of fabricated users (the "goldmine" an attacker thinks they found).
function fakeUsers() {
  const out = [];
  for (let i = 0; i < 18; i++) {
    const fn = FIRST[i % FIRST.length];
    const ln = LAST[(i * 7) % LAST.length];
    const role = i === 0 ? 'super_admin' : i < 3 ? 'admin' : 'normal';
    out.push({
      id: uuidFrom('user' + i),
      username: `${fn}${ln}${(i * 13) % 97}`,
      email: `${fn}.${ln}${i}@${['gmail.com', 'outlook.com', 'proton.me', 'yahoo.com'][i % 4]}`,
      role,
      active: i % 9 !== 0,
      kycVerified: i % 3 === 0,
      dailyLimitUsd: [1000, 5000, 25000, 100000][i % 4].toFixed(2),
      averageRating: (3 + (i % 20) / 10).toFixed(2),
      totalRatings: (i * 17) % 300,
      country: COUNTRIES[i % COUNTRIES.length],
    });
  }
  return out;
}

function fakeMe() {
  return {
    id: uuidFrom('me'), email: 'admin@bitflow.community', username: 'admin', role: 'super_admin',
    emailVerified: true, kycVerified: true, active: true, twoFactorEnabled: true,
    dailyLimitUsd: '1000000.00', averageRating: '0.00', totalRatings: 0, country: 'US',
  };
}

function fakeStats() {
  return [
    { role: 'normal', kycVerified: false, active: true, country: 'US', total: '842' },
    { role: 'normal', kycVerified: true, active: true, country: 'GB', total: '311' },
    { role: 'admin', kycVerified: true, active: true, country: 'US', total: '4' },
    { role: 'super_admin', kycVerified: true, active: true, country: 'US', total: '1' },
  ];
}

// Pending governance actions — matches the real PendingAction shape so the Maker-Checker
// inbox renders identically. Includes a juicy LARGE WITHDRAWAL to "approve": when the
// attacker approves it, we capture their intended cash-out.
function fakeGovernancePending() {
  const now = Date.now();
  return {
    pending: [
      {
        id: uuidFrom('gov1'), actionType: 'large_withdrawal_release', status: 'pending',
        amountUsd: '48500.00', makerUserId: uuidFrom('user4'), checkerUserId: null,
        payload: { crypto: 'BTC', amount: '0.61500000', destinationAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', network: 'bitcoin' },
        rejectionReason: null, result: null,
        expiresAt: new Date(now + 20 * 36e5).toISOString(), resolvedAt: null, created_at: new Date(now - 36e5).toISOString(),
      },
      {
        id: uuidFrom('gov2'), actionType: 'admin_balance_update', status: 'pending',
        amountUsd: '12000.00', makerUserId: uuidFrom('user2'), checkerUserId: null,
        payload: { crypto: 'USDT', amount: '12000.00', targetUserId: uuidFrom('user7'), reason: 'manual credit' },
        rejectionReason: null, result: null,
        expiresAt: new Date(now + 20 * 36e5).toISOString(), resolvedAt: null, created_at: new Date(now - 72e5).toISOString(),
      },
    ],
  };
}

function fakeReadiness() {
  return {
    ready: true, operatorCount: 5, enrolledCount: 5, minEnrolled: 2, pending: [],
    enrolled: fakeUsers().filter((u) => u.role !== 'normal').map((u) => ({
      id: u.id, email: u.email, role: u.role, active: true, totpEnabled: true, twoFactorEnabled: true,
    })), reasons: [],
  };
}

function fakeConfig() {
  return {
    data: [
      { key: 'withdrawal_fee_percent', value: '0.1', type: 'number', category: 'fees' },
      { key: 'trading_fee_percent', value: '0.2', type: 'number', category: 'fees' },
      { key: 'min_withdrawal_usd', value: '20', type: 'number', category: 'limits' },
      { key: 'maintenance_mode', value: 'false', type: 'boolean', category: 'system' },
    ],
  };
}

const fakeAmlConfig = () => ({ monitoringEnabled: true, holdEnforcementEnabled: true });
const fakeDenylist = () => ([
  { id: uuidFrom('dl1'), address: '0x7F367cC41522cE07553e823bf3be79A889DEbe1B', network: 'ethereum', reason: 'OFAC SDN', source: 'manual' },
  { id: uuidFrom('dl2'), address: '1Mz7153HMuxXTuR2R1t78mGSdzaAtNbBWX', network: 'bitcoin', reason: 'ransomware', source: 'chainalysis' },
]);
const fakeCases = () => ([
  { id: uuidFrom('case1'), status: 'open', userId: uuidFrom('user7'), riskScore: 82, createdAt: new Date(Date.now() - 864e5).toISOString() },
]);
const fakeAudit = () => ({
  rows: Array.from({ length: 8 }).map((_, i) => ({
    id: 10000 - i, eventId: uuidFrom('ev' + i), eventType: ['WithdrawalRequested', 'TradeExecuted', 'DepositConfirmed', 'AdminBalanceUpdate'][i % 4],
    aggregateId: uuidFrom('agg' + i), occurredAt: new Date(Date.now() - i * 36e5).toISOString(),
    hash: crypto.createHash('sha256').update('hp' + i).digest('hex'), prevHash: crypto.createHash('sha256').update('hp' + (i + 1)).digest('hex'),
  })), nextBeforeId: null,
});
const fakeAuditVerify = () => ({ ok: true, brokenAtSeq: null, checked: 9997 });

// Opaque honeypot token (NOT signed with the real JWT_SECRET — useless against real
// endpoints even if the flag were off; the guard identifies trapped sessions by IP).
function fakeAdminToken(sessionId) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ id: uuidFrom('me'), role: 'super_admin', hp: sessionId, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const sig = crypto.createHash('sha256').update(head + body + 'mirage').digest('base64url');
  return `${head}.${body}.${sig}`;
}

module.exports = {
  fakeUsers, fakeMe, fakeStats, fakeGovernancePending, fakeReadiness, fakeConfig,
  fakeAmlConfig, fakeDenylist, fakeCases, fakeAudit, fakeAuditVerify, fakeAdminToken, uuidFrom,
};
