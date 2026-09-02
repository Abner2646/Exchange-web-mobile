const { DataTypes, Model } = require('sequelize');

class CuentaLedger extends Model {}

function initCuentaLedger(sequelize) {
  CuentaLedger.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    ownerId: { type: DataTypes.UUID, allowNull: false, field: 'owner_id' }, // usuario, o HOUSE_OWNER_ID para casa
    proposito: { type: DataTypes.STRING, allowNull: false }, // ej. 'funding:disponible', 'fee_revenue'
    criptomonedaId: { type: DataTypes.UUID, allowNull: false, field: 'criptomoneda_id' },
  }, {
    sequelize,
    modelName: 'CuentaLedger',
    tableName: 'ledger_accounts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ unique: true, fields: ['owner_id', 'proposito', 'criptomoneda_id'] }],
  });
  return CuentaLedger;
}

module.exports = initCuentaLedger;
