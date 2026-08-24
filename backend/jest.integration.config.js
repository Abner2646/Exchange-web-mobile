module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/helpers/testEnv.js'],
  // Only the integration suites under tests/integration/.
  testMatch: ['<rootDir>/tests/integration/**/*.integration.test.js'],
  globalSetup: '<rootDir>/tests/helpers/globalSetup.js',
  globalTeardown: '<rootDir>/tests/helpers/globalTeardown.js',
  forceExit: true,
  testTimeout: 20000,
};
