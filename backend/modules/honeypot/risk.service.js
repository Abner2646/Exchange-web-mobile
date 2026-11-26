// Risk scoring — turns the forensic signals we already capture (device/UA, IP geo,
// email, acquisition) into a single score + reasons. Used to (a) decide whether to route
// a session into the honeypot, and later (b) gate/deny abusive signups (Tier-1 hardening).
// Pure and side-effect free; callers pass pre-computed signals.
const { parseUserAgent } = require('../users/signupIntel.service');

// Throwaway/disposable inbox providers — a curated starter set (every bot we've caught
// used one). Keep this list growing; a maintained dataset can replace it later.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'euploading.com', 'mailer.net', 'guerrillamail.com', 'sharklasers.com',
  '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'yopmail.com', 'trashmail.com',
  'getnada.com', 'dropmail.me', 'fakeinbox.com', 'maildrop.cc', 'mohmal.com', 'fldubai.com',
  'mintemail.com', 'throwawaymail.com', 'emailondeck.com', 'spam4.me', 'tempr.email',
]);

function emailDomain(email) {
  const m = String(email || '').toLowerCase().match(/@([^@\s]+)$/);
  return m ? m[1] : '';
}

function isDisposableEmail(email) {
  return DISPOSABLE_DOMAINS.has(emailDomain(email));
}

// Signals (all optional): { userAgent, email, ipIsHosting, ipIsProxyVpn, acquisitionSource,
// declaredCountry, ipCountryCode }. Returns { score, reasons, verdict }.
//   verdict: 'low' (<35) · 'suspicious' (35–59) · 'high' (>=60, honeypot-eligible)
function score(signals = {}) {
  const reasons = [];
  let s = 0;
  const add = (points, reason) => { s += points; reasons.push(reason); };

  const dev = signals.userAgent != null ? parseUserAgent(signals.userAgent) : null;
  if (dev && dev.isBot) add(40, 'bot/automated user-agent');
  if (signals.ipIsHosting) add(35, 'datacenter/hosting IP');
  if (signals.ipIsProxyVpn) add(25, 'VPN/proxy IP');
  if (signals.email && isDisposableEmail(signals.email)) add(40, 'disposable email domain');
  if (signals.acquisitionSource === 'direct' && (!dev || dev.deviceType === 'bot')) add(15, 'hit the API directly (no browser)');

  const declared = (signals.declaredCountry || '').toUpperCase();
  const real = (signals.ipCountryCode || '').toUpperCase();
  if (declared && real && declared !== real) add(10, `declared country (${declared}) ≠ IP country (${real})`);

  const verdict = s >= 60 ? 'high' : s >= 35 ? 'suspicious' : 'low';
  return { score: s, reasons, verdict };
}

module.exports = { score, isDisposableEmail, emailDomain, DISPOSABLE_DOMAINS };
