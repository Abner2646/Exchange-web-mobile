// models/direccionDeposito.model.js - Versión completa con correcciones para direcciones únicas por usuario
require('dotenv').config();
const initDireccionDeposito = require('./entities/direccionDeposito.entity');
const { Op, Transaction } = require('sequelize');
const crypto = require('crypto');
const { ethers } = require('ethers');

// Importaciones correctas para las librerías Bitcoin
let bitcoin, BIP32Factory;

try {
  bitcoin = require('bitcoinjs-lib');
  
  try {
    const bip32 = require('bip32');
    const ecc = require('tiny-secp256k1');
    
    if (!ecc.isPoint || typeof ecc.isPoint !== 'function') {
      throw new Error('tiny-secp256k1 no está correctamente inicializado');
    }
    
    BIP32Factory = bip32.BIP32Factory(ecc);
    console.log('bitcoinjs-lib con BIP32Factory cargado correctamente');
  } catch (bip32Error) {
    console.warn('BIP32Factory falló, intentando modo compatibilidad:', bip32Error.message);
    BIP32Factory = require('bip32');
  }
} catch (error) {
  console.error('Error cargando bitcoin libraries:', error.message);
  bitcoin = null;
  BIP32Factory = null;
}

function createDireccionDepositoModel(sequelize) {
  const DepositAddress = initDireccionDeposito(sequelize);

  // =================== MÉTODOS DE CONSULTA BÁSICOS ===================
  
  DepositAddress.getById = async (id) => {
    try {
      const address = await DepositAddress.findByPk(id, {
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username', 'active'],
            required: false
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'active', 'decimals'],
            required: false
          },
          {
            model: sequelize.models.MasterWallet,
            as: 'masterWallet',
            attributes: ['id', 'name', 'network', 'symbol', 'active', 'totalBalance'],
            required: false
          }
        ]
      });

      return address;
    } catch (error) {
      console.error(`Error al obtener dirección por ID ${id}:`, error.message);
      throw new Error(`Error al obtener dirección de depósito por ID: ${error.message}`);
    }
  };

  DepositAddress.getAll = async (filters = {}) => {
    try {
      const whereClause = {};
      const includeClause = [
        {
          model: sequelize.models.User,
          as: 'user',
          attributes: ['id', 'email', 'username'],
          where: filters.userEmail ? {
            email: { [Op.iLike]: `%${filters.userEmail}%` }
          } : undefined
        },
        {
          model: sequelize.models.Crypto,
          as: 'crypto',
          attributes: ['id', 'symbol', 'name', 'network', 'active'],
          where: filters.symbol ? {
            symbol: filters.symbol.toUpperCase()
          } : undefined
        },
        {
          model: sequelize.models.MasterWallet,
          as: 'masterWallet',
          attributes: ['id', 'name', 'network', 'symbol', 'active']
        }
      ];
      
      if (filters.active !== undefined) {
        whereClause.active = filters.active === 'true';
      }
      
      if (filters.userId) whereClause.userId = filters.userId;
      if (filters.cryptoId) whereClause.cryptoId = filters.cryptoId;
      if (filters.masterWalletId) whereClause.masterWalletId = filters.masterWalletId;
      
      if (filters.address) {
        whereClause.address = { [Op.iLike]: `%${filters.address}%` };
      }

      if (filters.fechaDesde || filters.fechaHasta) {
        whereClause.created_at = {};
        if (filters.fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(filters.fechaHasta);
        }
      }

      const options = {
        where: whereClause,
        include: includeClause.filter(inc => !inc.where || Object.keys(inc.where).length > 0),
        order: [['created_at', 'DESC']],
        limit: parseInt(filters.limit) || 100,
        offset: parseInt(filters.offset) || 0
      };

      const { count, rows } = await DepositAddress.findAndCountAll(options);
      
      return {
        direcciones: rows,
        total: count,
        page: Math.floor((parseInt(filters.offset) || 0) / (parseInt(filters.limit) || 100)) + 1,
        totalPages: Math.ceil(count / (parseInt(filters.limit) || 100))
      };
    } catch (error) {
      throw new Error(`Error al obtener direcciones de depósito: ${error.message}`);
    }
  };

  DepositAddress.search = async (term, limit = 10) => {
    try {
      const direcciones = await DepositAddress.findAll({
        where: {
          [Op.or]: [
            { address: { [Op.iLike]: `%${term}%` } },
            { derivationPath: { [Op.iLike]: `%${term}%` } }
          ]
        },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          },
          {
            model: sequelize.models.MasterWallet,
            as: 'masterWallet',
            attributes: ['id', 'name', 'network', 'symbol']
          }
        ],
        limit: parseInt(limit),
        order: [['created_at', 'DESC']]
      });
      
      return direcciones;
    } catch (error) {
      throw new Error(`Error en búsqueda de direcciones: ${error.message}`);
    }
  };

  // =================== MÉTODOS ESPECÍFICOS PARA DIRECCIONES ===================

  DepositAddress.getByUser = async (userId, options = {}) => {
    try {
      const whereClause = { userId: userId };

      if (options.soloActivas !== false) {
        whereClause.active = true;
      }

      if (options.cryptoId) {
        whereClause.cryptoId = options.cryptoId;
      }

      const direcciones = await DepositAddress.findAll({
        where: whereClause,
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'active', 'decimals'],
            where: options.soloActivas !== false ? { active: true } : undefined
          },
          {
            model: sequelize.models.MasterWallet,
            as: 'masterWallet',
            attributes: ['id', 'name', 'network', 'symbol', 'active', 'totalBalance']
          }
        ],
        order: [['created_at', 'DESC']]
      });
      return direcciones;
    } catch (error) {
      throw new Error(`Error al obtener direcciones por usuario: ${error.message}`);
    }
  };

  DepositAddress.getByUserAndCrypto = async (userId, cryptoId) => {
    try {
      const address = await DepositAddress.findOne({
        where: { 
          userId: userId,
          cryptoId: cryptoId,
          active: true 
        },
        include: [
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'active', 'decimals']
          },
          {
            model: sequelize.models.MasterWallet,
            as: 'masterWallet',
            attributes: ['id', 'name', 'network', 'symbol', 'xpub', 'active']
          }
        ]
      });
      return address;
    } catch (error) {
      throw new Error(`Error al obtener dirección por usuario y crypto: ${error.message}`);
    }
  };

  DepositAddress.getByAddress = async (address) => {
    try {
      const result = await DepositAddress.findOne({
        where: { address: address },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username', 'active']
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'active']
          },
          {
            model: sequelize.models.MasterWallet,
            as: 'masterWallet',
            attributes: ['id', 'name', 'network', 'symbol', 'active']
          }
        ]
      });
      return result;
    } catch (error) {
      throw new Error(`Error al obtener dirección por address: ${error.message}`);
    }
  };

  DepositAddress.getByWallet = async (walletId) => {
    try {
      const direcciones = await DepositAddress.findAll({
        where: { masterWalletId: walletId },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username']
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network']
          }
        ],
        order: [['derivationIndex', 'ASC']]
      });
      return direcciones;
    } catch (error) {
      throw new Error(`Error al obtener direcciones por wallet: ${error.message}`);
    }
  };

  // =================== GENERACIÓN AUTOMÁTICA DE DIRECCIONES ===================

  DepositAddress.generateAddressForUser = async (userId, cryptoId, transaction = null) => {
    const t = transaction || await sequelize.transaction();
    
    try {
      if (!userId || !cryptoId) {
        throw new Error('userId y cryptoId son requeridos');
      }

      // Verificar si ya existe una dirección active
      const existingDireccion = await DepositAddress.findOne({
        where: { 
          userId: userId,
          cryptoId: cryptoId,
          active: true
        },
        transaction: t
      });
      
      if (existingDireccion) {
        if (!transaction) await t.commit();
        return await DepositAddress.getById(existingDireccion.id);
      }

      // Obtener datos de la criptomoneda
      const crypto = await sequelize.models.Crypto.findByPk(cryptoId, {
        transaction: t
      });

      if (!crypto || !crypto.active) {
        throw new Error('Criptomoneda no encontrada o inactiva');
      }

      // Buscar wallet maestra o crear usando variables de entorno
      let walletMaestra = await sequelize.models.MasterWallet.findOne({
        where: { 
          cryptoId: cryptoId,
          active: true 
        },
        transaction: t
      });

      if (!walletMaestra) {
        walletMaestra = await DepositAddress._createMasterWalletFromEnv(crypto, t);
      }

      if (!walletMaestra.xpub) {
        throw new Error('La wallet maestra no tiene XPUB/seed configurado');
      }

      // **CAMBIO CLAVE**: Usar userId para generar índice único
      const uniqueIndex = await DepositAddress.generateUniqueIndexForUser(userId, walletMaestra.id, t);

      // Generar la dirección
      let addressData;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        console.log(`Generando dirección para usuario ${userId}, ${crypto.symbol}, índice ${uniqueIndex + attempts}`);
        
        addressData = await DepositAddress._generateAddress(
          walletMaestra.xpub,
          walletMaestra.derivationPath,
          uniqueIndex + attempts,
          crypto.network,
          'legacy',
          userId // **NUEVO**: Pasar userId para mayor unicidad
        );

        console.log(`Dirección generada para usuario ${userId}, ${crypto.symbol}:`, addressData);

        // Verificar que la dirección no existe
        const existingByAddress = await DepositAddress.findOne({
          where: { address: addressData.address },
          transaction: t
        });

        if (!existingByAddress) {
          break;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(`No se pudo generar dirección única después de ${maxAttempts} intentos para usuario ${userId}`);
        }
      }

      if (!addressData || !addressData.address) {
        throw new Error(`No se pudo generar dirección para ${crypto.symbol}, usuario ${userId}`);
      }

      // Crear la dirección en la base de datos
      const direccionData = {
        userId: userId,
        cryptoId: cryptoId,
        masterWalletId: walletMaestra.id,
        address: addressData.address,
        derivationIndex: uniqueIndex,
        derivationPath: `${walletMaestra.derivationPath}/0/${uniqueIndex}`,
        publicKey: addressData.publicKey,
        active: true,
        metadata: {
          generatedAt: new Date().toISOString(),
          method: 'auto_generation',
          network: crypto.network,
          addressFormat: 'deterministic',
          userId: userId, // **NUEVO**: Agregar userId al metadata
          uniqueIndex: uniqueIndex
        }
      };

      const nuevaDireccion = await DepositAddress.create(direccionData, { transaction: t });

      if (!transaction) await t.commit();
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const direccionCompleta = await DepositAddress.getById(nuevaDireccion.id);
        if (direccionCompleta) {
          return direccionCompleta;
        }
      } catch (error) {
        console.error('Error recuperando dirección:', error.message);
      }

      // Respuesta de fallback
      return {
        id: nuevaDireccion.id,
        userId: nuevaDireccion.userId,
        cryptoId: nuevaDireccion.cryptoId,
        masterWalletId: nuevaDireccion.masterWalletId,
        address: nuevaDireccion.address,
        derivationIndex: nuevaDireccion.derivationIndex,
        derivationPath: nuevaDireccion.derivationPath,
        publicKey: nuevaDireccion.publicKey,
        active: nuevaDireccion.active,
        metadata: nuevaDireccion.metadata,
        created_at: nuevaDireccion.created_at,
        crypto: {
          id: crypto.id,
          symbol: crypto.symbol,
          name: crypto.name,
          network: crypto.network,
          active: crypto.active,
          decimals: crypto.decimals || 18
        },
        walletMaestra: {
          id: walletMaestra.id,
          name: walletMaestra.name,
          network: walletMaestra.network,
          symbol: walletMaestra.symbol,
          active: walletMaestra.active,
          totalBalance: walletMaestra.totalBalance || "0.00000000"
        }
      };

    } catch (error) {
      if (!transaction) await t.rollback();
      throw new Error(`Error al generar dirección para usuario ${userId}: ${error.message}`);
    }
  };

  // **NUEVO MÉTODO**: Generar índice único basado en userId
  DepositAddress.generateUniqueIndexForUser = async (userId, masterWalletId, transaction = null) => {
    try {
      // Crear hash único basado en userId para determinismo
      const userHash = crypto.createHash('sha256')
        .update(`${userId}_${masterWalletId}`)
        .digest('hex');
      
      // Convertir hash a número entero (usando primeros 8 caracteres)
      const baseIndex = parseInt(userHash.substring(0, 8), 16) % 1000000; // Limitar a 1M
      
      // Verificar si ya existe una dirección con este índice
      let finalIndex = baseIndex;
      let attempts = 0;
      const maxAttempts = 100;
      
      while (attempts < maxAttempts) {
        const existingWithIndex = await DepositAddress.findOne({
          where: {
            masterWalletId: masterWalletId,
            derivationIndex: finalIndex
          },
          transaction
        });
        
        if (!existingWithIndex) {
          console.log(`Índice único generado para usuario ${userId}: ${finalIndex}`);
          return finalIndex;
        }
        
        // Si ya existe, incrementar
        finalIndex = (baseIndex + attempts + 1) % 1000000;
        attempts++;
      }
      
      throw new Error(`No se pudo generar índice único para usuario ${userId} después de ${maxAttempts} intentos`);
      
    } catch (error) {
      throw new Error(`Error generando índice único: ${error.message}`);
    }
  };

  // =================== CREACIÓN DE WALLET MAESTRA DESDE ENV ===================

  DepositAddress._createMasterWalletFromEnv = async (crypto, transaction) => {
    try {
      let xpub, derivationPath;

      switch (crypto.network.toLowerCase()) {
        case 'bitcoin':
        case 'testnet3':
          xpub = process.env.BTC_MASTER_XPUB;
          
          // DETERMINAR DERIVATION PATH SEGÚN TIPO DE XPUB
          if (xpub) {
            const prefix = xpub.substring(0, 4);
            if (prefix === 'vpub' || prefix === 'vprv') {
              // BIP84 - Native SegWit
              derivationPath = "m/84'/1'/0'";
              console.log('Detectado BIP84 (vpub) - usando derivation path m/84\'/1\'/0\'');
            } else if (prefix === 'upub' || prefix === 'uprv') {
              // BIP49 - P2SH-SegWit
              derivationPath = "m/49'/1'/0'";
              console.log('Detectado BIP49 (upub) - usando derivation path m/49\'/1\'/0\'');
            } else if (prefix === 'tpub' || prefix === 'tprv') {
              // BIP44 - Legacy
              derivationPath = "m/44'/1'/0'";
              console.log('Detectado BIP44 (tpub) - usando derivation path m/44\'/1\'/0\'');
            } else {
              // Fallback
              derivationPath = process.env.BTC_DERIVATION_PATH || "m/84'/1'/0'";
              console.log(`Prefijo desconocido ${prefix} - usando ENV o fallback: ${derivationPath}`);
            }
          } else {
            derivationPath = process.env.BTC_DERIVATION_PATH || "m/84'/1'/0'";
          }
          break;

        case 'ethereum':
        case 'sepolia':
          xpub = process.env.ETH_MASTER_SEED;
          derivationPath = process.env.ETH_DERIVATION_PATH || "m/44'/60'/0'";
          break;

        case 'bsc':
        case 'bsc-testnet':
          xpub = process.env.BSC_MASTER_SEED;
          derivationPath = process.env.BSC_DERIVATION_PATH || "m/44'/60'/0'";
          break;

        default:
          throw new Error(`Red no configurada en variables de entorno: ${crypto.network}`);
      }

      if (!xpub) {
        throw new Error(`XPUB/seed no configurado para ${crypto.network} en variables de entorno`);
      }

      // Determinar estándar BIP
      let bipStandard = 'BIP44';
      if (crypto.network.toLowerCase() === 'bitcoin' || crypto.network.toLowerCase() === 'testnet3') {
        const prefix = xpub.substring(0, 4);
        if (prefix === 'vpub' || prefix === 'vprv') {
          bipStandard = 'BIP84';
        } else if (prefix === 'upub' || prefix === 'uprv') {
          bipStandard = 'BIP49';
        }
      }

      const walletData = {
        name: `Wallet Maestra ${crypto.symbol}`,
        network: crypto.network,
        symbol: crypto.symbol,
        cryptoId: crypto.id,
        xpub: xpub,
        derivationPath: derivationPath,
        active: true,
        totalBalance: "0.00000000",
        metadata: {
          createdAt: new Date().toISOString(),
          source: 'env_variables',
          autoCreated: true,
          derivationStandard: bipStandard,
          xpubType: xpub.substring(0, 4),
          addressFormat: bipStandard === 'BIP84' ? 'native-segwit' : 
                        bipStandard === 'BIP49' ? 'p2sh-segwit' : 'legacy'
        }
      };

      const walletMaestra = await sequelize.models.MasterWallet.create(walletData, { transaction });
      console.log(`Wallet maestra creada para ${crypto.symbol} - ${bipStandard} con path: ${derivationPath}`);
      
      return walletMaestra;
    } catch (error) {
      throw new Error(`Error creando wallet maestra desde ENV: ${error.message}`);
    }
  };

  // =================== GENERACIÓN DE DIRECCIONES POR RED ===================

  DepositAddress._generateAddress = async (xpub, derivationPath, index, network, addressFormat = 'legacy', userId = null) => {
    try {
      console.log(`Generando dirección para usuario ${userId}, network: ${network}, índice: ${index}`);

      switch (network.toLowerCase()) {
        case 'bitcoin':
        case 'testnet3':
          if (!bitcoin || !BIP32Factory) {
            throw new Error('Librerías de Bitcoin no disponibles');
          }
          return DepositAddress._generateBitcoinAddress(xpub, derivationPath, index, addressFormat, userId);
        
        case 'ethereum':
        case 'sepolia':
        case 'bsc':
        case 'bsc-testnet':
          return DepositAddress._generateEthereumAddress(xpub, derivationPath, index, userId);
        
        default:
          throw new Error(`Red no soportada: ${network}`);
      }
    } catch (error) {
      throw new Error(`Error generando dirección para usuario ${userId}: ${error.message}`);
    }
  };

  DepositAddress._generateBitcoinAddress = (xpub, derivationPath, index, format = 'legacy', userId = null) => {
    try {
      console.log(`Generando dirección Bitcoin ${format} con índice ${index} para usuario ${userId}`);
      console.log(`XPUB prefix: ${xpub.substring(0, 4)}`);
      
      if (!bitcoin || !BIP32Factory) {
        throw new Error('Librerías de Bitcoin no disponibles');
      }

      // CONFIGURACIONES ESPECÍFICAS PARA CADA TIPO DE XPUB
      let network;
      const prefix = xpub.substring(0, 4);
      
      if (prefix === 'vpub' || prefix === 'vprv') {
        // BIP84 testnet (Native SegWit) - TU CASO
        network = {
          messagePrefix: '\x18Bitcoin Signed Message:\n',
          bech32: 'tb',
          bip32: {
            public: 0x045f1cf6,   // vpub específico
            private: 0x045f18bc,  // vprv específico
          },
          pubKeyHash: 0x6f,
          scriptHash: 0xc4,
          wif: 0xef,
        };
        console.log('Configurando para BIP84 testnet (vpub)');
        
      } else if (prefix === 'upub' || prefix === 'uprv') {
        // BIP49 testnet (P2SH-SegWit)
        network = {
          messagePrefix: '\x18Bitcoin Signed Message:\n',
          bech32: 'tb',
          bip32: {
            public: 0x044a5262,   // upub
            private: 0x044a4e28,  // uprv
          },
          pubKeyHash: 0x6f,
          scriptHash: 0xc4,
          wif: 0xef,
        };
        console.log('Configurando para BIP49 testnet (upub)');
        
      } else if (prefix === 'tpub' || prefix === 'tprv') {
        // BIP44 testnet (Legacy)
        network = {
          messagePrefix: '\x18Bitcoin Signed Message:\n',
          bech32: 'tb',
          bip32: {
            public: 0x043587cf,   // tpub
            private: 0x04358394,  // tprv
          },
          pubKeyHash: 0x6f,
          scriptHash: 0xc4,
          wif: 0xef,
        };
        console.log('Configurando para BIP44 testnet (tpub)');
        
      } else {
        // Fallback para otros casos
        console.warn(`Prefijo desconocido: ${prefix}, usando bitcoin.networks.testnet`);
        network = bitcoin.networks.testnet;
      }

      console.log(`Configuración de network para ${prefix}:`, {
        bip32Public: network.bip32.public.toString(16),
        bip32Private: network.bip32.private.toString(16)
      });

      // DERIVACIÓN CON LA RED CORRECTA
      let node, child;
      
      try {
        console.log('Intentando derivación con configuración específica...');
        
        // Intentar con BIP32Factory
        if (typeof BIP32Factory.fromBase58 === 'function') {
          node = BIP32Factory.fromBase58(xpub, network);
        } else {
          const ecc = require('tiny-secp256k1');
          const BIP32 = BIP32Factory(ecc);
          node = BIP32.fromBase58(xpub, network);
        }
        
        // **CAMBIO IMPORTANTE**: Derivar con el índice único del usuario
        child = node.derive(index);
        console.log('Derivación exitosa con configuración específica');
        
      } catch (derivationError) {
        console.error('Error en derivación:', derivationError.message);
        throw new Error(`Error en derivación HD con ${prefix}: ${derivationError.message}`);
      }

      if (!child || !child.publicKey) {
        throw new Error('No se pudo derivar clave pública del nodo hijo');
      }

      // CONVERSIÓN DE PUBLIC KEY
      let publicKeyHex;
      try {
        if (Buffer.isBuffer(child.publicKey)) {
          publicKeyHex = child.publicKey.toString('hex');
        } else {
          publicKeyHex = Buffer.from(child.publicKey).toString('hex');
        }
      } catch (conversionError) {
        throw new Error(`Error convirtiendo publicKey: ${conversionError.message}`);
      }

      if (!publicKeyHex || publicKeyHex.length !== 66) {
        throw new Error(`PublicKey inválida: longitud ${publicKeyHex?.length}, esperado 66`);
      }

      // GENERACIÓN DE DIRECCIÓN SEGÚN EL TIPO DE XPUB
      let address;
      const pubkeyBuffer = Buffer.from(publicKeyHex, 'hex');
      
      try {
        if (prefix === 'vpub' || prefix === 'vprv') {
          // BIP84 - Native SegWit (bech32)
          const p2wpkhResult = bitcoin.payments.p2wpkh({ 
            pubkey: pubkeyBuffer,
            network: bitcoin.networks.testnet // Usar network estándar para payments
          });
          address = p2wpkhResult.address;
          console.log(`Dirección Native SegWit generada: ${address}`);
          
        } else if (prefix === 'upub' || prefix === 'uprv') {
          // BIP49 - P2SH-SegWit
          const redeemScript = bitcoin.payments.p2wpkh({ 
            pubkey: pubkeyBuffer,
            network: bitcoin.networks.testnet 
          });
          const p2shResult = bitcoin.payments.p2sh({
            redeem: redeemScript,
            network: bitcoin.networks.testnet
          });
          address = p2shResult.address;
          console.log(`Dirección P2SH-SegWit generada: ${address}`);
          
        } else {
          // BIP44 - Legacy P2PKH
          const p2pkhResult = bitcoin.payments.p2pkh({ 
            pubkey: pubkeyBuffer,
            network: bitcoin.networks.testnet
          });
          address = p2pkhResult.address;
          console.log(`Dirección Legacy generada: ${address}`);
        }
        
      } catch (paymentError) {
        throw new Error(`Error creando payment Bitcoin: ${paymentError.message}`);
      }

      if (!address) {
        throw new Error('No se pudo generar dirección Bitcoin válida');
      }

      // VALIDAR FORMATO SEGÚN TIPO
      let isValidFormat = false;
      if (prefix === 'vpub' || prefix === 'vprv') {
        isValidFormat = address.startsWith('tb1'); // Native SegWit testnet
      } else if (prefix === 'upub' || prefix === 'uprv') {
        isValidFormat = address.startsWith('2');   // P2SH testnet
      } else {
        isValidFormat = address.startsWith('m') || address.startsWith('n'); // Legacy testnet
      }

      if (!isValidFormat) {
        console.warn(`Advertencia: Dirección generada con formato inesperado para ${prefix}: ${address}`);
      }

      console.log(`Dirección Bitcoin testnet única generada para usuario ${userId}: ${address}`);

      return {
        address,
        publicKey: publicKeyHex,
        derivationIndex: index,
        format: prefix === 'vpub' ? 'native-segwit' : (prefix === 'upub' ? 'p2sh-segwit' : 'legacy'),
        network: 'testnet',
        userId: userId // **NUEVO**: Incluir userId en respuesta
      };

    } catch (error) {
      console.error('Error completo en _generateBitcoinAddress:', error.message);
      throw new Error(`Error generando dirección Bitcoin para usuario ${userId}: ${error.message}`);
    }
  };

  DepositAddress._generateEthereumAddress = (xpub, derivationPath, index, userId = null) => {
    try {
      console.log(`Generando dirección Ethereum/BSC con índice ${index} para usuario ${userId}`);

      if (!BIP32Factory) {
        throw new Error('Librería BIP32 no disponible');
      }

      // Derivación HD real: el mismo mecanismo BIP32 que ya se usa para Bitcoin
      // (misma curva secp256k1), aplicado sobre el xpub de la cuenta ETH/BSC.
      // Ver AUDITORIA_BACKEND.md Críticos #1: antes esto era un hash SHA-256
      // disfrazado de dirección, sin clave privada real detrás.
      const node = BIP32Factory.fromBase58(xpub);
      const child = node.derive(index);

      if (!child || !child.publicKey) {
        throw new Error('No se pudo derivar clave pública del nodo hijo');
      }

      const publicKeyHex = Buffer.isBuffer(child.publicKey)
        ? child.publicKey.toString('hex')
        : Buffer.from(child.publicKey).toString('hex');

      // computeAddress aplica Keccak-256 sobre la clave pública descomprimida,
      // que es como se derivan las direcciones en cualquier chain EVM (ETH/BSC).
      const address = ethers.computeAddress('0x' + publicKeyHex);

      console.log(`Dirección Ethereum/BSC única generada para usuario ${userId}: ${address}`);

      return {
        address,
        publicKey: publicKeyHex,
        derivationIndex: index,
        userId
      };
    } catch (error) {
      throw new Error(`Error en generación Ethereum/BSC para usuario ${userId}: ${error.message}`);
    }
  };

  // =================== CREAR DIRECCIONES PARA TODAS LAS CRIPTOS ===================

  DepositAddress.createAddressesForAllCryptos = async (userId) => {
    const transaction = await sequelize.transaction();
    
    try {
      const usuario = await sequelize.models.User.findByPk(userId, { transaction });
      
      if (!usuario || !usuario.active) {
        throw new Error(`User ${userId} no encontrado o inactivo`);
      }

      // Obtener criptomonedas activas configuradas en ENV
      const criptomonedasDisponibles = [];
      
      if (process.env.BTC_MASTER_XPUB) {
        const btcCrypto = await sequelize.models.Crypto.findOne({
          where: { network: 'bitcoin', active: true },
          transaction
        });
        if (btcCrypto) criptomonedasDisponibles.push(btcCrypto);
      }

      if (process.env.ETH_MASTER_SEED) {
        const ethCrypto = await sequelize.models.Crypto.findOne({
          where: { network: 'ethereum', active: true },
          transaction
        });
        if (ethCrypto) criptomonedasDisponibles.push(ethCrypto);
      }

      if (process.env.BSC_MASTER_SEED) {
        const bscCrypto = await sequelize.models.Crypto.findOne({
          where: { network: 'bsc', active: true },
          transaction
        });
        if (bscCrypto) criptomonedasDisponibles.push(bscCrypto);
      }

      if (criptomonedasDisponibles.length === 0) {
        throw new Error('No hay criptomonedas configuradas en variables de entorno');
      }

      const resultados = [];
      const errores = [];

      for (const crypto of criptomonedasDisponibles) {
        try {
          const existingAddress = await DepositAddress.findOne({
            where: {
              userId: userId,
              cryptoId: crypto.id,
              active: true
            },
            transaction
          });

          if (existingAddress) {
            const direccionCompleta = await DepositAddress.getById(existingAddress.id);
            resultados.push({
              crypto: crypto.symbol,
              address: direccionCompleta,
              status: 'ya_existia'
            });
          } else {
            const nuevaDireccion = await DepositAddress.generateAddressForUser(
              userId, 
              crypto.id, 
              transaction
            );
            
            resultados.push({
              crypto: crypto.symbol,
              address: nuevaDireccion,
              status: 'creada'
            });
          }
        } catch (error) {
          console.error(`Error procesando ${crypto.symbol}:`, error.message);
          errores.push({
            crypto: crypto.symbol,
            error: error.message
          });
        }
      }

      await transaction.commit();
      
      return {
        exitosas: resultados,
        errores: errores,
        total: criptomonedasDisponibles.length,
        creadas: resultados.filter(r => r.status === 'creada').length,
        yaExistian: resultados.filter(r => r.status === 'ya_existia').length
      };

    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear direcciones masivas: ${error.message}`);
    }
  };

  DepositAddress.getNextDerivationIndex = async (masterWalletId, transaction = null) => {
    try {
      if (!masterWalletId) {
        throw new Error('masterWalletId es requerido');
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(masterWalletId)) {
        throw new Error(`masterWalletId debe ser un UUID válido: ${masterWalletId}`);
      }

      const wallet = await sequelize.models.MasterWallet.findByPk(masterWalletId, { transaction });
      
      if (!wallet) {
        throw new Error(`Wallet maestra con ID ${masterWalletId} no encontrada`);
      }

      const result = await DepositAddress.findOne({
        attributes: [
          [sequelize.fn('COALESCE', 
            sequelize.fn('MAX', sequelize.col('derivation_index')), 
            -1
          ), 'maxIndex']
        ],
        where: { masterWalletId: masterWalletId },
        transaction,
        raw: true
      });
      
      const maxIndex = parseInt(result?.maxIndex || -1);
      const nextIndex = maxIndex + 1;
      
      console.log(`Wallet ${masterWalletId}: siguiente índice = ${nextIndex}`);
      
      return nextIndex;
    } catch (error) {
      throw new Error(`Error al obtener siguiente índice de derivación: ${error.message}`);
    }
  };

  // =================== MÉTODOS CRUD CON VALIDACIONES ===================

  DepositAddress.createAddress = async (data) => {
    const transaction = await sequelize.transaction();
    
    try {
      if (!data.userId || !data.cryptoId) {
        throw new Error('userId y cryptoId son requeridos');
      }

      const crypto = await sequelize.models.Crypto.findByPk(data.cryptoId, { transaction });
      
      if (!crypto || !crypto.active) {
        throw new Error('Criptomoneda no encontrada o inactiva');
      }

      if (data.masterWalletId) {
        const walletMaestra = await sequelize.models.MasterWallet.findByPk(data.masterWalletId, { transaction });
        
        if (!walletMaestra || !walletMaestra.active) {
          throw new Error('Wallet maestra no encontrada o inactiva');
        }
      }

      if (data.address) {
        const existingAddress = await DepositAddress.findOne({
          where: { address: data.address },
          transaction
        });
        
        if (existingAddress) {
          throw new Error('Esta dirección ya está en uso');
        }
      }

      const direccionData = {
        ...data,
        metadata: {
          ...data.metadata,
          createdAt: new Date(),
          method: 'manual_creation'
        }
      };

      const nuevaDireccion = await DepositAddress.create(direccionData, { transaction });
      await transaction.commit();
      
      return await DepositAddress.getById(nuevaDireccion.id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al crear dirección de depósito: ${error.message}`);
    }
  };

  DepositAddress.updateAddress = async (id, data) => {
    const transaction = await sequelize.transaction();
    
    try {
      const address = await DepositAddress.findByPk(id, { transaction });
      
      if (!address) {
        throw new Error('Dirección de depósito no encontrada');
      }

      if (data.address && data.address !== address.address) {
        const existingAddress = await DepositAddress.findOne({
          where: { 
            address: data.address,
            id: { [Op.ne]: id }
          },
          transaction
        });
        
        if (existingAddress) {
          throw new Error('Esta dirección ya está en uso');
        }
      }

      const updateData = {
        ...data,
        metadata: {
          ...address.metadata,
          ...data.metadata,
          lastModified: new Date()
        }
      };

      await DepositAddress.update(updateData, {
        where: { id },
        transaction
      });
      
      await transaction.commit();
      
      return await DepositAddress.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar dirección de depósito: ${error.message}`);
    }
  };

  DepositAddress.deleteAddress = async (id) => {
    const transaction = await sequelize.transaction();
    
    try {
      const address = await DepositAddress.findByPk(id, { transaction });
      
      if (!address) {
        throw new Error('Dirección de depósito no encontrada');
      }

      await DepositAddress.update(
        { 
          active: false,
          metadata: {
            ...address.metadata,
            deletedAt: new Date(),
            deletedReason: 'manual_deletion'
          }
        },
        { where: { id }, transaction }
      );
      
      await transaction.commit();
      
      return { 
        message: 'Dirección de depósito desactivada correctamente',
        direccionId: id
      };
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al eliminar dirección de depósito: ${error.message}`);
    }
  };

  // =================== VALIDACIONES Y SEGURIDAD ===================

  DepositAddress.validateForDeposit = async (address) => {
    try {
      const direccionData = await DepositAddress.getByAddress(address);
      
      if (!direccionData) {
        return {
          valid: false,
          message: 'Dirección de depósito no encontrada'
        };
      }

      if (!direccionData.active) {
        return {
          valid: false,
          message: 'La dirección de depósito está desactivada'
        };
      }

      if (!direccionData.crypto.active) {
        return {
          valid: false,
          message: 'La criptomoneda está desactivada'
        };
      }

      if (!direccionData.user.active) {
        return {
          valid: false,
          message: 'El usuario está desactivado'
        };
      }

      return {
        valid: true,
        address: direccionData,
        message: 'Dirección válida para depósito'
      };
    } catch (error) {
      return {
        valid: false,
        message: `Error en validación: ${error.message}`
      };
    }
  };

  DepositAddress.validateAddress = (address, network) => {
    try {
      switch (network.toLowerCase()) {
        case 'bitcoin':
        case 'testnet3':
          return DepositAddress._validateBitcoinAddress(address);
        case 'ethereum':
        case 'sepolia':
        case 'bsc':
        case 'bsc-testnet':
          return DepositAddress._validateEthereumAddress(address);
        default:
          return { valid: false, message: 'Red no soportada' };
      }
    } catch (error) {
      return { valid: false, message: error.message };
    }
  };

  DepositAddress._validateBitcoinAddress = (address) => {
    try {
      if (!bitcoin) {
        return { valid: false, message: 'Validador Bitcoin no disponible' };
      }
      
      const network = process.env.BITCOIN_NETWORK === 'testnet3' ? 
        bitcoin.networks.testnet : bitcoin.networks.bitcoin;
      
      bitcoin.address.toOutputScript(address, network);
      return { valid: true, message: 'Dirección Bitcoin válida' };
    } catch (error) {
      return { valid: false, message: 'Dirección Bitcoin inválida' };
    }
  };

  DepositAddress._validateEthereumAddress = (address) => {
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (ethAddressRegex.test(address)) {
      return { valid: true, message: 'Dirección Ethereum/BSC válida' };
    }
    return { valid: false, message: 'Dirección Ethereum/BSC inválida' };
  };

  // =================== MÉTODOS ADMINISTRATIVOS ===================

  DepositAddress.updateStatus = async (id, newStatus, reason = null) => {
    const transaction = await sequelize.transaction();
    
    try {
      const address = await DepositAddress.findByPk(id, { transaction });
      
      if (!address) {
        throw new Error('Dirección de depósito no encontrada');
      }

      await DepositAddress.update(
        { 
          active: newStatus,
          metadata: {
            ...address.metadata,
            lastStatusChange: new Date(),
            statusChangeReason: reason
          }
        },
        { where: { id }, transaction }
      );
      
      await transaction.commit();
      
      return await DepositAddress.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al actualizar status: ${error.message}`);
    }
  };

  DepositAddress.getStats = async (filters = {}) => {
    try {
      const whereClause = {};
      
      if (filters.fechaDesde || filters.fechaHasta) {
        whereClause.created_at = {};
        if (filters.fechaDesde) {
          whereClause.created_at[Op.gte] = new Date(filters.fechaDesde);
        }
        if (filters.fechaHasta) {
          whereClause.created_at[Op.lte] = new Date(filters.fechaHasta);
        }
      }

      const totalDirecciones = await DepositAddress.count({ where: whereClause });
      const direccionesActivas = await DepositAddress.count({
        where: { ...whereClause, active: true }
      });
      const direccionesInactivas = await DepositAddress.count({
        where: { ...whereClause, active: false }
      });

      const statsByCrypto = await DepositAddress.findAll({
        where: whereClause,
        attributes: [
          'cryptoId',
          [sequelize.fn('COUNT', sequelize.col('DepositAddress.id')), 'count'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN "DepositAddress"."active" = true THEN 1 END')), 'activas']
        ],
        include: [{
          model: sequelize.models.Crypto,
          as: 'crypto',
          attributes: ['symbol', 'name', 'network']
        }],
        group: ['cryptoId', 'criptomoneda.id'],
        raw: false
      });

      const statsByWallet = await DepositAddress.findAll({
        where: whereClause,
        attributes: [
          'masterWalletId',
          [sequelize.fn('COUNT', sequelize.col('DepositAddress.id')), 'count'],
          [sequelize.fn('COUNT', sequelize.literal('CASE WHEN "DepositAddress"."active" = true THEN 1 END')), 'activas']
        ],
        include: [{
          model: sequelize.models.MasterWallet,
          as: 'masterWallet',
          attributes: ['name', 'network', 'symbol']
        }],
        group: ['masterWalletId', 'walletMaestra.id'],
        raw: false
      });

      const direccionesPorDia = await DepositAddress.findAll({
        where: {
          created_at: {
            [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'fecha'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true
      });

      return {
        resumen: {
          total: totalDirecciones,
          activas: direccionesActivas,
          inactivas: direccionesInactivas,
          porcentajeActivas: totalDirecciones > 0 ? ((direccionesActivas / totalDirecciones) * 100).toFixed(2) : 0
        },
        porCriptomoneda: statsByCrypto,
        porWallet: statsByWallet,
        tendencia: direccionesPorDia
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  // =================== OPERACIONES MASIVAS ===================

  DepositAddress.createBulkAddresses = async (requests) => {
    const transaction = await sequelize.transaction();
    
    try {
      const results = [];
      
      for (const request of requests) {
        const { userId, cryptoId } = request;
        
        const address = await DepositAddress.generateAddressForUser(
          userId, 
          cryptoId, 
          transaction
        );
        
        results.push(address);
      }
      
      await transaction.commit();
      return results;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error en creación masiva: ${error.message}`);
    }
  };

  DepositAddress.regenerateAddress = async (id, reason) => {
    const transaction = await sequelize.transaction();
    
    try {
      const direccionActual = await DepositAddress.findByPk(id, {
        include: ['crypto', 'masterWallet'],
        transaction
      });
      
      if (!direccionActual) {
        throw new Error('Dirección no encontrada');
      }

      await DepositAddress.update(
        { 
          active: false,
          metadata: {
            ...direccionActual.metadata,
            deactivatedAt: new Date(),
            deactivationReason: reason
          }
        },
        { where: { id }, transaction }
      );

      const nuevaDireccion = await DepositAddress.generateAddressForUser(
        direccionActual.userId,
        direccionActual.cryptoId,
        transaction
      );

      await transaction.commit();
      return nuevaDireccion;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`Error al regenerar dirección: ${error.message}`);
    }
  };

  // =================== MÉTODOS PARA INTEGRACIÓN CON BLOCKCHAIN SERVICES ===================

  DepositAddress.getAllActiveAddresses = async () => {
    try {
      const direcciones = await DepositAddress.findAll({
        where: { active: true },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username', 'active'],
            where: { active: true }
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'active'],
            where: { active: true }
          }
        ]
      });
      
      return direcciones;
    } catch (error) {
      throw new Error(`Error obteniendo direcciones activas: ${error.message}`);
    }
  };

  DepositAddress.getAddressesByNetwork = async (network) => {
    try {
      const direcciones = await DepositAddress.findAll({
        where: { active: true },
        include: [
          {
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'email', 'username', 'active'],
            where: { active: true }
          },
          {
            model: sequelize.models.Crypto,
            as: 'crypto',
            attributes: ['id', 'symbol', 'name', 'network', 'active'],
            where: { 
              active: true,
              network: network.toLowerCase()
            }
          }
        ]
      });
      
      return direcciones;
    } catch (error) {
      throw new Error(`Error obteniendo direcciones por network: ${error.message}`);
    }
  };

  // Añadir este método al modelo para configuración explícita de testnet3
  DepositAddress._getBitcoinNetwork = () => {
    // Configuración explícita para Bitcoin testnet3
    const testnet3Config = {
      messagePrefix: '\x18Bitcoin Signed Message:\n',
      bech32: 'tb',
      bip32: {
        public: 0x043587cf,   // tpub - BIP32 extended public key
        private: 0x04358394,  // tprv - BIP32 extended private key
      },
      pubKeyHash: 0x6f,       // Direcciones P2PKH testnet (empiezan con 'm' o 'n')
      scriptHash: 0xc4,       // Direcciones P2SH testnet (empiezan con '2')
      wif: 0xef,              // Wallet Import Format para testnet
    };

    const mainnetConfig = {
      messagePrefix: '\x18Bitcoin Signed Message:\n',
      bech32: 'bc',
      bip32: {
        public: 0x0488b21e,   // xpub
        private: 0x0488ade4,  // xprv
      },
      pubKeyHash: 0x00,       // Direcciones P2PKH mainnet (empiezan con '1')
      scriptHash: 0x05,       // Direcciones P2SH mainnet (empiezan con '3')
      wif: 0x80,              // Wallet Import Format para mainnet
    };

    // Determinar configuración desde variables de entorno
    if (process.env.BITCOIN_NETWORK === 'testnet3' || process.env.BITCOIN_NETWORK === 'testnet') {
      console.log('Usando configuración Bitcoin testnet3');
      return testnet3Config;
    } else if (process.env.BITCOIN_NETWORK === 'mainnet') {
      console.log('Usando configuración Bitcoin mainnet');
      return mainnetConfig;
    } else {
      // Default para desarrollo
      console.log('Usando configuración por defecto: testnet3');
      return testnet3Config;
    }
  };

  // También añadir método de validación de XPUB
  DepositAddress._validateXPUB = (xpub, network) => {
    try {
      if (!xpub || typeof xpub !== 'string' || xpub.length < 100) {
        throw new Error('XPUB inválido: formato incorrecto');
      }

      // Verificar prefijos válidos según la network
      const validPrefixes = network === bitcoin.networks.testnet
        ? ['tpub', 'tprv', 'upub', 'uprv', 'vpub', 'vprv'] // testnet
        : ['xpub', 'xprv', 'ypub', 'yprv', 'zpub', 'zprv']; // mainnet

      const hasValidPrefix = validPrefixes.some(prefix => xpub.startsWith(prefix));
      
      if (!hasValidPrefix) {
        console.warn(`XPUB con prefijo inusual: ${xpub.substring(0, 4)} para network ${network === bitcoin.networks.testnet ? 'testnet' : 'mainnet'}`);
      }

      // Intentar parsear para validar
      const node = BIP32Factory.fromBase58(xpub, network);
      
      return {
        valid: true,
        prefix: xpub.substring(0, 4),
        network: network === bitcoin.networks.testnet ? 'testnet' : 'mainnet',
        depth: node.depth,
        fingerprint: node.fingerprint.toString('hex')
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message,
        prefix: xpub.substring(0, 4)
      };
    }
  };

  return DepositAddress;
}

module.exports = createDireccionDepositoModel;