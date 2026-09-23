const { DataTypes, Model } = require('sequelize');

class Contribution extends Model {}

function initContribution(sequelize) {
  Contribution.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    presaleId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'presale_id',
      references: { model: 'launchpad_presales', key: 'id' }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: { model: 'users', key: 'id' }
    },
    amountUsdt: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'amount_usdt'
    },
    tokenAmount: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'token_amount'
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    }
  }, {
    sequelize,
    modelName: 'Contribution',
    tableName: 'launchpad_contributions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  
  return Contribution;
}

module.exports = initContribution;
