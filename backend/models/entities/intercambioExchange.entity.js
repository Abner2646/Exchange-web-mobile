const { DataTypes, Model } = require('sequelize');

class IntercambioExchange extends Model {}

function initIntercambioExchange(sequelize) {
  IntercambioExchange.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'usuario_id',
      references: {
        model: 'usuarios',
        key: 'id'
      }
    },
    parId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'par_id',
      references: {
        model: 'pares_exchange',
        key: 'id'
      }
    },
    tipo: {
      type: DataTypes.ENUM('compra', 'venta'),
      allowNull: false
    },
    cantidadBase: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'cantidad_base'
    },
    cantidadQuote: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'cantidad_quote'
    },
    precio: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false
    },
    comisionMonto: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'comision_monto'
    },
    comisionPorcentaje: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      field: 'comision_porcentaje'
    },
    estado: {
      type: DataTypes.ENUM('pendiente', 'completado', 'fallido'),
      allowNull: false,
      defaultValue: 'pendiente'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    }
  }, {
    sequelize,
    modelName: 'IntercambioExchange',
    tableName: 'intercambios_exchange',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return IntercambioExchange;
}

module.exports = initIntercambioExchange;