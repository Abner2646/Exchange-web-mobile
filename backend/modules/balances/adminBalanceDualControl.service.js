// backend/modules/balances/adminBalanceDualControl.service.js
//
// Dual control (Maker-Checker / 4-eyes) for PRIVILEGED SINGLE-OPERATOR balance mutations:
//   - manual balance adjustment (PUT /balances/user/:userId/crypto/:cryptoId)  — money creation/destruction
//   - cross-user transfer        (POST /balances/transfer)                     — moves money between users
//   - block / unblock            (POST .../block, .../unblock)                 — within-user available↔blocked
// These were reachable by a single operator (operator + MFA) with no 4-eyes — a bigger control asymmetry
// than large withdrawals or large launchpad resolutions (which are already dual-controlled). Above a
// server-computed USD magnitude they are now routed through Maker-Checker.
//
// DESIGN: unlike a large withdrawal (which is HELD at creation with the funds blocked), an admin mutation
// has no natural intermediate held state — so we DEFER the whole ledger posting: `propose` records the
// exact intended mutation in the pending action payload and NOTHING moves; the registered executor performs
// the posting inside the checker's approval transaction. Because no resource is held at propose time, a
// rejected/expired action needs NO compensator (the mutation simply never ran). The ledger's own FOR UPDATE
// overdraft guard still protects execution, so a stale proposal that can no longer post fails at approval.
//
// SECURITY: the USD magnitude is computed SERVER-SIDE from the real crypto + |amount| (never a maker-declared
// value); the inviolable $20k hard ceiling lives in makerChecker.requiresDualControl.
const makerChecker = require('../governance/makerChecker.service');
const businessConfig = require('../config/businessConfig');
const amlValuation = require('../aml/amlValuation');
const money = require('../../utils/money');

// Seed default (editable from the admin panel via businessConfig). Above this USD magnitude an admin
// balance mutation requires dual control; makerChecker.requiresDualControl also enforces the $20k hard
// ceiling, so this config can never be raised to bypass 4-eyes.
const DEFAULT_THRESHOLD_USD = 5000;
const THRESHOLD_KEY = 'admin_balance_dual_control_usd_threshold';
const UNVALUABLE_KEY = 'admin_balance_dual_control_on_unvaluable';

// A pair-derived price older than this (or with no timestamp) is NOT trusted to decide dual control —
// a frozen/manipulated feed could undervalue a truly-large mutation below the threshold and skip 4-eyes.
// (Mirrors the fail-closed trust logic in withdrawalDualControl.evaluate; a shared USD-magnitude gate is
// a noted dedup follow-up — behavior parity is already guaranteed by the shared requiresDualControl.)
const MAX_PRICE_AGE_MS = 3600 * 1000; // 1 hour

// One executor per action type. The payload carries the exact intended mutation; the engine looks the
// executor up by this string when a distinct checker approves.
const ACTIONS = {
  UPDATE: 'admin_balance_update',
  TRANSFER: 'admin_balance_transfer',
  BLOCK: 'admin_balance_block',
  UNBLOCK: 'admin_balance_unblock',
};

// Decide, from the REAL mutation, whether it needs dual control. Returns the decision plus the
// server-computed USD magnitude (stored on the pending action for the audit trail).
async function evaluate(cryptoId, amount) {
  // Value the absolute magnitude: a debit (negative amount) is just as large as the equivalent credit.
  const magnitude = money.compare(String(amount), '0') < 0 ? money.negate(String(amount)) : String(amount);
  const valuation = await amlValuation.getUsdValue(cryptoId, magnitude);

  const priceMs = valuation.priceAsOf ? new Date(valuation.priceAsOf).getTime() : null;
  const fresh = valuation.source === 'stable'
    || (priceMs !== null && Date.now() - priceMs <= MAX_PRICE_AGE_MS);
  const trusted = (valuation.usd !== null && valuation.usd !== undefined) && fresh;

  if (!trusted) {
    const holdUnvaluable = await businessConfig.getBoolean(UNVALUABLE_KEY, true);
    return { dualControl: holdUnvaluable, amountUsd: valuation.usd ?? null };
  }

  const threshold = await businessConfig.getNumber(THRESHOLD_KEY, DEFAULT_THRESHOLD_USD);
  return {
    dualControl: makerChecker.requiresDualControl(valuation.usd, threshold),
    amountUsd: valuation.usd,
  };
}

// Propose a deferred admin balance mutation. Nothing moves until a distinct checker approves.
async function propose({ makerUserId, actionType, payload, amountUsd }) {
  return makerChecker.propose({ makerUserId, actionType, payload, amountUsd });
}

// ── Executors: perform the real ledger posting inside the checker's approval transaction ──
async function updateExecutor(payload, transaction) {
  const { UserBalance } = require('../../models');
  await UserBalance.updateBalance(payload.userId, payload.cryptoId, payload.amount, payload.type || 'available', transaction);
  return { applied: ACTIONS.UPDATE, userId: payload.userId, cryptoId: payload.cryptoId, amount: payload.amount };
}

async function blockExecutor(payload, transaction) {
  const { UserBalance } = require('../../models');
  await UserBalance.blockBalance(payload.userId, payload.cryptoId, payload.amount, transaction);
  return { applied: ACTIONS.BLOCK, userId: payload.userId, cryptoId: payload.cryptoId, amount: payload.amount };
}

async function unblockExecutor(payload, transaction) {
  const { UserBalance } = require('../../models');
  await UserBalance.unblockBalance(payload.userId, payload.cryptoId, payload.amount, transaction);
  return { applied: ACTIONS.UNBLOCK, userId: payload.userId, cryptoId: payload.cryptoId, amount: payload.amount };
}

async function transferExecutor(payload, transaction) {
  const { transferInternal } = require('./ledger/operations');
  await transferInternal({
    remitenteId: payload.fromUserId,
    destinatarioId: payload.toUserId,
    criptomonedaId: payload.cryptoId,
    cantidad: payload.amount,
    referencia: payload.reference,
  }, transaction);
  return { applied: ACTIONS.TRANSFER, fromUserId: payload.fromUserId, toUserId: payload.toUserId, cryptoId: payload.cryptoId, amount: payload.amount };
}

// Wire the executors into the governance engine. Called once at app boot. No compensators: nothing is
// held at propose time, so a reject/expiry has nothing to release (the posting simply never happened).
function register() {
  makerChecker.registerExecutor(ACTIONS.UPDATE, updateExecutor);
  makerChecker.registerExecutor(ACTIONS.BLOCK, blockExecutor);
  makerChecker.registerExecutor(ACTIONS.UNBLOCK, unblockExecutor);
  makerChecker.registerExecutor(ACTIONS.TRANSFER, transferExecutor);
}

module.exports = {
  ACTIONS,
  DEFAULT_THRESHOLD_USD,
  evaluate,
  propose,
  updateExecutor,
  blockExecutor,
  unblockExecutor,
  transferExecutor,
  register,
};
