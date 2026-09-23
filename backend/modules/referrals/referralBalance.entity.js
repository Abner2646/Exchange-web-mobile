const { DataTypes, Model } = require('sequelize');

class ReferralBalance extends Model {}

function initReferralBalance(sequelize) {
  ReferralBalance.init({
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      field: 'user_id',
      references: { model: 'users', key: 'id' }
    },
    saldoReferidosPendienteUsdt: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0',
      field: 'saldo_referidos_pendiente_usdt'
    }
  }, {
    sequelize,
    modelName: 'ReferralBalance',
    tableName: 'referral_balances',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
  
  return ReferralBalance;
}

module.exports = initReferralBalance;
