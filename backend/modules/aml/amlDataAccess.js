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

module.exports = { withdrawalsInWindow, onchainMovementsInWindow, confirmedDepositsInWindow, p2pCompletedCountBetween, userCreatedAt };
