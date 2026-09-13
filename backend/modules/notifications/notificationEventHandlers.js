// modules/notifications/notificationEventHandlers.js
// Reacts to P2P domain events by sending the both-parties notification. Subscribed
// to the eventBus at bootstrap; the money-path no longer calls notifications.

const TYPE_TO_STATUS = {
  P2PTransactionCreated: 'initiated',
  P2PPaymentConfirmed: 'payment_confirmed',
  P2PTransactionCompleted: 'completed',
  P2PTransactionCancelled: 'cancelled',
};

async function handleP2PTransactionEvent(event) {
  const status = TYPE_TO_STATUS[event.type];
  if (!status) return;
  if (!event.payload || !event.payload.transaction) return;
  const { Notification } = require('../../models');
  const { buyerId, sellerId, transaction } = event.payload;
  const transaccionData = {
    id: transaction.id,
    amount: transaction.amount,
    crypto: { symbol: transaction.cryptoSymbol },
    fiatAmount: transaction.fiatAmount,
    fiatCurrency: transaction.fiatCurrency,
  };
  await Notification.notifyBothParties(buyerId, sellerId, transaccionData, status, { sourceEventId: event.id });
}

function register(eventBus) {
  for (const type of Object.keys(TYPE_TO_STATUS)) {
    eventBus.on(type, 'notifications', handleP2PTransactionEvent);
  }
}

module.exports = { handleP2PTransactionEvent, register, TYPE_TO_STATUS };
