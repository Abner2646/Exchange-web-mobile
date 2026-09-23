const { DataTypes, Model } = require('sequelize');

class Presale extends Model {}

function initPresale(sequelize) {
  Presale.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    tokenCryptoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'token_crypto_id'
    },
    priceUsdt: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'price_usdt'
    },
    hardCapUsdt: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'hard_cap_usdt'
    },
    softCapUsdt: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'soft_cap_usdt'
    },
    minTicketUsdt: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'min_ticket_usdt'
    },
    maxTicketUsdt: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'max_ticket_usdt'
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'start_date'
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'end_date'
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PENDING'
    },
    totalRaisedUsdt: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0',
      field: 'total_raised_usdt'
    }
  }, {
    sequelize,
    modelName: 'Presale',
    tableName: 'launchpad_presales',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  
  return Presale;
}

module.exports = initPresale;
