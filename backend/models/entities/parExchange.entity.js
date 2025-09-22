// models/entities/parExchange.entity.js

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
    precioAnterior: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
      field: 'precio_anterior'
    },
    volumen24h: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0,
      field: 'volumen_24h'
    },
    volumenBase24h: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0,
      field: 'volumen_base_24h'
    },
    cantidadOperaciones24h: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'cantidad_operaciones_24h'
    },
    precioMaximo24h: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
      field: 'precio_maximo_24h'
    },
    precioMinimo24h: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
      field: 'precio_minimo_24h'
    },
    cambiosPorcentaje24h: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      field: 'cambios_porcentaje_24h'
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
    },
    fuentePrecio: {
      type: DataTypes.STRING(50),
      defaultValue: 'manual',
      field: 'fuente_precio',
      comment: 'coingecko, binance, manual, chainlink'
    },
    simboloExterno: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'simbolo_externo',
      comment: 'ID del par en la fuente externa'
    }
  }, {
    sequelize,
    modelName: 'ParExchange',
    tableName: 'pares_exchange',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['cripto_base_id', 'cripto_quote_id']
      },
      {
        fields: ['activo']
      },
      {
        fields: ['volumen_24h']
      },
      {
        fields: ['ultima_actualizacion']
      }
    ]
  });

  return ParExchange;
}

module.exports = initParExchange;