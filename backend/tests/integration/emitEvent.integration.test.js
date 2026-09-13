const { sequelize, OutboxEvent } = require('../../models');
const { emitEvent } = require('../../modules/events/emitEvent');

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterEach(async () => { await OutboxEvent.destroy({ where: {} }); });
afterAll(async () => { await sequelize.close(); });

describe('emitEvent', () => {
  test('writes a pending row inside the given transaction', async () => {
    const t = await sequelize.transaction();
    await emitEvent('X', { n: 1 }, { transaction: t, aggregateId: null });
    await t.commit();
    const rows = await OutboxEvent.findAll({ where: { type: 'X' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
    expect(rows[0].payload).toEqual({ n: 1 });
  });

  test('is atomic: nothing persists if the transaction rolls back', async () => {
    const t = await sequelize.transaction();
    await emitEvent('Y', { n: 2 }, { transaction: t });
    await t.rollback();
    const rows = await OutboxEvent.findAll({ where: { type: 'Y' } });
    expect(rows).toHaveLength(0);
  });
});
