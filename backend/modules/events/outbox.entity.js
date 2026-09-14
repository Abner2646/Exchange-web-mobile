// modules/events/outbox.entity.js
const { DataTypes, Model } = require('sequelize');

class OutboxEvent extends Model {}

function initOutboxEvent(sequelize) {
  OutboxEvent.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    type: { type: DataTypes.STRING, allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false },
    aggregateId: { type: DataTypes.UUID, allowNull: true, field: 'aggregate_id' },
    status: {
      type: DataTypes.ENUM('pending', 'dispatched', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    availableAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'available_at' },
    lastError: { type: DataTypes.TEXT, allowNull: true, field: 'last_error' },
    dispatchedAt: { type: DataTypes.DATE, allowNull: true, field: 'dispatched_at' },
  }, {
    sequelize,
    modelName: 'OutboxEvent',
    tableName: 'outbox_events',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      { fields: ['status', 'available_at'] },
      { fields: ['created_at'] },
    ],
  });
  return OutboxEvent;
}

module.exports = initOutboxEvent;
