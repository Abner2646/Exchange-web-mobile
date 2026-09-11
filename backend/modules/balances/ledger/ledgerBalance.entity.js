const { DataTypes, Model } = require('sequelize');

class LedgerBalance extends Model {}

function initLedgerBalance(sequelize) {
  LedgerBalance.init({
    accountId: { type: DataTypes.UUID, primaryKey: true, field: 'account_id' },
    balance: { type: DataTypes.DECIMAL(28, 8), allowNull: false, defaultValue: 0 },
  }, {
    sequelize,
    modelName: 'LedgerBalance',
    tableName: 'ledger_balances',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at',
  });
  return LedgerBalance;
}

module.exports = initLedgerBalance;
