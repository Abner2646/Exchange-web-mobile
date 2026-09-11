// models/entities/blockchainState.entity.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const BlockchainState = sequelize.define('BlockchainState', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    network: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        isIn: [['ethereum', 'bsc', 'bitcoin', 'sepolia', 'bsc-testnet', 'testnet3']]
      }
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'blockchain_states',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['network', 'key'],
        name: 'unique_network_key'
      }
    ]
  });

  return BlockchainState;
};