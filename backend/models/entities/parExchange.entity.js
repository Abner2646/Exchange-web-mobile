const { DataTypes, Model } = require('sequelize');

class ParExchange extends Model {}

function initParExchange(sequelize) {
  ParExchange.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    criptoBaseId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'cripto_base_id'
    },
    criptoQuoteId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'cripto_quote_id'
    },
    precioActual: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'precio_actual'
    },
    comisionPorcentaje: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      field: 'comision_porcentaje'
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    ultimaActualizacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'ultima_actualizacion'
    }
  }, {
    sequelize,
    modelName: 'ParExchange',
    tableName: 'pares_exchange',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['cripto_base_id', 'cripto_quote_id']
      }
    ]
  });

  return ParExchange;
}

module.exports = initParExchange;