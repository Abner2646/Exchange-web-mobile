const { sequelize, Crypto } = require('../../models');
const { Presale, Contribution } = require('./launchpad.model');
const { postTransaction } = require('../balances/ledger/postingService');
const { PURPOSES } = require('../balances/ledger/ledgerAccounts');
const makerChecker = require('../governance/makerChecker.service');
const businessConfig = require('../config/businessConfig');
const money = require('../../utils/money');
const AppError = require('../../utils/AppError');
const errorCodes = require('../../utils/errorCodes');

// Resolving a presale is a privileged BULK money movement: on success the raised USDT moves
// from escrow (SUSPENSE) to house TREASURY and tokens are distributed; on failure everything
// is refunded. Contributions are denominated in USDT (≈ USD 1:1), so `totalRaisedUsdt` is the
// settlement's USD magnitude directly — no oracle needed. To keep control PARITY with large
// withdrawals (which require 4-eyes above a threshold), a large resolution is not settled by a
// single operator: it is HELD (`RESOLUTION_PENDING`) and a Maker-Checker action is proposed;
// a DISTINCT checker must approve with TOTP before the registered executor settles it.
const DUAL_CONTROL_ACTION = 'large_presale_resolve';
// Seed default (editable via businessConfig). makerChecker.requiresDualControl additionally
// enforces the inviolable $20k hard ceiling, so this can never be raised to bypass 4-eyes.
const DEFAULT_DUAL_CONTROL_THRESHOLD_USD = 20000;
const HELD_STATUS = 'RESOLUTION_PENDING';

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

// Operator entry point. Loads + locks the presale, and either settles it immediately (small)
// or HOLDS it and proposes a Maker-Checker action (large) — mirroring the large-withdrawal path.
// `makerUserId` is the operator initiating the resolution (the maker); a distinct checker must
// approve a held resolution. Returns { pending, presale, action? }.
async function resolvePresale({ presaleId, makerUserId }) {
  return await sequelize.transaction(async (transaction) => {
    const presale = await Presale.findByPk(presaleId, {
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!presale) {
      throw new AppError(404, errorCodes.NOT_FOUND, 'Presale not found');
    }

    // Only an ACTIVE presale can be resolved. This also rejects a second resolve while one is
    // already HELD (RESOLUTION_PENDING) — no duplicate proposal, no double settlement.
    if (presale.status !== 'ACTIVE') {
      throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Presale already resolved or pending');
    }

    const settlementUsd = presale.totalRaisedUsdt;
    const threshold = await businessConfig.getNumber(
      'launchpad_dual_control_usd_threshold', DEFAULT_DUAL_CONTROL_THRESHOLD_USD
    );

    if (makerChecker.requiresDualControl(settlementUsd, threshold)) {
      // A large resolution must not be executed by a single operator. Hold it and propose the
      // dual-control action ATOMICALLY (same tx) so a held presale can never exist without its
      // approval path, and vice versa.
      if (!makerUserId) {
        throw new AppError(400, errorCodes.VALIDATION_ERROR, 'Se requiere el operador (maker) para resolver una presale grande');
      }
      await presale.update({ status: HELD_STATUS }, { transaction });
      const action = await makerChecker.propose(
        { makerUserId, actionType: DUAL_CONTROL_ACTION, payload: { presaleId: presale.id }, amountUsd: settlementUsd },
        { transaction }
      );
      return { pending: true, presale, action };
    }

    await settlePresale(presale, transaction);
    return { pending: false, presale };
  });
}

// Perform the actual settlement on an already-loaded, locked presale within `transaction`.
// Shared by the immediate (small) path and the dual-control executor (large). Determines
// success/failure from stored state (frozen once no longer ACTIVE) and posts the ledger legs.
async function settlePresale(presale, transaction) {
    const contributions = await Contribution.findAll({
      where: { presaleId: presale.id },
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
}

// Dual-control executor: a DISTINCT checker approved a held large resolution. Load + lock the
// presale inside the checker's approval transaction, assert it is still HELD (so a replayed or
// concurrent approval can never double-settle), then settle. Throwing rolls the whole approval
// back and leaves the action pending — never a silent no-op approval.
async function settlePresaleExecutor(payload, transaction) {
  const presale = await Presale.findByPk(payload.presaleId, {
    lock: transaction.LOCK.UPDATE,
    transaction
  });
  if (!presale) {
    throw new Error(`No presale ${payload.presaleId} to settle`);
  }
  if (presale.status !== HELD_STATUS) {
    throw new Error(`Presale ${payload.presaleId} is not held for resolution (status ${presale.status})`);
  }
  await settlePresale(presale, transaction);
  return { settled: true, presaleId: presale.id, status: presale.status };
}

// Wire the executor into the governance engine. Called once at app boot.
function register() {
  makerChecker.registerExecutor(DUAL_CONTROL_ACTION, settlePresaleExecutor);
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

module.exports = {
  buy,
  resolvePresale,
  settlePresale,
  settlePresaleExecutor,
  register,
  createPresale,
  activatePresale,
  DUAL_CONTROL_ACTION,
  DEFAULT_DUAL_CONTROL_THRESHOLD_USD,
  HELD_STATUS,
};
