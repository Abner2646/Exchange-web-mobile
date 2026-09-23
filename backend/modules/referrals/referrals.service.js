const { sequelize, Crypto } = require('../../models');
const { ReferralLink, ReferralBalance } = require('./referrals.model');
const { postTransaction } = require('../balances/ledger/postingService');
const { PURPOSES } = require('../balances/ledger/ledgerAccounts');
const money = require('../../utils/money');
const businessConfig = require('../config/businessConfig');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');

async function accrueCommission({ inviteeUserId, feeAmount, feeAsset, feeUsdtEquivalent }) {
  // USDT target
  let amountToAdd = feeUsdtEquivalent;
  if (!amountToAdd) {
    if (feeAsset === 'USDT') {
      amountToAdd = feeAmount;
    } else {
      // TODO: Usar el servicio de precios/orculo real cuando est disponible para la conversin a USDT.
      // REVIEW: Como no hay orculo inyectado, asumo que el caller provee feeUsdtEquivalent o la tarifa ya es en USDT.
      throw new Error('feeUsdtEquivalent es requerido si feeAsset no es USDT');
    }
  }

  const commissionPct = await businessConfig.getNumber('referral_commission_pct', 0.1);
  const commissionUsdt = money.multiply(String(amountToAdd), String(commissionPct));

  if (money.compare(commissionUsdt, '0') <= 0) {
    return null;
  }

  const link = await ReferralLink.findOne({ where: { inviteeId: inviteeUserId } });
  if (!link) {
    return null;
  }

  return await sequelize.transaction(async (transaction) => {
    const [balance] = await ReferralBalance.findOrCreate({
      where: { userId: link.sponsorId },
      defaults: { saldoReferidosPendienteUsdt: '0' },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    const currentSaldo = balance.saldoReferidosPendienteUsdt;
    const newSaldo = money.add(currentSaldo, commissionUsdt);
    
    await balance.update({ saldoReferidosPendienteUsdt: newSaldo }, { transaction });
    return commissionUsdt;
  });
}

async function claim({ userId, reference }, externalTransaction = null) {
  const executeClaim = async (transaction) => {
    const balance = await ReferralBalance.findOne({
      where: { userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!balance || money.compare(balance.saldoReferidosPendienteUsdt, '0') === 0) {
      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'No hay balance de referidos pendiente para reclamar');
    }

    const amount = balance.saldoReferidosPendienteUsdt;

    // The ledger keys accounts by crypto_id (a UUID), NEVER by symbol. Resolve the
    // USDT UUID; passing the string 'USDT' would create a bogus, unreconcilable
    // account. Fail loudly if USDT is not configured.
    const usdt = await Crypto.getBySymbol('USDT');
    if (!usdt) {
      throw new AppError(500, errorCodes.INTERNAL_ERROR, 'USDT no está configurada como criptomoneda');
    }

    // 1. Zero out the pending balance in the referral table
    await balance.update({ saldoReferidosPendienteUsdt: '0' }, { transaction });

    // 2. Ledger movement (balanced double-entry, USDT). Referral payout is a rebate
    // drawn from house FEE_REVENUE into the user's funding:disponible.
    // REVIEW (design, for Abner): drawing from FEE_REVENUE assumes it holds enough
    // USDT (overdraft-protected by the ledger). A dedicated REFERRAL_LIABILITY
    // purpose funded at accrual time may be the cleaner audit-grade model.
    const lines = [
      { ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: usdt.id, amount: money.negate(amount) },
      { ownerId: userId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: usdt.id, amount: amount }
    ];

    await postTransaction({
      type: 'referral_claim',
      reference,
      description: 'Reclamo de comisiones de referidos',
      lines
    }, transaction);

    return { amountClaimed: amount, asset: 'USDT' };
  };

  if (externalTransaction) {
    return executeClaim(externalTransaction);
  } else {
    return sequelize.transaction(executeClaim);
  }
}

module.exports = { accrueCommission, claim };
