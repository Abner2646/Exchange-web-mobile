// The production Sequelize pool is env-configurable, so a low-traffic deploy (e.g. 5 users on a
// db.t*.micro with few connections) can shrink it without a code change. Defaults preserve the
// previous behavior (max 10 / min 2). min=0 must be honored (explicit "no idle connections").

describe('production DB pool — DB_POOL_MAX / DB_POOL_MIN', () => {
  const OLD = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  test('defaults to max 10 / min 2 when unset', () => {
    delete process.env.DB_POOL_MAX;
    delete process.env.DB_POOL_MIN;
    const cfg = require('../config/config').production;
    expect(cfg.pool.max).toBe(10);
    expect(cfg.pool.min).toBe(2);
  });

  test('honors DB_POOL_MAX and DB_POOL_MIN=0', () => {
    process.env.DB_POOL_MAX = '5';
    process.env.DB_POOL_MIN = '0';
    const cfg = require('../config/config').production;
    expect(cfg.pool.max).toBe(5);
    expect(cfg.pool.min).toBe(0);
  });

  test('a non-positive/invalid max falls back to the default', () => {
    process.env.DB_POOL_MAX = '0';
    const cfg = require('../config/config').production;
    expect(cfg.pool.max).toBe(10);
  });
});

describe('production DB SSL — DB_SSL (config/config.js, used by sequelize-cli)', () => {
  const OLD = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  test('SSL is ON by default (managed DB / RDS)', () => {
    delete process.env.DB_SSL;
    const cfg = require('../config/config').production;
    expect(cfg.dialectOptions.ssl).toMatchObject({ require: true });
  });

  test('DB_SSL=false disables SSL (for a localhost Postgres without SSL)', () => {
    process.env.DB_SSL = 'false';
    const cfg = require('../config/config').production;
    expect(cfg.dialectOptions.ssl).toBeUndefined();
  });
});

// config/database.js is the RUNTIME connection config (required by models/index.js); config/config.js
// is only for sequelize-cli. The DB_SSL toggle must work HERE too, or a localhost Postgres (co-located,
// with only a self-signed cert) rejects the connection at boot (DEPTH_ZERO_SELF_SIGNED_CERT).
describe('production DB SSL — DB_SSL (config/database.js, used by the app at runtime)', () => {
  const OLD = process.env;
  beforeEach(() => { jest.resetModules(); process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  test('SSL is ON by default (managed DB / RDS)', () => {
    delete process.env.DB_SSL;
    const cfg = require('../config/database').production;
    expect(cfg.dialectOptions.ssl).toMatchObject({ require: true });
  });

  test('DB_SSL=false disables SSL entirely (plain TCP to a localhost Postgres)', () => {
    process.env.DB_SSL = 'false';
    const cfg = require('../config/database').production;
    expect(cfg.dialectOptions.ssl).toBeUndefined();
  });
});
