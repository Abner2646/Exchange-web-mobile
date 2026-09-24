const { PendingAdminAction } = require('./governance.model');
const makerChecker = require('./makerChecker.service');
const { User } = require('../../models');
const totp = require('../users/totp.service');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');

// Maker proposes a privileged action. Operator + MFA is enforced by route middleware.
async function propose(req, res) {
  const { actionType, payload, amountUsd } = req.body;
  const action = await makerChecker.propose({
    makerUserId: req.user.id,
    actionType,
    payload,
    amountUsd: amountUsd ?? null,
  });
  res.status(201).json(action);
}

// A DISTINCT checker authorizes and executes. The checker proves a second factor with a
// TOTP code from their authenticator app, verified against their enrolled secret. Unlike
// the old email-code path, TOTP works for an already-logged-in operator (it is time-based,
// not a per-login stored code), so the approval step-up actually functions.
async function approve(req, res) {
  const { codigo } = req.body;
  const checkerUserId = req.user.id;

  const action = await makerChecker.approve({
    actionId: req.params.id,
    checkerUserId,
    verifyCheckerSecondFactor: async () => {
      const checker = await User.findByPk(checkerUserId);
      totp.verifyForUser(checker, codigo); // throws on invalid / not enrolled
    },
  });
  res.status(200).json(action);
}

async function reject(req, res) {
  const action = await makerChecker.reject({
    actionId: req.params.id,
    checkerUserId: req.user.id,
    reason: req.body?.reason ?? null,
  });
  res.status(200).json(action);
}

// Inbox of pending actions for operators. Excludes nothing sensitive here (operator-only route).
async function listPending(req, res) {
  const actions = await PendingAdminAction.findAll({
    where: { status: 'pending' },
    order: [['created_at', 'ASC']],
  });
  res.json({ pending: actions });
}

module.exports = { propose, approve, reject, listPending };
