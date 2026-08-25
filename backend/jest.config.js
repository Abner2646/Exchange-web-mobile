module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/helpers/testEnv.js'],
  // Unit run: never touch the integration suites (they need a DB).
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.js$'],
};
