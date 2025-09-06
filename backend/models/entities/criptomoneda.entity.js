const { DataTypes, Model } = require('sequelize');

class Criptomoneda extends Model {}

function initCriptomoneda(sequelize) {
  Criptomoneda.init({
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
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    red: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    direccionContrato: {
      type: DataTypes.STRING(42),
      allowNull: true,
      field: 'direccion_contrato'
    },
    decimales: {
      type: DataTypes.INTEGER,
      defaultValue: 18
    },
    activa: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Criptomoneda',
    tableName: 'criptomonedas',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return Criptomoneda;
}

module.exports = initCriptomoneda;