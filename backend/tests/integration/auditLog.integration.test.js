const { sequelize, AuditLog } = require('../../models');

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

describe('AuditLog model', () => {
  test('persists a row with an auto-increment id and the expected fields', async () => {
    const row = await AuditLog.create({
      eventId: '11111111-1111-1111-1111-111111111111',
      eventType: 'TestEvent',
      payload: { a: 1 },
      aggregateId: null,
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      prevHash: null,
      hash: 'a'.repeat(64),
    });
    expect(Number(row.id)).toBeGreaterThan(0);
    expect(row.eventType).toBe('TestEvent');
    expect(row.payload).toEqual({ a: 1 });
    expect(row.created_at).toBeInstanceOf(Date);
  });

  test('rejects a duplicate event_id (unique)', async () => {
    const base = {
      eventId: '22222222-2222-2222-2222-222222222222',
      eventType: 'T', payload: {}, occurredAt: new Date(), prevHash: null, hash: 'b'.repeat(64),
    };
    await AuditLog.create(base);
    await expect(AuditLog.create({ ...base, hash: 'c'.repeat(64) })).rejects.toThrow();
  });
});
