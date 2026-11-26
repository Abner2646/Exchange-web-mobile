// honeypotGuard — the single entry point of the Mirage deception system. Mounted FIRST on
// the /api router. Behaviour:
//   • HONEYPOT_ENABLED off (default) → pure no-op, zero cost/risk.
//   • A request hits a honeytoken (bait path) → trap the session, alert, serve a lure.
//   • A bot hits register/login → trap (risk trigger).
//   • An already-trapped IP → serve the fake admin (identical UI, fabricated data) + log
//     everything + alert on high-value intent (approve withdrawal, escalate, exfiltrate).
//   • Everyone else → next() (normal production).
// It NEVER touches the real domain and NEVER breaks real traffic (all errors swallowed).
const capture = require('./capture.service');
const honeytokens = require('./honeytokens');
const fakeAdmin = require('./fakeAdmin.service');
const { parseUserAgent } = require('../users/signupIntel.service');

function enabled() {
  const v = String(process.env.HONEYPOT_ENABLED || '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

async function alert(severity, code, title, session, req, extra = {}) {
  try {
    const { sendAlert } = require('../alerts/telegramAlert.service');
    await sendAlert({
      severity, code, message: title,
      context: { ip: (session && session.ip) || null, path: req.originalUrl || req.url, method: req.method, ua: req.headers && req.headers['user-agent'], ...extra },
    });
  } catch (e) { /* alerting is best-effort */ }
}

async function honeypotGuard(req, res, next) {
  if (!enabled()) return next();
  try {
    // 1) Honeytoken: a bait path only a scanner probes → trap + lure.
    if (honeytokens.isBait(req.path)) {
      const session = await capture.markSession({ req, trigger: 'honeytoken', reason: 'probed bait ' + req.path });
      const fresh = session && (session.eventCount || 0) === 0;
      await capture.logEvent({ req, session, action: 'honeytoken', statusServed: 200 });
      if (fresh) await alert('warning', 'HONEYPOT_TRAP', `🍯 Trapped (honeytoken): ${req.path}`, session, req);
      return honeytokens.serveBait(req, res);
    }

    // 2) Already trapped by IP?
    let session = await capture.findSession(req);

    // 3) Risk trigger: a bot/automated client hitting auth endpoints → trap now.
    if (!session && /^\/(user\/(register|login)|auth\/)/.test(req.path)) {
      const dev = parseUserAgent((req.headers && req.headers['user-agent']) || '');
      if (dev.isBot) {
        session = await capture.markSession({ req, trigger: 'risk_score', reason: 'automated user-agent on ' + req.path });
        if (session) await alert('warning', 'HONEYPOT_TRAP', `🍯 Trapped (bot UA): ${req.path}`, session, req);
      }
    }

    // 4) Trapped → serve the fake admin, capture intent, alert on high value.
    if (session) {
      const r = fakeAdmin.respond(req, session.id);
      await capture.logEvent({ req, session, action: r.action, statusServed: r.status });
      if (r.highValue) await alert('critical', 'HONEYPOT_ACTION', `🚨 High-value attacker action: ${r.action}`, session, req, { action: r.action });
      return res.status(r.status).json(r.body);
    }

    return next();
  } catch (e) {
    console.error('[honeypot] guard error (passing through): ' + e.message);
    return next(); // a honeypot bug must never affect real users
  }
}

module.exports = honeypotGuard;
