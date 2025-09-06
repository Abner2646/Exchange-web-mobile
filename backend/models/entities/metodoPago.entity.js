const { DataTypes, Model } = require('sequelize');

class MetodoPago extends Model {}

function initMetodoPago(sequelize) {
  MetodoPago.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'MetodoPago',
    tableName: 'metodos_pago',
    timestamps: false
  });

  return MetodoPago;
}

module.exports = initMetodoPago;