const { DataTypes, Model } = require('sequelize');

class Crypto extends Model {}

function initCrypto(sequelize) {
  Crypto.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    symbol: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    network: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    contractAddress: {
      type: DataTypes.STRING(42),
      allowNull: true,
      field: 'contract_address'
    },
    decimals: {
      type: DataTypes.INTEGER,
      defaultValue: 18
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // ✨ NUEVO CAMPO
    iconUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'icon_url',
      comment: 'URL del icono de la criptomoneda'
    }
  }, {
    sequelize,
    modelName: 'Crypto',
    tableName: 'cryptos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return Crypto;
}

module.exports = initCrypto;