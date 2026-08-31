// Jest config used ONLY by Stryker (mutation testing). Same as the unit config
// but WITHOUT collectCoverageFrom / coverageThreshold: Stryker does its own
// per-test coverage analysis, and the jest coverage floor would only get in the
// way when Stryker runs subsets of the suite.
const base = require('./jest.config');

module.exports = {
  testEnvironment: base.testEnvironment,
  setupFiles: base.setupFiles,
  testPathIgnorePatterns: base.testPathIgnorePatterns,
};
