jest.mock('../models', () => ({ Notification: { notifyBothParties: jest.fn() } }));
const { Notification } = require('../models');
const { handleP2PTransactionEvent } = require('../modules/notifications/notificationEventHandlers');

beforeEach(() => jest.clearAllMocks());

test('maps event type to status and forwards sourceEventId', async () => {
  await handleP2PTransactionEvent({
    id: 'evt-1',
    type: 'P2PTransactionCompleted',
    payload: {
      buyerId: 'b', sellerId: 's',
      transaction: { id: 'tx1', amount: '1', cryptoSymbol: 'BTC', fiatAmount: '100', fiatCurrency: 'USD' },
    },
  });
  expect(Notification.notifyBothParties).toHaveBeenCalledWith(
    'b', 's',
    expect.objectContaining({ id: 'tx1', amount: '1', crypto: { symbol: 'BTC' }, fiatAmount: '100', fiatCurrency: 'USD' }),
    'completed',
    { sourceEventId: 'evt-1' },
  );
});

test('unknown type is ignored', async () => {
  await handleP2PTransactionEvent({ id: 'e', type: 'Nope', payload: {} });
  expect(Notification.notifyBothParties).not.toHaveBeenCalled();
});

test('malformed known event with missing payload does not call notifyBothParties', async () => {
  await handleP2PTransactionEvent({ id: 'e', type: 'P2PTransactionCompleted', payload: {} });
  expect(Notification.notifyBothParties).not.toHaveBeenCalled();
});

test('malformed known event with null payload does not call notifyBothParties', async () => {
  await handleP2PTransactionEvent({ id: 'e', type: 'P2PTransactionCompleted', payload: null });
  expect(Notification.notifyBothParties).not.toHaveBeenCalled();
});
