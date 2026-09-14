const { sequelize, OutboxEvent } = require('../../models');

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

describe('OutboxEvent model', () => {
  test('persists an event with the expected defaults', async () => {
    const ev = await OutboxEvent.create({ type: 'TestEvent', payload: { a: 1 }, aggregateId: null });
    expect(ev.status).toBe('pending');
    expect(ev.attempts).toBe(0);
    expect(ev.availableAt).toBeInstanceOf(Date);
    expect(ev.dispatchedAt).toBeNull();
    expect(ev.payload).toEqual({ a: 1 });
  });
});
