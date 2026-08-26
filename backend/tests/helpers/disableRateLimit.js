// Integration-only setup file. Auth routes carry per-IP/per-identifier rate
// limiters (middleware/rateLimiters.js) whose in-memory counters accumulate
// across tests in the shared worker process and are NOT reset by resetDb().
// This flag makes those limiters skip, so integration tests can exercise the
// real routes repeatedly. It is wired ONLY into jest.integration.config.js —
// the unit config does not load it, so authRateLimiting.test.js still asserts
// that limiting works. Never set in production.
process.env.DISABLE_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT || 'true';
