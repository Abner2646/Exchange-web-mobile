const { sequelize, Crypto, LedgerEntry } = require('../../models');
const { ReferralLink, ReferralBalance } = require('./referrals.model');
const { postTransaction } = require('../balances/ledger/postingService');
const { PURPOSES } = require('../balances/ledger/ledgerAccounts');
const money = require('../../utils/money');
const businessConfig = require('../config/businessConfig');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');

// The ledger keys accounts by crypto_id (a UUID), NEVER by symbol. Passing the
// string 'USDT' would create a bogus, unreconcilable account. Resolve it once.
async function resolveUsdt() {
  const usdt = await Crypto.getBySymbol('USDT');
  if (!usdt) {
    throw new AppError(500, errorCodes.INTERNAL_ERROR, 'USDT no está configurada como criptomoneda');
  }
  return usdt;
}

// Accrue a referral commission for the invitee's sponsor. Audit-grade accounting:
// the obligation is booked to a dedicated house liability account (REFERRAL_LIABILITY)
// at the moment it is earned — funded out of FEE_REVENUE — so the liability lives on
// the ledger from accrual, not conjured at claim time. The ReferralBalance table is a
// fast per-user read of what is owed; the ledger liability is the source of truth.
async function accrueCommission({ inviteeUserId, feeAmount, feeAsset, feeUsdtEquivalent, sourceRef }, externalTransaction = null) {
  let amountToAdd = feeUsdtEquivalent;
  if (!amountToAdd) {
    if (feeAsset === 'USDT') {
      amountToAdd = feeAmount;
    } else {
      // The caller must convert non-USDT fees to their USDT equivalent (oracle) before
      // accruing; this service does not price assets.
      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'feeUsdtEquivalent es requerido si feeAsset no es USDT');
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
  // No self-referral: a user can never earn a commission on their own trading fees.
  if (link.sponsorId === inviteeUserId) {
    return null;
  }
  // A stable source-event ref is REQUIRED so a retried/duplicated fee settlement is
  // idempotent. A random fallback would defeat dedup and double-accrue the commission.
  if (!sourceRef) {
    throw new AppError(400, errorCodes.VALIDATION_ERROR, 'sourceRef es requerido para devengar comisión de referidos');
  }
  const reference = `referral_accrual:${sourceRef}`;

  const execute = async (transaction) => {
    // Idempotency guard: if this accrual was already posted, do NOT touch the per-user
    // balance again. postTransaction dedups the LEDGER by reference, but the balance
    // projection below would otherwise double-count on a retry and diverge from the
    // ledger liability (letting a later claim overdraw REFERRAL_LIABILITY).
    const existing = await LedgerEntry.findOne({ where: { reference }, transaction });
    if (existing) {
      return null;
    }

    const usdt = await resolveUsdt();

    const [balance] = await ReferralBalance.findOrCreate({
      where: { userId: link.sponsorId },
      defaults: { saldoReferidosPendienteUsdt: '0' },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    const newSaldo = money.add(balance.saldoReferidosPendienteUsdt, commissionUsdt);
    await balance.update({ saldoReferidosPendienteUsdt: newSaldo }, { transaction });

    // Fund the liability: move the earned commission out of house revenue into the
    // referral liability account (balanced, USDT).
    await postTransaction({
      type: 'referral_accrual',
      reference,
      description: 'Devengo de comisión de referidos',
      lines: [
        { ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: usdt.id, amount: money.negate(commissionUsdt) },
        { ownerId: null, purpose: PURPOSES.REFERRAL_LIABILITY, cryptoId: usdt.id, amount: commissionUsdt }
      ]
    }, transaction);

    return commissionUsdt;
  };

  return externalTransaction ? execute(externalTransaction) : sequelize.transaction(execute);
}

// Pay out an accrued referral balance. Moves the amount FROM the house referral
// liability INTO the user's funding:disponible (balanced, USDT) and zeroes the
// per-user pending balance in the same transaction. Idempotent by `reference`.
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
    const usdt = await resolveUsdt();

    // 1. Zero out the per-user pending balance.
    await balance.update({ saldoReferidosPendienteUsdt: '0' }, { transaction });

    // 2. Ledger: drain the referral liability into the user's funding:disponible.
    const lines = [
      { ownerId: null, purpose: PURPOSES.REFERRAL_LIABILITY, cryptoId: usdt.id, amount: money.negate(amount) },
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
