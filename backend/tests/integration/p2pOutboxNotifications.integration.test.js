const { sequelize, OutboxEvent, Notification } = require('../../models');
const { emitEvent } = require('../../modules/events/emitEvent');
const eventBus = require('../../modules/events/eventBus');
const { registerAllHandlers } = require('../../modules/events/registerHandlers');
const publisherJob = require('../../jobs/outboxPublisher.job');
const f = require('../helpers/factories');

beforeAll(async () => { await sequelize.sync({ force: true }); registerAllHandlers(); });
afterAll(async () => { await sequelize.close(); });
afterEach(async () => { await OutboxEvent.destroy({ where: {} }); await Notification.destroy({ where: {} }); });

describe('P2P outbox → notifications end-to-end', () => {
  test('emit → publisher dispatches → one notification per user, marked dispatched; re-run stays idempotent', async () => {
    const buyer = await f.seedUser();
    const seller = await f.seedUser();
    const evt = await emitEvent('P2PTransactionCompleted', {
      buyerId: buyer.id, sellerId: seller.id,
      transaction: { id: '22222222-2222-2222-2222-222222222222', amount: '1', cryptoSymbol: 'BTC', fiatAmount: '100', fiatCurrency: 'USD' },
    }, { aggregateId: '22222222-2222-2222-2222-222222222222' });

    await publisherJob.run();
    await publisherJob.run(); // at-least-once redelivery must not duplicate

    const reloaded = await OutboxEvent.findByPk(evt.id);
    expect(reloaded.status).toBe('dispatched');
    const notifs = await Notification.findAll({ where: { sourceEventId: evt.id } });
    expect(notifs).toHaveLength(2); // buyer + seller, once each
  });
});
