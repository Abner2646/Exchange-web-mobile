const { DataTypes, Model } = require('sequelize');

class AsientoLedger extends Model {}

function initAsientoLedger(sequelize) {
  AsientoLedger.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tipo: { type: DataTypes.STRING, allowNull: false },
    referencia: { type: DataTypes.STRING, allowNull: false, unique: true }, // idempotencia
    descripcion: { type: DataTypes.STRING, allowNull: true },
    asientoReversadoId: { type: DataTypes.UUID, allowNull: true, field: 'asiento_reversado_id' },
  }, {
    sequelize,
    modelName: 'AsientoLedger',
    tableName: 'ledger_transactions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  });
  return AsientoLedger;
}

module.exports = initAsientoLedger;
