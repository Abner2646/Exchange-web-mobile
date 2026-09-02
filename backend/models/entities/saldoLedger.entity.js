const { DataTypes, Model } = require('sequelize');

class SaldoLedger extends Model {}

function initSaldoLedger(sequelize) {
  SaldoLedger.init({
    cuentaId: { type: DataTypes.UUID, primaryKey: true, field: 'cuenta_id' },
    saldo: { type: DataTypes.DECIMAL(28, 8), allowNull: false, defaultValue: 0 },
  }, {
    sequelize,
    modelName: 'SaldoLedger',
    tableName: 'ledger_balances',
    timestamps: true,
    createdAt: false,
    updatedAt: 'updated_at',
  });
  return SaldoLedger;
}

module.exports = initSaldoLedger;
