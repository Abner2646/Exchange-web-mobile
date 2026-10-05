// modules/oracle/oracleCircuitBreaker.service.js
//
// Circuit breaker that gates the SWAP price feed with the multi-source oracle.
// Runs OUT of the swap hot-path (a background sweep, see jobs/oracleBreaker.job.js)
// so the money transaction never blocks on external HTTP. Per swap pair that has an
// `externalSymbol`:
//   - oracle reliable      -> update currentPrice to the median, clear the pause.
//   - oracle divergent      -> PAUSE the pair (do NOT touch the price), emit
//     PRICE_ORACLE_DIVERGENCE (atomically, transactional outbox) and fire a
//     sanitized Telegram alert so an operator can look.
//   - oracle throws (<2 sources) -> FAIL SAFE: pause as if divergent (we cannot
//     prove the price is sound).
// Pairs with no externalSymbol are skipped untouched (manual-priced pairs keep
// their behavior — additive, nothing breaks).
'use strict';

const OracleService = require('./oracle.service');
const defaultSources = require('./oracle.sources');
const { emitEvent: defaultEmitEvent } = require('../events/emitEvent');
const { sendAlert: defaultSendAlert } = require('../alerts/telegramAlert.service');
const businessConfig = require('../config/businessConfig');

const PRICE_ORACLE_DIVERGENCE = 'PRICE_ORACLE_DIVERGENCE';

// Evaluate + apply the oracle outcome for ONE pair. Dependencies are injected so the
// money-path policy is unit-testable without a DB, network, or the outbox.
async function refreshPairFromOracle(pair, deps) {
  const {
    oracleService,
    emitEvent = defaultEmitEvent,
    sendAlert = defaultSendAlert,
    sequelize,
  } = deps;

  // Manual-priced pairs (no external symbol) are intentionally out of scope.
  if (!pair.externalSymbol) {
    return { action: 'skipped', pairId: pair.id };
  }

  let result;
  try {
    result = await oracleService.getPrice(pair.externalSymbol);
  } catch (err) {
    // Fail safe: an unavailable oracle (insufficient sources) must pause, not pass.
    return pausePair(pair, {
      reason: `ORACLE_UNAVAILABLE: ${err.message}`,
      divergencePct: null,
    }, { emitEvent, sendAlert, sequelize });
  }

  if (!result.reliable) {
    return pausePair(pair, {
      reason: result.reason || 'oracle divergence circuit breaker',
      divergencePct: result.divergencePct,
    }, { emitEvent, sendAlert, sequelize });
  }

  // Reliable: adopt the median as the swap price and clear any prior pause.
  const wasPaused = pair.oraclePaused;
  await pair.update({
    previousPrice: pair.currentPrice,
    currentPrice: String(result.median),
    oraclePaused: false,
    oraclePauseReason: null,
    oracleCheckedAt: new Date(),
    priceSource: 'oracle',
    lastUpdated: new Date(),
  });

  return { action: 'updated', pairId: pair.id, price: String(result.median), recovered: !!wasPaused };
}

// Pause a pair. If it was already paused, this is a no-op write-wise and emits
// nothing — avoids an alert storm while a divergence persists across sweeps.
async function pausePair(pair, { reason, divergencePct }, { emitEvent, sendAlert, sequelize }) {
  if (pair.oraclePaused) {
    // Still record that we checked (cheap, no event/alert).
    await pair.update({ oracleCheckedAt: new Date(), oraclePauseReason: reason });
    return { action: 'already_paused', pairId: pair.id, reason };
  }

  // Pause + emit atomically (transactional outbox): the pause state and the event
  // commit together, so a crash can't pause without the event (or vice versa).
  await sequelize.transaction(async (transaction) => {
    await pair.update({
      oraclePaused: true,
      oraclePauseReason: reason,
      oracleCheckedAt: new Date(),
    }, { transaction });

    await emitEvent(PRICE_ORACLE_DIVERGENCE, {
      pairId: pair.id,
      externalSymbol: pair.externalSymbol,
      divergencePct: divergencePct != null ? String(divergencePct) : null,
      reason,
    }, { transaction, aggregateId: pair.id });
  });

  // Best-effort out-of-band alert (NOT in the money tx; failure must not roll back).
  await sendAlert({
    severity: 'critical',
    code: PRICE_ORACLE_DIVERGENCE,
    message: `Swap paused for ${pair.externalSymbol}: ${reason}`,
    context: { pairId: pair.id, externalSymbol: pair.externalSymbol, divergencePct },
  });

  return { action: 'paused', pairId: pair.id, reason };
}

// Sweep all active, externally-priced swap pairs. Per-pair errors are isolated so a
// single bad pair can never abort the whole pass.
async function sweep(deps = {}) {
  const { SwapPair, sequelize } = require('../../models');
  const { Op } = require('sequelize');

  const threshold = await businessConfig.getNumber('oracle_divergence_threshold_pct', 1.5);
  const oracleService = deps.oracleService
    || new OracleService(deps.sources || defaultSources, threshold);

  const pairs = await SwapPair.findAll({
    where: { active: true, externalSymbol: { [Op.ne]: null } },
  });

  const summary = { total: pairs.length, updated: 0, paused: 0, alreadyPaused: 0, skipped: 0, errors: 0 };

  for (const pair of pairs) {
    try {
      const outcome = await refreshPairFromOracle(pair, {
        oracleService,
        sequelize,
        emitEvent: deps.emitEvent,
        sendAlert: deps.sendAlert,
      });
      if (outcome.action === 'updated') summary.updated++;
      else if (outcome.action === 'paused') summary.paused++;
      else if (outcome.action === 'already_paused') summary.alreadyPaused++;
      else if (outcome.action === 'skipped') summary.skipped++;
    } catch (err) {
      summary.errors++;
      console.error(`[oracleCircuitBreaker] pair ${pair.id} failed:`, err.message);
    }
  }

  return summary;
}

module.exports = { refreshPairFromOracle, sweep, PRICE_ORACLE_DIVERGENCE };
