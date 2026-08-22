const { DataTypes, Model } = require('sequelize');

class IdempotencyKey extends Model {}

function initIdempotencyKey(sequelize) {
  IdempotencyKey.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    idempotencyKey: { type: DataTypes.STRING, allowNull: false, field: 'idempotency_key' },
    requestHash: { type: DataTypes.STRING(64), allowNull: false, field: 'request_hash' },
    status: {
      type: DataTypes.ENUM('in_progress', 'completed'),
      allowNull: false,
      defaultValue: 'in_progress'
    },
    responseStatusCode: { type: DataTypes.INTEGER, allowNull: true, field: 'response_status_code' },
    responseBody: { type: DataTypes.JSONB, allowNull: true, field: 'response_body' }
  }, {
    sequelize,
    modelName: 'IdempotencyKey',
    tableName: 'idempotency_keys',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['user_id', 'idempotency_key'] },
      { fields: ['created_at'] }
    ]
  });

  return IdempotencyKey;
}

module.exports = initIdempotencyKey;
