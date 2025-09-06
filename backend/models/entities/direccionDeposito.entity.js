const { DataTypes, Model } = require('sequelize');

class DireccionDeposito extends Model {}

function initDireccionDeposito(sequelize) {
  DireccionDeposito.init({
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
    criptomonedaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'criptomoneda_id'
    },
    walletMaestraId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'wallet_maestra_id'
    },
    direccion: {
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
    activa: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'DireccionDeposito',
    tableName: 'direcciones_deposito',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'criptomoneda_id']
      },
      {
        fields: ['wallet_maestra_id', 'derivation_index']
      }
    ]
  });

  return DireccionDeposito;
}

module.exports = initDireccionDeposito;