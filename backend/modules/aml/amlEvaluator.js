// modules/aml/amlEvaluator.js
// Maps a money event to its signals, gathers facts, returns the findings to persist.
// No DB writes — the consumer persists. Pure signals; impure fact-gathering here.
const amlConfig = require('./amlConfig');
const da = require('./amlDataAccess');
const s3 = require('./signals/s3');
const s4 = require('./signals/s4');

function utcDay() { return new Date().toISOString().slice(0, 10); }

async function evaluate(event) {
  const results = [];
  const p = event.payload || {};

  if (event.type === 'WithdrawalTransmitted') {
    // S3 velocity: deposit-then-withdraw same asset inside the window
    const ratio = await amlConfig.getThreshold('aml.s3.ratio', 0.9);
    const windowMin = await amlConfig.getThreshold('aml.s3.windowMinutes', 60);
    const deposits = await da.confirmedDepositsInWindow(
      p.userId, p.cryptoId, new Date(Date.now() - windowMin * 60000)
    );
    const f3 = s3({ withdrawalAmount: p.amount, deposits, ratio });
    if (f3) {
      results.push({
        userId: p.userId,
        finding: f3,
        dedupeKey: `${p.userId}:S3:${p.blockchainTransactionId}`,
      });
    }
  }

  if (event.type === 'P2PTransactionCompleted') {
    // S4 wash-trading / collusion: same pair too many times in the window
    const threshold = await amlConfig.getThreshold('aml.s4.count', 5);
    const windowHours = await amlConfig.getThreshold('aml.s4.windowHours', 168);
    const count = await da.p2pCompletedCountBetween(
      p.buyerId, p.sellerId, new Date(Date.now() - windowHours * 3600000)
    );
    const f4 = s4({ count, threshold });
    if (f4) {
      // Record BOTH parties in the evidence: S4 flags the seller's risk too
      // (`alsoFlag`), so the case must name the seller for that elevated risk to be
      // traceable back to a case (audit-trail requirement — no flag without a case).
      f4.evidence.buyerId = p.buyerId;
      f4.evidence.sellerId = p.sellerId;
      const pairKey = [p.buyerId, p.sellerId].sort().join(':');
      results.push({
        userId: p.buyerId,
        finding: f4,
        dedupeKey: `${pairKey}:S4:${utcDay()}`,
        alsoFlag: [p.sellerId],
      });
    }
  }

  return results;
}

module.exports = { evaluate, utcDay };
