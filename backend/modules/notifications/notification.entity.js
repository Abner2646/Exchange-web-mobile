// models/entities/notificaciones.entity.js
const { DataTypes, Model } = require('sequelize');

class Notification extends Model {}

function initNotification(sequelize) {
  Notification.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id'
    },
    type: {
      type: DataTypes.ENUM('security', 'transaction', 'kyc', 'system', 'p2p', 'exchange'),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    important: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'sent_at'
    },
  }, {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['read'] },
      { fields: ['type'] },
      { fields: ['important'] },
      { fields: ['created_at'] },
      { fields: ['user_id', 'read'] }
    ]
  });

  return Notification;
}

module.exports = initNotification;