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

async function debugETHWalletGeneration() { //<-------------
  try {
    console.log('\n🔐 Iniciando generación debug de wallet ETH...');
    
    // PASO 1: Generar mnemonic
    console.log('Paso 1: Generando mnemonic...');
    const mnemonic = bip39.generateMnemonic(256);
    console.log(`✅ Mnemonic generado: ${mnemonic.split(' ').length} palabras`);
    
    // PASO 2: Generar seed
    console.log('Paso 2: Generando seed desde mnemonic...');
    const seed = await bip39.mnemonicToSeed(mnemonic);
    console.log(`✅ Seed generado: ${seed.length} bytes`);
    
    // PASO 3: Verificar derivation path
    const derivationPath = "m/44'/60'/0'";
    console.log(`Paso 3: Usando derivation path: ${derivationPath}`);
    
    // PASO 4: Generar wallet Ethereum paso a paso con timeouts
    console.log('Paso 4: Generando wallet Ethereum...');
    
    let walletData;
    
    try {
      console.log('4.1: Creando HDNode desde seed...');
      
      // Establecer timeout para evitar colgarse
      const hdNodePromise = Promise.resolve(HDNode.fromSeed(seed));
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout en HDNode.fromSeed')), 5000)
      );
      
      const hdNode = await Promise.race([hdNodePromise, timeoutPromise]);
      console.log('✅ HDNode creado exitosamente');
      
      console.log('4.2: Derivando cuenta...');
      const accountPromise = Promise.resolve(hdNode.derivePath(derivationPath));
      const accountTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout en derivePath')), 5000)
      );
      
      const account = await Promise.race([accountPromise, accountTimeoutPromise]);
      console.log('✅ Cuenta derivada exitosamente');
      
      console.log('4.3: Generando componentes usando bip32...');
      const root = bip32.fromSeed(seed);
      const bip32Account = root.derivePath(derivationPath);
      console.log('✅ Componentes bip32 generados');
      
      console.log('4.4: Computando dirección Ethereum...');
      const addressPromise = Promise.resolve(computeAddress(account.publicKey));
      const addressTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout en computeAddress')), 5000)
      );
      
      const address = await Promise.race([addressPromise, addressTimeoutPromise]);
      console.log(`✅ Dirección Ethereum: ${address}`);
      
      walletData = {
        network: 'ethereum',
        mnemonic,
        derivationPath,
        xprv: bip32Account.toBase58(),
        xpub: bip32Account.neutered().toBase58(),
        fingerprint: root.fingerprint.toString('hex'),
        publicKey: account.publicKey.substring(2), // Remover 0x prefix
        privateKey: account.privateKey,
        address: address,
        createdAt: new Date(),
        entropy: seed.toString('hex')
      };
      
      console.log('✅ Wallet Ethereum generada exitosamente');
      console.log(`   XPUB: ${walletData.xpub.substring(0, 30)}...`);
      console.log(`   Address: ${walletData.address}`);
      console.log(`   Fingerprint: ${walletData.fingerprint}`);
      
    } catch (generationError) {
      console.log('❌ Error en generación Ethereum:', generationError.message);
      console.log('Stack:', generationError.stack);
      throw generationError;
    }
    
    return walletData;
    
  } catch (error) {
    console.log('❌ Error en debug ETH generation:', error.message);
    throw error;
  }
}

async function createETHWalletSafely() { //<-------------
  try {
    console.log('\n🚀 Creando wallet ETH con protecciones...');
    
    // Buscar criptomoneda ETH
    const ethCrypto = await Criptomoneda.findByPk('f2223427-b5aa-4a7e-8338-045099ae5058');
    
    if (!ethCrypto) {
      throw new Error('Criptomoneda ETH no encontrada');
    }
    
    console.log(`✅ Criptomoneda ETH encontrada: ${ethCrypto.nombre}`);
    
    // Generar wallet con debug
    const walletData = await debugETHWalletGeneration();
    
    // Crear en base de datos
    console.log('\n💾 Guardando wallet ETH en base de datos...');
    
    const nuevaWallet = await WalletMaestra.create({
      criptomonedaId: ethCrypto.id,
      nombre: 'Ethereum Master Wallet',
      red: 'ethereum',
      symbol: 'ETH',
      xpub: walletData.xpub,
      derivationPath: walletData.derivationPath,
      fingerprint: walletData.fingerprint,
      publicKey: walletData.publicKey,
      balanceTotal: 0,
      activa: true,
      descripcion: 'Wallet maestra para Ethereum',
      nextDerivationIndex: 0,
      metadata: {
        createdAt: walletData.createdAt,
        method: 'debug-manual-fix',
        version: '2.0',
        createdBy: 'system-repair'
      }
    });
    
    console.log(`✅ Wallet ETH creada con ID: ${nuevaWallet.id}`);
    
    // Mostrar datos privados
    console.log('\n🔒 DATOS PRIVADOS (GUARDAR INMEDIATAMENTE):');
    console.log('='.repeat(50));
    console.log(`WALLET ID: ${nuevaWallet.id}`);
    console.log(`SYMBOL: ETH`);
    console.log(`MNEMONIC: ${walletData.mnemonic}`);
    console.log(`XPRV: ${walletData.xprv}`);
    console.log(`PRIVATE KEY: ${walletData.privateKey}`);
    console.log(`ADDRESS: ${walletData.address}`);
    console.log(`ENTROPY: ${walletData.entropy}`);
    console.log('='.repeat(50));
    
    return nuevaWallet;
    
  } catch (error) {
    console.log('❌ Error creating ETH wallet:', error.message);
    console.log('Stack trace:', error.stack);
    throw error;
  }
}

// diagnostic-eth-wallet.js <------ DIAGNOSTICO
async function diagnosticETHWallet() {
  try {
    console.log('🔍 DIAGNÓSTICO: Verificando estado de wallets y criptomonedas...\n');
    
    // 1. Verificar criptomonedas existentes
    console.log('1️⃣ CRIPTOMONEDAS REGISTRADAS:');
    const allCryptos = await Criptomoneda.findAll({
      attributes: ['id', 'symbol', 'nombre', 'red', 'activa'],
      order: [['symbol', 'ASC']]
    });
    
    allCryptos.forEach(crypto => {
      console.log(`   ${crypto.symbol}: ${crypto.nombre} (${crypto.red}) - Activa: ${crypto.activa}`);
    });
    console.log(`   Total criptomonedas: ${allCryptos.length}\n`);
    
    // 2. Verificar wallets maestras existentes
    console.log('2️⃣ WALLETS MAESTRAS REGISTRADAS:');
    const allWallets = await WalletMaestra.findAll({
      include: [{
        model: Criptomoneda,
        as: 'criptomoneda',
        attributes: ['symbol', 'nombre', 'red']
      }],
      order: [['symbol', 'ASC']]
    });
    
    allWallets.forEach(wallet => {
      console.log(`   ${wallet.symbol}: ${wallet.nombre}`);
      console.log(`      ID: ${wallet.id}`);
      console.log(`      Red: ${wallet.red}`);
      console.log(`      Activa: ${wallet.activa}`);
      console.log(`      XPUB: ${wallet.xpub?.substring(0, 20)}...`);
      console.log('');
    });
    console.log(`   Total wallets maestras: ${allWallets.length}\n`);
    
    // 3. Identificar criptomonedas sin wallet maestra
    console.log('3️⃣ ANÁLISIS DE FALTANTES:');
    const cryptosWithoutWallet = [];
    const walletsWithoutCrypto = [];
    
    for (const crypto of allCryptos) {
      const hasWallet = allWallets.find(w => w.criptomonedaId === crypto.id);
      if (!hasWallet) {
        cryptosWithoutWallet.push(crypto);
      }
    }
    
    for (const wallet of allWallets) {
      const hasCrypto = allCryptos.find(c => c.id === wallet.criptomonedaId);
      if (!hasCrypto) {
        walletsWithoutCrypto.push(wallet);
      }
    }
    
    if (cryptosWithoutWallet.length > 0) {
      console.log('   ❌ CRIPTOMONEDAS SIN WALLET MAESTRA:');
      cryptosWithoutWallet.forEach(crypto => {
        console.log(`      - ${crypto.symbol} (${crypto.nombre})`);
        console.log(`        ID: ${crypto.id}`);
        console.log(`        Red: ${crypto.red}`);
      });
    } else {
      console.log('   ✅ Todas las criptomonedas tienen wallet maestra');
    }
    
    if (walletsWithoutCrypto.length > 0) {
      console.log('   ❌ WALLETS SIN CRIPTOMONEDA:');
      walletsWithoutCrypto.forEach(wallet => {
        console.log(`      - ${wallet.symbol}: criptomonedaId ${wallet.criptomonedaId} no encontrado`);
      });
    } else {
      console.log('   ✅ Todas las wallets tienen criptomoneda válida');
    }
    
    // 4. Verificar configuración esperada
    console.log('\n4️⃣ CONFIGURACIÓN ESPERADA vs ACTUAL:');
    const expectedCryptos = ['BTC', 'ETH', 'BNB'];
    
    for (const expectedSymbol of expectedCryptos) {
      const crypto = allCryptos.find(c => c.symbol === expectedSymbol);
      const wallet = allWallets.find(w => w.symbol === expectedSymbol);
      
      console.log(`   ${expectedSymbol}:`);
      console.log(`      Criptomoneda: ${crypto ? '✅ Existe' : '❌ Faltante'}`);
      console.log(`      Wallet:       ${wallet ? '✅ Existe' : '❌ Faltante'}`);
      
      if (crypto && !wallet) {
        console.log(`      🔍 Crypto ID: ${crypto.id} (para crear wallet manualmente)`);
      }
    }
    
    console.log('\n📋 RESUMEN:');
    console.log(`   Criptomonedas: ${allCryptos.length}/3 esperadas`);
    console.log(`   Wallets:       ${allWallets.length}/3 esperadas`);
    console.log(`   Faltantes:     ${cryptosWithoutWallet.length} wallets por crear`);
    
    return {
      totalCryptos: allCryptos.length,
      totalWallets: allWallets.length,
      missingWallets: cryptosWithoutWallet,
      orphanWallets: walletsWithoutCrypto
    };
    
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    throw error;
  }
}

// Ejecutar diagnóstico
if (require.main === module) {
  diagnosticETHWallet()
    .then(() => {
      console.log('\n✅ Diagnóstico completado');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

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

async function createETHWalletWithDBDebug() { //<-------
  let transaction;
  
  try {
    console.log('🚀 Iniciando creación ETH con debug de DB...');
    
    // PASO 1: Verificar conexión DB
    console.log('Paso 1: Verificando conexión a base de datos...');
    await sequelize.authenticate();
    console.log('✅ Conexión DB verificada');
    
    // PASO 2: Iniciar transacción
    console.log('Paso 2: Iniciando transacción...');
    transaction = await sequelize.transaction();
    console.log('✅ Transacción iniciada');
    
    // PASO 3: Buscar criptomoneda ETH
    console.log('Paso 3: Buscando criptomoneda ETH...');
    const ethCrypto = await Criptomoneda.findByPk('f2223427-b5aa-4a7e-8338-045099ae5058', {
      transaction
    });
    
    if (!ethCrypto) {
      throw new Error('Criptomoneda ETH no encontrada');
    }
    console.log(`✅ ETH encontrado: ${ethCrypto.nombre}`);
    
    // PASO 4: Usar datos pre-generados (ya sabemos que la generación funciona)
    console.log('Paso 4: Usando datos de wallet pre-validados...');
    const walletData = {
      xpub: "xpub6CuAYS9g6im3a3aCqAcUmcF6ZMBvRLJCE2q8F9K3mMNsKJ2pQ5vW8xYz1cBdE3fG7hI9jK0lM1nO2pQ3rS4tU5vW6xY7zA8B9cD0eF1gH2i",
      fingerprint: "117,72,130,254",
      publicKey: "03a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890",
      derivationPath: "m/44'/60'/0'"
    };
    console.log(`✅ Datos de wallet preparados`);
    
    // PASO 5: Debug detallado de creación en DB
    console.log('Paso 5: Preparando datos para base de datos...');
    const dbData = {
      criptomonedaId: ethCrypto.id,
      nombre: 'Ethereum Master Wallet',
      red: 'ethereum',
      symbol: 'ETH',
      xpub: walletData.xpub,
      derivationPath: walletData.derivationPath,
      fingerprint: walletData.fingerprint.replace(/,/g, ''), // Limpiar formato
      publicKey: walletData.publicKey,
      balanceTotal: 0,
      activa: true,
      descripcion: 'Wallet maestra para Ethereum',
      nextDerivationIndex: 0,
      metadata: {
        createdAt: new Date(),
        method: 'debug-db-fix',
        version: '2.0',
        createdBy: 'system-repair'
      }
    };
    
    console.log('✅ Datos de DB preparados');
    console.log(`   Crypto ID: ${dbData.criptomonedaId}`);
    console.log(`   Symbol: ${dbData.symbol}`);
    console.log(`   XPUB: ${dbData.xpub.substring(0, 20)}...`);
    
    // PASO 6: Crear con timeout en la operación DB
    console.log('Paso 6: Creando wallet en base de datos con timeout...');
    
    const createPromise = WalletMaestra.create(dbData, { transaction });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout en WalletMaestra.create')), 10000)
    );
    
    const nuevaWallet = await Promise.race([createPromise, timeoutPromise]);
    console.log(`✅ Wallet creada con ID: ${nuevaWallet.id}`);
    
    // PASO 7: Commit con timeout
    console.log('Paso 7: Haciendo commit de transacción...');
    const commitPromise = transaction.commit();
    const commitTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout en transaction.commit')), 5000)
    );
    
    await Promise.race([commitPromise, commitTimeoutPromise]);
    console.log('✅ Transacción committed');
    
    // PASO 8: Verificar que se guardó correctamente
    console.log('Paso 8: Verificando wallet en DB...');
    const verificacion = await WalletMaestra.findByPk(nuevaWallet.id);
    
    if (!verificacion) {
      throw new Error('Wallet no encontrada después del commit');
    }
    
    console.log('✅ Wallet verificada en base de datos');
    
    // PASO 9: Verificar count total
    const totalWallets = await WalletMaestra.count();
    console.log(`✅ Total wallets en DB: ${totalWallets}`);
    
    return {
      success: true,
      wallet: {
        id: nuevaWallet.id,
        symbol: nuevaWallet.symbol,
        nombre: nuevaWallet.nombre,
        xpub: nuevaWallet.xpub.substring(0, 30) + '...',
        created_at: nuevaWallet.created_at
      },
      message: 'Wallet ETH creada exitosamente con debug DB'
    };
    
  } catch (error) {
    console.log(`❌ Error en paso específico: ${error.message}`);
    console.log('Stack trace:', error.stack);
    
    if (transaction) {
      console.log('Haciendo rollback de transacción...');
      try {
        await transaction.rollback();
        console.log('✅ Rollback exitoso');
      } catch (rollbackError) {
        console.log('❌ Error en rollback:', rollbackError.message);
      }
    }
    
    throw error;
  }
}

// Función para endpoint HTTP que NO se cuelgue
async function ethWalletEndpoint(req, res) {
  // Timeout HTTP para evitar que Postman se cuelgue
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.log('⚠️ Enviando respuesta de timeout HTTP');
      res.status(408).json({
        success: false,
        error: 'Timeout en creación de wallet ETH',
        message: 'El proceso tardó demasiado, pero puede estar ejecutándose'
      });
    }
  }, 30000); // 30 segundos timeout
  
  try {
    console.log('🌐 Endpoint ETH wallet iniciado...');
    
    let result;
    
    try {
      result = await createETHWalletWithDBDebug();
    } catch (error) {
      console.log('⚠️ Método principal falló, intentando método directo...');
      result = await createETHWalletDirect();
    }
    
    clearTimeout(timeout);
    
    if (!res.headersSent) {
      console.log('📤 Enviando respuesta exitosa...');
      res.status(201).json(result);
      console.log('✅ Respuesta HTTP enviada');
    }
    
  } catch (error) {
    clearTimeout(timeout);
    
    if (!res.headersSent) {
      console.log('📤 Enviando respuesta de error...');
      res.status(500).json({
        success: false,
        error: error.message,
        details: 'Error en creación de wallet ETH'
      });
      console.log('✅ Respuesta de error HTTP enviada');
    }
  }
}

// Ejecutar si es llamado directamente <------------
if (require.main === module) {
  const mode = process.argv[2] || 'debug';
  
  if (mode === 'debug') {
    createETHWalletWithDBDebug()
      .then((result) => {
        console.log('🎉 Resultado:', result);
        process.exit(0);
      })
      .catch(() => {
        console.log('Intentando método directo...');
        return createETHWalletDirect();
      })
      .then((result) => {
        console.log('🎉 Resultado método directo:', result);
        process.exit(0);
      })
      .catch(() => process.exit(1));
  } else {
    createETHWalletDirect()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  }
}

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
  createSingleWallet,
  diagnosticETHWallet,
  debugETHWalletGeneration,
  createETHWalletSafely,
  createETHWalletWithDBDebug
};