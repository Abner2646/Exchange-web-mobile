// modules/aml/denylist.entity.js
// Sanctioned/denylisted withdrawal-destination addresses (AML signal S5).
const { DataTypes, Model } = require('sequelize');

class AmlDenylistedAddress extends Model {}

function initAmlDenylistedAddress(sequelize) {
  AmlDenylistedAddress.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    address: { type: DataTypes.STRING, allowNull: false },
    network: { type: DataTypes.STRING, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
    source: { type: DataTypes.STRING, allowNull: true },
    addedBy: { type: DataTypes.UUID, allowNull: true, field: 'added_by' },
  }, {
    sequelize,
    modelName: 'AmlDenylistedAddress',
    tableName: 'aml_denylisted_addresses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['address', 'network'] }],
  });
  return AmlDenylistedAddress;
}

module.exports = initAmlDenylistedAddress;
