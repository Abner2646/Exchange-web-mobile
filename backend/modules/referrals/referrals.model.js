const { sequelize } = require('../../models');
const initReferralLink = require('./referralLink.entity');
const initReferralBalance = require('./referralBalance.entity');

// Inicializar modelos
const ReferralLink = sequelize.models.ReferralLink || initReferralLink(sequelize);
const ReferralBalance = sequelize.models.ReferralBalance || initReferralBalance(sequelize);

// Definir relaciones si no estn definidas an
if (!ReferralLink.associations.sponsor) {
  ReferralLink.belongsTo(sequelize.models.User, { as: 'sponsor', foreignKey: 'sponsorId' });
}
if (!ReferralLink.associations.invitee) {
  ReferralLink.belongsTo(sequelize.models.User, { as: 'invitee', foreignKey: 'inviteeId' });
}
if (!ReferralBalance.associations.user) {
  ReferralBalance.belongsTo(sequelize.models.User, { as: 'user', foreignKey: 'userId' });
}

module.exports = {
  ReferralLink,
  ReferralBalance
};
