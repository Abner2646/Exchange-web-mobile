const { DataTypes, Model } = require('sequelize');

class User extends Model {
  // Serialización segura: los flags de riesgo AML NUNCA salen en una respuesta
  // (ni al propio usuario — tipping-off). El campo sigue legible en código
  // (`user.amlRiskLevel`) para el tooling admin; solo se elimina del JSON.
  // Radar #14 + §4.8. (El PII sensible —taxId/DOB/legalName— sí lo ve su dueño;
  // a terceros se les da el perfil público curado, no la instancia completa.)
  toJSON() {
    const values = { ...this.get() };
    delete values.amlRiskLevel;
    delete values.amlReviewPending;
    return values;
  }

  // Método para generar código de recuperación de 6 dígitos
  async generatePasswordResetCode() {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
    const expiracion = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    
    await this.update({
      passwordResetCode: codigo,
      passwordResetCodeExpiresAt: expiracion
    });
    
    return codigo;
  }

  // Método para validar código de recuperación
  validatePasswordResetCode(codigo) {
    return this.passwordResetCode === codigo && 
           this.passwordResetCodeExpiresAt && 
           new Date() < this.passwordResetCodeExpiresAt;
  }

  // Método para limpiar token después de uso
  async clearPasswordResetToken() {
    await this.update({
      passwordResetCode: null,
      passwordResetCodeExpiresAt: null
    });
  }

  // Método para verificar si el usuario puede recuperar contraseña
  canResetPassword() {
    return this.passwordHash !== null; // Solo usuarios con contraseña local
  }

  // ==================== MÉTODOS DE VERIFICACIÓN DE EMAIL ==================== //
  
  // Método para generar código de verificación de email
  async generateEmailVerificationCode() {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
    const expiracion = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    
    await this.update({
      emailVerificationCode: codigo,
      emailVerificationCodeExpiresAt: expiracion
    });
    
    return codigo;
  }

  // Método para validar código de verificación de email
  validateEmailVerificationCode(codigo) {
    return this.emailVerificationCode === codigo && 
           this.emailVerificationCodeExpiresAt && 
           new Date() < this.emailVerificationCodeExpiresAt;
  }

  // Método para limpiar código de verificación después de uso
  async clearEmailVerificationCode() {
    await this.update({
      emailVerificationCode: null,
      emailVerificationCodeExpiresAt: null
    });
  }

  // Método para verificar si necesita verificar email
  needsEmailVerification() {
    // Usuarios de Google no necesitan verificar
    return !this.emailVerified && !this.googleId;
  }
}

function initUser(sequelize) {
  User.init({
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
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'email_verified'
    },
    emailVerificationCode: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'email_verification_code',
      validate: {
        len: [6, 6],
        isNumeric: true
      }
    },
    emailVerificationCodeExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'email_verification_code_expires_at'
    },
    // Campos para recuperación de contraseña
    passwordResetCode: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'password_reset_code',
      validate: {
        len: [6, 6], // Exactamente 6 caracteres
        isNumeric: true // Solo números
      }
    },
    passwordResetCodeExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'password_reset_code_expires_at'
    },
    passwordResetAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'password_reset_attempts'
    },
    lastPasswordResetAttemptAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_password_reset_attempt_at'
    },
    // Campos para autenticación en dos pasos
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'two_factor_enabled'
    },
    twoFactorCode: {
      type: DataTypes.STRING(6),
      allowNull: true,
      field: 'two_factor_code',
      validate: {
        len: [6, 6],
        isNumeric: true
      }
    },
    twoFactorCodeExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'two_factor_code_expires_at'
    },
    country: {
      type: DataTypes.STRING(2),
      allowNull: true,
      validate: {
        len: [2, 2], // Código ISO de 2 letras
        isAlpha: true
      }
    },
    role: {
      type: DataTypes.ENUM('normal', 'admin', 'super_admin'),
      defaultValue: 'normal'
    },
    kycVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'kyc_verified'
    },
    kycData: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'kyc_data'
    },
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0,
      field: 'average_rating',
      validate: {
        min: 0,
        max: 5
      }
    },
    totalRatings: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'total_ratings',
      validate: {
        min: 0
      }
    },
    dailyLimitUsd: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 1000,
      field: 'daily_limit_usd',
      validate: {
        min: 0
      }
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Campo para invalidación de tokens por logout
    lastLogoutAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_logout_at'
    },
    // Campo de último login para seguridad
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at'
    },

    // ── Radar #14: identidad/perfil por capas ────────────────────────────────
    // Display name editable (nickname), SEPARADO del `username` de login (único,
    // inmutable). Nullable → el front cae a `username` para mostrar si está vacío.
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'display_name'
    },
    // Perfil KYC (CIP / FinCEN §4.7). PII sensible — no se expone a terceros.
    legalName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'legal_name'
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'date_of_birth'
    },
    state: { // province/state; the country already lives in `country`
      type: DataTypes.STRING,
      allowNull: true
    },
    taxId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'tax_id'
    },
    // Preferencias (Fase 7.3): locale/idioma por defecto.
    locale: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    // Estado de cuenta: tier KYC (complementa el boolean `kycVerified`).
    kycLevel: {
      type: DataTypes.ENUM('none', 'basic', 'full'),
      allowNull: false,
      defaultValue: 'none',
      field: 'kyc_level'
    },
    // Flag de riesgo AML (Radar #14 + §4.8). NUNCA se expone —ni al propio usuario
    // (tipping-off)—: lo borra `toJSON` de toda serialización; solo tooling admin
    // lo lee vía el atributo. Ver docs/compliance/aml-signal-catalog.md.
    amlRiskLevel: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      allowNull: false,
      defaultValue: 'low',
      field: 'aml_risk_level'
    },
    amlReviewPending: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'aml_review_pending'
    },

    // ── Radar #14: cambio de email (acción sensible) ─────────────────────────
    // Email nuevo pendiente de confirmar + su código (enviado AL email nuevo para
    // probar control). Separados de emailVerificationCode (verificación inicial)
    // para no pisar estados.
    pendingEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'pending_email'
    },
    emailChangeCode: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'email_change_code'
    },
    emailChangeCodeExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'email_change_code_expires_at'
    },
    // Cooldown de retiros: tras un cambio de email (o de credenciales sensibles)
    // los retiros se bloquean hasta este instante — mitiga account-takeover.
    withdrawalCooldownUntil: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'withdrawal_cooldown_until'
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      // Índice para el código de verificación de email
      {
        fields: ['email_verification_code'],
        unique: true,
        where: {
          email_verification_code: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      // Índice para email verificado
      {
        fields: ['email_verified']
      },
      // Índice para el token de recuperación
      {
        fields: ['password_reset_code'],
        unique: true,
        where: {
          password_reset_code: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      // Índice para el código 2FA
      {
        fields: ['two_factor_code'],
        where: {
          two_factor_code: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      // Composite index for email + active
      {
        fields: ['email', 'active']
      },
      // Index for country lookups
      {
        fields: ['country']
      },
      // Índice para último logout
      {
        fields: ['last_logout_at']
      },
      // Índice para último login
      {
        fields: ['last_login_at']
      },
      // Índice para 2FA activado
      {
        fields: ['two_factor_enabled']
      }
    ],
    hooks: {
      // Normaliza email/username (trim + minúsculas) en TODO create/update.
      // La unicidad de la DB (unique en las columnas) es case-sensitive sobre
      // los bytes guardados; normalizar acá garantiza que `User@X.com` y
      // `user@x.com` colisionen, sin depender de que cada caller haga
      // .toLowerCase() a mano (hay paths que lo saltean, ej. el alta de Google).
      beforeValidate: (usuario, options) => {
        if (usuario.email) usuario.email = usuario.email.trim().toLowerCase();
        if (usuario.username) usuario.username = usuario.username.trim().toLowerCase();
      },
      beforeCreate: (usuario, options) => {
        if (!usuario.googleId && !usuario.passwordHash) {
          throw new Error('Password is required if you are not a Google user');
        }
      },
      // Hook para limpiar tokens expirados al actualizar
      beforeUpdate: (usuario, options) => {
        // Limpiar token de recuperación expirado
        if (usuario.passwordResetCodeExpiresAt && new Date() > usuario.passwordResetCodeExpiresAt) {
          usuario.passwordResetCode = null;
          usuario.passwordResetCodeExpiresAt = null;
        }
        
        // Limpiar código 2FA expirado
        if (usuario.twoFactorCodeExpiresAt && new Date() > usuario.twoFactorCodeExpiresAt) {
          usuario.twoFactorCode = null;
          usuario.twoFactorCodeExpiresAt = null;
        }

        // Limpiar código de verificación de email expirado
        if (usuario.emailVerificationCodeExpiresAt && new Date() > usuario.emailVerificationCodeExpiresAt) {
          usuario.emailVerificationCode = null;
          usuario.emailVerificationCodeExpiresAt = null;
        }
      }
    }
  });

  return User;
}

module.exports = initUser;