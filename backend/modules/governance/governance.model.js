const { sequelize } = require('../../models');
const initPendingAdminAction = require('./pendingAdminAction.entity');

// Self-register the model idempotently (mirrors modules/referrals/referrals.model.js),
// so importing this module from anywhere does not double-define or trigger the
// models<->module load cycle.
const PendingAdminAction = sequelize.models.PendingAdminAction || initPendingAdminAction(sequelize);

if (!PendingAdminAction.associations.maker) {
  PendingAdminAction.belongsTo(sequelize.models.User, { as: 'maker', foreignKey: 'makerUserId' });
}
if (!PendingAdminAction.associations.checker) {
  PendingAdminAction.belongsTo(sequelize.models.User, { as: 'checker', foreignKey: 'checkerUserId' });
}

module.exports = { PendingAdminAction };
