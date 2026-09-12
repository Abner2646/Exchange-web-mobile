const { DataTypes, Model } = require('sequelize');

class LedgerEntry extends Model {}

function initLedgerEntry(sequelize) {
  LedgerEntry.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    type: { type: DataTypes.STRING, allowNull: false, field: 'type' },
    reference: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'reference' }, // idempotencia
    description: { type: DataTypes.STRING, allowNull: true, field: 'description' },
    reversedEntryId: { type: DataTypes.UUID, allowNull: true, field: 'reversed_entry_id' },
  }, {
    sequelize,
    modelName: 'LedgerEntry',
    tableName: 'ledger_transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
  return LedgerEntry;
}

module.exports = initLedgerEntry;
