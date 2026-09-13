const { sequelize, AuditLog } = require('../../models');
const { auditConsumer } = require('../../modules/audit/auditConsumer');
const { GENESIS, computeHash } = require('../../modules/audit/auditHash');

const ev = (over = {}) => ({
  id: '33333333-3333-3333-3333-333333333333',
  type: 'P2PTransactionCompleted',
  payload: { buyerId: 'b', sellerId: 's' },
  aggregateId: 'agg-1',
  createdAt: new Date('2026-02-02T00:00:00.000Z'),
  ...over,
});

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterEach(async () => { await AuditLog.destroy({ where: {}, truncate: true, restartIdentity: true }); });
afterAll(async () => { await sequelize.close(); });

describe('auditConsumer', () => {
  test('writes a chained row whose hash matches the content', async () => {
    const row = await auditConsumer(ev());
    expect(row.prevHash).toBe(GENESIS);
    expect(row.hash).toBe(computeHash(
      { eventId: ev().id, eventType: ev().type, payload: ev().payload, aggregateId: ev().aggregateId, occurredAt: ev().createdAt },
      GENESIS,
    ));
  });

  test('is idempotent: same event id twice → one row', async () => {
    await auditConsumer(ev());
    await auditConsumer(ev());
    const rows = await AuditLog.findAll();
    expect(rows).toHaveLength(1);
  });

  test('links the chain: row2.prevHash === row1.hash', async () => {
    const r1 = await auditConsumer(ev({ id: '44444444-4444-4444-4444-444444444444' }));
    const r2 = await auditConsumer(ev({ id: '55555555-5555-5555-5555-555555555555' }));
    expect(r2.prevHash).toBe(r1.hash);
  });
});
