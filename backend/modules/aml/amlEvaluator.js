// modules/aml/amlEvaluator.js
// Maps a money event to its signals, gathers facts, returns the findings to persist.
// No DB writes — the consumer persists. Pure signals; impure fact-gathering here.
const amlConfig = require('./amlConfig');
const da = require('./amlDataAccess');
const valuation = require('./amlValuation');
const money = require('../../utils/money');
const s1 = require('./signals/s1');
const s2 = require('./signals/s2');
const s3 = require('./signals/s3');
const s4 = require('./signals/s4');
const s6 = require('./signals/s6');

function utcDay() { return new Date().toISOString().slice(0, 10); }

// valueItems: values a list of {amount, cryptoId} items via amlValuation.
// Drops unvaluable assets (records the count so callers can attach it to evidence).
// Returns { sumUsd, valuedUsds, unvaluable }.
// Memoizes getUsdValue per cryptoId within a single call: fetches the unit price
// (amount='1') once per unique asset and scales by each item's actual amount, so
// repeated assets (e.g. several BTC withdrawals in S2) avoid redundant DB lookups.
async function valueItems(items) {
  let sumUsd = '0';
  const valuedUsds = [];
  const unvaluableCryptoIds = [];
  const cache = new Map(); // memoize per cryptoId within this call
  for (const it of items) {
    if (!cache.has(it.cryptoId)) {
      cache.set(it.cryptoId, await valuation.getUsdValue(it.cryptoId, '1'));
    }
    const { usd: unitUsd } = cache.get(it.cryptoId);
    if (unitUsd === null) { unvaluableCryptoIds.push(it.cryptoId); continue; }
    // Scale the unit price by the actual amount.
    const usd = money.multiply(unitUsd, String(it.amount));
    valuedUsds.push(usd);
    sumUsd = money.add(sumUsd, usd);
  }
  // `unvaluable` = count (back-compat); `unvaluableCryptoIds` = which assets went
  // unpriced, so a compliance reviewer sees the exact gap, not just a number.
  return { sumUsd, valuedUsds, unvaluable: unvaluableCryptoIds.length, unvaluableCryptoIds };
}

async function evaluate(event) {
  const results = [];
  const p = event.payload || {};

  // Guard: a malformed event (missing key fields) must not crash signal logic or
  // produce false cases. Return empty rather than propagating undefined through
  // money.multiply / dedupeKey string interpolation.
  if (event.type === 'WithdrawalTransmitted' || event.type === 'DepositConfirmed') {
    if (!p.userId || !p.cryptoId || p.amount == null) return results;
  }
  if (event.type === 'P2PTransactionCompleted') {
    if (!p.buyerId || !p.sellerId) return results;
  }

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

    // S2 structuring (USD-valued withdrawals in the window)
    const T = await amlConfig.getThreshold('aml.s2.thresholdUsd', 10000);
    const s2count = await amlConfig.getThreshold('aml.s2.count', 3);
    const s2Hours = await amlConfig.getThreshold('aml.s2.windowHours', 24);
    const wds = await da.withdrawalsInWindow(p.userId, new Date(Date.now() - s2Hours * 3600000));
    const { valuedUsds, unvaluable: unvS2, unvaluableCryptoIds: unvIdsS2 } = await valueItems(wds);
    const f2 = s2({ withdrawalUsds: valuedUsds, thresholdUsd: T, count: s2count });
    if (f2) {
      f2.evidence.unvaluable = unvS2; // how many withdrawals couldn't be USD-valued
      f2.evidence.unvaluableCryptoIds = unvIdsS2; // which assets — the exact pricing gap
      results.push({ userId: p.userId, finding: f2, dedupeKey: `${p.userId}:S2:${utcDay()}` });
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

  // S1 + S6: shared block for all on-chain movements (deposits and withdrawals)
  if (event.type === 'DepositConfirmed' || event.type === 'WithdrawalTransmitted') {
    const userId = p.userId;
    // One query for both S1 (dailyLimitUsd) and S6 (createdAt).
    const { createdAt, dailyLimitUsd: limitUsd } = await da.userProfile(userId);

    // S1 volume over the rolling window vs the user's daily limit
    const s1Hours = await amlConfig.getThreshold('aml.s1.windowHours', 24);
    const s1Mult  = await amlConfig.getThreshold('aml.s1.multiplier', 3);
    // Skip S1 when there's no positive limit (missing/null/0): a 0 ceiling would
    // fire on any volume (ghost-user false positive). Only evaluate against a real limit.
    if (limitUsd !== null && money.compare(limitUsd, '0') > 0) {
      const moves1 = await da.onchainMovementsInWindow(userId, new Date(Date.now() - s1Hours * 3600000));
      const { sumUsd: vol1, unvaluable: unv1, unvaluableCryptoIds: unvIds1 } = await valueItems(moves1);
      const f1 = s1({ totalUsd: vol1, limitUsd, multiplier: s1Mult });
      if (f1) {
        f1.evidence.unvaluable = unv1;
        f1.evidence.unvaluableCryptoIds = unvIds1;
        results.push({ userId, finding: f1, dedupeKey: `${userId}:S1:${utcDay()}` });
      }
    }

    // S6 new-account volume since signup
    const maxAgeDays = await amlConfig.getThreshold('aml.s6.accountAgeDays', 7);
    const volumeUsd  = await amlConfig.getThreshold('aml.s6.volumeUsd', 50000);
    if (createdAt) {
      const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86400000;
      if (ageDays < maxAgeDays) {
        const movesAll = await da.onchainMovementsInWindow(userId, new Date(createdAt));
        const { sumUsd: vol6, unvaluable: unv6, unvaluableCryptoIds: unvIds6 } = await valueItems(movesAll);
        const f6 = s6({ accountAgeDays: ageDays, maxAgeDays, totalUsd: vol6, volumeUsd });
        if (f6) {
          f6.evidence.unvaluable = unv6;
          f6.evidence.unvaluableCryptoIds = unvIds6;
          results.push({ userId, finding: f6, dedupeKey: `${userId}:S6:${utcDay()}` });
        }
      }
    }
  }

  return results;
}

module.exports = { evaluate, utcDay, valueItems };
