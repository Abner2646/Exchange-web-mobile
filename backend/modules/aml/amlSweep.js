// modules/aml/amlSweep.js
// The periodic AML sweep (Slice C). REPLAYS recent money rows through the same
// amlConsumer.handleEvent the on-event path uses — one consistent ruleset for
// real-time and batch (no drift), idempotent by dedupeKey. No evaluation logic here.
const amlConfig = require('./amlConfig');
const da = require('./amlDataAccess');
const consumer = require('./amlConsumer');

async function replay(id, type, payload, counters) {
  try {
    await consumer.handleEvent({ id, type, payload });
  } catch (err) {
    // Per-row isolation: one poison row must not abort the whole pass.
    counters.errors++;
    console.error(`[amlSweep] replay ${type} ${id} failed:`, err.message);
  }
  // Counter is OUTSIDE the try on purpose: `scanned` counts every row we ATTEMPTED,
  // whether or not its replay threw. `errors` (above) records how many failed, so a
  // reader can tell attempted-and-evaluated from attempted-but-errored (reporting
  // integrity for the batch pass). Do not move byType inside the try.
  counters.byType[type]++;
}

async function runSweep() {
  const counters = { byType: { WithdrawalTransmitted: 0, DepositConfirmed: 0, P2PTransactionCompleted: 0 }, errors: 0 };
  if (!(await amlConfig.isMonitoringEnabled())) return { scanned: 0, byType: counters.byType, errors: 0 };

  const lookbackHours = await amlConfig.getThreshold('aml.sweep.lookbackHours', 48);
  const since = new Date(Date.now() - lookbackHours * 3600000);

  const [moneyRows, p2pRows] = await Promise.all([
    da.recentMoneyTransactions(since),
    da.recentCompletedP2P(since),
  ]);

  for (const r of moneyRows) {
    const payload = { blockchainTransactionId: r.id, userId: r.userId, cryptoId: r.cryptoId, amount: r.amount };
    await replay(r.id, r.eventType, payload, counters);
  }
  for (const r of p2pRows) {
    await replay(r.id, 'P2PTransactionCompleted', { buyerId: r.buyerId, sellerId: r.sellerId, transaction: { id: r.id } }, counters);
  }

  const { byType, errors } = counters;
  const scanned = byType.WithdrawalTransmitted + byType.DepositConfirmed + byType.P2PTransactionCompleted;
  return { scanned, byType, errors };
}

module.exports = { runSweep };
