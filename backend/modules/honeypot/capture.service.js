// Honeypot capture — marks trapped sessions and records everything they do. Every function
// is best-effort: a capture failure must NEVER break the response the attacker sees (that
// would tip them off), so all errors are swallowed. Reads/writes ONLY honeypot_* tables.
const { extractClientIp } = require('../users/signupIntel.service');

const BODY_CAP = 8000; // cap stored payloads so a huge POST can't bloat the row

function capBody(obj) {
  try {
    const s = JSON.stringify(obj);
    if (!s) return null;
    return s.length > BODY_CAP ? { _truncated: true, preview: s.slice(0, BODY_CAP) } : obj;
  } catch {
    return null;
  }
}

function pickHeaders(req) {
  const h = req.headers || {};
  return {
    'user-agent': h['user-agent'], referer: h['referer'] || h['referrer'],
    'x-forwarded-for': h['x-forwarded-for'], 'content-type': h['content-type'], origin: h['origin'],
  };
}

// Find an active trap session for this request (by IP or by the authed subject).
async function findSession(req) {
  try {
    const { HoneypotSession } = require('../../models');
    const { Op } = require('sequelize');
    const ip = extractClientIp(req);
    const uid = req.user && req.user.id ? String(req.user.id) : null;
    const or = [];
    if (ip) or.push({ ip });
    if (uid) or.push({ markedUserId: uid });
    if (or.length === 0) return null;
    return await HoneypotSession.findOne({ where: { active: true, [Op.or]: or } });
  } catch {
    return null;
  }
}

// Mark a session as trapped (idempotent-ish: reuse an active one for the same IP/subject).
async function markSession({ req, trigger, reason, riskScore = null, geo = {} }) {
  try {
    const { HoneypotSession } = require('../../models');
    const existing = await findSession(req);
    if (existing) return existing;
    const ip = extractClientIp(req);
    return await HoneypotSession.create({
      ip,
      markedUserId: req.user && req.user.id ? String(req.user.id) : null,
      trigger,
      reason,
      riskScore,
      userAgent: req.headers && req.headers['user-agent'],
      ipCountry: geo.country || null,
      ipIsp: geo.isp || null,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    });
  } catch (e) {
    console.error('[honeypot] markSession failed: ' + e.message);
    return null;
  }
}

// Persist the attacker's OWN registration identity (from their register/login body) so the
// fake panel can mirror their account back to them. Only their own data — never a real user.
async function rememberIdentity({ session, req }) {
  try {
    if (!session || session.capturedEmail) return;
    const email = req.body && typeof req.body.email === 'string' ? req.body.email.slice(0, 200) : null;
    if (!email) return;
    const username = req.body && typeof req.body.username === 'string' ? req.body.username.slice(0, 100) : null;
    const { HoneypotSession } = require('../../models');
    await HoneypotSession.update({ capturedEmail: email, capturedUsername: username }, { where: { id: session.id } });
    session.capturedEmail = email; session.capturedUsername = username;
  } catch (e) { /* best-effort */ }
}

// Record one attacker request + bump the session counters.
async function logEvent({ req, session, action, statusServed }) {
  try {
    const { HoneypotEvent, HoneypotSession } = require('../../models');
    await HoneypotEvent.create({
      sessionId: session ? session.id : null,
      ip: extractClientIp(req),
      userAgent: req.headers && req.headers['user-agent'],
      method: req.method,
      path: req.originalUrl || req.url,
      query: capBody(req.query),
      body: capBody(req.body),
      headers: pickHeaders(req),
      action: action || null,
      statusServed: statusServed || null,
    });
    if (session) {
      await HoneypotSession.update(
        { eventCount: (session.eventCount || 0) + 1, lastSeenAt: new Date() },
        { where: { id: session.id } },
      );
    }
  } catch (e) {
    console.error('[honeypot] logEvent failed: ' + e.message);
  }
}

module.exports = { findSession, markSession, logEvent, rememberIdentity };
