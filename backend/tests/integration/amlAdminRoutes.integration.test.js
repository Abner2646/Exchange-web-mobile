require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const f = require('../helpers/factories');
const businessConfig = require('../../modules/config/businessConfig');
const { BlockchainTransaction, AmlCase, Crypto } = require('../../models');

// Admin auth = an admin user with 2FA enabled + the standard auth header, exactly
// as tests/integration/configuracionNegocio.integration.test.js authenticates the
// /api/config admin routes (same middleware stack).
const adminConMFA = () => f.seedUser({ role: 'admin', twoFactorEnabled: true });

beforeEach(async () => { await resetDb(); businessConfig.clearCache(); });
afterAll(async () => { await sequelize.close(); });

describe('AML admin routes', () => {
  test('PUT /aml/config/:key rejects non-aml keys, accepts aml.*', async () => {
    const admin = await adminConMFA();
    const h = f.authHeader(admin);
    await request(app).put('/api/aml/config/foo.bar').set(h).send({ value: 'true' }).expect(400);
    await request(app).put('/api/aml/config/aml.monitoring.enabled').set(h).send({ value: 'true' }).expect(200);
    expect(await businessConfig.getBoolean('aml.monitoring.enabled', false)).toBe(true);
  });

  test('denylist add/list/remove roundtrip', async () => {
    const h = f.authHeader(await adminConMFA());
    const created = await request(app)
      .post('/api/aml/denylist').set(h)
      .send({ address: '0xBAD', network: 'ethereum', source: 'OFAC' })
      .expect(201);
    await request(app).get('/api/aml/denylist').set(h).expect(200)
      .then(r => expect(r.body).toHaveLength(1));
    await request(app).delete(`/api/aml/denylist/${created.body.id}`).set(h).expect(200);
  });

  test('resolve S5 case: approve makes the held withdrawal claimable', async () => {
    const h = f.authHeader(await adminConMFA());
    await businessConfig.set('aml.monitoring.enabled', 'true');
    await businessConfig.set('aml.holdEnforcement.enabled', 'true');
    const denylist = require('../../modules/aml/denylist.model');
    await denylist.addAddress({ address: '0xbad', network: 'ethereum', source: 'OFAC' });
    const user = await f.seedUser();
    // Use network:'ethereum' so the denylist hit matches (f.seedCripto defaults to 'test').
    const eth = await Crypto.create({ symbol: 'ETH', name: 'ETH', network: 'ethereum' });
    // Seed funding:available so blockBalance in createWithdrawal succeeds.
    await f.seedBalance(user, eth, '10');
    const w = await BlockchainTransaction.createWithdrawal({
      userId: user.id, cryptoId: eth.id, amount: '1', destinationAddress: '0xbad',
    });
    // The S5 case must have been opened during createWithdrawal.
    const c = await AmlCase.findOne({ where: { signalId: 'S5' } });
    expect(c).not.toBeNull();
    // Withdrawal must be held (requiresApproval=true → claimForProcessing returns false).
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(false);

    await request(app).put(`/api/aml/cases/${c.id}/resolve`).set(h).send({ decision: 'approve' }).expect(200);
    // After approve: requiresApproval cleared → claimForProcessing succeeds.
    expect(await BlockchainTransaction.claimForProcessing(w.id)).toBe(true);
    expect((await AmlCase.findByPk(c.id)).status).toBe('closed');
  });

  test('unauthenticated request is rejected', async () => {
    await request(app).get('/api/aml/cases').expect(401);
  });
});
