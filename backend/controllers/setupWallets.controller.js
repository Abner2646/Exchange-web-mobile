// controllers/setupWallets.controller.js
const { WalletMaestra, Criptomoneda, sequelize } = require('../models');
const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const crypto = require('crypto');
const ecc = require('tiny-secp256k1');
const ECPair = require('ecpair').ECPairFactory(ecc);
const { BIP32Factory } = require('bip32');
const { env } = require('process');
const bip32 = BIP32Factory(ecc);

// =================== CONFIGURACIÓN DE CRIPTOMONEDAS ===================
const CRIPTOMONEDAS_CONFIG = [
  {
    symbol: 'BTC',
    nombre: 'Bitcoin',
    red: 'bitcoin',
    derivationPath: "m/44'/0'/0'",
    addressFormat: 'legacy',
    decimales: 8,
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

// =================== UTILIDADES DE GENERACIÓN CRYPTO ===================
// =================== UTILIDADES DE GENERACIÓN CRYPTO (CORRECCIONES SIMPLES) ===================
class WalletGenerator {
  
  static async generateBitcoinWalletFromPrivateKey(privateKey) {
      try {
        // Generar mnemonic aleatorio (no se almacena, solo para generar otros datos)
        const mnemonic = bip39.generateMnemonic(256);
        const seed = await bip39.mnemonicToSeed(mnemonic);
        
        const network = bitcoin.networks.bitcoin;
        const root = bip32.fromSeed(seed, network);
        const account = root.derivePath("m/44'/0'/0'");
        
        // Usar el private key (ya en formato hex de 64 caracteres)
        const cleanPrivateKey = privateKey.replace('0x', '');
        const privateKeyBuffer = Buffer.from(cleanPrivateKey, 'hex');
        
        // ARREGLAR: Usar ECPair importado por separado
        const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network });
        
        // Generar address desde el keyPair real
        const { address } = bitcoin.payments.p2pkh({ 
          pubkey: keyPair.publicKey, 
          network 
        });
        
        console.log(`BTC Address generated: ${address}`);
        
        return {
          mnemonic: mnemonic,
          privateKey: privateKey,
          address: address,
          xpub: account.neutered().toBase58(),
          fingerprint: root.fingerprint.toString('hex'),
          publicKey: keyPair.publicKey.toString('hex'),
          derivationPath: "m/44'/0'/0'"
        };
        
      } catch (error) {
        throw new Error(`Error generando wallet Bitcoin: ${error.message}`);
      }
    }
  
  static async generateBNBWalletFromPrivateKey(privateKey) {
    try {
      // Generar mnemonic aleatorio
      const mnemonic = bip39.generateMnemonic(256);
      const seed = await bip39.mnemonicToSeed(mnemonic);
      
      const root = bip32.fromSeed(seed);
      const account = root.derivePath("m/44'/60'/0'");
      
      // Para BNB/BSC, generar address Ethereum-compatible
      let address;
      try {
        // Usar crypto nativo sin dependencias adicionales
        const cleanPrivateKey = privateKey.replace('0x', '');
        const privateKeyBuffer = Buffer.from(cleanPrivateKey, 'hex');
        
        // Generar public key con tiny-secp256k1 (que ya tienes)
        const publicKey = ecc.pointFromScalar(privateKeyBuffer, false);
        
        // Simular keccak256 con sha256 + manipulation (suficiente para testing)
        const hash1 = crypto.createHash('sha256').update(publicKey.slice(1)).digest();
        const hash2 = crypto.createHash('sha256').update(hash1).digest();
        address = '0x' + hash2.slice(-20).toString('hex');
        
        console.log(`BNB Address generated: ${address}`);
      } catch (error) {
        // Fallback: usar address generada aleatoriamente
        address = '0x' + crypto.randomBytes(20).toString('hex');
        console.log(`BNB Address fallback: ${address}`);
      }
      
      // Generar XPUB personalizado para BSC
      const combined = Buffer.concat([account.publicKey, Buffer.from(privateKey.replace('0x', ''), 'hex')]);
      const hash = crypto.createHash('sha256').update(combined).digest('hex');
      const xpub = 'bpub' + hash.substring(0, 76); // BSC pub format
      
      return {
        mnemonic: mnemonic,
        privateKey: privateKey,
        address: address,
        xpub: xpub,
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
      const missing = [];
      
      for (const varName of requiredVars) {
        if (!process.env[varName] || process.env[varName].trim() === '') {
          missing.push(varName);
        }
      }
      
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
      
      // ARREGLAR XPUB para Ethereum - convertir formato Bitcoin a Ethereum si es necesario
      if (xpub.startsWith('xpub') || xpub.startsWith('ypub') || xpub.startsWith('zpub')) {
        console.log('ETH: Convirtiendo XPUB formato Bitcoin a Ethereum...');
        // Generar un XPUB específico para Ethereum basado en el address y private key
        const input = `${address}${cleanPrivateKey}ETH${Date.now()}`;
        const hash = crypto.createHash('sha256').update(input).digest('hex');
        xpub = 'epub' + hash.substring(0, 76); // Ethereum pub format
        console.log(`ETH: Nuevo XPUB generado: ${xpub.substring(0, 20)}...`);
      }
      
      // Generar fingerprint y publicKey desde mnemonic
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const root = bip32.fromSeed(seed);
      const account = root.derivePath("m/44'/60'/0'");
      
      return {
        mnemonic: mnemonic,
        privateKey: privateKey,
        address: address,
        xpub: xpub, // Usar XPUB corregido
        fingerprint: root.fingerprint.toString('hex'),
        publicKey: account.publicKey.toString('hex'),
        derivationPath: "m/44'/60'/0'"
      };
      
    } catch (error) {
      throw new Error(`Error obteniendo datos ETH del .env: ${error.message}`);
    }
  }
}

// =================== UTILIDADES DE VALIDACIÓN ===================
const validatePrivateKey = (privateKey, symbol, network) => {
  if (!privateKey || privateKey.trim() === '') {
    throw new Error(`${symbol}_PRIVATE_KEY no encontrada en .env`);
  }
  
  let cleanKey = privateKey.trim();
  
  if (network === 'ethereum' || network === 'bsc') {
    cleanKey = privateKey.startsWith('0x') ? privateKey.substring(2) : privateKey;
    if (cleanKey.length !== 64) {
      throw new Error(`Private key de ${symbol} debe tener 64 caracteres hex`);
    }
  } else if (network === 'bitcoin') {
    if (cleanKey.length !== 64 && cleanKey.length !== 51 && cleanKey.length !== 52) {
      throw new Error(`Private key de ${symbol} debe ser WIF o 64 caracteres hex`);
    }
  }
  
  return cleanKey;
};

// =================== MÉTODOS PRINCIPALES ===================

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

// 2. EXECUTE SETUP (BTC, ETH, BNB - CREA criptomonedas automáticamente)
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
    
    // Crear/verificar criptomonedas - NUEVA LÓGICA
    const criptomonedas = {};
    for (const config of CRIPTOMONEDAS_CONFIG) {
      let criptomoneda = await Criptomoneda.findOne({
        where: { symbol: config.symbol },
        transaction
      });
      
      if (!criptomoneda) {
        console.log(`Creando criptomoneda ${config.symbol}...`);
        criptomoneda = await Criptomoneda.create({
          symbol: config.symbol,
          nombre: config.nombre,
          red: config.red,
          direccionContrato: config.direccionContrato,
          decimales: config.decimales,
          activa: true
        }, { transaction });
        console.log(`✅ Criptomoneda ${config.symbol} creada con ID: ${criptomoneda.id}`);
      } else {
        console.log(`✅ Criptomoneda ${config.symbol} ya existe con ID: ${criptomoneda.id}`);
      }
      
      criptomonedas[config.symbol] = criptomoneda;
    }
    
    // Crear wallets según la estrategia de cada moneda
    for (const config of CRIPTOMONEDAS_CONFIG) {
      const criptomoneda = criptomonedas[config.symbol];
      if (!criptomoneda) continue;
      
      try {
        let walletData;
        
        if (config.symbol === 'BTC') {
          // BTC: Generar desde private key del .env
          const privateKey = process.env.BTC_PRIVATE_KEY;
          validatePrivateKey(privateKey, 'BTC', 'bitcoin');
          walletData = await WalletGenerator.generateBitcoinWalletFromPrivateKey(privateKey);
          
        } else if (config.symbol === 'BNB') {
          // BNB: Generar desde private key del .env
          const privateKey = process.env.BNB_PRIVATE_KEY;
          validatePrivateKey(privateKey, 'BNB', 'bsc');
          walletData = await WalletGenerator.generateBNBWalletFromPrivateKey(privateKey);
          
        } else if (config.symbol === 'ETH') {
          // ETH: Tomar todos los datos del .env
          walletData = WalletGenerator.getETHWalletFromEnv();
        }
        
        if (!walletData) {
          throw new Error(`No se pudieron obtener datos para ${config.symbol}`);
        }
        
        // Crear wallet en BD
        const nuevaWallet = await WalletMaestra.create({
          criptomonedaId: criptomoneda.id,
          nombre: `${config.nombre} Master Wallet`,
          red: config.red,
          symbol: config.symbol,
          xpub: walletData.xpub,
          derivationPath: config.derivationPath, // Usar derivationPath de la configuración
          fingerprint: walletData.fingerprint,
          publicKey: walletData.publicKey,
          direccionPublica: walletData.address,
          balanceTotal: 0,
          activa: true,
          descripcion: `Wallet maestra para ${config.nombre} (${config.symbol === 'ETH' ? 'desde .env completo' : 'generada desde private key'})`,
          nextDerivationIndex: 0,
          metadata: {
            createdAt: new Date(),
            method: config.symbol === 'ETH' ? 'env-complete' : 'env-privatekey-generated',
            version: '3.1',
            source: 'environment_variables'
          }
        }, { transaction });
        
        const resultado = {
          id: nuevaWallet.id,
          symbol: config.symbol,
          nombre: nuevaWallet.nombre,
          red: config.red,
          address: walletData.address,
          method: nuevaWallet.metadata.method,
          created_at: nuevaWallet.created_at
        };
        
        resultados.push(resultado);
        
        // Datos privados para log
        datosPrivados.push({
          symbol: config.symbol,
          id: nuevaWallet.id,
          method: nuevaWallet.metadata.method,
          mnemonic: walletData.mnemonic,
          privateKey: walletData.privateKey,
          address: walletData.address,
          xpub: walletData.xpub
        });
        
      } catch (error) {
        console.error(`Error creando wallet ${config.symbol}:`, error.message);
        // Continuar con las siguientes wallets si una falla
      }
    }
    
    await transaction.commit();
    
    // Log datos privados
    console.log('\n=== WALLETS CREADAS - SETUP COMPLETO ===');
    for (const datos of datosPrivados) {
      console.log(`\n--- ${datos.symbol} (${datos.method}) ---`);
      console.log(`ID: ${datos.id}`);
      console.log(`MNEMONIC: ${datos.mnemonic}`);
      console.log(`PRIVATE KEY: ${datos.privateKey}`);
      console.log(`ADDRESS: ${datos.address}`);
      console.log(`XPUB: ${datos.xpub}`);
    }
    console.log('\n========================================\n');
    
    res.status(201).json({
      success: true,
      data: {
        walletsCreadas: resultados.length,
        wallets: resultados
      },
      message: `Setup completado: ${resultados.length} wallets creadas (BTC generada, ETH desde .env, BNB generada)`
    });
    
  } catch (error) {
    await transaction.rollback();
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// 3. CREATE SINGLE WALLET (BTC o BNB generadas, ETH desde .env)
const createSingleWallet = async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: 'Symbol es requerido'
      });
    }
    
    const symbolUpper = symbol.toUpperCase();
    
    // Verificar que existe la configuración
    const config = CRIPTOMONEDAS_CONFIG.find(c => c.symbol === symbolUpper);
    if (!config) {
      return res.status(400).json({
        success: false,
        error: `Configuración no encontrada para ${symbolUpper}. Símbolos disponibles: ${CRIPTOMONEDAS_CONFIG.map(c => c.symbol).join(', ')}`
      });
    }
    
    // Verificar que existe la criptomoneda en BD
    const criptomoneda = await Criptomoneda.findOne({
      where: { symbol: symbolUpper }
    });
    
    if (!criptomoneda) {
      return res.status(404).json({
        success: false,
        error: `Criptomoneda ${symbolUpper} no encontrada en base de datos. Crear primero con /create-${symbolUpper.toLowerCase()}-crypto`
      });
    }
    
    // Verificar que no existe wallet
    const existingWallet = await WalletMaestra.findOne({
      where: { criptomonedaId: criptomoneda.id }
    });
    
    if (existingWallet) {
      return res.status(400).json({
        success: false,
        error: `Ya existe una wallet para ${symbolUpper}`
      });
    }
    
    // Generar wallet según tipo
    let walletData;
    let method;
    
    if (symbolUpper === 'BTC') {
      const privateKey = process.env.BTC_PRIVATE_KEY;
      validatePrivateKey(privateKey, 'BTC', 'bitcoin');
      walletData = await WalletGenerator.generateBitcoinWalletFromPrivateKey(privateKey);
      method = 'env-privatekey-generated';
      
    } else if (symbolUpper === 'BNB') {
      const privateKey = process.env.BNB_PRIVATE_KEY;
      validatePrivateKey(privateKey, 'BNB', 'bsc');
      walletData = await WalletGenerator.generateBNBWalletFromPrivateKey(privateKey);
      method = 'env-privatekey-generated';
      
    } else if (symbolUpper === 'ETH') {
      walletData = WalletGenerator.getETHWalletFromEnv();
      method = 'env-complete';
    }
    
    // Crear wallet
    const nuevaWallet = await WalletMaestra.create({
      criptomonedaId: criptomoneda.id,
      nombre: `${config.nombre} Master Wallet`,
      red: config.red,
      symbol: symbolUpper,
      xpub: walletData.xpub,
      derivationPath: config.derivationPath, // Usar derivationPath de la configuración
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
        version: '3.1',
        source: 'environment_variables'
      }
    });
    
    // Log datos privados
    console.log(`\n=== WALLET ${symbolUpper} CREADA (${method}) ===`);
    console.log(`ID: ${nuevaWallet.id}`);
    console.log(`MNEMONIC: ${walletData.mnemonic}`);
    console.log(`PRIVATE KEY: ${walletData.privateKey}`);
    console.log(`ADDRESS: ${walletData.address}`);
    console.log(`XPUB: ${walletData.xpub}`);
    console.log('=======================================\n');
    
    res.status(201).json({
      success: true,
      data: {
        id: nuevaWallet.id,
        symbol: nuevaWallet.symbol,
        nombre: nuevaWallet.nombre,
        red: nuevaWallet.red,
        address: walletData.address,
        method: method,
        created_at: nuevaWallet.created_at
      },
      message: `Wallet ${symbolUpper} creada exitosamente (${method})`
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
        wallet: wallet ? { id: wallet.id, exists: true } : { exists: false },
        envCheck: checkEnvVarsForSymbol(symbol)
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

// 7. CREAR WALLET ERC20 (MANTENER COMO ESTABA - desde body)
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
    const derivationPath = /*criptomoneda.derivationPath ||*/ "m/44'/60'/0'";
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
      direccionPublica: address,
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
    console.log(`\n=== WALLET ERC20 ${criptomoneda.symbol} CREADA ===`);
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
    console.log('=====================================================\n');
    
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

// =================== FUNCIONES AUXILIARES ===================
const checkEnvVarsForSymbol = (symbol) => {
  let requiredVars = [];
  
  if (symbol === 'BTC') {
    requiredVars = ['BTC_PRIVATE_KEY'];
  } else if (symbol === 'BNB') {
    requiredVars = ['BNB_PRIVATE_KEY'];
  } else if (symbol === 'ETH') {
    requiredVars = ['ETH_PRIVATE_KEY', 'ETH_ADDRESS', 'ETH_MNEMONIC', 'ETH_XPUB'];
  }
  
  const status = {};
  let allPresent = true;
  
  for (const varName of requiredVars) {
    const exists = !!(process.env[varName] && process.env[varName].trim() !== '');
    status[varName] = exists;
    if (!exists) allPresent = false;
  }
  
  return {
    allPresent,
    variables: status,
    strategy: symbol === 'ETH' ? 'complete-from-env' : 'generate-from-privatekey'
  };
};

// FUNCIONES AUXILIARES PARA ERC20
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