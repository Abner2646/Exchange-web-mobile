// models/entities/tradingBalance.entity.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TradingBalance = sequelize.define('TradingBalance', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Usuarios',
        key: 'id'
      }
    },
    criptomonedaId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Criptomonedas',
        key: 'id'
      }
    },
    
    // Balances
    available: {
      type: DataTypes.DECIMAL(30, 18),
      defaultValue: 0
      // Disponible para trading
    },
    locked: {
      type: DataTypes.DECIMAL(30, 18),
      defaultValue: 0
      // Bloqueado en órdenes activas
    },
    
    // Para margin (futuro)
    borrowed: {
      type: DataTypes.DECIMAL(30, 18),
      defaultValue: 0
      // Cantidad prestada
    },
    interest: {
      type: DataTypes.DECIMAL(30, 18),
      defaultValue: 0
      // Intereses acumulados
    },
    
    // Tipo de cuenta
    accountType: {
      type: DataTypes.ENUM('spot', 'margin_cross', 'margin_isolated', 'futures'),
      defaultValue: 'spot'
    }
  }, {
    tableName: 'trading_balances',
    timestamps: true,
    indexes: [
      { 
        fields: ['userId', 'criptomonedaId', 'accountType'],
        unique: true
      },
      { fields: ['userId'] },
      { fields: ['criptomonedaId'] }
    ]
  });

  TradingBalance.associate = (models) => {
    TradingBalance.belongsTo(models.Usuario, {
      foreignKey: 'userId',
      as: 'user'
    });
    TradingBalance.belongsTo(models.Criptomoneda, {
      foreignKey: 'criptomonedaId',
      as: 'criptomoneda'
    });
  };

  return TradingBalance;
};