module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/helpers/testEnv.js', '<rootDir>/tests/helpers/disableRateLimit.js'],
  // Only the integration suites under tests/integration/.
  testMatch: ['<rootDir>/tests/integration/**/*.integration.test.js'],
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
  globalTeardown: '<rootDir>/tests/helpers/globalTeardown.js',
  forceExit: true,
  testTimeout: 20000,
  // Integration suites share ONE test database and truncate between tests, so
  // they must run serially — parallel workers would truncate each other's
  // seeded rows mid-test. This is the standard trade-off for a shared test DB.
  maxWorkers: 1,
  // Same pinned denominator as the unit config, so the integration floor below
  // is stable and meaningful.
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'jobs/**/*.js',
    'utils/**/*.js',
  ],
  // Global coverage FLOOR for the integration suite (money per-file bars live in
  // jest.config.js). Enforced only with --coverage (npm run test:integration:coverage).
  // At/just-below current; ratchet up as coverage rises. See ROADMAP "Estándares
  // de testing".
  coverageThreshold: {
    global: { statements: 23, branches: 11, functions: 15, lines: 24 },
  },
};
