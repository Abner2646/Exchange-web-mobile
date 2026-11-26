// Honeytokens — bait paths that DON'T exist in the real API. Only a scanner/attacker probes
// them (our real attackers literally hit /api/admin/* — see the forensic logs). Touching any
// of these flags the session and serves a believable, enticing fake so they dig deeper into
// the trap instead of leaving.
const fake = require('./fakeData');

// Paths are relative to the /api mount (the router sees them without the /api prefix).
const BAIT = [
  /^\/admin(\/|$)/i, /^\/administrator(\/|$)/i, /^\/v1\/admin(\/|$)/i, /^\/internal(\/|$)/i,
  /^\/\.env$/i, /^\/config\.json$/i, /^\/backup(\/|$)/i, /^\/debug(\/|$)/i, /^\/dump(\/|$)/i,
  /^\/actuator(\/|$)/i, /^\/\.git(\/|$)/i, /^\/wp-admin(\/|$)/i, /^\/phpmyadmin(\/|$)/i,
];

function isBait(path) {
  return BAIT.some((re) => re.test(path || ''));
}

// Serve a plausible, tempting response so the bait looks like a real, juicy endpoint.
function serveBait(req, res) {
  const p = (req.path || '').toLowerCase();
  if (/\.env$/.test(p)) {
    return res.status(200).type('text/plain').send(
      'NODE_ENV=production\nDB_HOST=10.0.1.42\nDB_USER=bitflow_admin\nADMIN_EMAIL=admin@bitflow.community\nJWT_ISSUER=crypto-exchange\n',
    );
  }
  // The exact paths our real attackers guessed (see forensics) — each returns tempting,
  // shape-correct fake data so they keep digging into the trap.
  if (/users/.test(p)) return res.status(200).json({ users: fake.fakeUsers() });
  if (/withdraw|payout/.test(p)) return res.status(200).json(fake.fakeGovernancePending());
  if (/dashboard|stats|metric|overview/.test(p)) {
    return res.status(200).json({ users: 1158, pendingWithdrawals: 2, volume24hUsd: '2847500.00', custodyBalanceUsd: '18492300.00', hotWalletBtc: '14.8213', hotWalletUsdt: '842100.00' });
  }
  if (/blocks|blocklist|denylist/.test(p)) return res.status(200).json(fake.fakeDenylist());
  if (/transfer/.test(p)) return res.status(200).json({ transfers: [], canTransfer: true, endpoint: '/admin/transfer/execute' });
  if (/config|settings/.test(p)) return res.status(200).json(fake.fakeConfig());
  // Generic "you found the admin surface" lure — breadcrumbs their next probes.
  return res.status(200).json({ status: 'ok', admin: true, endpoints: ['/admin/users', '/admin/withdrawals', '/admin/dashboard', '/admin/blocks', '/admin/transfer', '/admin/settings'] });
}

module.exports = { isBait, serveBait, BAIT };
