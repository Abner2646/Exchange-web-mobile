const { DataTypes, Model } = require('sequelize');

class PaymentMethod extends Model {}

function initMetodoPago(sequelize) {
  PaymentMethod.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'PaymentMethod',
    tableName: 'payment_methods',
    timestamps: false
  });

  return PaymentMethod;
}

module.exports = initMetodoPago;