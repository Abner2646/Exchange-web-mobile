const { DataTypes, Model } = require('sequelize');

class P2POffer extends Model {}

function initOfertaP2P(sequelize) {
  P2POffer.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    type: {
      type: DataTypes.ENUM('buy', 'sell'),
      allowNull: false
    },
    cryptoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'crypto_id'
    },
    minAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'min_amount'
    },
    maxAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'max_amount'
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      field: 'unit_price'
    },
    fiatCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'fiat_currency'
    },
    additionalTerms: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'additional_terms'
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'P2POffer',
    tableName: 'p2p_offers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return P2POffer;
}

module.exports = initOfertaP2P;