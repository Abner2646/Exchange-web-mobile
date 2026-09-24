// TOTP (RFC 6238) second factor via an authenticator app (Google Authenticator, Authy…).
// Replaces the old email-code 2FA: the shared secret lives with the user's app, so the
// server never has to mint/store a short-lived code, and a logged-in user can prove a
// step-up (e.g. Maker-Checker approval) at any time — not only right after login.
const { authenticator } = require('otplib');
const qrcode = require('qrcode');

// Accept the current 30s step plus one step either side, tolerating small client/server
// clock drift without meaningfully widening the attack window.
authenticator.options = { window: 1 };

const ISSUER = process.env.TOTP_ISSUER || 'CryptoExchange';

// Generate a fresh secret + the otpauth:// provisioning URI an authenticator app scans.
// The secret is returned so the caller can persist it (pending enable); it must NEVER be
// exposed again after enrollment.
function generateEnrollmentSecret(accountName) {
  const secret = authenticator.generateSecret();
  const otpauthUri = authenticator.keyuri(accountName, ISSUER, secret);
  return { secret, otpauthUri, issuer: ISSUER };
}

// Verify a 6-digit TOTP token against the user's secret. Fails CLOSED (returns false) on
// missing input or a malformed secret — never throws — so callers can treat it as a plain
// boolean gate.
function verifyToken(token, secret) {
  if (!token || !secret) return false;
  try {
    return authenticator.check(String(token), secret);
  } catch (err) {
    return false;
  }
}

// Render the provisioning URI as a PNG data URL for the enrollment UI (the client may also
// just show the otpauth URI / secret for manual entry).
async function generateQrDataUrl(otpauthUri) {
  return qrcode.toDataURL(otpauthUri);
}

module.exports = { generateEnrollmentSecret, verifyToken, generateQrDataUrl, ISSUER };
