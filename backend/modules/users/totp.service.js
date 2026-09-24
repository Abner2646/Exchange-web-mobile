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

// The absolute 30s step a token matches (within the ±1 window), or null if it does not match.
// Used to enforce single-use: a token is bound to its step, so a consumed step can be rejected.
function matchedStep(token, secret) {
  if (!token || !secret) return null;
  let delta;
  try {
    delta = authenticator.checkDelta(String(token), secret);
  } catch (err) {
    return null;
  }
  if (delta === null || delta === undefined) return null;
  return Math.floor(Date.now() / 1000 / 30) + delta;
}

// Validate a token for an enrolled user AND enforce single-use: the old email code was deleted
// on use (single-use); TOTP must not regress that. A code is bound to its 30s step; once a step
// (or an earlier one) has been consumed it can never be replayed — closing the ~90s replay window
// on login, Maker-Checker step-up, and disable. Returns the step to persist, or throws.
function consumeStep(user, token) {
  const step = matchedStep(token, user.totpSecret);
  if (step === null) {
    throw new AppError(401, errorCodes.TOTP_INVALID, 'Código TOTP inválido');
  }
  if (user.totpLastUsedStep !== null && user.totpLastUsedStep !== undefined
      && step <= Number(user.totpLastUsedStep)) {
    throw new AppError(401, errorCodes.TOTP_INVALID, 'Código TOTP ya utilizado');
  }
  return step;
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

// Complete enrollment: verify the first token against the pending secret, then enable. The
// enrollment code is consumed (its step recorded) so it cannot be replayed as a login/step-up.
async function enable(user, token) {
  if (!user.totpSecret) {
    throw new AppError(400, errorCodes.TOTP_ENROLLMENT_REQUIRED, 'No hay enrolamiento TOTP pendiente');
  }
  const step = consumeStep(user, token);
  await user.update({ totpEnabled: true, twoFactorEnabled: true, totpLastUsedStep: step });
}

// Verify a token for an enabled user (login 2nd factor / Maker-Checker step-up). Single-use:
// records the consumed step and rejects replay. Throws on invalid so callers can treat a
// resolved call as success. ASYNC — callers MUST await (a dropped await would let a replayed
// or invalid code slip through the step-up).
async function verifyForUser(user, token) {
  if (!user || !user.totpEnabled || !user.totpSecret) {
    throw new AppError(400, errorCodes.TOTP_NOT_ENABLED, 'El usuario no tiene TOTP activado');
  }
  const step = consumeStep(user, token);
  await user.update({ totpLastUsedStep: step });
  return true;
}

// Disable TOTP — requires a valid current token so a hijacked session cannot silently turn
// off 2FA without the enrolled device. Resets the single-use marker for a future re-enrollment.
async function disable(user, token) {
  if (!user.totpEnabled || !user.totpSecret) {
    throw new AppError(400, errorCodes.TOTP_NOT_ENABLED, 'El usuario no tiene TOTP activado');
  }
  const step = consumeStep(user, token);
  // (step validated for single-use before we clear state, so a replayed code can't disable)
  void step;
  await user.update({ totpSecret: null, totpEnabled: false, twoFactorEnabled: false, totpLastUsedStep: null });
}

module.exports = {
  generateEnrollmentSecret, verifyToken, matchedStep, generateQrDataUrl, ISSUER,
  beginEnrollment, enable, verifyForUser, disable,
};
