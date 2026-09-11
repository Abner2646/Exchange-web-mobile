// models/entities/trade.entity.js
const { DataTypes, Model } = require('sequelize');

class Trade extends Model {}

function initTrade(sequelize) {
  Trade.init({
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
    
    // Órdenes involucradas
    buyOrderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'buy_order_id'
    },
    sellOrderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'sell_order_id'
    },
    
    // Usuarios
    buyerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'buyer_id'
    },
    sellerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'seller_id'
    },
    
    // Detalles del trade
    price: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      comment: 'Precio al que se ejecutó'
    },
    quantity: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      comment: 'Cantidad ejecutada del base asset'
    },
    
    // Fees
    buyerFee: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      field: 'buyer_fee',
      comment: 'Fee pagado por el comprador'
    },
    sellerFee: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      field: 'seller_fee',
      comment: 'Fee pagado por el vendedor'
    },
    buyerFeePercent: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      field: 'buyer_fee_percent'
    },
    sellerFeePercent: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      field: 'seller_fee_percent'
    },
    
    // Maker/Taker
    makerSide: {
      type: DataTypes.ENUM('buy', 'sell'),
      allowNull: false,
      field: 'maker_side',
      comment: 'Quién fue el maker (quien puso la orden primero)'
    },
    
    // Tipo de trading
    tradingType: {
      type: DataTypes.ENUM('spot', 'margin_cross', 'margin_isolated', 'futures'),
      defaultValue: 'spot',
      field: 'trading_type'
    },
    
    // Totales
    totalValue: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      field: 'total_value',
      comment: 'quantity * price (en quote asset)'
    }
  }, {
    sequelize,
    modelName: 'Trade',
    tableName: 'trades',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['trading_pair_id'] },
      { fields: ['buyer_id'] },
      { fields: ['seller_id'] },
      { fields: ['buy_order_id'] },
      { fields: ['sell_order_id'] },
      { fields: ['created_at'] },
      { fields: ['trading_pair_id', 'created_at'] },
      { fields: ['buyer_id', 'created_at'] },
      { fields: ['seller_id', 'created_at'] }
    ]
  });

  return Trade;
}

module.exports = initTrade;