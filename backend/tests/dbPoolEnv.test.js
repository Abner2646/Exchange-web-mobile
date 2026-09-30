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
