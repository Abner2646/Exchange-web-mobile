// modules/audit/auditLog.entity.js
const { DataTypes, Model } = require('sequelize');

class AuditLog extends Model {}

function initAuditLog(sequelize) {
  AuditLog.init({
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    eventId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'event_id' },
    eventType: { type: DataTypes.STRING, allowNull: false, field: 'event_type' },
    payload: { type: DataTypes.JSONB, allowNull: false },
    aggregateId: { type: DataTypes.TEXT, allowNull: true, field: 'aggregate_id' },
    occurredAt: { type: DataTypes.DATE, allowNull: false, field: 'occurred_at' },
    prevHash: { type: DataTypes.STRING(64), allowNull: true, field: 'prev_hash' },
    hash: { type: DataTypes.STRING(64), allowNull: false },
  }, {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_log',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['event_type'] },
      { fields: ['aggregate_id'] },
    ],
  });
  return AuditLog;
}

module.exports = initAuditLog;
