// controllers/setupWallets.controller.js
const { WalletMaestra, Criptomoneda, sequelize } = require('../models');
const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const { HDNode } = require('@ethersproject/hdnode');
const { computeAddress } = require('@ethersproject/transactions');
const crypto = require('crypto');

const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const bip32 = BIP32Factory(ecc);

class WalletMaestraSetup {
  
  static async generateMasterWallet(network, derivationPath = "m/44'/0'/0'") {
    try {
      // 1. Generar mnemonic de 24 palabras
      const mnemonic = bip39.generateMnemonic(256);
      
      // 2. Generar seed desde mnemonic
      const seed = await bip39.mnemonicToSeed(mnemonic);
      
      let walletData = {};
      
      switch (network.toLowerCase()) {
        case 'bitcoin':
        case 'btc':
          walletData = this._generateBitcoinMasterWallet(seed, derivationPath);
          break;
          
        case 'ethereum':
        case 'eth':
        case 'bsc':
          walletData = this._generateEthereumMasterWallet(seed, derivationPath);
          break;
          
        default:
          throw new Error(`Red no soportada: ${network}`);
      }
      
      return {
        network,
        mnemonic, // PRIVADO
        derivationPath,
        ...walletData,
        createdAt: new Date(),
        entropy: seed.toString('hex') // PRIVADO
      };
      
    } catch (error) {
      throw new Error(`Error generando wallet maestra: ${error.message}`);
    }
  }
  
  static _generateBitcoinMasterWallet(seed, derivationPath) {
    const network = bitcoin.networks.bitcoin;
    const root = bip32.fromSeed(seed, network);
    const account = root.derivePath(derivationPath);

    return {
      xprv: account.toBase58(), // PRIVADO
      xpub: account.neutered().toBase58(), // PUBLICO
      fingerprint: root.fingerprint.toString('hex'),
      publicKey: account.publicKey.toString('hex')
    };
  }
    
  static _generateEthereumMasterWallet(seed, derivationPath) {
    try {
      // Usar HDNode de ethers para Ethereum/BSC
      const hdNode = HDNode.fromSeed(seed);
      const account = hdNode.derivePath(derivationPath);
      
      // Para obtener fingerprint y crear xpub/xprv compatible, usar bip32
      const root = bip32.fromSeed(seed);
      const bip32Account = root.derivePath(derivationPath);
      
      return {
        xprv: bip32Account.toBase58(), // PRIVADO - usando bip32
        xpub: bip32Account.neutered().toBase58(), // PUBLICO - usando bip32
        fingerprint: root.fingerprint.toString('hex'),
        publicKey: account.publicKey.substring(2), // Remover 0x prefix
        privateKey: account.privateKey, // PRIVADO - desde HDNode
        address: computeAddress(account.publicKey) // Dirección Ethereum
      };
    } catch (error) {
      throw new Error(`Error generando wallet Ethereum: ${error.message}`);
    }
  }
}

// Configuración de criptomonedas por defecto
const CRIPTOMONEDAS_CONFIG = [
  {
    symbol: 'BTC',
    nombre: 'Bitcoin',
    red: 'bitcoin',
    derivationPath: "m/44'/0'/0'",
    addressFormat: 'legacy',
    decimales: 8
  },
  {
    symbol: 'ETH', 
    nombre: 'Ethereum',
    red: 'ethereum',
    derivationPath: "m/44'/60'/0'",
    addressFormat: 'ethereum',
    decimales: 18
  },
  {
    symbol: 'BNB',
    nombre: 'BNB Smart Chain',
    red: 'bsc',
    derivationPath: "m/44'/60'/0'",
    addressFormat: 'ethereum',
    decimales: 18
  }
];

// Verificar si el setup ya fue ejecutado
const checkSetupStatus = async (req, res) => {
  try {
    const walletCount = await WalletMaestra.count();
    const cryptoCount = await Criptomoneda.count();
    
    const isSetup = walletCount > 0;
    
    const wallets = await WalletMaestra.findAll({
      include: [{
        model: Criptomoneda,
        as: 'criptomoneda',
        attributes: ['symbol', 'nombre']
      }],
      attributes: ['id', 'nombre', 'symbol', 'activa', 'created_at']
    });
    
    res.json({
      success: true,
      data: {
        isSetup,
        walletCount,
        cryptoCount,
        wallets: wallets.map(w => ({
          id: w.id,
          symbol: w.symbol,
          nombre: w.nombre,
          activa: w.activa,
          created_at: w.created_at
        }))
      },
      message: isSetup ? 
        'Sistema ya configurado' : 
        'Sistema requiere configuración inicial'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'CHECK_SETUP_ERROR'
    });
  }
};

// Ejecutar setup inicial
const executeSetup = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    // Verificar si ya existe configuración
    const existingWallets = await WalletMaestra.count({ transaction });
    
    if (existingWallets > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Ya existen wallets maestras configuradas. Use force=true para recrear.',
        code: 'SETUP_ALREADY_EXISTS'
      });
    }
    
    const { force = false } = req.body;
    
    if (force && existingWallets > 0) {
      // Eliminar configuración anterior si force=true
      await WalletMaestra.destroy({ where: {}, transaction });
      console.log('Configuración anterior eliminada (force=true)');
    }
    
    const resultados = [];
    const datosPrivados = []; // Para log interno solamente
    
    // 1. Crear/verificar criptomonedas
    const criptomonedas = {};
    
    for (const config of CRIPTOMONEDAS_CONFIG) {
      let criptomoneda = await Criptomoneda.findOne({
        where: { symbol: config.symbol },
        transaction
      });
      
      if (!criptomoneda) {
        criptomoneda = await Criptomoneda.create({
          symbol: config.symbol,
          nombre: config.nombre,
          red: config.red,
          derivationPath: config.derivationPath,
          addressFormat: config.addressFormat,
          decimales: config.decimales,
          activa: true,
          metadata: {
            createdBy: 'setup-controller',
            createdAt: new Date()
          }
        }, { transaction });
      }
      
      criptomonedas[config.symbol] = criptomoneda;
    }
    
    // 2. Generar wallets maestras
    for (const config of CRIPTOMONEDAS_CONFIG) {
      const criptomoneda = criptomonedas[config.symbol];
      
      if (!criptomoneda) continue;
      
      try {
        // Generar wallet
        const walletData = await WalletMaestraSetup.generateMasterWallet(
          config.red,
          config.derivationPath
        );
        
        // Crear en base de datos (solo datos públicos)
        const nuevaWallet = await WalletMaestra.create({
          criptomonedaId: criptomoneda.id,
          nombre: `${config.nombre} Master Wallet`,
          red: config.red,
          symbol: config.symbol,
          xpub: walletData.xpub,
          derivationPath: walletData.derivationPath,
          fingerprint: walletData.fingerprint,
          publicKey: walletData.publicKey,
          balanceTotal: 0,
          activa: true,
          descripcion: `Wallet maestra para ${config.nombre}`,
          nextDerivationIndex: 0,
          metadata: {
            createdAt: walletData.createdAt,
            method: 'api-setup',
            version: '2.0',
            createdBy: req.user?.id || 'admin'
          }
        }, { transaction });
        
        // Resultado público (sin claves privadas)
        const resultado = {
          id: nuevaWallet.id,
          symbol: config.symbol,
          nombre: nuevaWallet.nombre,
          xpub: walletData.xpub,
          red: config.red,
          derivationPath: config.derivationPath,
          created_at: nuevaWallet.created_at
        };
        
        // Agregar dirección para wallets Ethereum
        if (walletData.address) {
          resultado.address = walletData.address;
        }
        
        resultados.push(resultado);
        
        // Datos privados para log (NO enviar al cliente)
        const datosPrivados_item = {
          symbol: config.symbol,
          id: nuevaWallet.id,
          mnemonic: walletData.mnemonic,
          xprv: walletData.xprv,
          entropy: walletData.entropy
        };
        
        // Agregar private key para wallets Ethereum
        if (walletData.privateKey) {
          datosPrivados_item.privateKey = walletData.privateKey;
        }
        
        datosPrivados.push(datosPrivados_item);
        
      } catch (error) {
        console.error(`Error creando wallet ${config.symbol}:`, error.message);
        // Continuar con las demás wallets
      }
    }
    
    await transaction.commit();
    
    // Log de datos privados (SOLO EN SERVIDOR)
    console.log('\n=== DATOS PRIVADOS GENERADOS ===');
    console.log('GUARDAR EN LUGAR SEGURO - NO LOGEAR EN PRODUCCIÓN');
    for (const datos of datosPrivados) {
      console.log(`\n--- ${datos.symbol} ---`);
      console.log(`ID: ${datos.id}`);
      console.log(`MNEMONIC: ${datos.mnemonic}`);
      console.log(`XPRV: ${datos.xprv}`);
      if (datos.privateKey) {
        console.log(`PRIVATE KEY: ${datos.privateKey}`);
      }
      console.log(`ENTROPY: ${datos.entropy}`);
    }
    console.log('\n================================\n');
    
    // Respuesta al cliente (SIN datos privados)
    res.status(201).json({
      success: true,
      data: {
        walletsCreadas: resultados.length,
        wallets: resultados.map(w => ({
          id: w.id,
          symbol: w.symbol,
          nombre: w.nombre,
          red: w.red,
          xpub: w.xpub.substring(0, 30) + '...', // Parcial por seguridad
          derivationPath: w.derivationPath,
          address: w.address, // Para wallets Ethereum
          created_at: w.created_at
        }))
      },
      message: `Setup completado: ${resultados.length} wallets maestras creadas`,
      warning: 'Datos privados loggeados en servidor - mover a lugar seguro',
      code: 'SETUP_COMPLETED'
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error en executeSetup:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'SETUP_EXECUTION_ERROR'
    });
  }
};

// Reset completo (solo super admin)
const resetSetup = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { confirmReset } = req.body;
    
    if (confirmReset !== 'YES_DELETE_ALL_WALLETS') {
      return res.status(400).json({
        success: false,
        error: 'Confirmación requerida: confirmReset="YES_DELETE_ALL_WALLETS"',
        code: 'RESET_CONFIRMATION_REQUIRED'
      });
    }
    
    // Eliminar direcciones de depósito asociadas
    const direccionesEliminadas = await sequelize.models.DireccionDeposito?.destroy({
      where: {},
      transaction
    }) || 0;
    
    // Eliminar wallets maestras
    const walletsEliminadas = await WalletMaestra.destroy({
      where: {},
      transaction
    });
    
    await transaction.commit();
    
    console.log(`RESET EJECUTADO: ${walletsEliminadas} wallets y ${direccionesEliminadas} direcciones eliminadas`);
    
    res.json({
      success: true,
      data: {
        walletsEliminadas,
        direccionesEliminadas
      },
      message: 'Reset completo ejecutado - sistema limpio para nueva configuración',
      code: 'RESET_COMPLETED'
    });
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'RESET_ERROR'
    });
  }
};

// Crear wallet individual
const createSingleWallet = async (req, res) => {
  try {
    const {
      criptomonedaId,
      nombre,
      red,
      symbol,
      derivationPath,
      descripcion
    } = req.body;
    
    if (!criptomonedaId || !red || !symbol) {
      return res.status(400).json({
        success: false,
        error: 'criptomonedaId, red y symbol son requeridos',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }
    
    // Generar wallet
    const walletData = await WalletMaestraSetup.generateMasterWallet(
      red,
      derivationPath || "m/44'/0'/0'"
    );
    
    // Crear en base de datos
    const nuevaWallet = await WalletMaestra.create({
      criptomonedaId,
      nombre: nombre || `${symbol} Master Wallet`,
      red: red.toLowerCase(),
      symbol: symbol.toUpperCase(),
      xpub: walletData.xpub,
      derivationPath: walletData.derivationPath,
      fingerprint: walletData.fingerprint,
      publicKey: walletData.publicKey,
      balanceTotal: 0,
      activa: true,
      descripcion: descripcion || `Wallet maestra para ${symbol}`,
      nextDerivationIndex: 0,
      metadata: {
        createdBy: req.user?.id || 'admin',
        method: 'individual-creation'
      }
    });
    
    // Log datos privados (servidor)
    console.log(`\n=== WALLET INDIVIDUAL CREADA: ${symbol} ===`);
    console.log(`ID: ${nuevaWallet.id}`);
    console.log(`MNEMONIC: ${walletData.mnemonic}`);
    console.log(`XPRV: ${walletData.xprv}`);
    console.log(`XPUB: ${walletData.xpub}`);
    if (walletData.privateKey) {
      console.log(`PRIVATE KEY: ${walletData.privateKey}`);
    }
    if (walletData.address) {
      console.log(`ADDRESS: ${walletData.address}`);
    }
    console.log('=========================================\n');
    
    const response = {
      id: nuevaWallet.id,
      symbol: nuevaWallet.symbol,
      nombre: nuevaWallet.nombre,
      red: nuevaWallet.red,
      xpub: walletData.xpub.substring(0, 30) + '...',
      created_at: nuevaWallet.created_at
    };
    
    if (walletData.address) {
      response.address = walletData.address;
    }
    
    res.status(201).json({
      success: true,
      data: response,
      message: `Wallet ${symbol} creada exitosamente`,
      warning: 'Datos privados loggeados en servidor',
      code: 'WALLET_CREATED'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'CREATE_WALLET_ERROR'
    });
  }
};

module.exports = {
  checkSetupStatus,
  executeSetup,
  resetSetup,
  createSingleWallet
};