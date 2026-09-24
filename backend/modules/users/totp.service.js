// TOTP (RFC 6238) second factor via an authenticator app (Google Authenticator, Authy…).
// Replaces the old email-code 2FA: the shared secret lives with the user's app, so the
// server never has to mint/store a short-lived code, and a logged-in user can prove a
// step-up (e.g. Maker-Checker approval) at any time — not only right after login.
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');

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

// ---- User-oriented orchestration (takes a loaded user instance; the controller does IO) ----

// Begin enrollment: generate + persist a pending secret on the user, return the provisioning
// URI + QR. 2FA is NOT active until `enable` verifies the first token.
async function beginEnrollment(user) {
  if (user.totpEnabled) {
    throw new AppError(409, errorCodes.TOTP_ALREADY_ENABLED, 'TOTP ya está activado; deshabilitá primero para reconfigurar');
  }
  const accountName = user.email || user.username || String(user.id);
  const { secret, otpauthUri } = generateEnrollmentSecret(accountName);
  await user.update({ totpSecret: secret });
  const qr = await generateQrDataUrl(otpauthUri);
  return { otpauthUri, secret, qr };
}

// Complete enrollment: verify the first token against the pending secret, then enable.
async function enable(user, token) {
  if (!user.totpSecret) {
    throw new AppError(400, errorCodes.TOTP_ENROLLMENT_REQUIRED, 'No hay enrolamiento TOTP pendiente');
  }
  if (!verifyToken(token, user.totpSecret)) {
    throw new AppError(401, errorCodes.TOTP_INVALID, 'Código TOTP inválido');
  }
  await user.update({ totpEnabled: true, twoFactorEnabled: true });
}

// Verify a token for an enabled user (login 2nd factor / Maker-Checker step-up). Throws on
// invalid so callers can treat a resolved call as success.
function verifyForUser(user, token) {
  if (!user || !user.totpEnabled || !user.totpSecret) {
    throw new AppError(400, errorCodes.TOTP_NOT_ENABLED, 'El usuario no tiene TOTP activado');
  }
  if (!verifyToken(token, user.totpSecret)) {
    throw new AppError(401, errorCodes.TOTP_INVALID, 'Código TOTP inválido');
  }
  return true;
}

// Disable TOTP — requires a valid current token so a hijacked session cannot silently turn
// off 2FA without the enrolled device.
async function disable(user, token) {
  if (!user.totpEnabled || !user.totpSecret) {
    throw new AppError(400, errorCodes.TOTP_NOT_ENABLED, 'El usuario no tiene TOTP activado');
  }
  if (!verifyToken(token, user.totpSecret)) {
    throw new AppError(401, errorCodes.TOTP_INVALID, 'Código TOTP inválido');
  }
  await user.update({ totpSecret: null, totpEnabled: false, twoFactorEnabled: false });
}

module.exports = {
  generateEnrollmentSecret, verifyToken, generateQrDataUrl, ISSUER,
  beginEnrollment, enable, verifyForUser, disable,
};
