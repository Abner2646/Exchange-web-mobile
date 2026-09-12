const { DataTypes, Model } = require('sequelize');

class P2PTransaction extends Model {}

function initTransaccionP2P(sequelize) {
  P2PTransaction.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    offerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'offer_id'
    },
    buyerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'buyer_id'
    },
    sellerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'seller_id'
    },
    cryptoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'crypto_id'
    },
    amount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false
    },
    unitPrice: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      field: 'unit_price'
    },
    fiatAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: 'fiat_amount'
    },
    fiatCurrency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      field: 'fiat_currency'
    },
    paymentMethodId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'payment_method_id'
    },
    status: {
      type: DataTypes.ENUM('initiated', 'crypto_locked', 'payment_confirmed', 'completed', 'cancelled'),
      defaultValue: 'initiated'
    },
    paymentConfirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'payment_confirmed_at'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    }
  }, {
    sequelize,
    modelName: 'P2PTransaction',
    tableName: 'p2p_transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return P2PTransaction;
}

module.exports = initTransaccionP2P;