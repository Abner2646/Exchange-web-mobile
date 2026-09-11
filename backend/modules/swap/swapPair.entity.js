// modules/swap/swapPair.entity.js

const { DataTypes, Model } = require('sequelize');

class SwapPair extends Model {}

function initSwapPair(sequelize) {
  SwapPair.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    baseCryptoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'base_crypto_id'
    },
    quoteCryptoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'quote_crypto_id'
    },
    currentPrice: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'current_price'
    },
    previousPrice: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
      field: 'previous_price'
    },
    volume24h: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0,
      field: 'volume_24h'
    },
    volumeBase24h: {
      type: DataTypes.DECIMAL(18, 8),
      defaultValue: 0,
      field: 'volume_base_24h'
    },
    operationsCount24h: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'operations_count_24h'
    },
    maxPrice24h: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
      field: 'max_price_24h'
    },
    minPrice24h: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: true,
      field: 'min_price_24h'
    },
    changePercent24h: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 0,
      field: 'change_percent_24h'
    },
    feePercent: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      field: 'fee_percent'
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastUpdated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'last_updated'
    },
    priceSource: {
      type: DataTypes.STRING(50),
      defaultValue: 'manual',
      field: 'price_source',
      comment: 'coingecko, binance, manual, chainlink'
    },
    externalSymbol: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'external_symbol',
      comment: 'ID del par en la fuente externa (pair id in the external source)'
    }
  }, {
    sequelize,
    modelName: 'SwapPair',
    tableName: 'swap_pairs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['base_crypto_id', 'quote_crypto_id']
      },
      {
        fields: ['active']
      },
      {
        fields: ['volume_24h']
      },
      {
        fields: ['last_updated']
      }
    ]
  });

  return SwapPair;
}

module.exports = initSwapPair;