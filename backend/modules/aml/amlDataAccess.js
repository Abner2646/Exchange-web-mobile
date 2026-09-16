// modules/aml/amlDataAccess.js
// The impure, isolated windowed queries the AML signals need. Reads the tx tables;
// returns plain fact rows so the signal functions stay pure.
const { Op } = require('sequelize');

async function withdrawalsInWindow(userId, since, transaction = null) {
  const { BlockchainTransaction } = require('../../models');
  const rows = await BlockchainTransaction.findAll({
    where: { userId, type: 'withdrawal', status: { [Op.ne]: 'failed' }, created_at: { [Op.gte]: since } },
    transaction,
  });
  return rows.map(r => ({ id: r.id, cryptoId: r.cryptoId, amount: String(r.amount), createdAt: r.created_at }));
}

async function onchainMovementsInWindow(userId, since, transaction = null) {
  const { BlockchainTransaction } = require('../../models');
  const rows = await BlockchainTransaction.findAll({
    where: {
      userId,
      created_at: { [Op.gte]: since },
      [Op.or]: [
        { type: 'withdrawal', status: { [Op.ne]: 'failed' } },
        { type: 'deposit', status: { [Op.in]: ['confirmed', 'completed'] } },
      ],
    },
    transaction,
  });
  return rows.map(r => ({ id: r.id, type: r.type, cryptoId: r.cryptoId, amount: String(r.amount), createdAt: r.created_at }));
}

async function confirmedDepositsInWindow(userId, cryptoId, since, transaction = null) {
  const { BlockchainTransaction } = require('../../models');
  const rows = await BlockchainTransaction.findAll({
    where: { userId, cryptoId, type: 'deposit', status: { [Op.in]: ['confirmed', 'completed'] }, created_at: { [Op.gte]: since } },
    transaction,
  });
  return rows.map(r => ({ id: r.id, amount: String(r.amount), createdAt: r.created_at }));
}

async function p2pCompletedCountBetween(userIdA, userIdB, since, transaction = null) {
  const { P2PTransaction } = require('../../models');
  return P2PTransaction.count({
    where: {
      status: 'completed',
      created_at: { [Op.gte]: since },
      [Op.or]: [
        { buyerId: userIdA, sellerId: userIdB },
        { buyerId: userIdB, sellerId: userIdA },
      ],
    },
    transaction,
  });
}

async function userCreatedAt(userId, transaction = null) {
  const { User } = require('../../models');
  const u = await User.findByPk(userId, { transaction });
  return u ? u.created_at : null;
}

// The user's configured daily USD limit (S1 baseline), as a string, or null when it
// can't be determined (user missing, or dailyLimitUsd is null). Returning null — not
// '0' — is deliberate: a '0' limit would make S1's ceiling 0 and fire on ANY volume
// (a ghost-user false positive), and String(null) would crash money.multiply. The
// evaluator skips S1 when this is null. Lives here so the evaluator never touches the ORM.
async function userDailyLimit(userId, transaction = null) {
  const { User } = require('../../models');
  const u = await User.findByPk(userId, { transaction });
  return u && u.dailyLimitUsd != null ? String(u.dailyLimitUsd) : null;
}

// Fetches both createdAt and dailyLimitUsd in a single query (used by the S1+S6 block
// in amlEvaluator to avoid two separate User.findByPk calls for the same row).
// dailyLimitUsd follows the same null-not-zero contract as userDailyLimit above.
async function userProfile(userId, transaction = null) {
  const { User } = require('../../models');
  const u = await User.findByPk(userId, { transaction });
  if (!u) return { createdAt: null, dailyLimitUsd: null };
  return {
    createdAt: u.created_at,
    dailyLimitUsd: u.dailyLimitUsd != null ? String(u.dailyLimitUsd) : null,
  };
}

// ── Cross-user recent finders (for the periodic sweep, Slice C) ─────────────
// Single query for both withdrawal and deposit money-rows. Only CONFIRMED/completed
// withdrawals are included — the exact state at which the real `WithdrawalTransmitted`
// event fires (blockchainTransaction.model: status→confirmed). Including
// pending/processing would replay a "transmitted" event for a withdrawal that hasn't
// left yet — a false positive and real-time/batch drift.
async function recentMoneyTransactions(since, transaction = null) {
  const { BlockchainTransaction } = require('../../models');
  const rows = await BlockchainTransaction.findAll({
    where: {
      status: { [Op.in]: ['confirmed', 'completed'] },
      created_at: { [Op.gte]: since },
      [Op.or]: [
        { type: 'withdrawal' },
        { type: 'deposit' },
      ],
    },
    transaction,
  });
  return rows.map(r => ({
    id: r.id,
    userId: r.userId,
    cryptoId: r.cryptoId,
    amount: String(r.amount),
    eventType: r.type === 'withdrawal' ? 'WithdrawalTransmitted' : 'DepositConfirmed',
  }));
}

async function recentCompletedP2P(since, transaction = null) {
  const { P2PTransaction } = require('../../models');
  const rows = await P2PTransaction.findAll({
    where: { status: 'completed', created_at: { [Op.gte]: since } },
    transaction,
  });
  return rows.map(r => ({ id: r.id, buyerId: r.buyerId, sellerId: r.sellerId }));
}

module.exports = { withdrawalsInWindow, onchainMovementsInWindow, confirmedDepositsInWindow, p2pCompletedCountBetween, userCreatedAt, userDailyLimit, userProfile, recentMoneyTransactions, recentCompletedP2P };
