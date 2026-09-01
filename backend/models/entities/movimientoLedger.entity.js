const { DataTypes, Model } = require('sequelize');

class MovimientoLedger extends Model {}

function initMovimientoLedger(sequelize) {
  MovimientoLedger.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    asientoId: { type: DataTypes.UUID, allowNull: false, field: 'asiento_id' },
    cuentaId: { type: DataTypes.UUID, allowNull: false, field: 'cuenta_id' },
    criptomonedaId: { type: DataTypes.UUID, allowNull: false, field: 'criptomoneda_id' },
    monto: { type: DataTypes.DECIMAL(28, 8), allowNull: false }, // con signo: + credito / - debito
  }, {
    sequelize,
    modelName: 'MovimientoLedger',
    tableName: 'ledger_postings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [{ fields: ['cuenta_id'] }, { fields: ['asiento_id'] }],
  });
  return MovimientoLedger;
}

module.exports = initMovimientoLedger;
