// modules/referrals/referralsConsumer.js
// Event-driven referral commission accrual (Hito 8). Reacts to the SwapExecuted
// money event OUT of the swap hot-path (same transactional-outbox pattern as the
// notification/AML/audit consumers) so pricing + the referral ledger posting never
// block or risk the swap transaction. At-least-once delivery is safe:
// accrueCommission is idempotent by `referral_accrual:<sourceRef>`.
//
// The swap fee is charged in the QUOTE asset; we value it in USD (≈ USDT 1:1, the
// project-wide stable convention) via amlValuation. A fee we cannot value is skipped
// rather than accrued at a guessed amount.
//
// FOLLOW-UP: the order-book path (TradeExecuted) also charges fees (buyer fee in the
// received base asset, seller fee in the quote asset) and should accrue for both
// users' sponsors the same way. Deferred: the order book has no live trades yet
// (seeded pairs have lastPrice=0). Same handler shape extends to it.
'use strict';

const money = require('../../utils/money');

async function handleSwapExecuted(event) {
  const { userId, pairId, feeAmount, swapId } = event.payload || {};

  // No fee → nothing to share.
  if (!feeAmount || money.compare(String(feeAmount), '0') <= 0) return;

  // Cheap guard FIRST: only the small minority of users with a sponsor link can
  // accrue, so skip all valuation work for everyone else.
  const { ReferralLink } = require('./referrals.model');
  const link = await ReferralLink.findOne({ where: { inviteeId: userId } });
  if (!link) return;

  // Resolve the quote asset (the fee's currency) and value it in USD ≈ USDT.
  const { SwapPair } = require('../../models');
  const pair = await SwapPair.findByPk(pairId);
  if (!pair) return;

  const amlValuation = require('../aml/amlValuation');
  const { usd } = await amlValuation.getUsdValue(pair.quoteCryptoId, feeAmount);
  if (!usd) return; // unvaluable → do not accrue a wrong amount

  const referrals = require('./referrals.service');
  await referrals.accrueCommission({
    inviteeUserId: userId,
    feeUsdtEquivalent: usd,
    sourceRef: `swap:${swapId}`,
  });
}

function register(eventBus) {
  eventBus.on('SwapExecuted', 'referrals', handleSwapExecuted);
}

module.exports = { handleSwapExecuted, register };
