// modules/aml/riskFlag.js
// Raises User.amlRiskLevel monotonically (never downgrades) and marks the account
// for review. NEVER exposed to the user (User.toJSON already strips both fields).
const RANK = { low: 0, medium: 1, high: 2 };

async function raiseUserRisk(userId, targetLevel, transaction = null) {
  const { User } = require('../../models');
  const user = await User.findByPk(userId, { transaction });
  if (!user) return;
  if (RANK[targetLevel] > RANK[user.amlRiskLevel]) {
    await User.update(
      { amlRiskLevel: targetLevel, amlReviewPending: true },
      { where: { id: userId }, transaction }
    );
  }
}

module.exports = { RANK, raiseUserRisk };
