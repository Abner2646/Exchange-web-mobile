const { DataTypes, Model } = require('sequelize');

class LogAdmin extends Model {}

function initLogAdmin(sequelize) {
  LogAdmin.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'admin_id'
    },
    accion: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    entidadTipo: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'entidad_tipo'
    },
    entidadId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'entidad_id'
    },
    datosAnteriores: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'datos_anteriores'
    },
    datosNuevos: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'datos_nuevos'
    },
    ipAddress: {
      type: DataTypes.INET,
      allowNull: true,
      field: 'ip_address'
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'user_agent'
    }
  }, {
    sequelize,
    modelName: 'LogAdmin',
    tableName: 'logs_admin',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });

  return LogAdmin;
}

module.exports = initLogAdmin;