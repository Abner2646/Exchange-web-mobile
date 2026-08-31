// Stand-in for the real google-auth-library id_token verifier
// (services/auth/googleTokenVerifier.js). Maps known token strings to canonical
// payloads and THROWS on anything else — an unknown/forged token — so the
// controller's reject-with-401 path is exercised without touching Google.
// Injected via app.locals.googleTokenVerifier, mirroring the email fake.
function createFakeGoogleVerifier(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    // Register a token -> { googleId, email, name, emailVerified } mapping.
    register(token, payload) {
      map.set(token, payload);
      return token;
    },
    async verify(idToken) {
      const payload = map.get(idToken);
      if (!payload) {
        throw new Error('Invalid Google id_token');
      }
      return payload;
    },
  };
}

module.exports = { createFakeGoogleVerifier };
