const { sequelize, OutboxEvent, AuditLog, Notification } = require('../../models');
const { emitEvent } = require('../../modules/events/emitEvent');
const { registerAllHandlers } = require('../../modules/events/registerHandlers');
const { verifyAuditChain } = require('../../modules/audit/verifyAuditChain');
const publisherJob = require('../../jobs/outboxPublisher.job');
const f = require('../helpers/factories');

beforeAll(async () => { await sequelize.sync({ force: true }); registerAllHandlers(); });
afterAll(async () => { await sequelize.close(); });

describe('audit trail end-to-end (publisher → audit + notifications)', () => {
  test('a dispatched event is audited (chained) AND still notifies both parties', async () => {
    const buyer = await f.seedUser();
    const seller = await f.seedUser();
    const evt = await emitEvent('P2PTransactionCompleted', {
      buyerId: buyer.id, sellerId: seller.id,
      transaction: { id: '99999999-9999-9999-9999-999999999999', amount: '1', cryptoSymbol: 'BTC', fiatAmount: '100', fiatCurrency: 'USD' },
    }, { aggregateId: '99999999-9999-9999-9999-999999999999' });

    await publisherJob.run();

    // audited
    const audit = await AuditLog.findAll({ where: { eventId: evt.id } });
    expect(audit).toHaveLength(1);
    expect(audit[0].eventType).toBe('P2PTransactionCompleted');
    expect((await verifyAuditChain()).ok).toBe(true);

    // notified (slice 1 still works — both any-handler and type handler ran)
    const notifs = await Notification.findAll({ where: { sourceEventId: evt.id } });
    expect(notifs).toHaveLength(2);

    // outbox row dispatched
    expect((await OutboxEvent.findByPk(evt.id)).status).toBe('dispatched');
  });
});
