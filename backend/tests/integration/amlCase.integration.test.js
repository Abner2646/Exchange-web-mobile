const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const cases = require('../../modules/aml/case.model');
const riskFlag = require('../../modules/aml/riskFlag');
const { User } = require('../../models');

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('AML case model + risk flag', () => {
  test('openCase is idempotent by dedupeKey', async () => {
    const user = await f.seedUser();
    const args = { userId: user.id, signalId: 'S5', severity: 'high', evidence: { a: 1 }, dedupeKey: `${user.id}:S5:w1` };
    const first = await cases.openCase(args);
    const second = await cases.openCase(args);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.case.id).toBe(first.case.id);
    expect(await cases.listCases()).toHaveLength(1);
  });

  test('raiseUserRisk moves up and never downgrades', async () => {
    const user = await f.seedUser();
    await riskFlag.raiseUserRisk(user.id, 'high');
    let u = await User.findByPk(user.id);
    expect(u.amlRiskLevel).toBe('high');
    expect(u.amlReviewPending).toBe(true);
    await riskFlag.raiseUserRisk(user.id, 'medium'); // no downgrade
    u = await User.findByPk(user.id);
    expect(u.amlRiskLevel).toBe('high');
  });

  test('resolveCase sets status + resolver + timestamp', async () => {
    const user = await f.seedUser();
    const { case: c } = await cases.openCase({ userId: user.id, signalId: 'S5', severity: 'high', evidence: {}, dedupeKey: `${user.id}:S5:w2` });
    const resolved = await cases.resolveCase(c.id, { status: 'closed', resolvedBy: user.id });
    expect(resolved.status).toBe('closed');
    expect(resolved.resolvedBy).toBe(user.id);
    expect(resolved.resolvedAt).toBeInstanceOf(Date);
  });
});
