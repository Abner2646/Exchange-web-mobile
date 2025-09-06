const { DataTypes, Model } = require('sequelize');

class Usuario extends Model {}

function initUsuario(sequelize) {
  Usuario.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_hash'
    },
    googleId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      field: 'google_id'
    },
    pais: {
      type: DataTypes.STRING(2),
      allowNull: false
    },
    rol: {
      type: DataTypes.ENUM('normal', 'admin', 'super_admin'),
      defaultValue: 'normal'
    },
    kycVerificado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'kyc_verificado'
    },
    kycData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'kyc_data'
    },
    reputacionPromedio: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0,
      field: 'reputacion_promedio'
    },
    totalValoraciones: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_valoraciones'
    },
    limiteDiarioUsd: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1000,
      field: 'limite_diario_usd'
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Usuario',
    tableName: 'usuarios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeCreate: (usuario, options) => {
        if (!usuario.googleId && !usuario.passwordHash) {
          throw new Error('Password is required if you are not a Google user');
        }
      }
    }
  });

  return Usuario;
}

module.exports = initUsuario;