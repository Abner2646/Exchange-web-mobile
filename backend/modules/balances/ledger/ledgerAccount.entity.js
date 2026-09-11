const { DataTypes, Model } = require('sequelize');

class LedgerAccount extends Model {}

function initLedgerAccount(sequelize) {
  LedgerAccount.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    ownerId: { type: DataTypes.UUID, allowNull: false, field: 'owner_id' }, // usuario, o HOUSE_OWNER_ID para casa
    purpose: { type: DataTypes.STRING, allowNull: false, field: 'purpose' }, // ej. 'funding:disponible', 'fee_revenue'
    cryptoId: { type: DataTypes.UUID, allowNull: false, field: 'crypto_id' },
  }, {
    sequelize,
    modelName: 'LedgerAccount',
    tableName: 'ledger_accounts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ unique: true, fields: ['owner_id', 'purpose', 'crypto_id'] }],
  });
  return LedgerAccount;
}

module.exports = initLedgerAccount;
