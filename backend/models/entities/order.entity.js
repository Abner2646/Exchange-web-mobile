// models/entities/order.entity.js
const { DataTypes, Model } = require('sequelize');

class Order extends Model {}

function initOrder(sequelize) {
  Order.init({
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
    tradingPairId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'trading_pair_id'
    },
    
    // Tipo de orden
    orderType: {
      type: DataTypes.ENUM('market', 'limit', 'stop_limit', 'stop_market'),
      allowNull: false,
      field: 'order_type',
      comment: 'market=a mercado, limit=precio específico, stop=condicional'
    },
    
    // Tipo de trading (escalabilidad)
    tradingType: {
      type: DataTypes.ENUM('spot', 'margin_cross', 'margin_isolated', 'futures'),
      defaultValue: 'spot',
      field: 'trading_type'
    },
    
    // Compra o venta
    side: {
      type: DataTypes.ENUM('buy', 'sell'),
      allowNull: false,
      comment: 'buy=compra, sell=venta'
    },
    
    // Cantidades
    quantity: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      comment: 'Cantidad total del base asset'
    },
    quantityFilled: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'quantity_filled',
      comment: 'Cantidad ya ejecutada'
    },
    quantityRemaining: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: false,
      field: 'quantity_remaining',
      comment: 'Cantidad pendiente'
    },
    
    // Precios
    price: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: true,
      comment: 'Precio límite (null para market orders)'
    },
    stopPrice: {
      type: DataTypes.DECIMAL(28, 18),
      allowNull: true,
      field: 'stop_price',
      comment: 'Precio de activación para stop orders'
    },
    averagePrice: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'average_price',
      comment: 'Precio promedio de ejecución'
    },
    
    // Estado
    status: {
      type: DataTypes.ENUM(
        'pending',
        'open',
        'partially_filled',
        'filled',
        'cancelled',
        'expired',
        'rejected'
      ),
      defaultValue: 'pending',
      comment: 'Estado actual de la orden'
    },
    
    // Time in force
    timeInForce: {
      type: DataTypes.ENUM('GTC', 'IOC', 'FOK'),
      defaultValue: 'GTC',
      field: 'time_in_force',
      comment: 'GTC=hasta cancelar, IOC=inmediato o cancelar, FOK=todo o nada'
    },
    
    // Fees
    feePercent: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      field: 'fee_percent',
      comment: 'Porcentaje de fee (se determina al crear)'
    },
    feeAmount: {
      type: DataTypes.DECIMAL(28, 18),
      defaultValue: 0,
      field: 'fee_amount',
      comment: 'Fee total pagado'
    },
    feeCurrency: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: 'fee_currency',
      comment: 'Moneda en que se paga el fee'
    },
    
    // Maker o Taker (se asigna al ejecutarse)
    makerOrTaker: {
      type: DataTypes.ENUM('maker', 'taker'),
      allowNull: true,
      field: 'maker_or_taker',
      comment: 'maker=pone liquidez, taker=toma liquidez'
    },
    
    // Para margin (futuro)
    leverage: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: 'Apalancamiento (1 = sin apalancamiento)'
    },
    marginMode: {
      type: DataTypes.ENUM('cross', 'isolated'),
      allowNull: true,
      field: 'margin_mode'
    },
    
    // Metadata
    clientOrderId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'client_order_id',
      comment: 'ID del cliente para APIs'
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
      comment: 'Fecha de expiración (opcional)'
    },
    cancelledReason: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'cancelled_reason'
    },
    
    // Timestamps adicionales
    executedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'executed_at',
      comment: 'Fecha de ejecución completa'
    }
  }, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['trading_pair_id'] },
      { fields: ['status'] },
      { fields: ['side'] },
      { fields: ['trading_type'] },
      { fields: ['order_type'] },
      { fields: ['created_at'] },
      { fields: ['user_id', 'status'] },
      { fields: ['trading_pair_id', 'status'] },
      { fields: ['trading_pair_id', 'status', 'side'] },
      { fields: ['trading_pair_id', 'status', 'side', 'price'] }
    ]
  });

  return Order;
}

module.exports = initOrder;