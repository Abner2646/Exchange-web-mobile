module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/helpers/testEnv.js'],
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
};
