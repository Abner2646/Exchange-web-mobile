// modules/aml/case.entity.js
// AML case queue — one row per unique (dedupeKey) incident raised by the
// signal engine or the manual-review sweep. Never deleted; only resolved.
const { DataTypes, Model } = require('sequelize');

class AmlCase extends Model {}

function initAmlCase(sequelize) {
  AmlCase.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    signalId: { type: DataTypes.STRING, allowNull: false, field: 'signal_id' },
    severity: { type: DataTypes.ENUM('low', 'medium', 'high'), allowNull: false },
    status: { type: DataTypes.ENUM('open', 'in_review', 'closed'), allowNull: false, defaultValue: 'open' },
    evidence: { type: DataTypes.JSONB, allowNull: false },
    sourceEventId: { type: DataTypes.UUID, allowNull: true, field: 'source_event_id' },
    dedupeKey: { type: DataTypes.STRING, allowNull: false, field: 'dedupe_key' },
    resolvedBy: { type: DataTypes.UUID, allowNull: true, field: 'resolved_by' },
    resolvedAt: { type: DataTypes.DATE, allowNull: true, field: 'resolved_at' },
  }, {
    sequelize,
    modelName: 'AmlCase',
    tableName: 'aml_cases',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['dedupe_key'] },
      { fields: ['user_id'] },
      { fields: ['status'] },
    ],
  });
  return AmlCase;
}

module.exports = initAmlCase;
