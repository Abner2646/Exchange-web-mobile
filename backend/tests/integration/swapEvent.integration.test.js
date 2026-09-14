const request = require('supertest');
const app = require('../../app');
const { sequelize, resetDb } = require('../helpers/db');
const { OutboxEvent } = require('../../models');
const f = require('../helpers/factories');

// El swap es money-path → exige Idempotency-Key.
let idem = 0;
const idemKey = () => `swap-evt-${Date.now()}-${idem++}`;

beforeEach(async () => { await resetDb(); });
afterAll(async () => { await sequelize.close(); });

describe('SwapExecuted event', () => {
  test('a completed swap writes a SwapExecuted outbox row with correct payload and aggregateId', async () => {
    const user = await f.seedUser();
    const btc = await f.seedCripto('BTC');
    const usdt = await f.seedCripto('USDT');
    const par = await f.seedPar({ base: btc, quote: usdt, price: '0.1', comision: '1' });
    await f.seedWalletMaestra(usdt);
    // Buy 1 BTC @ 0.1 → quoteAmount=0.1, fee=0.001, required=0.101
    await f.seedBalance(user, usdt, '1');

    const res = await request(app)
      .post('/api/intercambioExchange/')
      .set(f.authHeader(user))
      .set('Idempotency-Key', idemKey())
      .send({ pairId: par.id, type: 'buy', baseAmount: 1 });

    expect(res.status).toBe(201);
    const swapId = res.body.data.id;

    const rows = await OutboxEvent.findAll({ where: { type: 'SwapExecuted' } });
    expect(rows).toHaveLength(1);

    const evt = rows[0];
    expect(evt.status).toBe('pending');
    expect(evt.payload.userId).toBe(user.id);
    // swapId + aggregateId must both equal the actual persisted swap PK
    expect(evt.payload.swapId).toBe(swapId);
    expect(evt.aggregateId).toBe(swapId);
    expect(evt.payload.pairId).toBe(par.id);
    // Spot-check numeric fields are stored as canonical strings
    expect(evt.payload.type).toBe('buy');
    expect(typeof evt.payload.baseAmount).toBe('string');
    expect(typeof evt.payload.quoteAmount).toBe('string');
    expect(typeof evt.payload.price).toBe('string');
    expect(typeof evt.payload.feeAmount).toBe('string');
  });
});
