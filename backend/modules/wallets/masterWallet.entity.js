/*
// Las wallets maestras son ÚNICAS por crypto
// Las crea UN ADMIN o el SISTEMA automáticamente
// NO cada usuario

Cada usuario recibe una dirección única para cada crypto, derivada de la wallet maestra.
¿Cuándo se crea?
Se crea AUTOMÁTICAMENTE cuando:
1. User se registra (todas las cryptos soportadas)
2. Se agrega una nueva crypto al sistema

// Ejemplo: Solo UNA wallet maestra para Bitcoin
{
  id: "uuid",
  cryptoId: "btc-uuid", 
  publicAddress: "1A2B3C...bitcoin-address",
  totalBalance: 125.50000000,  // Total de todos los usuarios
  active: true
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

class MasterWallet extends Model {}

function initMasterWallet(sequelize) {
  MasterWallet.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    cryptoId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'crypto_id'
    },
    // Campos originales mantenidos
    publicAddress: {
      type: DataTypes.STRING(255),
      allowNull: true, // Cambiado a nullable porque ahora usamos xpub
      field: 'public_address'
    },
    totalBalance: {
      type: DataTypes.DECIMAL(28, 8),
      defaultValue: 0,
      field: 'total_balance'
    },
    
    // ========== CAMPOS NUEVOS PARA HD WALLETS ==========
    
    // Información descriptiva
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Nombre descriptivo de la wallet (ej: "Bitcoin Master Wallet")'
    },
    network: {
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
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Si la wallet está active para generar nuevas direcciones'
    },
    
    // Información adicional
    description: {
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
    modelName: 'MasterWallet',
    tableName: 'master_wallets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at', // Activado para auditoría
    
    indexes: [
      {
        unique: true,
        fields: ['crypto_id'],
        name: 'master_wallets_crypto_unique'
      },
      {
        unique: true,
        fields: ['network', 'symbol'],
        name: 'master_wallets_network_symbol_unique'
      },
      {
        fields: ['active'],
        name: 'master_wallets_active_index'
      },
      {
        fields: ['xpub'],
        name: 'master_wallets_xpub_index'
      },
      {
        fields: ['last_sync_at'],
        name: 'master_wallets_last_sync_index'
      }
    ],
    
    // Validaciones a nivel de modelo
    validate: {
      // Validar que xpub corresponde a la network
      xpubMatchesNetwork() {
        if (this.xpub && this.network) {
          // Bitcoin: acepta mainnet y testnet
          if (this.network === 'bitcoin') {
            const validBitcoinPrefixes = ['xpub', 'ypub', 'zpub', 'tpub', 'upub', 'vpub'];
            const isValidBitcoin = validBitcoinPrefixes.some(prefix => 
              this.xpub.startsWith(prefix)
            );
            
            if (!isValidBitcoin) {
              throw new Error('XPUB de Bitcoin debe empezar con un prefijo válido (xpub/ypub/zpub para mainnet, tpub/upub/vpub para testnet)');
            }
          }
          
          // Ethereum usa formato diferente
          if (this.network === 'ethereum' && this.xpub.startsWith('xpub')) {
            throw new Error('XPUB de Ethereum no debe usar formato Bitcoin');
          }
          
          // BSC puede usar formato ethereum o propio
          if (this.network === 'bsc') {
            const validBscPrefixes = ['epub', 'bpub', 'upub'];
            const startsWithBitcoinPrefix = this.xpub.startsWith('xpub') || 
                                            this.xpub.startsWith('ypub') || 
                                            this.xpub.startsWith('zpub');
            
            if (startsWithBitcoinPrefix) {
              throw new Error('XPUB de BSC no debe usar formato Bitcoin (xpub/ypub/zpub)');
            }
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
        // Validar que no existe otra wallet para la misma crypto
        const existing = await MasterWallet.findOne({
          where: { cryptoId: wallet.cryptoId },
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
        if (wallet.changed('active') || wallet.changed('xpub')) {
          const currentMetadata = wallet.metadata || {};
          wallet.metadata = {
            ...currentMetadata,
            lastModified: new Date(),
            lastModifiedBy: options.userId || 'system'
          };
        }
      },
      
      afterCreate: async (wallet, options) => {
        console.log(`Nueva wallet maestra creada: ${wallet.name} (${wallet.symbol})`);
      }
    }
  });

  return MasterWallet;
}

module.exports = initMasterWallet;