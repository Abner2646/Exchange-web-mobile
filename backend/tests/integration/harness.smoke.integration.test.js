require('../helpers/testEnv');
const { sequelize, resetDb } = require('../helpers/db');
const { Criptomoneda } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('integration harness smoke', () => {
  test('connects, has a synced schema, and truncates between tests', async () => {
    await Criptomoneda.create({ symbol: 'BTC', nombre: 'Bitcoin', red: 'bitcoin' });
    const count = await Criptomoneda.count();
    expect(count).toBe(1);
  });

  test('previous test data is gone (resetDb ran)', async () => {
    const count = await Criptomoneda.count();
    expect(count).toBe(0);
  });
});
