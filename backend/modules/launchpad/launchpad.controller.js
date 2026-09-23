const { Presale, Contribution } = require('./launchpad.model');
const launchpadService = require('./launchpad.service');
const AppError = require('../../utils/AppError');
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

module.exports = {
  getPresales,
  getPresale,
  buy
};
