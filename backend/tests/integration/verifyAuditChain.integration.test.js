const { sequelize, AuditLog } = require('../../models');
const { auditConsumer } = require('../../modules/audit/auditConsumer');
const { verifyAuditChain } = require('../../modules/audit/verifyAuditChain');

const ev = (id, n) => ({ id, type: 'T', payload: { n }, aggregateId: null, createdAt: new Date(`2026-03-0${n}T00:00:00.000Z`) });

beforeAll(async () => { await sequelize.sync({ force: true }); });
afterAll(async () => { await sequelize.close(); });

describe('verifyAuditChain (DB)', () => {
  test('an intact chain verifies, a tampered payload is detected', async () => {
    await auditConsumer(ev('66666666-6666-6666-6666-666666666666', 1));
    const r2 = await auditConsumer(ev('77777777-7777-7777-7777-777777777777', 2));
    await auditConsumer(ev('88888888-8888-8888-8888-888888888888', 3));

    expect(await verifyAuditChain()).toEqual({ ok: true, brokenAtSeq: null, checked: 3 });

    // Tamper: edit a historical payload directly (bypassing the model).
    await sequelize.query(
      `UPDATE audit_log SET payload = '{"n": 999}' WHERE id = :id`,
      { replacements: { id: Number(r2.id) } },
    );

    const result = await verifyAuditChain();
    expect(result.ok).toBe(false);
    expect(result.brokenAtSeq).toBe(Number(r2.id));
  });
});
