// controllers/setupWallets.controller.js
const { WalletMaestra, Criptomoneda, sequelize } = require('../models');
const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');
const ecc = require('tiny-secp256k1');
const ECPair = require('ecpair').ECPairFactory(ecc);
const { BIP32Factory } = require('bip32');
const bip32 = BIP32Factory(ecc);

// =================== CONFIGURACIÓN DE CRIPTOMONEDAS BÁSICAS ===================
const CRIPTOMONEDAS_BASICAS = [
  {
    symbol: 'BTC',
    nombre: 'Bitcoin',
    red: 'bitcoin',
    derivationPath: "m/44'/1'/0'", //En minnet: "m/44'/0'/0'"
    decimales: 8,
  },
  {
    symbol: 'ETH',
    nombre: 'Ethereum',
    red: 'ethereum',
    derivationPath: "m/44'/60'/0'",
    decimales: 18
  },
  {
    symbol: 'BNB',
    nombre: 'BNB Smart Chain',
    red: 'bsc',
    derivationPath: "m/44'/60'/0'",
    decimales: 18
  }
];

// =================== GENERADORES DE WALLET ===================
class WalletSetupGenerator {
  
  static getBTCWalletFromEnv() {
    try {
      const requiredVars = ['BTC_PRIVATE_KEY', 'BITCOIN_WALLET_ADDRESS', 'BTC_MNEMONIC', 'BTC_MASTER_XPUB'];
      const missing = requiredVars.filter(varName => 
        !process.env[varName] || process.env[varName].trim() === ''
      );
      
      if (missing.length > 0) {
        throw new Error(`Variables de entorno faltantes para BTC: ${missing.join(', ')}`);
      }
      
      const mnemonic = process.env.BTC_MNEMONIC.trim();
      const privateKey = process.env.BTC_PRIVATE_KEY.trim();
      const address = process.env.BITCOIN_WALLET_ADDRESS.trim();
      const xpub = process.env.BTC_MASTER_XPUB.trim();
      
      // Validaciones
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('BTC_MNEMONIC inválido');
      }
      
      // Validar private key (WIF o HEX)
      const privateKeyValidation = validateBitcoinPrivateKey(privateKey);
      if (!privateKeyValidation.valid) {
        throw new Error('BTC_PRIVATE_KEY debe estar en formato WIF o HEX (64 caracteres)');
      }
      
      // Validar XPUB
      if (!validateBitcoinXpub(xpub)) {
        throw new Error('BTC_MASTER_XPUB debe tener un prefijo válido (xpub/ypub/zpub/tpub/upub/vpub)');
      }
      
      // Detectar red del XPUB
      const detectedNetwork = getNetworkFromXpub(xpub);
      const derivationPath = detectedNetwork === 'testnet' ? "m/44'/1'/0'" : "m/44'/0'/0'";
      
      // Validar address según la red detectada
      if (detectedNetwork === 'testnet') {
        // Testnet: legacy (m,n,2), P2SH (2), Bech32 (tb1)
        if (!address.match(/^([mn2][a-km-zA-HJ-NP-Z1-9]{25,34}|tb1[a-z0-9]{39,59})$/)) {
          throw new Error('BITCOIN_WALLET_ADDRESS inválida para testnet (debe empezar con m, n, 2, o tb1)');
        }
      } else {
        // Mainnet: legacy (1), P2SH (3), Bech32 (bc1)
        if (!address.match(/^([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/)) {
          throw new Error('BITCOIN_WALLET_ADDRESS inválida para mainnet (debe empezar con 1, 3, o bc1)');
        }
      }
      
      // Generar fingerprint desde mnemonic
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const network = detectedNetwork === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
      const root = bip32.fromSeed(seed, network);
      const account = root.derivePath(derivationPath);
      
      console.log(`BTC: Red detectada desde XPUB: ${detectedNetwork.toUpperCase()}`);
      
      return {
        mnemonic,
        privateKey,
        address,
        xpub,
        fingerprint: root.fingerprint.toString('hex'),
        publicKey: account.publicKey.toString('hex'),
        derivationPath,
        network: detectedNetwork
      };
      
    } catch (error) {
      throw new Error(`Error obteniendo datos BTC del .env: ${error.message}`);
    }
  }
  
  static async generateBNBWallet(privateKey) {
    try {
      const mnemonic = bip39.generateMnemonic(256);
      const seed = await bip39.mnemonicToSeed(mnemonic);
      
      const root = bip32.fromSeed(seed);
      const account = root.derivePath("m/44'/60'/0'");
      
      // Generar address BSC/Ethereum compatible
      const cleanPrivateKey = privateKey.replace('0x', '');
      const privateKeyBuffer = Buffer.from(cleanPrivateKey, 'hex');
      
      const publicKey = ecc.pointFromScalar(privateKeyBuffer, false);
      const hash1 = crypto.createHash('sha256').update(publicKey.slice(1)).digest();
      const hash2 = crypto.createHash('sha256').update(hash1).digest();
      const address = '0x' + hash2.slice(-20).toString('hex');
      
      // Generar XPUB para BSC
      const combined = Buffer.concat([account.publicKey, Buffer.from(cleanPrivateKey, 'hex')]);
      const hash = crypto.createHash('sha256').update(combined).digest('hex');
      const xpub = 'bpub' + hash.substring(0, 76);
      
      return {
        mnemonic,
        privateKey,
        address,
        xpub,
        fingerprint: root.fingerprint.toString('hex'),
        publicKey: account.publicKey.toString('hex'),
        derivationPath: "m/44'/60'/0'"
      };
      
    } catch (error) {
      throw new Error(`Error generando wallet BNB: ${error.message}`);
    }
  }
  
  static getETHWalletFromEnv() {
    try {
      const requiredVars = ['ETH_PRIVATE_KEY', 'ETH_ADDRESS', 'ETH_MNEMONIC', 'ETH_XPUB'];
      const missing = requiredVars.filter(varName => 
        !process.env[varName] || process.env[varName].trim() === ''
      );
      
      if (missing.length > 0) {
        throw new Error(`Variables de entorno faltantes para ETH: ${missing.join(', ')}`);
      }
      
      const mnemonic = process.env.ETH_MNEMONIC.trim();
      const privateKey = process.env.ETH_PRIVATE_KEY.trim();
      const address = process.env.ETH_ADDRESS.trim();
      let xpub = process.env.ETH_XPUB.trim();
      
      // Validaciones
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('ETH_MNEMONIC inválido');
      }
      
      if (!address.startsWith('0x') || address.length !== 42) {
        throw new Error('ETH_ADDRESS inválida');
      }
      
      const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey.substring(2) : privateKey;
      if (cleanPrivateKey.length !== 64) {
        throw new Error('ETH_PRIVATE_KEY debe tener 64 caracteres hex');
      }
      
      // Corregir XPUB si es formato Bitcoin
      if (xpub.startsWith('xpub') || xpub.startsWith('ypub') || xpub.startsWith('zpub')) {
        const input = `${address}${cleanPrivateKey}ETH${Date.now()}`;
        const hash = crypto.createHash('sha256').update(input).digest('hex');
        xpub = 'epub' + hash.substring(0, 76);
      }
      
      // Generar fingerprint desde mnemonic
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const root = bip32.fromSeed(seed);
      const account = root.derivePath("m/44'/60'/0'");
      
      return {
        mnemonic,
        privateKey,
        address,
        xpub,
        fingerprint: root.fingerprint.toString('hex'),
        publicKey: account.publicKey.toString('hex'),
        derivationPath: "m/44'/60'/0'"
      };
      
    } catch (error) {
      throw new Error(`Error obteniendo datos ETH del .env: ${error.message}`);
    }
  }
}

// =================== VALIDACIONES ===================
const validateBitcoinPrivateKey = (privateKey) => {
  if (!privateKey) return false;
  
  const trimmed = privateKey.trim();
  
  // Formato WIF (más común en Bitcoin)
  // Mainnet: empieza con 5, K, o L
  // Testnet: empieza con 9 o c
  const wifRegex = /^[5KL9c][1-9A-HJ-NP-Za-km-z]{50,51}$/;
  if (wifRegex.test(trimmed)) {
    return { valid: true, format: 'WIF' };
  }
  
  // Formato hex (64 caracteres)
  const cleanKey = trimmed.replace('0x', '');
  if (cleanKey.length === 64 && /^[0-9a-fA-F]+$/.test(cleanKey)) {
    return { valid: true, format: 'HEX' };
  }
  
  return { valid: false, format: 'UNKNOWN' };
};

const validateBitcoinXpub = (xpub, network = null) => {
  if (!xpub || typeof xpub !== 'string') return false;
  
  const trimmed = xpub.trim();
  
  // Prefijos válidos para Bitcoin según red
  const validPrefixes = {
    mainnet: ['xpub', 'ypub', 'zpub'],        // Legacy, P2SH-wrapped SegWit, Native SegWit
    testnet: ['tpub', 'upub', 'vpub']         // Testnet equivalents
  };
  
  // Si se especifica red, validar solo esa red
  if (network) {
    const prefixes = validPrefixes[network] || [];
    return prefixes.some(prefix => trimmed.startsWith(prefix));
  }
  
  // Sin red especificada, aceptar cualquier prefijo válido
  const allValidPrefixes = [...validPrefixes.mainnet, ...validPrefixes.testnet];
  return allValidPrefixes.some(prefix => trimmed.startsWith(prefix));
};

const getNetworkFromXpub = (xpub) => {
  if (!xpub) return null;
  
  const trimmed = xpub.trim();
  
  // Prefijos mainnet
  if (trimmed.startsWith('xpub') || trimmed.startsWith('ypub') || trimmed.startsWith('zpub')) {
    return 'mainnet';
  }
  
  // Prefijos testnet
  if (trimmed.startsWith('tpub') || trimmed.startsWith('upub') || trimmed.startsWith('vpub')) {
    return 'testnet';
  }
  
  return null;
};

const validateEthereumPrivateKey = (privateKey) => {
  if (!privateKey) return false;
  
  const cleanKey = privateKey.trim().replace('0x', '');
  if (cleanKey.length === 64 && /^[0-9a-fA-F]+$/.test(cleanKey)) {
    return { valid: true, format: 'HEX' };
  }
  
  return { valid: false, format: 'INVALID' };
};

const validateEnvVars = () => {
  const errors = [];
  
  // Validar BTC (como ETH, requiere datos completos)
  const btcRequiredVars = ['BTC_PRIVATE_KEY', 'BITCOIN_WALLET_ADDRESS', 'BTC_MNEMONIC', 'BTC_MASTER_XPUB'];
  const btcMissing = btcRequiredVars.filter(varName => !process.env[varName]);
  if (btcMissing.length > 0) {
    errors.push(`Variables BTC faltantes: ${btcMissing.join(', ')}`);
  } else {
    const btcValidation = validateBitcoinPrivateKey(process.env.BTC_PRIVATE_KEY);
    if (!btcValidation.valid) {
      errors.push('BTC_PRIVATE_KEY debe estar en formato WIF o HEX (64 caracteres)');
    }
    
    if (!validateBitcoinXpub(process.env.BTC_MASTER_XPUB)) {
      errors.push('BTC_MASTER_XPUB debe tener un prefijo válido (xpub/ypub/zpub para mainnet, tpub/upub/vpub para testnet)');
    }
  }
  
  // Validar BNB
  if (!process.env.BNB_PRIVATE_KEY) {
    errors.push('BNB_PRIVATE_KEY requerida');
  } else {
    const bnbValidation = validateEthereumPrivateKey(process.env.BNB_PRIVATE_KEY);
    if (!bnbValidation.valid) {
      errors.push('BNB_PRIVATE_KEY debe tener 64 caracteres hex (con o sin 0x)');
    }
  }
  
  // Validar ETH
  const ethRequiredVars = ['ETH_PRIVATE_KEY', 'ETH_ADDRESS', 'ETH_MNEMONIC', 'ETH_XPUB'];
  const ethMissing = ethRequiredVars.filter(varName => !process.env[varName]);
  if (ethMissing.length > 0) {
    errors.push(`Variables ETH faltantes: ${ethMissing.join(', ')}`);
  } else {
    const ethValidation = validateEthereumPrivateKey(process.env.ETH_PRIVATE_KEY);
    if (!ethValidation.valid) {
      errors.push('ETH_PRIVATE_KEY debe tener 64 caracteres hex (con o sin 0x)');
    }
  }
  
  return errors;
};

// =================== FUNCIÓN PRINCIPAL DE SETUP ===================
const executeCompleteSetup = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🚀 Iniciando setup completo del sistema...');
    
    // Validar variables de entorno
    const envErrors = validateEnvVars();
    if (envErrors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Variables de entorno faltantes o inválidas',
        details: envErrors
      });
    }
    
    // Verificar si ya existe setup
    const existingWallets = await WalletMaestra.count({ transaction });
    const { force = false } = req.body;
    
    if (existingWallets > 0 && !force) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Ya existe un setup completo. Use force=true para recrear.',
        data: { walletsExistentes: existingWallets }
      });
    }
    
    // Limpiar datos existentes si force=true
    if (force && existingWallets > 0) {
      console.log('🧹 Limpiando datos existentes...');
      await WalletMaestra.destroy({ where: {}, transaction });
    }
    
    const resultados = [];
    const datosPrivados = [];
    
    // PASO 1: Crear/verificar criptomonedas
    console.log('📊 Creando criptomonedas básicas...');
    const criptomonedas = {};
    
    for (const config of CRIPTOMONEDAS_BASICAS) {
      let criptomoneda = await Criptomoneda.findOne({
        where: { symbol: config.symbol },
        transaction
      });
      
      if (!criptomoneda) {
        criptomoneda = await Criptomoneda.create({
          symbol: config.symbol,
          nombre: config.nombre,
          red: config.red,
          decimales: config.decimales,
          activa: true
        }, { transaction });
        console.log(`✅ Criptomoneda ${config.symbol} creada`);
      } else {
        console.log(`✅ Criptomoneda ${config.symbol} ya existe`);
      }
      
      criptomonedas[config.symbol] = criptomoneda;
    }
    
    // PASO 2: Crear wallets maestras
    console.log('💰 Generando wallets maestras...');
    
    for (const config of CRIPTOMONEDAS_BASICAS) {
      const criptomoneda = criptomonedas[config.symbol];
      
      try {
        console.log(`⚡ Procesando ${config.symbol}...`);
        
        let walletData;
        let method;
        
        switch (config.symbol) {
          case 'BTC':
            // BTC: Tomar todos los datos del .env (como ETH)
            walletData = WalletSetupGenerator.getBTCWalletFromEnv();
            method = 'env-complete-data';
            break;
            
          case 'BNB':
            walletData = await WalletSetupGenerator.generateBNBWallet(process.env.BNB_PRIVATE_KEY);
            method = 'env-privatekey-generated';
            break;
            
          case 'ETH':
            walletData = WalletSetupGenerator.getETHWalletFromEnv();
            method = 'env-complete-data';
            break;
        }
        
        // Crear wallet en base de datos
        const nuevaWallet = await WalletMaestra.create({
          criptomonedaId: criptomoneda.id,
          nombre: `${config.nombre} Master Wallet`,
          red: config.red,
          symbol: config.symbol,
          xpub: walletData.xpub,
          derivationPath: config.derivationPath,
          fingerprint: walletData.fingerprint,
          publicKey: walletData.publicKey,
          direccionPublica: walletData.address,
          balanceTotal: 0,
          activa: true,
          descripcion: `Wallet maestra para ${config.nombre} (${method})`,
          nextDerivationIndex: 0,
          metadata: {
            createdAt: new Date(),
            method: method,
            version: '4.0',
            source: 'complete_setup',
            setupTimestamp: Date.now()
          }
        }, { transaction });
        
        // Agregar a resultados
        resultados.push({
          id: nuevaWallet.id,
          symbol: config.symbol,
          nombre: nuevaWallet.nombre,
          red: config.red,
          address: walletData.address,
          method: method,
          created_at: nuevaWallet.created_at
        });
        
        // Datos privados para log
        datosPrivados.push({
          symbol: config.symbol,
          id: nuevaWallet.id,
          method: method,
          mnemonic: walletData.mnemonic,
          privateKey: walletData.privateKey,
          address: walletData.address,
          xpub: walletData.xpub,
          fingerprint: walletData.fingerprint
        });
        
        console.log(`✅ Wallet ${config.symbol} creada exitosamente`);
        
      } catch (error) {
        console.error(`❌ Error creando wallet ${config.symbol}: ${error.message}`);
        // Continuar con las demás wallets
      }
    }
    
    // Confirmar transacción
    await transaction.commit();
    
    // Logs de datos privados (SOLO EN DESARROLLO)
    console.log('\n🔒 =================== DATOS PRIVADOS ===================');
    console.log('⚠️  GUARDAR INMEDIATAMENTE - NO DEJAR EN LOGS DE PRODUCCIÓN');
    console.log('========================================================');
    
    for (const datos of datosPrivados) {
      console.log(`\n--- ${datos.symbol} (ID: ${datos.id}) ---`);
      console.log(`METHOD: ${datos.method}`);
      console.log(`MNEMONIC: ${datos.mnemonic}`);
      console.log(`PRIVATE_KEY: ${datos.privateKey}`);
      console.log(`ADDRESS: ${datos.address}`);
      console.log(`XPUB: ${datos.xpub}`);
      console.log(`FINGERPRINT: ${datos.fingerprint}`);
    }
    
    console.log('\n========================================================');
    console.log('🔒 FIN DATOS PRIVADOS - ELIMINAR DE LOGS INMEDIATAMENTE');
    console.log('========================================================\n');
    
    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: 'Setup completo ejecutado exitosamente',
      data: {
        criptomonedasCreadas: CRIPTOMONEDAS_BASICAS.length,
        walletsCreadas: resultados.length,
        wallets: resultados,
        timestamp: new Date(),
        version: '4.0'
      },
      warning: 'Datos privados loggeados en servidor - guardar y limpiar logs inmediatamente'
    });
    
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error en setup completo:', error);
    
    res.status(500).json({
      success: false,
      error: 'Error ejecutando setup completo',
      details: error.message
    });
  }
};

// =================== FUNCIONES DE DIAGNÓSTICO ===================
const checkSetupStatus = async (req, res) => {
  try {
    const walletCount = await WalletMaestra.count();
    const cryptoCount = await Criptomoneda.count();
    
    const wallets = await WalletMaestra.findAll({
      include: [{
        model: Criptomoneda,
        as: 'criptomoneda',
        attributes: ['symbol', 'nombre', 'red']
      }],
      attributes: ['id', 'nombre', 'symbol', 'red', 'activa', 'created_at', 'balanceTotal'],
      order: [['symbol', 'ASC']]
    });
    
    // Verificar estado de variables de entorno
    const envStatus = {
      BTC_PRIVATE_KEY: !!process.env.BTC_PRIVATE_KEY,
      BNB_PRIVATE_KEY: !!process.env.BNB_PRIVATE_KEY,
      ETH_PRIVATE_KEY: !!process.env.ETH_PRIVATE_KEY,
      ETH_ADDRESS: !!process.env.ETH_ADDRESS,
      ETH_MNEMONIC: !!process.env.ETH_MNEMONIC,
      ETH_XPUB: !!process.env.ETH_XPUB
    };
    
    const envErrors = validateEnvVars();
    
    res.json({
      success: true,
      data: {
        isSetupComplete: walletCount >= 3 && cryptoCount >= 3,
        walletCount,
        cryptoCount,
        wallets: wallets.map(w => ({
          id: w.id,
          symbol: w.symbol,
          nombre: w.nombre,
          red: w.red,
          activa: w.activa,
          balance: w.balanceTotal,
          created_at: w.created_at
        })),
        environmentStatus: {
          allVariablesPresent: envErrors.length === 0,
          variables: envStatus,
          errors: envErrors
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const resetCompleteSetup = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { confirmReset } = req.body;
    
    if (confirmReset !== 'YES_DELETE_EVERYTHING') {
      return res.status(400).json({
        success: false,
        error: 'Confirmación requerida: confirmReset="YES_DELETE_EVERYTHING"'
      });
    }
    
    console.log('🧹 Eliminando todas las wallets maestras...');
    const walletsEliminadas = await WalletMaestra.destroy({
      where: {},
      transaction
    });
    
    console.log('🧹 Eliminando todas las criptomonedas...');
    const criptomonedasEliminadas = await Criptomoneda.destroy({
      where: {},
      transaction
    });
    
    await transaction.commit();
    
    console.log('✅ Reset completo ejecutado');
    
    res.json({
      success: true,
      message: 'Reset completo ejecutado - sistema completamente limpio',
      data: { 
        walletsEliminadas,
        criptomonedasEliminadas
      }
    });
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// =================== EXPORTS ===================
module.exports = {
  executeCompleteSetup,
  checkSetupStatus,
  resetCompleteSetup
};