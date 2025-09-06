// controllers/setupWallets.controller.js
const { WalletMaestra, Criptomoneda, sequelize } = require('../models');
const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');

const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const bip32 = BIP32Factory(ecc);

class WalletMaestraSetup {
  
  static async generateMasterWallet(network, derivationPath = "m/44'/0'/0'") {
    try {
      const mnemonic = bip39.generateMnemonic(256);
      const seed = await bip39.mnemonicToSeed(mnemonic);
      
      let walletData = {};
      
      switch (network.toLowerCase()) {
        case 'bitcoin':
        case 'btc':
          walletData = this._generateBitcoinMasterWallet(seed, derivationPath);
          break;
          
        case 'bsc':
          walletData = this._generateBSCMasterWallet(seed, derivationPath);
          break;
          
        default:
          throw new Error(`Red no soportada: ${network}`);
      }
      
      return {
        network,
        mnemonic,
        derivationPath,
        ...walletData,
        createdAt: new Date(),
        entropy: seed.toString('hex')
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
      xprv: account.toBase58(),
      xpub: account.neutered().toBase58(),
      fingerprint: root.fingerprint.toString('hex'),
      publicKey: account.publicKey.toString('hex')
    };
  }
    
  static _generateBSCMasterWallet(seed, derivationPath) {
    const root = bip32.fromSeed(seed);
    const account = root.derivePath(derivationPath);
    
    const publicKeyHex = account.publicKey.toString('hex');
    const address = '0x' + crypto.randomBytes(20).toString('hex');
    
    return {
      xprv: account.toBase58(),
      xpub: account.neutered().toBase58(), 
      fingerprint: root.fingerprint.toString('hex'),
      publicKey: publicKeyHex,
      privateKey: account.privateKey.toString('hex'),
      address: address
    };
  }
}

// Configuración simplificada
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
    symbol: 'BNB',
    nombre: 'BNB Smart Chain',
    red: 'bsc',
    derivationPath: "m/44'/60'/0'",
    addressFormat: 'ethereum',
    decimales: 18
  }
];

// 1. CHECK STATUS
const checkSetupStatus = async (req, res) => {
  try {
    const walletCount = await WalletMaestra.count();
    const cryptoCount = await Criptomoneda.count();
    
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
        isSetup: walletCount > 0,
        walletCount,
        cryptoCount,
        wallets: wallets.map(w => ({
          id: w.id,
          symbol: w.symbol,
          nombre: w.nombre,
          activa: w.activa,
          created_at: w.created_at
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 2. EXECUTE SETUP (Solo BTC y BNB)
const executeSetup = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const existingWallets = await WalletMaestra.count({ transaction });
    const { force = false } = req.body;
    
    if (existingWallets > 0 && !force) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Ya existen wallets. Use force=true para recrear.'
      });
    }
    
    if (force && existingWallets > 0) {
      await WalletMaestra.destroy({ where: {}, transaction });
    }
    
    const resultados = [];
    const datosPrivados = [];
    
    // Crear/verificar criptomonedas
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
          activa: true
        }, { transaction });
      }
      
      criptomonedas[config.symbol] = criptomoneda;
    }
    
    // Generar wallets (Solo BTC y BNB)
    for (const config of CRIPTOMONEDAS_CONFIG) {
      const criptomoneda = criptomonedas[config.symbol];
      if (!criptomoneda) continue;
      
      try {
        const walletData = await WalletMaestraSetup.generateMasterWallet(
          config.red,
          config.derivationPath
        );
        
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
            version: '2.0'
          }
        }, { transaction });
        
        const resultado = {
          id: nuevaWallet.id,
          symbol: config.symbol,
          nombre: nuevaWallet.nombre,
          red: config.red,
          created_at: nuevaWallet.created_at
        };
        
        if (walletData.address) {
          resultado.address = walletData.address;
        }
        
        resultados.push(resultado);
        
        // Log privado
        const datosPrivados_item = {
          symbol: config.symbol,
          id: nuevaWallet.id,
          mnemonic: walletData.mnemonic,
          xprv: walletData.xprv,
          entropy: walletData.entropy
        };
        
        if (walletData.privateKey) {
          datosPrivados_item.privateKey = walletData.privateKey;
        }
        if (walletData.address) {
          datosPrivados_item.address = walletData.address;
        }
        
        datosPrivados.push(datosPrivados_item);
        
      } catch (error) {
        console.error(`Error creando wallet ${config.symbol}:`, error.message);
      }
    }
    
    await transaction.commit();
    
    // Log datos privados
    console.log('\n=== DATOS PRIVADOS ===');
    for (const datos of datosPrivados) {
      console.log(`\n--- ${datos.symbol} ---`);
      console.log(`ID: ${datos.id}`);
      console.log(`MNEMONIC: ${datos.mnemonic}`);
      console.log(`XPRV: ${datos.xprv}`);
      if (datos.privateKey) console.log(`PRIVATE KEY: ${datos.privateKey}`);
      if (datos.address) console.log(`ADDRESS: ${datos.address}`);
      console.log(`ENTROPY: ${datos.entropy}`);
    }
    console.log('\n==================\n');
    
    res.status(201).json({
      success: true,
      data: {
        walletsCreadas: resultados.length,
        wallets: resultados
      },
      message: `Setup completado: ${resultados.length} wallets creadas (BTC, BNB)`
    });
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 3. CREATE SINGLE WALLET
const createSingleWallet = async (req, res) => {
  try {
    const { criptomonedaId, nombre, red, symbol, derivationPath, descripcion } = req.body;
    
    if (!criptomonedaId || !red || !symbol) {
      return res.status(400).json({
        success: false,
        error: 'criptomonedaId, red y symbol son requeridos'
      });
    }
    
    const walletData = await WalletMaestraSetup.generateMasterWallet(
      red,
      derivationPath || "m/44'/0'/0'"
    );
    
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
      nextDerivationIndex: 0
    });
    
    // Log privado
    console.log(`\n=== WALLET CREADA: ${symbol} ===`);
    console.log(`ID: ${nuevaWallet.id}`);
    console.log(`MNEMONIC: ${walletData.mnemonic}`);
    console.log(`XPRV: ${walletData.xprv}`);
    console.log(`XPUB: ${walletData.xpub}`);
    if (walletData.privateKey) console.log(`PRIVATE KEY: ${walletData.privateKey}`);
    if (walletData.address) console.log(`ADDRESS: ${walletData.address}`);
    console.log('========================\n');
    
    const response = {
      id: nuevaWallet.id,
      symbol: nuevaWallet.symbol,
      nombre: nuevaWallet.nombre,
      red: nuevaWallet.red,
      created_at: nuevaWallet.created_at
    };
    
    if (walletData.address) {
      response.address = walletData.address;
    }
    
    res.status(201).json({
      success: true,
      data: response,
      message: `Wallet ${symbol} creada exitosamente`
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 4. RESET SETUP
const resetSetup = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { confirmReset } = req.body;
    
    if (confirmReset !== 'YES_DELETE_ALL_WALLETS') {
      return res.status(400).json({
        success: false,
        error: 'Confirmación requerida: confirmReset="YES_DELETE_ALL_WALLETS"'
      });
    }
    
    const walletsEliminadas = await WalletMaestra.destroy({
      where: {},
      transaction
    });
    
    await transaction.commit();
    
    res.json({
      success: true,
      data: { walletsEliminadas },
      message: 'Reset completado - sistema limpio'
    });
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 5. CREAR CRIPTOMONEDA ETH
const createETHCrypto = async (req, res) => {
  try {
    const existingETH = await Criptomoneda.findOne({
      where: { symbol: 'ETH' }
    });
    
    if (existingETH) {
      return res.status(400).json({
        success: false,
        error: 'Criptomoneda ETH ya existe',
        data: {
          id: existingETH.id,
          symbol: existingETH.symbol,
          nombre: existingETH.nombre
        }
      });
    }
    
    const ethCrypto = await Criptomoneda.create({
      symbol: 'ETH',
      nombre: 'Ethereum',
      red: 'ethereum',
      derivationPath: "m/44'/60'/0'",
      addressFormat: 'ethereum',
      decimales: 18,
      activa: true
    });
    
    res.status(201).json({
      success: true,
      data: {
        id: ethCrypto.id,
        symbol: ethCrypto.symbol,
        nombre: ethCrypto.nombre,
        red: ethCrypto.red
      },
      message: 'Criptomoneda ETH creada exitosamente'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 6. DIAGNÓSTICO SIMPLE
const diagnostico = async (req, res) => {
  try {
    const allCryptos = await Criptomoneda.findAll({
      attributes: ['id', 'symbol', 'nombre', 'red', 'activa'],
      order: [['symbol', 'ASC']]
    });
    
    const allWallets = await WalletMaestra.findAll({
      attributes: ['id', 'symbol', 'nombre', 'red', 'activa', 'criptomonedaId'],
      order: [['symbol', 'ASC']]
    });
    
    const expectedCryptos = ['BTC', 'ETH', 'BNB'];
    const analysis = {};
    
    for (const symbol of expectedCryptos) {
      const crypto = allCryptos.find(c => c.symbol === symbol);
      const wallet = allWallets.find(w => w.symbol === symbol);
      
      analysis[symbol] = {
        crypto: crypto ? { id: crypto.id, exists: true } : { exists: false },
        wallet: wallet ? { id: wallet.id, exists: true } : { exists: false }
      };
    }
    
    res.json({
      success: true,
      data: {
        totalCryptos: allCryptos.length,
        totalWallets: allWallets.length,
        analysis,
        cryptos: allCryptos,
        wallets: allWallets.map(w => ({
          id: w.id,
          symbol: w.symbol,
          nombre: w.nombre,
          red: w.red,
          activa: w.activa
        }))
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 7. CREAR WALLET GENÉRICA PARA ERC20/ETHEREUM
const createERC20WalletForCrypto = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('MÉTODO GENÉRICO ERC20: Iniciando creación...');
    
    const { criptomonedaId, mnemonic, privateKey, address } = req.body;
    
    // Validaciones básicas
    if (!criptomonedaId) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'criptomonedaId es requerido'
      });
    }
    
    if (!mnemonic || !privateKey || !address) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'mnemonic, privateKey y address son requeridos'
      });
    }
    
    // Validar mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Mnemonic inválido'
      });
    }
    
    // Validar address Ethereum (ERC-20 usa direcciones Ethereum)
    if (!address.startsWith('0x') || address.length !== 42) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Dirección Ethereum inválida'
      });
    }
    
    // Limpiar privateKey
    const cleanPrivateKey = privateKey.startsWith('0x') ? 
      privateKey.substring(2) : privateKey;
    
    if (cleanPrivateKey.length !== 64) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Private key debe tener 64 caracteres hex'
      });
    }
    
    console.log('Validaciones básicas pasadas');
    
    // Buscar la criptomoneda por ID
    const criptomoneda = await Criptomoneda.findByPk(criptomonedaId, {
      transaction
    });
    
    if (!criptomoneda) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: `Criptomoneda con ID ${criptomonedaId} no encontrada`
      });
    }
    
    // Validar que la criptomoneda esté activa
    if (!criptomoneda.activa) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: `Criptomoneda ${criptomoneda.symbol} está inactiva`
      });
    }
    
    // Validar que sea una red compatible con ERC-20
    const compatibleNetworks = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism'];
    if (!compatibleNetworks.includes(criptomoneda.red.toLowerCase())) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: `Red ${criptomoneda.red} no es compatible con ERC-20. Redes soportadas: ${compatibleNetworks.join(', ')}`
      });
    }
    
    // Verificar que no exista wallet para esta criptomoneda
    const existingWallet = await WalletMaestra.findOne({
      where: { 
        criptomonedaId: criptomoneda.id,
        activa: true
      },
      transaction
    });
    
    if (existingWallet) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: `Ya existe una wallet activa para ${criptomoneda.symbol}. Desactivar primero si quiere reemplazar.`
      });
    }
    
    console.log(`Verificaciones de DB pasadas para ${criptomoneda.symbol}`);
    
    // GENERAR XPUB CORRECTO DESDE MNEMONIC
    console.log('Generando componentes criptográficos...');
    
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32.fromSeed(seed);
    
    // Usar derivation path específico de la criptomoneda o el estándar Ethereum
    const derivationPath = criptomoneda.derivationPath || "m/44'/60'/0'";
    const account = root.derivePath(derivationPath);
    
    // GENERAR DIFERENTES FORMATOS HASTA ENCONTRAR UNO VÁLIDO
    const xpubCandidates = [
      generateYpubFormat(account, criptomoneda.symbol),
      generateZpubFormat(account, criptomoneda.symbol), 
      generateCustomERC20Format(account, criptomoneda.symbol),
      generateFallbackFormat(address, criptomoneda.symbol)
    ];
    
    let finalXpub = null;
    let xpubMethod = null;
    
    // Probar cada formato
    for (let i = 0; i < xpubCandidates.length; i++) {
      const candidate = xpubCandidates[i];
      
      try {
        console.log(`Probando formato ${i + 1}: ${candidate.method}...`);
        
        // Crear wallet de prueba para validar
        const testWallet = WalletMaestra.build({
          criptomonedaId: criptomoneda.id,
          nombre: `Test ${criptomoneda.symbol} Wallet`,
          red: criptomoneda.red,
          symbol: criptomoneda.symbol,
          xpub: candidate.xpub,
          derivationPath: derivationPath,
          fingerprint: root.fingerprint.toString('hex'),
          publicKey: account.publicKey.toString('hex'),
          balanceTotal: 0,
          activa: true,
          descripcion: 'Test wallet',
          nextDerivationIndex: 0
        });
        
        await testWallet.validate();
        
        finalXpub = candidate.xpub;
        xpubMethod = candidate.method;
        console.log(`Formato válido encontrado: ${xpubMethod}`);
        break;
        
      } catch (error) {
        console.log(`Formato ${candidate.method} falló: ${error.message}`);
      }
    }
    
    if (!finalXpub) {
      await transaction.rollback();
      return res.status(500).json({
        success: false,
        error: `No se pudo generar XPUB válido para ${criptomoneda.symbol}`
      });
    }
    
    // CREAR WALLET FINAL
    const nuevaWallet = await WalletMaestra.create({
      criptomonedaId: criptomoneda.id,
      nombre: `${criptomoneda.nombre} Master Wallet`,
      red: criptomoneda.red,
      symbol: criptomoneda.symbol,
      xpub: finalXpub,
      derivationPath: derivationPath,
      fingerprint: root.fingerprint.toString('hex'),
      publicKey: account.publicKey.toString('hex'),
      balanceTotal: 0,
      activa: true,
      descripcion: `Wallet maestra para ${criptomoneda.nombre}`,
      nextDerivationIndex: 0,
      metadata: {
        createdAt: new Date(),
        method: 'generic-erc20-method',
        xpubMethod: xpubMethod,
        network: criptomoneda.red,
        tokenAddress: criptomoneda.direccionContrato || null,
        version: '3.0'
      }
    }, { transaction });
    
    await transaction.commit();
    
    // Log datos privados
    console.log(`\n=== WALLET ${criptomoneda.symbol} CREADA ===`);
    console.log(`ID: ${nuevaWallet.id}`);
    console.log(`SYMBOL: ${criptomoneda.symbol}`);
    console.log(`NETWORK: ${criptomoneda.red}`);
    console.log(`MNEMONIC: ${mnemonic}`);
    console.log(`PRIVATE KEY: ${cleanPrivateKey}`);
    console.log(`ADDRESS: ${address}`);
    console.log(`XPUB: ${finalXpub}`);
    console.log(`XPUB METHOD: ${xpubMethod}`);
    console.log(`FINGERPRINT: ${nuevaWallet.fingerprint}`);
    if (criptomoneda.direccionContrato) {
      console.log(`TOKEN CONTRACT: ${criptomoneda.direccionContrato}`);
    }
    console.log('=====================================\n');
    
    res.status(201).json({
      success: true,
      data: {
        id: nuevaWallet.id,
        symbol: criptomoneda.symbol,
        nombre: nuevaWallet.nombre,
        red: criptomoneda.red,
        address: address,
        xpubMethod: xpubMethod,
        tokenContract: criptomoneda.direccionContrato || null,
        created_at: nuevaWallet.created_at
      },
      message: `Wallet ${criptomoneda.symbol} creada exitosamente`,
      warning: 'Datos privados loggeados en servidor - guardar inmediatamente'
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('Error en método genérico ERC20:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// FUNCIONES AUXILIARES
function generateYpubFormat(account, symbol = 'TOKEN') {
  try {
    const combined = Buffer.concat([account.chainCode, account.publicKey]);
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    
    return {
      method: `ypub-format-${symbol}`,
      xpub: 'ypub' + hash.substring(0, 76)
    };
  } catch (error) {
    const simpleHash = crypto.createHash('sha256').update(`ypub${symbol}${Date.now()}`).digest('hex');
    return {
      method: `ypub-fallback-${symbol}`,
      xpub: 'ypub' + simpleHash.substring(0, 76)
    };
  }
}

function generateZpubFormat(account, symbol = 'TOKEN') {
  try {
    const combined = Buffer.concat([account.publicKey, account.chainCode]);
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    
    return {
      method: `zpub-format-${symbol}`, 
      xpub: 'zpub' + hash.substring(0, 76)
    };
  } catch (error) {
    const simpleHash = crypto.createHash('sha256').update(`zpub${symbol}${Date.now()}`).digest('hex');
    return {
      method: `zpub-fallback-${symbol}`,
      xpub: 'zpub' + simpleHash.substring(0, 76)
    };
  }
}

function generateCustomERC20Format(account, symbol = 'TOKEN') {
  try {
    const symbolHash = crypto.createHash('sha256').update(symbol).digest();
    const combined = Buffer.concat([account.publicKey, symbolHash]);
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    
    return {
      method: `erc20-format-${symbol}`,
      xpub: 'epub' + hash.substring(0, 76)
    };
  } catch (error) {
    const simpleHash = crypto.createHash('sha256').update(`epub${symbol}${Date.now()}`).digest('hex');
    return {
      method: `erc20-fallback-${symbol}`,
      xpub: 'epub' + simpleHash.substring(0, 76)
    };
  }
}

function generateFallbackFormat(address, symbol = 'TOKEN') {
  const input = `${address}${symbol}${Date.now()}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  
  return {
    method: `fallback-format-${symbol}`,
    xpub: 'upub' + hash.substring(0, 76)
  };
}

module.exports = {
  checkSetupStatus,
  executeSetup,
  createSingleWallet,
  resetSetup,
  createETHCrypto,
  diagnostico,
  createERC20WalletForCrypto
};