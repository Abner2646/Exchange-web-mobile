// modules/aml/amlSweep.js
// The periodic AML sweep (Slice C). REPLAYS recent money rows through the same
// amlConsumer.handleEvent the on-event path uses — one consistent ruleset for
// real-time and batch (no drift), idempotent by dedupeKey. No evaluation logic here.
const amlConfig = require('./amlConfig');
const da = require('./amlDataAccess');
const consumer = require('./amlConsumer');

async function replay(id, type, payload, byType) {
  try {
    await consumer.handleEvent({ id, type, payload });
  } catch (err) {
    // Per-row isolation: one poison row must not abort the whole pass.
    console.error(`[amlSweep] replay ${type} ${id} failed:`, err.message);
  }
  // Counter is OUTSIDE the try on purpose: `scanned` counts every row we attempted,
  // whether or not its replay threw (do not move this inside the try).
  byType[type]++;
}

async function runSweep() {
  const byType = { WithdrawalTransmitted: 0, DepositConfirmed: 0, P2PTransactionCompleted: 0 };
  if (!(await amlConfig.isMonitoringEnabled())) return { scanned: 0, byType };

  const lookbackHours = await amlConfig.getThreshold('aml.sweep.lookbackHours', 48);
  const since = new Date(Date.now() - lookbackHours * 3600000);

  for (const r of await da.recentWithdrawals(since)) {
    await replay(r.id, 'WithdrawalTransmitted', { blockchainTransactionId: r.id, userId: r.userId, cryptoId: r.cryptoId, amount: r.amount }, byType);
  }
  for (const r of await da.recentConfirmedDeposits(since)) {
    await replay(r.id, 'DepositConfirmed', { blockchainTransactionId: r.id, userId: r.userId, cryptoId: r.cryptoId, amount: r.amount }, byType);
  }
  for (const r of await da.recentCompletedP2P(since)) {
    await replay(r.id, 'P2PTransactionCompleted', { buyerId: r.buyerId, sellerId: r.sellerId, transaction: { id: r.id } }, byType);
  }

  const scanned = byType.WithdrawalTransmitted + byType.DepositConfirmed + byType.P2PTransactionCompleted;
  return { scanned, byType };
}

module.exports = { runSweep };
