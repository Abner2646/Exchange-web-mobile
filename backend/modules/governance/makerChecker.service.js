const { sequelize } = require('../../models');
const { PendingAdminAction } = require('./governance.model');
const businessConfig = require('../config/businessConfig');
const money = require('../../utils/money');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');

// Inviolable institutional hard ceiling. No monetary action above this USD amount may
// EVER auto-execute; it always requires dual control. The configurable per-action
// threshold can lower when dual control kicks in, but can never RAISE it past this.
const HARD_CEILING_USD = '20000';

// Default TTL for a pending action (hours) if business config does not override it.
const DEFAULT_TTL_HOURS = 24;

// action_type -> async (payload, transaction) => result. The executor performs the
// real privileged effect (e.g. release a withdrawal, change a fee) once a distinct
// checker has authorized. Registered by the owning module at wiring time so this
// engine stays decoupled from what it authorizes.
const executors = new Map();

function registerExecutor(actionType, fn) {
  if (typeof fn !== 'function') {
    throw new TypeError(`Executor for ${actionType} must be a function`);
  }
  executors.set(actionType, fn);
}

// action_type -> async (payload, transaction) => void. A COMPENSATOR undoes the resource HOLD
// that `propose` created, when the action ends WITHOUT executing (rejected by a checker, or
// expired past its TTL). Without it a held resource (a presale stuck in RESOLUTION_PENDING, a
// held withdrawal) would be stranded forever with no path back. Optional per action type:
// modules that hold a resource at propose time register one; the engine runs it inside the same
// transaction as the reject/expire transition, so the hold is released atomically or not at all.
const compensators = new Map();

function registerCompensator(actionType, fn) {
  if (typeof fn !== 'function') {
    throw new TypeError(`Compensator for ${actionType} must be a function`);
  }
  compensators.set(actionType, fn);
}

// Run the compensator for an action inside `transaction`, if one is registered. A throw
// propagates so the reject/expire transaction rolls back — an action is never marked
// rejected/expired unless its hold was released too.
async function runCompensator(action, transaction) {
  const compensator = compensators.get(action.actionType);
  if (compensator) {
    await compensator(action.payload, transaction);
  }
}

// Whether an action of this USD magnitude requires dual control. Dual control is
// required when the amount exceeds the configured threshold OR the hard ceiling —
// i.e. above the LOWER of the two. This makes the $20k ceiling impossible to bypass
// by misconfiguring the threshold higher.
function requiresDualControl(amountUsd, configuredThresholdUsd) {
  if (amountUsd === null || amountUsd === undefined) return false;
  const effectiveThreshold = money.compare(String(configuredThresholdUsd), HARD_CEILING_USD) > 0
    ? HARD_CEILING_USD
    : String(configuredThresholdUsd);
  return money.compare(String(amountUsd), effectiveThreshold) > 0;
}

// Maker proposes a privileged action. Returns the pending record. The maker's operator
// status/MFA is enforced by route middleware; here we only record the proposal + TTL.
async function propose({ makerUserId, actionType, payload = {}, amountUsd = null }, { transaction } = {}) {
  if (!makerUserId || !actionType) {
    throw new AppError(400, errorCodes.MAKER_CHECKER_INVALID_STATE, 'makerUserId y actionType son requeridos');
  }
  const ttlHours = await businessConfig.getNumber('maker_checker_ttl_horas', DEFAULT_TTL_HOURS);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  // The optional transaction lets a caller (e.g. the large-withdrawal path) record the proposal
  // atomically with the state change that holds the underlying resource — so a held withdrawal
  // can never exist without its approval path, and vice versa.
  return PendingAdminAction.create({
    actionType,
    payload,
    amountUsd: amountUsd === null ? null : String(amountUsd),
    status: 'pending',
    makerUserId,
    expiresAt
  }, transaction ? { transaction } : undefined);
}

// A DISTINCT checker authorizes and executes the action. Enforces, in order:
//  1. the action exists and is still pending,
//  2. it has not expired (past expired actions are marked and refused),
//  3. checker !== maker (hard 4-eyes incompatibility),
//  4. the checker's second factor is valid (verified by the injected verifier),
// then runs the registered executor inside the SAME transaction, so an executor
// failure rolls the whole approval back and leaves the action pending.
async function approve({ actionId, checkerUserId, verifyCheckerSecondFactor }) {
  return sequelize.transaction(async (transaction) => {
    const action = await PendingAdminAction.findByPk(actionId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!action) {
      throw new AppError(404, errorCodes.MAKER_CHECKER_NOT_FOUND, 'Acción pendiente no encontrada');
    }
    if (action.status !== 'pending') {
      throw new AppError(409, errorCodes.MAKER_CHECKER_INVALID_STATE, `La acción ya está en estado ${action.status}`);
    }
    if (new Date() > action.expiresAt) {
      await action.update({ status: 'expired', resolvedAt: new Date() }, { transaction });
      throw new AppError(409, errorCodes.MAKER_CHECKER_EXPIRED, 'La acción expiró y no puede autorizarse');
    }
    // Hard 4-eyes rule: the checker can NEVER be the maker. Normalize both ids (they come
    // from different sources — DB row vs JWT claim) so a representation/case mismatch can
    // never let the same human approve their own proposal.
    if (String(action.makerUserId).toLowerCase() === String(checkerUserId).toLowerCase()) {
      throw new AppError(403, errorCodes.MAKER_CHECKER_SAME_USER, 'El checker no puede ser el mismo que el maker');
    }

    // Second factor: the injected verifier throws on an invalid/expired code.
    try {
      await verifyCheckerSecondFactor();
    } catch (err) {
      throw new AppError(401, errorCodes.MAKER_CHECKER_MFA_INVALID, 'Código de segundo factor del checker inválido');
    }

    const executor = executors.get(action.actionType);
    if (!executor) {
      throw new AppError(500, errorCodes.INTERNAL_ERROR, `No hay executor registrado para ${action.actionType}`);
    }

    // Execute the privileged effect atomically with the state transition.
    const result = await executor(action.payload, transaction);

    await action.update({
      status: 'executed',
      checkerUserId,
      resolvedAt: new Date(),
      result: result === undefined ? null : result
    }, { transaction });

    return action;
  });
}

// A checker (or the maker) rejects a pending action.
async function reject({ actionId, checkerUserId, reason = null }) {
  return sequelize.transaction(async (transaction) => {
    const action = await PendingAdminAction.findByPk(actionId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });
    if (!action) {
      throw new AppError(404, errorCodes.MAKER_CHECKER_NOT_FOUND, 'Acción pendiente no encontrada');
    }
    if (action.status !== 'pending') {
      throw new AppError(409, errorCodes.MAKER_CHECKER_INVALID_STATE, `La acción ya está en estado ${action.status}`);
    }
    await action.update({
      status: 'rejected',
      checkerUserId,
      rejectionReason: reason,
      resolvedAt: new Date()
    }, { transaction });
    // Release the held resource (if any) atomically with the rejection.
    await runCompensator(action, transaction);
    return action;
  });
}

// Mark all pending actions past their TTL as expired, releasing each one's held resource via its
// compensator. Intended for a periodic job. Processed PER ROW inside its own transaction (re-locked
// and re-checked under the row lock) so an expiry can never race a concurrent approve/reject, and
// so a compensator failure only rolls back that one action instead of the whole sweep.
async function expireStale(now = new Date()) {
  const { Op } = require('sequelize');
  const stale = await PendingAdminAction.findAll({
    where: { status: 'pending', expiresAt: { [Op.lt]: now } }
  });
  let count = 0;
  for (const row of stale) {
    // eslint-disable-next-line no-await-in-loop
    await sequelize.transaction(async (transaction) => {
      const action = await PendingAdminAction.findByPk(row.id, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!action || action.status !== 'pending' || new Date(action.expiresAt) >= now) {
        return; // already resolved, or no longer stale — skip
      }
      await action.update({ status: 'expired', resolvedAt: now }, { transaction });
      await runCompensator(action, transaction);
      count += 1;
    });
  }
  return count;
}

module.exports = {
  HARD_CEILING_USD,
  registerExecutor,
  registerCompensator,
  requiresDualControl,
  propose,
  approve,
  reject,
  expireStale,
  // exposed for tests
  _executors: executors,
  _compensators: compensators
};
