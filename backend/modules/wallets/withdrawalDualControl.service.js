// backend/modules/wallets/withdrawalDualControl.service.js
//
// Hito 11 — dual control (Maker-Checker / 4-eyes) wired into the LARGE-WITHDRAWAL path.
// A withdrawal whose USD magnitude crosses the configured threshold (default > $5,000) — or
// the inviolable $20,000 hard ceiling — is not transmitted. Instead its row is HELD
// (`dualControlPending`) at creation time and a pending admin action is proposed; a DISTINCT
// operator (checker) must authorize with their TOTP second factor before the hold is released
// and the transmit pipeline can pick it up.
//
// SECURITY: the USD amount that drives the decision is computed SERVER-SIDE from the REAL
// withdrawal (crypto + amount) via amlValuation — never trusted from a client/maker-declared
// value. The hard-ceiling rule lives in makerChecker.requiresDualControl and is reused here.
const makerChecker = require('../governance/makerChecker.service');
const businessConfig = require('../config/businessConfig');
const amlValuation = require('../aml/amlValuation');

// Registered executor key. The wallets module registers the release executor under this type;
// the governance engine looks it up by this exact string when a checker approves.
const ACTION_TYPE = 'large_withdrawal_release';

// Seed default (editable from the admin panel via businessConfig). Above this USD amount a
// withdrawal requires dual control; the $20k hard ceiling in makerChecker can never be raised past.
const DEFAULT_THRESHOLD_USD = 5000;

// A pair-derived price older than this (or with no timestamp) is NOT trusted to decide dual
// control: a frozen/manipulated feed could undervalue a truly-large withdrawal below the
// threshold and skip 4-eyes. Such a price is treated as unvaluable → fail closed. Stable-quote
// valuations (USDT/USDC/…) are 1:1 and always fresh, so they are exempt.
const MAX_PRICE_AGE_MS = 3600 * 1000; // 1 hour

// Decide, from the REAL withdrawal, whether it needs dual control. Returns the decision plus the
// server-computed USD magnitude (stored on the pending action for the audit trail).
async function evaluate(cryptoId, amount, transaction = null) {
  const valuation = await amlValuation.getUsdValue(cryptoId, amount, transaction);

  // Trust the figure only if we actually have a USD value AND (it is a stable 1:1 valuation, or a
  // pair price with a fresh timestamp). Anything else → we cannot prove the amount is under the
  // ceiling, so fail closed by default (operator-overridable via config).
  const priceMs = valuation.priceAsOf ? new Date(valuation.priceAsOf).getTime() : null;
  const fresh = valuation.source === 'stable'
    || (priceMs !== null && Date.now() - priceMs <= MAX_PRICE_AGE_MS);
  const trusted = (valuation.usd !== null && valuation.usd !== undefined) && fresh;

  if (!trusted) {
    const holdUnvaluable = await businessConfig.getBoolean('withdrawal_dual_control_on_unvaluable', true);
    return { dualControl: holdUnvaluable, amountUsd: valuation.usd ?? null };
  }

  const threshold = await businessConfig.getNumber('withdrawal_dual_control_usd_threshold', DEFAULT_THRESHOLD_USD);
  return {
    dualControl: makerChecker.requiresDualControl(valuation.usd, threshold),
    amountUsd: valuation.usd,
  };
}

// Record the pending dual-control action for a held withdrawal, atomically within the
// withdrawal-creation transaction (so we never leave a held row without an approval path).
async function propose({ withdrawalId, makerUserId, amountUsd }, transaction) {
  return makerChecker.propose(
    { makerUserId, actionType: ACTION_TYPE, payload: { withdrawalId }, amountUsd },
    { transaction }
  );
}

// Executor: a DISTINCT checker has authorized. Release the dual-control hold atomically inside
// the approval transaction. If no releasable held row matches (already released / wrong state),
// throw so makerChecker.approve rolls the whole approval back — never a silent no-op approval.
async function releaseExecutor(payload, transaction) {
  const { BlockchainTransaction } = require('../../models');
  const affected = await BlockchainTransaction.releaseDualControlHold(payload.withdrawalId, transaction);
  if (!affected) {
    throw new Error(`No releasable dual-control withdrawal hold for ${payload.withdrawalId}`);
  }
  return { released: true, withdrawalId: payload.withdrawalId };
}

// Compensator: the dual-control action was REJECTED by a checker or EXPIRED past its TTL WITHOUT
// executing. Cancel the held withdrawal and return the user's blocked funds to available — atomically
// inside the reject/expire transaction — otherwise the withdrawal is stranded in the dual-control hold
// forever with the funds blocked and no path back (the release-only executor never runs). Idempotent:
// the model method only refunds a still-held row (status='pending' + dualControlPending), so a re-run
// or a race can never double-refund; a 0-match is a safe no-op (the hold is already resolved) — unlike
// the release executor, we do not throw, matching the launchpad compensator contract.
async function cancelCompensator(payload, transaction) {
  const { BlockchainTransaction } = require('../../models');
  await BlockchainTransaction.cancelDualControlHold(payload.withdrawalId, transaction);
}

// Wire the executor + compensator into the governance engine. Called once at app boot.
function register() {
  makerChecker.registerExecutor(ACTION_TYPE, releaseExecutor);
  makerChecker.registerCompensator(ACTION_TYPE, cancelCompensator);
}

module.exports = { ACTION_TYPE, DEFAULT_THRESHOLD_USD, evaluate, propose, releaseExecutor, cancelCompensator, register };
