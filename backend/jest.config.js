module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/helpers/testEnv.js'],
  // Unit run: never touch the integration suites (they need a DB).
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.js$'],
  // Pin the coverage denominator to the real backend source (not just whatever
  // the tests happen to require), so the coverage floor below is stable and
  // meaningful — a file nobody loads still counts as 0% instead of vanishing.
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'jobs/**/*.js',
    'utils/**/*.js',
  ],
  // Coverage FLOOR: a merge gate that fails CI if coverage drops below these
  // numbers (enforced only when run with --coverage → `npm run test:coverage`).
  // The floor guards against silent erosion; it is not a quality guarantee (weak
  // assertions can still pass a number — mutation testing is the quality check,
  // see ROADMAP "Estándares de testing"). Numbers sit at/just-below current
  // coverage so they pass today and only ratchet UP as we add tests. Bump them
  // whenever coverage rises to lock the gain.
  coverageThreshold: {
    // Global floor for the unit suite. jest SUBTRACTS the per-file globs below
    // (the well-covered money files) from this pool, so these numbers are the
    // "everything else" remainder (~current, small buffer for wiggle).
    global: { statements: 22, branches: 9, functions: 14, lines: 23 },
    // Money crown jewels — kept near-fully covered so no untested money code ships.
    '**/money.js': { statements: 95, branches: 90, functions: 95, lines: 95 },
    '**/intercambioSettlement.service.js': { statements: 90, branches: 90, functions: 90, lines: 90 },
    // Money services — lock in their current unit coverage so it can't regress.
    // Ratcheted up 2026-08-31 after the mutation-testing hardening pass
    // (mutation score covered: balanceManager 99%, feeCalculator 97%).
    '**/balanceManager.service.js': { lines: 78, functions: 70, branches: 82 },
    '**/feeCalculator.service.js': { lines: 76, branches: 63 },
    '**/orderBook.service.js': { lines: 50 },
    '**/tradeExecutor.service.js': { lines: 44 },
  },
};
