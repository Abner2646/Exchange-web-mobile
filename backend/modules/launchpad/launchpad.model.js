const { sequelize } = require('../../models');
const initPresale = require('./presale.entity');
const initContribution = require('./contribution.entity');

const Presale = sequelize.models.Presale || initPresale(sequelize);
const Contribution = sequelize.models.Contribution || initContribution(sequelize);

if (!Contribution.associations.presale) {
  Contribution.belongsTo(Presale, { as: 'presale', foreignKey: 'presaleId' });
}
if (!Presale.associations.contributions) {
  Presale.hasMany(Contribution, { as: 'contributions', foreignKey: 'presaleId' });
}
if (!Contribution.associations.user) {
  Contribution.belongsTo(sequelize.models.User, { as: 'user', foreignKey: 'userId' });
}

module.exports = {
  Presale,
  Contribution
};
