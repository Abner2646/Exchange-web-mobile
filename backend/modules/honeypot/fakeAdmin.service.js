// Fake admin dispatcher. For a TRAPPED session, every /api request comes here and gets a
// fabricated-but-believable response that matches the real endpoint's shape, so the genuine
// admin UI renders identically. It also CLASSIFIES the attacker's intent (the intelligence).
//
// `ctx` = { seed, identity:{email,username}|null }. The seed makes the fabricated data stable
// within a session but different per attacker; the identity mirrors the attacker's OWN
// captured account into the data (no real-DB read). Paths are relative to the /api mount.
const fake = require('./fakeData');

function respond(req, ctx = {}) {
  const m = req.method;
  const p = (req.path || '').replace(/\/+$/, '') || '/';
  const is = (re) => re.test(p);
  const token = () => fake.fakeAdminToken(ctx.seed || 's');

  // ── Auth / the "exploit that appears to work" ────────────────────────────────
  if (m === 'POST' && (is(/^\/user\/register$/) || is(/^\/auth\/register$/))) {
    const escalated = req.body && (req.body.role || req.body.emailVerified || req.body.kycVerified || req.body.dailyLimitUsd);
    return { status: 201, action: escalated ? 'register_exploit' : 'register', highValue: !!escalated,
      body: { message: 'Usuario registrado exitosamente', user: fake.fakeMe(ctx), token: token(), requiresEmailVerification: false } };
  }
  if (m === 'POST' && (is(/^\/user\/login$/) || is(/^\/user\/login\/google$/))) {
    return { status: 200, action: 'login', highValue: false, body: { message: 'Login exitoso', user: fake.fakeMe(ctx), token: token() } };
  }

  // ── Reads ────────────────────────────────────────────────────────────────────
  if (is(/^\/user\/me$/)) return { status: 200, action: 'session', highValue: false, body: fake.fakeMe(ctx) };
  if (m === 'GET' && is(/^\/user\/admin\/stats$/)) return { status: 200, action: 'view_stats', highValue: false, body: fake.fakeStats(fake.fakeUsers(ctx)) };
  if (m === 'GET' && is(/^\/user\/search$/)) return { status: 200, action: 'search_users', highValue: true, body: { users: fake.fakeUsers(ctx) } };
  if (m === 'GET' && is(/^\/user\/[^/]+\/signup-info$/)) {
    const u = fake.fakeUsers(ctx).find((x) => x.role === 'normal') || fake.fakeUsers(ctx)[1];
    const google = !!u.googleId;
    return { status: 200, action: 'view_user_intel', highValue: true, body: {
      user: { ...u, method: google ? 'google' : 'password', emailVerified: true, twoFactorEnabled: false, lastLoginAt: new Date(Date.now() - 48e5).toISOString(), createdAt: new Date(Date.now() - 864e6).toISOString() },
      declaredCountry: u.country, signup: null, activity: { depositAddresses: 1, swaps: 2, orders: 5, p2pOffers: 0 } } };
  }
  if (m === 'GET' && is(/^\/user$/)) return { status: 200, action: 'list_users', highValue: true, body: { users: fake.fakeUsers(ctx) } };
  if (is(/^\/governance\/pending$/)) return { status: 200, action: 'view_pending', highValue: false, body: fake.fakeGovernancePending(ctx) };
  if (is(/^\/governance\/readiness$/)) return { status: 200, action: 'view_readiness', highValue: false, body: fake.fakeReadiness(ctx) };
  if (m === 'GET' && is(/^\/config$/)) return { status: 200, action: 'view_config', highValue: false, body: fake.fakeConfig() };
  if (is(/^\/aml\/config$/)) return { status: 200, action: 'view_aml', highValue: false, body: fake.fakeAmlConfig() };
  if (is(/^\/aml\/denylist$/) && m === 'GET') return { status: 200, action: 'view_denylist', highValue: false, body: fake.fakeDenylist(ctx) };
  if (is(/^\/aml\/cases$/) && m === 'GET') return { status: 200, action: 'view_cases', highValue: false, body: fake.fakeCases(ctx) };
  if (is(/^\/audit$/)) return { status: 200, action: 'view_audit', highValue: false, body: fake.fakeAudit(ctx) };
  if (is(/^\/audit\/verify$/)) return { status: 200, action: 'verify_audit', highValue: false, body: fake.fakeAuditVerify() };
  if (is(/^\/balances\/my\/balances$/)) return { status: 200, action: 'view_balance', highValue: false, body: [{ criptomonedaId: fake.uuidFrom('btc:' + (ctx.seed || 's')), availableBalance: '0.00000000', blockedBalance: '0.00000000', crypto: { symbol: 'BTC', name: 'Bitcoin' } }] };
  if (m === 'GET' && is(/^\/transaccionBlockchain\/deposit-address\//)) return { status: 200, action: 'get_deposit_address', highValue: false, body: { address: fake.btcAddress('dep:' + (ctx.seed || 's')), network: 'bitcoin', crypto: 'BTC' } };
  if (is(/^\/transaccionBlockchain\/my$/)) return { status: 200, action: 'view_tx', highValue: false, body: { transactions: [], total: 0 } };

  // ── Mutations (intent captures — fake success, never real) ───────────────────
  if (m === 'POST' && is(/^\/governance\/[^/]+\/approve$/)) return { status: 200, action: 'approve_withdrawal', highValue: true, body: { success: true, message: 'Acción aprobada' } };
  if (m === 'POST' && is(/^\/governance\/[^/]+\/reject$/)) return { status: 200, action: 'reject_action', highValue: false, body: { success: true } };
  if (m === 'PATCH' && is(/^\/user\/[^/]+\/role$/)) return { status: 200, action: 'escalate_role', highValue: true, body: { user: fake.fakeMe(ctx), token: token() } };
  if (m === 'PATCH' && is(/^\/user\/[^/]+\/status$/)) return { status: 200, action: 'block_user', highValue: true, body: { user: fake.fakeUsers(ctx)[2], token: 'x' } };
  if (m === 'PATCH' && is(/^\/user\/[^/]+\/daily-limit$/)) return { status: 200, action: 'raise_limit', highValue: true, body: { user: fake.fakeUsers(ctx)[2], token: 'x' } };
  if (m === 'PATCH' && is(/^\/user\/[^/]+\/kyc$/)) return { status: 200, action: 'change_kyc', highValue: false, body: { user: fake.fakeUsers(ctx)[2], token: 'x' } };
  if (m === 'PATCH' && is(/^\/user\/[^/]+\/reputation$/)) return { status: 200, action: 'change_reputation', highValue: false, body: { user: fake.fakeUsers(ctx)[2], token: 'x' } };
  if (m === 'DELETE' && is(/^\/user\/[^/]+$/)) return { status: 200, action: 'delete_user', highValue: true, body: { message: 'Usuario eliminado exitosamente' } };
  if (m === 'POST' && is(/^\/aml\/denylist$/)) return { status: 201, action: 'edit_denylist', highValue: true, body: { id: fake.uuidFrom('new:' + (ctx.seed || 's')), ...req.body } };
  if (m === 'PUT' && is(/^\/config\//)) return { status: 200, action: 'change_config', highValue: true, body: { data: fake.fakeConfig().data } };
  if (is(/^\/balances\/.*\/(block|unblock|transfer)$/) || is(/^\/balances\/transfer$/)) return { status: 200, action: 'move_balance', highValue: true, body: { success: true } };
  if (m === 'POST' && is(/^\/transaccionBlockchain\/withdraw$/)) return { status: 200, action: 'attempt_withdraw', highValue: true, body: { success: true, message: 'Retiro en proceso', status: 'pending' } };

  // ── Default: believable generic so nothing ever errors ───────────────────────
  if (m === 'GET') return { status: 200, action: 'probe', highValue: false, body: { success: true, data: [] } };
  return { status: 200, action: 'probe', highValue: false, body: { success: true } };
}

module.exports = { respond };
