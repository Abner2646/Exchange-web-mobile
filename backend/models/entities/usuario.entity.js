const { DataTypes, Model } = require('sequelize');

class Usuario extends Model {
  // Método para generar código de recuperación de 6 dígitos
  async generarCodigoRecuperacion() {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
    const expiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    
    await this.update({
      tokenRecuperacion: codigo,
      tokenExpiracion: expiracion
    });
    
    return codigo;
  }

  // Método para validar código de recuperación
  validarCodigoRecuperacion(codigo) {
    return this.tokenRecuperacion === codigo && 
           this.tokenExpiracion && 
           new Date() < this.tokenExpiracion;
  }

  // Método para limpiar token después de uso
  async limpiarToken() {
    await this.update({
      tokenRecuperacion: null,
      tokenExpiracion: null
    });
  }

  // Método para verificar si el usuario puede recuperar contraseña
  puedeRecuperarPassword() {
    return this.passwordHash !== null; // Solo usuarios con contraseña local
  }

  // ==================== MÉTODOS DE VERIFICACIÓN DE EMAIL ==================== //
  
  // Método para generar código de verificación de email
  async generarCodigoVerificacionEmail() {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
    const expiracion = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    
    await this.update({
      codigoVerificacionEmail: codigo,
      codigoVerificacionEmailExpiracion: expiracion
    });
    
    return codigo;
  }

  // Método para validar código de verificación de email
  validarCodigoVerificacionEmail(codigo) {
    return this.codigoVerificacionEmail === codigo && 
           this.codigoVerificacionEmailExpiracion && 
           new Date() < this.codigoVerificacionEmailExpiracion;
  }

  // Método para limpiar código de verificación después de uso
  async limpiarCodigoVerificacionEmail() {
    await this.update({
      codigoVerificacionEmail: null,
      codigoVerificacionEmailExpiracion: null
    });
  }

  // Método para verificar si necesita verificar email
  necesitaVerificarEmail() {
    // Usuarios de Google no necesitan verificar
    return !this.emailVerificado && !this.googleId;
  }
}

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
      unique: true,
      validate: {
        isEmail: true
      }
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        notEmpty: true
      }
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
    // ==================== CAMPOS DE VERIFICACIÓN DE EMAIL ==================== //
    emailVerificado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'email_verificado'
    },
    codigoVerificacionEmail: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'codigo_verificacion_email',
      validate: {
        len: [6, 6],
        isNumeric: true
      }
    },
    codigoVerificacionEmailExpiracion: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'codigo_verificacion_email_expiracion'
    },
    // Campos para recuperación de contraseña
    tokenRecuperacion: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'token_recuperacion',
      validate: {
        len: [6, 6], // Exactamente 6 caracteres
        isNumeric: true // Solo números
      }
    },
    tokenExpiracion: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'token_expiracion'
    },
    intentosRecuperacion: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'intentos_recuperacion'
    },
    ultimoIntentoRecuperacion: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ultimo_intento_recuperacion'
    },
    // Campos para autenticación en dos pasos
    dosFactoresActivado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'dos_factores_activado'
    },
    codigo2FA: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'codigo_2fa',
      validate: {
        len: [6, 6],
        isNumeric: true
      }
    },
    codigo2FAExpiracion: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'codigo_2fa_expiracion'
    },
    pais: {
      type: DataTypes.STRING(2),
      allowNull: true,
      validate: {
        len: [2, 2], // Código ISO de 2 letras
        isAlpha: true
      }
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
      field: 'reputacion_promedio',
      validate: {
        min: 0,
        max: 5
      }
    },
    totalValoraciones: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_valoraciones',
      validate: {
        min: 0
      }
    },
    limiteDiarioUsd: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1000,
      field: 'limite_diario_usd',
      validate: {
        min: 0
      }
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Campo para invalidación de tokens por logout
    ultimoLogout: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ultimo_logout'
    },
    // Campo de último login para seguridad
    ultimoLogin: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'ultimo_login'
    }
  }, {
    sequelize,
    modelName: 'Usuario',
    tableName: 'usuarios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      // Índice para el código de verificación de email
      {
        fields: ['codigo_verificacion_email'],
        unique: true,
        where: {
          codigo_verificacion_email: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      // Índice para email verificado
      {
        fields: ['email_verificado']
      },
      // Índice para el token de recuperación
      {
        fields: ['token_recuperacion'],
        unique: true,
        where: {
          token_recuperacion: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      // Índice para el código 2FA
      {
        fields: ['codigo_2fa'],
        where: {
          codigo_2fa: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      // Índice compuesto para email y activo
      {
        fields: ['email', 'activo']
      },
      // Índice para búsquedas por país
      {
        fields: ['pais']
      },
      // Índice para último logout
      {
        fields: ['ultimo_logout']
      },
      // Índice para último login
      {
        fields: ['ultimo_login']
      },
      // Índice para 2FA activado
      {
        fields: ['dos_factores_activado']
      }
    ],
    hooks: {
      beforeCreate: (usuario, options) => {
        if (!usuario.googleId && !usuario.passwordHash) {
          throw new Error('Password is required if you are not a Google user');
        }
      },
      // Hook para limpiar tokens expirados al actualizar
      beforeUpdate: (usuario, options) => {
        // Limpiar token de recuperación expirado
        if (usuario.tokenExpiracion && new Date() > usuario.tokenExpiracion) {
          usuario.tokenRecuperacion = null;
          usuario.tokenExpiracion = null;
        }
        
        // Limpiar código 2FA expirado
        if (usuario.codigo2FAExpiracion && new Date() > usuario.codigo2FAExpiracion) {
          usuario.codigo2FA = null;
          usuario.codigo2FAExpiracion = null;
        }

        // Limpiar código de verificación de email expirado
        if (usuario.codigoVerificacionEmailExpiracion && new Date() > usuario.codigoVerificacionEmailExpiracion) {
          usuario.codigoVerificacionEmail = null;
          usuario.codigoVerificacionEmailExpiracion = null;
        }
      }
    }
  });

  return Usuario;
}

module.exports = initUsuario;