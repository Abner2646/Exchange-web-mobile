// modules/swap/swap.entity.js
const { DataTypes, Model } = require('sequelize');

class Swap extends Model {}

function initSwap(sequelize) {
  Swap.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id'
      }
    },
    pairId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'pair_id',
      references: {
        model: 'swap_pairs',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.ENUM('buy', 'sell'),
      allowNull: false
    },
    baseAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'base_amount'
    },
    quoteAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'quote_amount'
    },
    price: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false
    },
    feeAmount: {
      type: DataTypes.DECIMAL(18, 8),
      allowNull: false,
      field: 'fee_amount'
    },
    feePercent: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false,
      field: 'fee_percent'
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at'
    }
  }, {
    sequelize,
    modelName: 'Swap',
    tableName: 'swaps',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return Swap;
}

module.exports = initSwap;