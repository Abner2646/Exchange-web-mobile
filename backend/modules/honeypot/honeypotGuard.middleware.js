// honeypotGuard — the single entry point of the Mirage deception system. Mounted FIRST on
// the /api router.
//   • Owner (allowlisted) → ALWAYS the real app, never trapped. Can opt into a PREVIEW of the
//     fake panel (owner-only, works even when the trap is disabled) to inspect it safely.
//   • HONEYPOT_ENABLED off + no preview → pure no-op, zero cost/risk.
//   • Honeytoken / bot UA / exploit payload → trap the session, alert, serve the fake admin.
//   • Already-trapped IP → fake admin + capture + alert on high-value intent.
// Never touches the real domain and never breaks real traffic (all errors swallowed).
const capture = require('./capture.service');
const honeytokens = require('./honeytokens');
const fakeAdmin = require('./fakeAdmin.service');
const realMirror = require('./realMirror.service');
const { parseUserAgent, extractClientIp } = require('../users/signupIntel.service');

const OWNER_FALLBACK = '04956ec3-e52d-4f10-b0ec-2c2d7c95844c'; // grgurichabner (never trapped)

function enabled() {
  const v = String(process.env.HONEYPOT_ENABLED || '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}
function allowlist() {
  const extra = String(process.env.HONEYPOT_ALLOWLIST || '').split(',').map((s) => s.trim()).filter(Boolean);
  return new Set([OWNER_FALLBACK, ...extra]);
}
function decodeUser(req) {
  try {
    let tok = (req.headers && req.headers.authorization) || '';
    if (tok.startsWith('Bearer ')) tok = tok.slice(7);
    if (!tok || !process.env.JWT_SECRET) return null;
    return require('jsonwebtoken').verify(tok, process.env.JWT_SECRET);
  } catch { return null; }
}

async function alert(severity, code, title, session, req, extra = {}) {
  try {
    const { sendAlert } = require('../alerts/telegramAlert.service');
    await sendAlert({ severity, code, message: title,
      context: { ip: (session && session.ip) || null, path: req.originalUrl || req.url, method: req.method, ua: req.headers && req.headers['user-agent'], ...extra } });
  } catch (e) { /* best-effort */ }
}

async function honeypotGuard(req, res, next) {
  const previewHeader = req.headers && req.headers['x-mirage-preview'];
  // Fast no-op: trap disabled AND not an owner-preview attempt → behave exactly as before.
  if (!enabled() && !previewHeader) return next();
  try {
    const decoded = decodeUser(req);
    const isOwner = decoded && allowlist().has(String(decoded.id));

    // Owner PREVIEW: serve the fake panel to the owner on demand (works even while disabled),
    // so they can audit it. Gated purely by isOwner (an unforgeable owner JWT) + an explicit
    // opt-in header; it only ever shows FABRICATED data, so no secret key is needed. Not
    // logged/alerted (it's not an attacker).
    if (isOwner && previewHeader) {
      const r = fakeAdmin.respond(req, { seed: 'preview:' + (decoded && decoded.id), identity: null });
      // Mark ONLY the owner's preview /user/me so the UI shows the watermark. This marker is
      // added exclusively in this owner-gated branch — a non-owner (attacker) who sends the
      // header falls through to the trap below and NEVER receives it, so the "fake panel"
      // banner can never leak to them. The watermark is a backend decision, not a client flag.
      if (r.body && typeof r.body === 'object' && /\/user\/me$/.test(req.path)) r.body.__mirage = true;
      return res.status(r.status).json(r.body);
    }
    // Owner, normal browsing → always the real app, never trapped.
    if (isOwner) return next();

    // Beyond here the actor is NOT the owner. Trapping only happens when enabled.
    if (!enabled()) return next();

    // 1) Honeytoken bait → trap + lure.
    if (honeytokens.isBait(req.path)) {
      const session = await capture.markSession({ req, trigger: 'honeytoken', reason: 'probed bait ' + req.path });
      const fresh = session && (session.eventCount || 0) === 0;
      await capture.logEvent({ req, session, action: 'honeytoken', statusServed: 200 });
      if (fresh) await alert('warning', 'HONEYPOT_TRAP', `🍯 Trapped (honeytoken): ${req.path}`, session, req);
      return honeytokens.serveBait(req, res);
    }

    // 2) Already trapped by IP?
    let session = await capture.findSession(req);

    // 3) Risk/exploit trigger on auth endpoints: (a) mass-assignment signature in the body, or
    //    (b) an automated user-agent. The exploit "appears to work" (fakeAdmin returns a fake
    //    admin token), capturing the exact payload.
    if (!session && /^\/(user\/(register|login)|auth\/)/.test(req.path)) {
      const b = req.body || {};
      const exploit = !!(b.role || b.emailVerified || b.kycVerified || b.dailyLimitUsd || b.isAdmin);
      const dev = parseUserAgent((req.headers && req.headers['user-agent']) || '');
      if (exploit || dev.isBot) {
        const trigger = exploit ? 'fake_exploit' : 'risk_score';
        const reason = exploit ? 'privilege-escalation payload on ' + req.path : 'automated user-agent on ' + req.path;
        session = await capture.markSession({ req, trigger, reason });
        if (session) await alert(exploit ? 'critical' : 'warning', 'HONEYPOT_TRAP', `🍯 Trapped (${exploit ? 'exploit payload' : 'bot UA'}): ${req.path}`, session, req);
      }
    }

    // 4) Trapped → serve fake admin, capture intent, alert on high value.
    if (session) {
      // Remember their OWN registration identity so the fake data mirrors their account.
      if (/^\/(user\/(register|login)|auth\/)/.test(req.path)) await capture.rememberIdentity({ session, req });
      const email = session.capturedEmail || (req.body && req.body.email) || null;
      // Live mirror of the attacker's OWN real accounts (same signup IP) so an account they
      // just created shows up immediately. Only their own rows — never another customer's.
      const ownAccounts = await realMirror.ownAccountsByIp(session.ip || extractClientIp(req));
      const ctx = { seed: session.id, ownAccounts, identity: email ? { email, username: session.capturedUsername || (req.body && req.body.username) || null } : null };
      const r = fakeAdmin.respond(req, ctx);
      await capture.logEvent({ req, session, action: r.action, statusServed: r.status });
      if (r.highValue) await alert('critical', 'HONEYPOT_ACTION', `🚨 High-value attacker action: ${r.action}`, session, req, { action: r.action });
      return res.status(r.status).json(r.body);
    }

    return next();
  } catch (e) {
    console.error('[honeypot] guard error (passing through): ' + e.message);
    return next();
  }
}

module.exports = honeypotGuard;
