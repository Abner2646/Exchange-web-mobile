const { PendingAdminAction } = require('./governance.model');
const makerChecker = require('./makerChecker.service');
const { User } = require('../../models');
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

// A DISTINCT checker authorizes and executes. The checker proves a second factor by
// submitting a fresh 2FA code, verified authoritatively against the DB for THIS user.
async function approve(req, res) {
  const { codigo } = req.body;
  const checkerUserId = req.user.id;

  const action = await makerChecker.approve({
    actionId: req.params.id,
    checkerUserId,
    verifyCheckerSecondFactor: () => User.verify2FACode(checkerUserId, codigo),
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
