const { DataTypes, Model } = require('sequelize');

class DepositAddress extends Model {}

function initDepositAddress(sequelize) {
  DepositAddress.init({
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
    cryptoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'crypto_id'
    },
    masterWalletId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'master_wallet_id'
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    derivationIndex: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'derivation_index'
    },
    // Campos adicionales necesarios para el modelo mejorado
    derivationPath: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'derivation_path'
    },
    publicKey: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'public_key'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'DepositAddress',
    tableName: 'deposit_addresses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'crypto_id']
      },
      {
        fields: ['master_wallet_id', 'derivation_index']
      }
    ]
  });

  return DepositAddress;
}

module.exports = initDepositAddress;
