require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const { Crypto } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('integration harness smoke', () => {
  test('connects, has a synced schema, and truncates between tests', async () => {
    await Crypto.create({ symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin' });
    const count = await Crypto.count();
    expect(count).toBe(1);
  });

  test('previous test data is gone (resetDb ran)', async () => {
    const count = await Crypto.count();
    expect(count).toBe(0);
  });
});
