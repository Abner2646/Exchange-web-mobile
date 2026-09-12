const { DataTypes, Model } = require('sequelize');

class Transfer extends Model {}

function initTransfer(sequelize) {
  Transfer.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'sender_id'
    },
    recipientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'recipient_id'
    },
    cryptoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'crypto_id'
    },
    amount: {
      type: DataTypes.DECIMAL(28, 8),
      allowNull: false,
      validate: {
        min: 0.00000001
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
      defaultValue: 'pending'
    },
    transactionHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'transaction_hash'
    },
    concept: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'concept'
    },
    verificationCode: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'verification_code'
    },
    codeExpiration: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'code_expiration'
    },
    notificationSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'notification_sent'
    }
  }, {
    sequelize,
    modelName: 'Transfer',
    tableName: 'transfers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['sender_id'] },
      { fields: ['recipient_id'] },
      { fields: ['crypto_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
      { fields: ['verification_code'] },
      {
        fields: ['sender_id', 'status']
      },
      {
        fields: ['recipient_id', 'status']
      }
    ]
  });

  return Transfer;
}

module.exports = initTransfer;
