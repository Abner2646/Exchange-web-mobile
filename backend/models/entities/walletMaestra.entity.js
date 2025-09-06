/*
// Las wallets maestras son ÚNICAS por criptomoneda
// Las crea UN ADMIN o el SISTEMA automáticamente
// NO cada usuario

Cada usuario recibe una dirección única para cada criptomoneda, derivada de la wallet maestra.
¿Cuándo se crea?
Se crea AUTOMÁTICAMENTE cuando:
1. Usuario se registra (todas las cryptos soportadas)
2. Se agrega una nueva criptomoneda al sistema

// Ejemplo: Solo UNA wallet maestra para Bitcoin
{
  id: "uuid",
  criptomonedaId: "btc-uuid", 
  direccionPublica: "1A2B3C...bitcoin-address",
  balanceTotal: 125.50000000,  // Total de todos los usuarios
  activa: true
}
*/

const { DataTypes, Model } = require('sequelize');

// Función utilitaria para asegurar formato hexadecimal
const ensureHexFormat = (value, fieldName) => {
  if (!value) return value;
  
  // Si ya es un string hex válido, retornarlo
  if (typeof value === 'string' && /^[0-9a-fA-F]+$/.test(value) && !value.includes(',')) {
    return value;
  }
  
  // Si es un Buffer, convertir a hex
  if (Buffer.isBuffer(value)) {
    return value.toString('hex');
  }
  
  // Si es un array de números, convertir
  if (Array.isArray(value) && value.every(v => typeof v === 'number')) {
    return Buffer.from(value).toString('hex');
  }
  
  // Si es un string que representa un array, convertir
  if (typeof value === 'string' && value.includes(',')) {
    try {
      const numbers = value.split(',').map(num => parseInt(num.trim()));
      const buffer = Buffer.from(numbers);
      return buffer.toString('hex');
    } catch (error) {
      console.warn(`No se pudo convertir ${fieldName}: ${value}`);
      return value;
    }
  }
  
  return value;
};

class WalletMaestra extends Model {}

function initWalletMaestra(sequelize) {
  WalletMaestra.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    criptomonedaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'criptomoneda_id'
    },
    // Campos originales mantenidos
    direccionPublica: {
      type: DataTypes.STRING(255),
      allowNull: true, // Cambiado a nullable porque ahora usamos xpub
      field: 'direccion_publica'
    },
    balanceTotal: {
      type: DataTypes.DECIMAL(28, 8),
      defaultValue: 0,
      field: 'balance_total'
    },
    
    // ========== CAMPOS NUEVOS PARA HD WALLETS ==========
    
    // Información descriptiva
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nombre descriptivo de la wallet (ej: "Bitcoin Master Wallet")'
    },
    red: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Red blockchain (bitcoin, ethereum, bsc, etc.)'
    },
    symbol: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: 'Símbolo de la criptomoneda (BTC, ETH, etc.)'
    },
    
    // Claves criptográficas - CRÍTICO
    xpub: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Extended public key para generar direcciones derivadas',
      validate: {
        notEmpty: {
          msg: 'XPUB es requerido para generar direcciones'
        }
      }
    },
    
    // Configuración de derivación
    derivationPath: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "m/44'/0'/0'",
      field: 'derivation_path',
      comment: 'Path base de derivación HD (ej: m/44\'/0\'/0\')'
    },
    
    // Información adicional de la clave
    fingerprint: {
      type: DataTypes.STRING(16),
      allowNull: true,
      comment: 'Fingerprint de la clave maestra para verificación'
    },
    publicKey: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'public_key',
      comment: 'Clave pública del nodo maestro'
    },
    
    // Control operativo
    activa: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Si la wallet está activa para generar nuevas direcciones'
    },
    
    // Información adicional
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Descripción detallada de la wallet'
    },
    
    // Metadatos flexibles
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Metadatos adicionales (configuración, historial, etc.)'
    },
    
    // Auditoría y control
    lastSyncAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_sync_at',
      comment: 'Última sincronización de balance con blockchain'
    },
    nextDerivationIndex: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      field: 'next_derivation_index',
      comment: 'Próximo índice de derivación disponible (cache para optimización)'
    }
    
  }, {
    sequelize,
    modelName: 'WalletMaestra',
    tableName: 'wallets_maestras',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at', // Activado para auditoría
    
    indexes: [
      {
        unique: true,
        fields: ['criptomoneda_id'],
        name: 'wallets_maestras_criptomoneda_unique'
      },
      {
        unique: true,
        fields: ['red', 'symbol'],
        name: 'wallets_maestras_red_symbol_unique'
      },
      {
        fields: ['activa'],
        name: 'wallets_maestras_activa_index'
      },
      {
        fields: ['xpub'],
        name: 'wallets_maestras_xpub_index'
      },
      {
        fields: ['last_sync_at'],
        name: 'wallets_maestras_last_sync_index'
      }
    ],
    
    // Validaciones a nivel de modelo
    validate: {
      // Validar que xpub corresponde a la red
      xpubMatchesNetwork() {
        if (this.xpub && this.red) {
          // Bitcoin xpub empieza con 'xpub'
          if (this.red === 'bitcoin' && !this.xpub.startsWith('xpub')) {
            throw new Error('XPUB de Bitcoin debe empezar con "xpub"');
          }
          // Ethereum usa formato diferente
          if (this.red === 'ethereum' && this.xpub.startsWith('xpub')) {
            throw new Error('XPUB de Ethereum no debe usar formato Bitcoin');
          }
        }
      },
      
      // Validar que derivation path es válido
      validDerivationPath() {
        if (this.derivationPath && !this.derivationPath.match(/^m(\/\d+['h]?)*$/)) {
          throw new Error('Derivation path inválido. Formato: m/44\'/0\'/0\'');
        }
      }
    },
    
    // Hooks para mantenimiento automático
    hooks: {
      beforeCreate: async (wallet, options) => {
        // Validar que no existe otra wallet para la misma criptomoneda
        const existing = await WalletMaestra.findOne({
          where: { criptomonedaId: wallet.criptomonedaId },
          transaction: options.transaction
        });
        
        if (existing) {
          throw new Error(`Ya existe una wallet maestra para esta criptomoneda`);
        }
        
        // NUEVO: Asegurar formato hex correcto ANTES de guardar
        if (wallet.fingerprint) {
          const originalFingerprint = wallet.fingerprint;
          wallet.fingerprint = ensureHexFormat(wallet.fingerprint, 'fingerprint');
          if (originalFingerprint !== wallet.fingerprint) {
            console.log(`Fingerprint ${wallet.symbol}: ${originalFingerprint} → ${wallet.fingerprint}`);
          }
        }
        
        if (wallet.publicKey) {
          const originalPublicKey = wallet.publicKey;
          wallet.publicKey = ensureHexFormat(wallet.publicKey, 'publicKey');
          if (originalPublicKey !== wallet.publicKey) {
            console.log(`PublicKey ${wallet.symbol}: array → hex format`);
          }
        }
        
        // Inicializar metadata si no existe
        if (!wallet.metadata) {
          wallet.metadata = {
            createdBy: 'system',
            version: '1.0',
            createdAt: new Date()
          };
        }
      },
      
      beforeUpdate: async (wallet, options) => {
        // NUEVO: Asegurar formato hex correcto en actualizaciones
        if (wallet.changed('fingerprint') && wallet.fingerprint) {
          wallet.fingerprint = ensureHexFormat(wallet.fingerprint, 'fingerprint');
        }
        
        if (wallet.changed('publicKey') && wallet.publicKey) {
          wallet.publicKey = ensureHexFormat(wallet.publicKey, 'publicKey');
        }
        
        // Actualizar metadata en cambios importantes
        if (wallet.changed('activa') || wallet.changed('xpub')) {
          const currentMetadata = wallet.metadata || {};
          wallet.metadata = {
            ...currentMetadata,
            lastModified: new Date(),
            lastModifiedBy: options.userId || 'system'
          };
        }
      },
      
      afterCreate: async (wallet, options) => {
        console.log(`Nueva wallet maestra creada: ${wallet.nombre} (${wallet.symbol})`);
      }
    }
  });

  return WalletMaestra;
}

module.exports = initWalletMaestra;