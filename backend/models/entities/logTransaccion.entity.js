const { DataTypes, Model } = require('sequelize');

class LogTransaccion extends Model {}

function initLogTransaccion(sequelize) {
  LogTransaccion.init({
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
    tipoTransaccion: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'tipo_transaccion'
    },
    transaccionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'transaccion_id'
    },
    accion: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    detalles: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'LogTransaccion',
    tableName: 'logs_transacciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return LogTransaccion;
}

module.exports = initLogTransaccion;