// models/entities/priceCandle.entity.js
const { DataTypes, Model } = require('sequelize');

class PriceCandle extends Model {}

function initPriceCandle(sequelize) {
  PriceCandle.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    tradingPairId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'trading_pair_id'
    },
    
    // Intervalo de la vela
    interval: {
      type: DataTypes.ENUM('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'),
      allowNull: false,
      comment: 'Intervalo temporal de la vela'
    },
    
    // Timestamp de apertura de la vela
    openTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'open_time',
      comment: 'Inicio del período'
    },
    
    // OHLCV data
    open: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      comment: 'Precio de apertura'
    },
    high: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      comment: 'Precio más alto'
    },
    low: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      comment: 'Precio más bajo'
    },
    close: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      comment: 'Precio de cierre'
    },
    volume: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      defaultValue: 0,
      comment: 'Volumen de base asset'
    },
    
    // Datos adicionales
    quoteVolume: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      defaultValue: 0,
      field: 'quote_volume',
      comment: 'Volumen en quote asset (USDT)'
    },
    trades: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Número de trades en el período'
    },
    
    // Timestamp de cierre
    closeTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'close_time',
      comment: 'Fin del período'
    },
    
    // Flag para saber si la vela está cerrada
    isClosed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'is_closed',
      comment: 'true si el período ha terminado'
    }
  }, {
    sequelize,
    modelName: 'PriceCandle',
    tableName: 'price_candles',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['trading_pair_id'] },
      { fields: ['interval'] },
      { fields: ['open_time'] },
      { 
        fields: ['trading_pair_id', 'interval', 'open_time'],
        unique: true 
      },
      { fields: ['trading_pair_id', 'interval', 'is_closed'] },
      { fields: ['open_time', 'close_time'] }
    ]
  });

  return PriceCandle;
}

module.exports = initPriceCandle;