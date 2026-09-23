const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../../models');

class KycWebhookEvent extends Model {}

KycWebhookEvent.init({
  id: { 
    type: DataTypes.UUID, 
    primaryKey: true, 
    defaultValue: DataTypes.UUIDV4 
  },
  eventId: { 
    type: DataTypes.STRING, 
    allowNull: false, 
    unique: true, 
    field: 'event_id' 
  },
  eventType: { 
    type: DataTypes.STRING, 
    allowNull: false, 
    field: 'event_type' 
  },
  referenceId: { 
    type: DataTypes.STRING, 
    allowNull: true, 
    field: 'reference_id' 
  },
  processedAt: { 
    type: DataTypes.DATE, 
    allowNull: false, 
    defaultValue: DataTypes.NOW, 
    field: 'processed_at' 
  }
}, {
  sequelize,
  modelName: 'KycWebhookEvent',
  tableName: 'kyc_webhook_events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = KycWebhookEvent;
