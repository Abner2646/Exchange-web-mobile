const { Presale, Contribution } = require('./launchpad.model');
const launchpadService = require('./launchpad.service');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');
const { isUuid } = require('../../utils/uuid');
const asyncHandler = require('../../utils/asyncHandler');
const idempotency = require('../../middleware/idempotency.middleware');

const getPresales = asyncHandler(async (req, res) => {
  const presales = await Presale.findAll({
    order: [['created_at', 'DESC']]
  });
  res.json(presales);
});

const getPresale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const presale = await Presale.findByPk(id, {
    include: [{ model: Contribution, as: 'contributions' }]
  });
  if (!presale) {
    throw new AppError(404, 'NOT_FOUND', 'Presale not found');
  }
  res.json(presale);
});

const buy = asyncHandler(async (req, res) => {
  const { presaleId, amountUsdt } = req.body;
  const idempotencyKey = req.get('Idempotency-Key');
  const userId = req.user.id;

  const result = await launchpadService.buy({
    userId,
    presaleId,
    amountUsdt,
    idempotencyKey,
    finalizeInTransaction: idempotency.finalizeInTransaction,
    req
  });

  res.status(200).json(result);
});

const validateUUID = (id) => {
  if (!isUuid(id)) {
    throw new AppError(404, errorCodes.NOT_FOUND, 'Presale not found');
  }
};

const createPresale = asyncHandler(async (req, res) => {
  const result = await launchpadService.createPresale(req.body);
  res.status(201).json(result);
});

const activatePresale = asyncHandler(async (req, res) => {
  validateUUID(req.params.id);
  const result = await launchpadService.activatePresale({ presaleId: req.params.id });
  res.status(200).json(result);
});

const resolvePresale = asyncHandler(async (req, res) => {
  validateUUID(req.params.id);
  const result = await launchpadService.resolvePresale({
    presaleId: req.params.id,
    makerUserId: req.user.id,
  });
  // A large resolution is HELD pending a distinct checker's approval (control parity with large
  // withdrawals) → 202 Accepted with the pending action id; a small one settles immediately → 200.
  if (result.pending) {
    return res.status(202).json({ pending: true, actionId: result.action.id, presale: result.presale });
  }
  res.status(200).json(result.presale);
});

module.exports = {
  getPresales,
  getPresale,
  buy,
  createPresale,
  activatePresale,
  resolvePresale
};
