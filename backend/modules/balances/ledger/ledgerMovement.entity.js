const { DataTypes, Model } = require('sequelize');

class LedgerMovement extends Model {}

function initLedgerMovement(sequelize) {
  LedgerMovement.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    entryId: { type: DataTypes.UUID, allowNull: false, field: 'entry_id' },
    accountId: { type: DataTypes.UUID, allowNull: false, field: 'account_id' },
    cryptoId: { type: DataTypes.UUID, allowNull: false, field: 'crypto_id' },
    amount: { type: DataTypes.DECIMAL(28, 8), allowNull: false }, // con signo: + credito / - debito
  }, {
    sequelize,
    modelName: 'LedgerMovement',
    tableName: 'ledger_postings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['account_id'] }, { fields: ['entry_id'] }],
  });
  return LedgerMovement;
}

module.exports = initLedgerMovement;
