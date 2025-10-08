// models/entities/notificaciones.entity.js
const { DataTypes, Model } = require('sequelize');

class Notificacion extends Model {}

function initNotificacion(sequelize) {
  Notificacion.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'usuario_id'
    },
    tipo: {
      type: DataTypes.ENUM('seguridad', 'transaccion', 'kyc', 'sistema', 'p2p', 'exchange'),
      allowNull: false
    },
    titulo: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    leida: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    importante: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    fechaEnviada: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'fecha_enviada'
    },
  }, {
    sequelize,
    modelName: 'Notificacion',
    tableName: 'notificaciones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['usuario_id'] },
      { fields: ['leida'] },
      { fields: ['tipo'] },
      { fields: ['importante'] },
      { fields: ['created_at'] },
      { fields: ['usuario_id', 'leida'] }
    ]
  });

  return Notificacion;
}

module.exports = initNotificacion;