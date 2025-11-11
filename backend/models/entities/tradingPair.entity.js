// models/entities/tradingPair.entity.js
/*
const { DataTypes, Model } = require('sequelize');

class TradingPair extends Model {}

function initTradingPair(sequelize) {
  TradingPair.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    symbol: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'Ejemplo: BTC/USDT, ETH/USDT'
    },
    baseAssetId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'base_asset_id',
      comment: 'Criptomoneda que se compra/vende (BTC en BTC/USDT)'
    },
    quoteAssetId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'quote_asset_id',
      comment: 'Criptomoneda con la que se paga (USDT en BTC/USDT)'
    },
    status: {
      type: DataTypes.ENUM('active', 'paused', 'delisted'),
      defaultValue: 'active',
      allowNull: false
    },
    
    // Configuración de trading
    minOrderAmount: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'min_order_amount',
      comment: 'Cantidad mínima de base asset por orden'
    },
    maxOrderAmount: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: true,
      field: 'max_order_amount',
      comment: 'Cantidad máxima (null = sin límite)'
    },
    pricePrecision: {
      type: DataTypes.INTEGER,
      defaultValue: 8,
      field: 'price_precision',
      comment: 'Decimales permitidos en precio'
    },
    quantityPrecision: {
      type: DataTypes.INTEGER,
      defaultValue: 8,
      field: 'quantity_precision',
      comment: 'Decimales permitidos en cantidad'
    },
    
    // Fees
    makerFeePercent: {
      type: DataTypes.DECIMAL(5, 4),
      defaultValue: 0.1000,
      field: 'maker_fee_percent',
      comment: 'Fee para makers (quien pone liquidez)'
    },
    takerFeePercent: {
      type: DataTypes.DECIMAL(5, 4),
      defaultValue: 0.1000,
      field: 'taker_fee_percent',
      comment: 'Fee para takers (quien toma liquidez)'
    },
    
    // Tipos de trading permitidos (escalabilidad futura)
    allowedTradingTypes: {
      type: DataTypes.JSON,
      defaultValue: ['spot'],
      field: 'allowed_trading_types',
      comment: 'Futuro: [spot, margin, futures]'
    },
    
    // Configuración de margin (para futuro)
    marginEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'margin_enabled'
    },
    maxLeverage: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'max_leverage',
      comment: '1 = solo spot, >1 = margin disponible'
    },
    
    // Estadísticas de 24h (actualizadas por jobs)
    lastPrice: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'last_price',
      comment: 'Último precio conocido'
    },
    priceChange24h: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      field: 'price_change_24h',
      comment: 'Cambio de precio en %'
    },
    volume24h: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'volume_24h',
      comment: 'Volumen de trading en 24h'
    },
    high24h: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'high_24h',
      comment: 'Precio más alto en 24h'
    },
    low24h: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'low_24h',
      comment: 'Precio más bajo en 24h'
    }
  }, {
    sequelize,
    modelName: 'TradingPair',
    tableName: 'trading_pairs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['symbol'], unique: true },
      { fields: ['status'] },
      { fields: ['base_asset_id'] },
      { fields: ['quote_asset_id'] },
      { fields: ['base_asset_id', 'quote_asset_id'], unique: true }
    ]
  });

  return TradingPair;
}

module.exports = initTradingPair;
*/

const { DataTypes, Model } = require('sequelize');

class TradingPair extends Model {}

function initTradingPair(sequelize) {
  TradingPair.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },

    symbol: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'Ejemplo: BTC/USDT, ETH/USDT'
    },

    baseAssetId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'base_asset_id',
      comment: 'Criptomoneda que se compra/vende (BTC en BTC/USDT)'
    },

    quoteAssetId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'quote_asset_id',
      comment: 'Criptomoneda con la que se paga (USDT en BTC/USDT)'
    },

    status: {
      type: DataTypes.ENUM('active', 'paused', 'delisted'),
      defaultValue: 'active',
      allowNull: false
    },

    // Configuración de trading
    minOrderAmount: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'min_order_amount',
      comment: 'Cantidad mínima de base asset por orden'
    },
    maxOrderAmount: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: true,
      field: 'max_order_amount',
      comment: 'Cantidad máxima (null = sin límite)'
    },
    pricePrecision: {
      type: DataTypes.INTEGER,
      defaultValue: 8,
      field: 'price_precision',
      comment: 'Decimales permitidos en precio'
    },
    quantityPrecision: {
      type: DataTypes.INTEGER,
      defaultValue: 8,
      field: 'quantity_precision',
      comment: 'Decimales permitidos en cantidad'
    },

    // Fees
    makerFeePercent: {
      type: DataTypes.DECIMAL(5, 4),
      defaultValue: 0.1000,
      field: 'maker_fee_percent',
      comment: 'Fee para makers (quien pone liquidez)'
    },
    takerFeePercent: {
      type: DataTypes.DECIMAL(5, 4),
      defaultValue: 0.1000,
      field: 'taker_fee_percent',
      comment: 'Fee para takers (quien toma liquidez)'
    },

    // Tipos de trading permitidos (escalabilidad futura)
    allowedTradingTypes: {
      type: DataTypes.JSON,
      defaultValue: ['spot'],
      field: 'allowed_trading_types',
      comment: 'Futuro: [spot, margin, futures]'
    },

    // Configuración de margin (para futuro)
    marginEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'margin_enabled'
    },
    maxLeverage: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      field: 'max_leverage',
      comment: '1 = solo spot, >1 = margin disponible'
    },

    // Estadísticas de 24h (actualizadas por jobs)
    lastPrice: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'last_price',
      comment: 'Último precio conocido'
    },
    priceChange24h: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      field: 'price_change_24h',
      comment: 'Cambio de precio en %'
    },
    volume24h: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'volume_24h',
      comment: 'Volumen de trading en 24h'
    },
    high24h: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'high_24h',
      comment: 'Precio más alto en 24h'
    },
    low24h: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'low_24h',
      comment: 'Precio más bajo en 24h'
    }
  }, {
    sequelize,
    modelName: 'TradingPair',
    tableName: 'trading_pairs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['symbol'], unique: true },
      { fields: ['status'] },
      { fields: ['base_asset_id'] },
      { fields: ['quote_asset_id'] },
      { fields: ['base_asset_id', 'quote_asset_id'], unique: true }
    ]
  });

  return TradingPair;
}

module.exports = initTradingPair;
