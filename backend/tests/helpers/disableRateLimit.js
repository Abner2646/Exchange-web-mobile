// Integration-only setup file. Auth routes carry per-IP/per-identifier rate
// limiters (middleware/rateLimiters.js) whose in-memory counters accumulate
// across tests in the shared worker process and are NOT reset by resetDb().
// This flag makes those limiters skip, so integration tests can exercise the
// real routes repeatedly. It is wired ONLY into jest.integration.config.js —
// the unit config does not load it, so authRateLimiting.test.js still asserts
// that limiting works. Never set in production.
//
// PATTERN for later auth etapas: only `registerLimiter` honors this flag today,
// because it is the only limiter integration tests currently saturate. When a
// new integration test exercises another auth route repeatedly (login, verify,
// forgot-password, 2FA…), add the same
//   skip: () => process.env.DISABLE_RATE_LIMIT === 'true'
// to that limiter in middleware/rateLimiters.js.
process.env.DISABLE_RATE_LIMIT = 'true';
