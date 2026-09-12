const { DataTypes, Model } = require('sequelize');

class OfferPaymentMethod extends Model {}

function initOfertaMetodoPago(sequelize) {
  OfferPaymentMethod.init({
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
    paymentMethodId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'payment_method_id'
    }
  }, {
    sequelize,
    modelName: 'OfferPaymentMethod',
    tableName: 'offer_payment_methods',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['offer_id', 'payment_method_id']
      }
    ]
  });

  return OfferPaymentMethod;
}

module.exports = initOfertaMetodoPago;