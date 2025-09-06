// Se crea/actualiza automáticamente cuando:
// 1. Usuario hace un depósito
// 2. Usuario hace un retiro  
// 3. Usuario hace intercambio P2P
// 4. Usuario hace intercambio con exchange

const { DataTypes, Model } = require('sequelize');

class BalanceUser extends Model {}

function initBalanceUser(sequelize) {
  BalanceUser.init({
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
    criptomonedaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'criptomoneda_id'
    },
    balanceDisponible: {
      type: DataTypes.DECIMAL(28, 8),
      defaultValue: 0,
      field: 'balance_disponible'
    },
    balanceBloqueado: {
      type: DataTypes.DECIMAL(28, 8),
      defaultValue: 0,
      field: 'balance_bloqueado'
    }
  }, {
    sequelize,
    modelName: 'BalanceUser',
    tableName: 'balances_users',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'criptomoneda_id']
      }
    ]
  });

  return BalanceUser;
}

module.exports = initBalanceUser;