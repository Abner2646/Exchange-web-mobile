const { DataTypes, Model } = require('sequelize');

class ReferralLink extends Model {}

function initReferralLink(sequelize) {
  ReferralLink.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    sponsorId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'sponsor_id',
      references: { model: 'users', key: 'id' }
    },
    inviteeId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'invitee_id',
      references: { model: 'users', key: 'id' }
    }
  }, {
    sequelize,
    modelName: 'ReferralLink',
    tableName: 'referral_links',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  
  return ReferralLink;
}

module.exports = initReferralLink;
