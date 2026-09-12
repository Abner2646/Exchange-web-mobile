// Verifies a Google Identity Services id_token server-side. This is the security
// boundary the Google login endpoint was missing: it checks the token's
// signature against Google's public certs AND that the token was minted for our
// client (audience === our GOOGLE_CLIENT_ID), then returns a normalized profile.
// Trusting a client-supplied googleId without this check is an account-takeover
// vector.
//
// Injected via app.locals.googleTokenVerifier so tests can swap in a fake
// (tests/helpers/fakeGoogleVerifier.js) and never touch Google.
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client();

async function verify(idToken) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name,
    emailVerified: payload.email_verified === true,
  };
}

module.exports = { verify };
