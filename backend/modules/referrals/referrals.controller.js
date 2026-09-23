const { sequelize } = require('../../models');
const referralsService = require('./referrals.service');
const idempotency = require('../../middleware/idempotency.middleware');
const { ReferralBalance, ReferralLink } = require('./referrals.model');

async function getSummary(req, res) {
  const userId = req.user.id;
  
  const balanceRow = await ReferralBalance.findOne({ where: { userId } });
  const pendingUsdt = balanceRow ? balanceRow.saldoReferidosPendienteUsdt : '0';

  const invitedLinks = await ReferralLink.findAll({
    where: { sponsorId: userId },
    include: [{ association: 'invitee', attributes: ['email'] }]
  });

  const invitedList = invitedLinks.map(link => {
    let maskedEmail = link.invitee.email;
    if (maskedEmail) {
      const [name, domain] = maskedEmail.split('@');
      // Anonymize: show first 2 chars of name if possible, then ***
      const namePart = name.length > 2 ? name.substring(0, 2) : name[0];
      maskedEmail = `${namePart}***@${domain}`;
    }
    return {
      email: maskedEmail,
      createdAt: link.createdAt
    };
  });

  return res.json({
    pendingUsdt,
    invitedCount: invitedList.length,
    invited: invitedList
  });
}

async function claim(req, res) {
  const userId = req.user.id;
  // Extraemos la key de idempotencia inyectada por el middleware
  const reference = req._idempotency && req._idempotency.where && req._idempotency.where.idempotencyKey
    ? req._idempotency.where.idempotencyKey
    : req.header('Idempotency-Key');

  if (!reference) {
    const AppError = require('../../utils/AppError');
    const errorCodes = require('../../utils/errorCodes');
    throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Idempotency-Key es requerida para el reclamo');
  }

  const result = await sequelize.transaction(async (transaction) => {
    const claimResult = await referralsService.claim({ userId, reference }, transaction);
    
    const responseBody = claimResult;
    // Hardening anti-doble-gasto: completamos la idempotencia en la misma transaccin de BDD
    if (req._idempotency) {
      await idempotency.finalizeInTransaction(req, transaction, 200, responseBody);
    }
    return responseBody;
  });

  res.status(200).json(result);
}

module.exports = { getSummary, claim };
