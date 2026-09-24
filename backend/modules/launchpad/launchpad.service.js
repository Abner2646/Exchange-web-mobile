const { sequelize, Crypto } = require('../../models');
const { Presale, Contribution } = require('./launchpad.model');
const { postTransaction } = require('../balances/ledger/postingService');
const { PURPOSES } = require('../balances/ledger/ledgerAccounts');
const money = require('../../utils/money');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');

async function buy({ userId, presaleId, amountUsdt, idempotencyKey, finalizeInTransaction, req }) {
  return await sequelize.transaction(async (transaction) => {
    const presale = await Presale.findByPk(presaleId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!presale) {
      throw new AppError(404, errorCodes.NOT_FOUND, 'Presale not found');
    }

    const now = new Date();
    if (now < presale.startDate || now > presale.endDate || presale.status !== 'ACTIVE') {
      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Presale is not active');
    }

    // Reject non-positive amounts outright — independent of min-ticket config. A negative
    // amount would flip the ledger legs (credit the buyer, debit house SUSPENSE) and mint
    // funds; a zero amount is a no-op that should not create a contribution.
    if (money.compare(amountUsdt, '0') <= 0) {
      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Amount must be positive');
    }

    if (money.compare(amountUsdt, presale.minTicketUsdt) < 0) {
      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Amount is below min ticket');
    }
    
    if (money.compare(amountUsdt, presale.maxTicketUsdt) > 0) {
      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Amount is above max ticket');
    }

    const userContributions = await Contribution.findAll({
      where: { presaleId, userId },
      transaction
    });

    const userTotal = userContributions.reduce((acc, c) => money.add(acc, c.amountUsdt), '0');
    const newUserTotal = money.add(userTotal, amountUsdt);

    if (money.compare(newUserTotal, presale.maxTicketUsdt) > 0) {
      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Total amount exceeds max ticket');
    }

    const newTotalRaised = money.add(presale.totalRaisedUsdt, amountUsdt);
    if (money.compare(newTotalRaised, presale.hardCapUsdt) > 0) {
      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Hard cap exceeded');
    }

    const usdt = await Crypto.getBySymbol('USDT');
    if (!usdt) {
      throw new AppError(500, errorCodes.INTERNAL_ERROR, 'USDT not configured');
    }

    const tokenAmount = money.divide(amountUsdt, presale.priceUsdt);

    const contribution = await Contribution.create({
      presaleId,
      userId,
      amountUsdt,
      tokenAmount,
      reference: idempotencyKey
    }, { transaction });

    await presale.update({ totalRaisedUsdt: newTotalRaised }, { transaction });

    // REVIEW: Using SUSPENSE as escrow account for USDT. 
    // Is there a dedicated LAUNCHPAD_ESCROW? Assuming SUSPENSE for now.
    const lines = [
      { ownerId: userId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: usdt.id, amount: money.negate(amountUsdt) },
      { ownerId: null, purpose: PURPOSES.SUSPENSE, cryptoId: usdt.id, amount: amountUsdt }
    ];

    await postTransaction({
      type: 'launchpad_buy',
      reference: idempotencyKey,
      description: 'Compra en Launchpad',
      lines
    }, transaction);

    // Call idempotency finalize if provided
    if (finalizeInTransaction && req) {
      await finalizeInTransaction(req, transaction, 200, contribution.toJSON());
    }

    return contribution;
  });
}

async function resolvePresale({ presaleId }) {
  return await sequelize.transaction(async (transaction) => {
    const presale = await Presale.findByPk(presaleId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!presale) {
      throw new AppError(404, errorCodes.NOT_FOUND, 'Presale not found');
    }

    if (presale.status !== 'ACTIVE') {
      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Presale already resolved or pending');
    }

    const contributions = await Contribution.findAll({
      where: { presaleId },
      transaction
    });

    const isSuccess = money.compare(presale.totalRaisedUsdt, presale.softCapUsdt) >= 0;
    
    const usdt = await Crypto.getBySymbol('USDT');
    if (!usdt) {
      throw new AppError(500, errorCodes.INTERNAL_ERROR, 'USDT not configured');
    }

    if (isSuccess) {
      // Success: credit purchased tokens to buyers, and maybe move USDT to treasury
      // The tokens are credited from TREASURY to user's FUNDING_AVAILABLE
      let tokenLines = [];
      let usdtLines = [];
      
      for (const c of contributions) {
        // Token credit
        // REVIEW: Assuming TREASURY holds the tokens to be distributed.
        tokenLines.push({ ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: presale.tokenCryptoId, amount: money.negate(c.tokenAmount) });
        tokenLines.push({ ownerId: c.userId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: presale.tokenCryptoId, amount: c.tokenAmount });
        
        // Move USDT from escrow to house treasury
        usdtLines.push({ ownerId: null, purpose: PURPOSES.SUSPENSE, cryptoId: usdt.id, amount: money.negate(c.amountUsdt) });
        usdtLines.push({ ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: usdt.id, amount: c.amountUsdt });
      }

      if (tokenLines.length > 0) {
        await postTransaction({
          type: 'launchpad_resolve_tokens',
          reference: `resolve_t_${presale.id}`,
          description: 'Distribución de tokens Launchpad',
          lines: tokenLines
        }, transaction);
      }

      if (usdtLines.length > 0) {
        await postTransaction({
          type: 'launchpad_resolve_usdt',
          reference: `resolve_u_${presale.id}`,
          description: 'Liquidación de USDT Launchpad',
          lines: usdtLines
        }, transaction);
      }

      await presale.update({ status: 'RESOLVED_SUCCESS' }, { transaction });
    } else {
      // Failed: refund USDT
      let usdtLines = [];
      
      for (const c of contributions) {
        // REVIEW: Refunding 100% from SUSPENSE back to FUNDING_AVAILABLE
        usdtLines.push({ ownerId: null, purpose: PURPOSES.SUSPENSE, cryptoId: usdt.id, amount: money.negate(c.amountUsdt) });
        usdtLines.push({ ownerId: c.userId, purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: usdt.id, amount: c.amountUsdt });
      }

      if (usdtLines.length > 0) {
        await postTransaction({
          type: 'launchpad_refund_usdt',
          reference: `refund_u_${presale.id}`,
          description: 'Reembolso de USDT Launchpad',
          lines: usdtLines
        }, transaction);
      }

      await presale.update({ status: 'RESOLVED_FAILED' }, { transaction });
    }

    return presale;
  });
}

async function createPresale(input) {
  const {
    tokenCryptoId, priceUsdt, hardCapUsdt, softCapUsdt,
    minTicketUsdt, maxTicketUsdt, startDate, endDate
  } = input;

  if (!tokenCryptoId) {
    throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Unknown token crypto');
  }

  const tokenCrypto = await Crypto.findByPk(tokenCryptoId);
  if (!tokenCrypto) {
    throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Unknown token crypto');
  }

  try {
    if (money.compare(priceUsdt, '0') <= 0) throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Price must be positive');
    if (money.compare(hardCapUsdt, '0') <= 0) throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Hard cap must be positive');
    if (money.compare(softCapUsdt, '0') <= 0) throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Soft cap must be positive');
    if (money.compare(maxTicketUsdt, '0') <= 0) throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Max ticket must be positive');
    if (money.compare(minTicketUsdt, '0') < 0) throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Min ticket cannot be negative');

    if (money.compare(softCapUsdt, hardCapUsdt) > 0) throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Soft cap cannot exceed hard cap');
    if (money.compare(minTicketUsdt, maxTicketUsdt) > 0) throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Min ticket cannot exceed max ticket');
    if (money.compare(maxTicketUsdt, hardCapUsdt) > 0) throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Max ticket cannot exceed hard cap');
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Invalid monetary value');
  }

  const sDate = new Date(startDate);
  const eDate = new Date(endDate);
  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || sDate >= eDate) {
    throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Invalid date range');
  }

  const presale = await Presale.create({
    tokenCryptoId, priceUsdt, hardCapUsdt, softCapUsdt,
    minTicketUsdt, maxTicketUsdt, startDate: sDate, endDate: eDate,
    status: 'PENDING'
  });

  return presale;
}

async function activatePresale({ presaleId }) {
  const presale = await Presale.findByPk(presaleId);
  if (!presale) {
    throw new AppError(404, errorCodes.NOT_FOUND, 'Presale not found');
  }

  if (presale.status !== 'PENDING') {
    throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Only a pending presale can be activated');
  }

  await presale.update({ status: 'ACTIVE' });
  return presale;
}

module.exports = { buy, resolvePresale, createPresale, activatePresale };
