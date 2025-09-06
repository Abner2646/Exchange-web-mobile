// setup-wallets.js - Colocar en la raíz de tu proyecto
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Importar tu instancia de Sequelize y modelos
const { sequelize } = require('./models'); // Ajusta la ruta según tu estructura
const { WalletMaestra, Criptomoneda } = require('./models');

// Importar generadores de wallets
const bip39 = require('bip39');
const bip32 = require('bip32');
const bitcoin = require('bitcoinjs-lib');
const { HDNode } = require('@ethersproject/hdnode');

// =================== GENERADOR DE WALLETS MAESTRAS ===================

class WalletMaestraSetup {
  
  /**
   * Genera una nueva wallet maestra con mnemonic y xpub
   */
  static async generateMasterWallet(network, derivationPath = "m/44'/0'/0'") {
    try {
      console.log(`🔑 Generando wallet maestra para ${network}...`);
      
      // 1. Generar mnemonic de 24 palabras
      const mnemonic = bip39.generateMnemonic(256);
      console.log(`   ✓ Mnemonic generado (24 palabras)`);
      
      // 2. Generar seed desde mnemonic
      const seed = await bip39.mnemonicToSeed(mnemonic);
      console.log(`   ✓ Seed generado desde mnemonic`);
      
      let walletData = {};
      
      switch (network.toLowerCase()) {
        case 'bitcoin':
        case 'btc':
          walletData = this._generateBitcoinMasterWallet(seed, derivationPath);
          break;
          
        case 'ethereum':
        case 'eth':
          walletData = this._generateEthereumMasterWallet(seed, derivationPath);
          break;
          
        default:
          throw new Error(`Red no soportada: ${network}`);
      }
      
      console.log(`   ✓ Claves generadas para ${network}`);
      
      return {
        network,
        mnemonic, // ⚠️ GUARDAR EN LUGAR MUY SEGURO
        derivationPath,
        ...walletData,
        createdAt: new Date(),
        entropy: seed.toString('hex') // ⚠️ TAMBIÉN GUARDAR SEGURO
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
      xprv: account.toBase58(), // ⚠️ PRIVATE - GUARDAR MUY SEGURO
      xpub: account.neutered().toBase58(), // PUBLIC - Para generar direcciones
      fingerprint: root.fingerprint.toString('hex'),
      publicKey: account.publicKey.toString('hex')
    };
  }
  
  static _generateEthereumMasterWallet(seed, derivationPath) {
    const hdNode = HDNode.fromSeed(seed);
    const account = hdNode.derivePath(derivationPath);
    
    return {
      xprv: account.extendedKey, // ⚠️ PRIVATE - GUARDAR MUY SEGURO
      xpub: account.neuter().extendedKey, // PUBLIC - Para generar direcciones
      address: account.address,
      publicKey: account.publicKey
    };
  }
}

// =================== CONFIGURACIÓN DE CRIPTOMONEDAS ===================

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

// =================== SCRIPT PRINCIPAL ===================

async function ejecutarConfiguracion() {
  console.log('🚀 CONFIGURACIÓN DE WALLETS MAESTRAS - EXCHANGE');
  console.log('================================================\n');
  
  try {
    // 1. Verificar conexión a base de datos
    await verificarConexionDB();
    
    // 2. Verificar/crear criptomonedas
    await verificarCriptomonedas();
    
    // 3. Generar y crear wallets maestras
    await generarWalletsMaestras();
    
    console.log('\n🎉 ¡CONFIGURACIÓN COMPLETADA EXITOSAMENTE!');
    console.log('⚠️  IMPORTANTE: Los datos privados se guardaron en ./wallet-keys-BACKUP.txt');
    console.log('⚠️  MUEVE ESTE ARCHIVO A UN LUGAR SEGURO Y ELIMINALO DEL PROYECTO');
    
  } catch (error) {
    console.error('\n❌ ERROR EN CONFIGURACIÓN:', error.message);
    process.exit(1);
  }
}

async function verificarConexionDB() {
  console.log('🔍 Verificando conexión a base de datos...');
  
  try {
    await sequelize.authenticate();
    console.log('   ✓ Conexión a base de datos exitosa');
  } catch (error) {
    throw new Error(`Fallo conexión DB: ${error.message}`);
  }
}

async function verificarCriptomonedas() {
  console.log('\n💰 Verificando criptomonedas en el sistema...');
  
  const criptomonedas = {};
  
  for (const config of CRIPTOMONEDAS_CONFIG) {
    try {
      let criptomoneda = await Criptomoneda.findOne({
        where: { symbol: config.symbol }
      });
      
      if (!criptomoneda) {
        console.log(`   📝 Creando criptomoneda: ${config.symbol}`);
        
        criptomoneda = await Criptomoneda.create({
          symbol: config.symbol,
          nombre: config.nombre,
          red: config.red,
          derivationPath: config.derivationPath,
          addressFormat: config.addressFormat,
          decimales: config.decimales,
          activa: true,
          metadata: {
            createdBy: 'setup-script',
            createdAt: new Date()
          }
        });
      } else {
        console.log(`   ✓ Criptomoneda existente: ${config.symbol}`);
      }
      
      criptomonedas[config.symbol] = criptomoneda;
      
    } catch (error) {
      console.error(`   ❌ Error con ${config.symbol}: ${error.message}`);
    }
  }
  
  return criptomonedas;
}

async function generarWalletsMaestras() {
  console.log('\n🔐 Generando wallets maestras...');
  
  const resultados = [];
  const archivoBackup = path.join(__dirname, `wallet-keys-BACKUP-${Date.now()}.txt`);
  let contenidoBackup = '=== CLAVES PRIVADAS WALLETS MAESTRAS ===\n';
  contenidoBackup += `Generado: ${new Date().toISOString()}\n`;
  contenidoBackup += 'GUARDAR EN LUGAR SEGURO Y ELIMINAR DE AQUÍ\n\n';
  
  // Obtener criptomonedas
  const criptomonedas = await verificarCriptomonedas();
  
  for (const config of CRIPTOMONEDAS_CONFIG) {
    try {
      const criptomoneda = criptomonedas[config.symbol];
      
      if (!criptomoneda) {
        console.log(`   ⚠️  Saltando ${config.symbol} - criptomoneda no encontrada`);
        continue;
      }
      
      // Verificar si ya existe wallet
      const existingWallet = await WalletMaestra.findOne({
        where: { criptomonedaId: criptomoneda.id }
      });
      
      if (existingWallet) {
        console.log(`   ⚠️  Ya existe wallet para ${config.symbol}, saltando...`);
        continue;
      }
      
      console.log(`   🔑 Generando wallet para ${config.symbol}...`);
      
      // Generar wallet
      const walletData = await WalletMaestraSetup.generateMasterWallet(
        config.red,
        config.derivationPath
      );
      
      // Crear en base de datos
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
          method: 'setup-script',
          version: '2.0'
        }
      });
      
      // Guardar resultado (SIN datos privados)
      resultados.push({
        id: nuevaWallet.id,
        symbol: config.symbol,
        nombre: nuevaWallet.nombre,
        xpub: walletData.xpub,
        red: config.red
      });
      
      // Agregar datos privados al backup
      contenidoBackup += `\n--- ${config.symbol} (${config.nombre}) ---\n`;
      contenidoBackup += `ID: ${nuevaWallet.id}\n`;
      contenidoBackup += `MNEMONIC: ${walletData.mnemonic}\n`;
      contenidoBackup += `XPRV: ${walletData.xprv}\n`;
      contenidoBackup += `XPUB: ${walletData.xpub}\n`;
      contenidoBackup += `FINGERPRINT: ${walletData.fingerprint}\n`;
      contenidoBackup += `ENTROPY: ${walletData.entropy}\n`;
      contenidoBackup += `DERIVATION PATH: ${walletData.derivationPath}\n\n`;
      
      console.log(`   ✅ Wallet creada: ${config.symbol}`);
      
    } catch (error) {
      console.error(`   ❌ Error creando wallet ${config.symbol}: ${error.message}`);
    }
  }
  
  // Guardar backup de claves privadas
  fs.writeFileSync(archivoBackup, contenidoBackup, 'utf8');
  console.log(`\n💾 Claves privadas guardadas en: ${archivoBackup}`);
  
  // Mostrar resumen
  console.log('\n📊 RESUMEN DE WALLETS CREADAS:');
  console.log('================================');
  
  for (const wallet of resultados) {
    console.log(`✅ ${wallet.symbol} - ${wallet.nombre}`);
    console.log(`   ID: ${wallet.id}`);
    console.log(`   XPUB: ${wallet.xpub.substring(0, 30)}...`);
    console.log(`   Red: ${wallet.red}\n`);
  }
  
  return resultados;
}

// =================== UTILIDADES ADICIONALES ===================

async function verificarConfiguracion() {
  console.log('🔍 VERIFICANDO CONFIGURACIÓN ACTUAL...\n');
  
  try {
    const wallets = await WalletMaestra.findAll({
      include: [{
        model: Criptomoneda,
        as: 'criptomoneda'
      }]
    });
    
    if (wallets.length === 0) {
      console.log('❌ No hay wallets maestras configuradas');
      return false;
    }
    
    console.log(`✅ ${wallets.length} wallets maestras encontradas:`);
    
    for (const wallet of wallets) {
      console.log(`   • ${wallet.symbol} - ${wallet.nombre}`);
      console.log(`     Estado: ${wallet.activa ? 'ACTIVA' : 'INACTIVA'}`);
      console.log(`     XPUB: ${wallet.xpub ? wallet.xpub.substring(0, 30) + '...' : 'NO CONFIGURADO'}`);
      console.log(`     Balance: ${wallet.balanceTotal}`);
      console.log('');
    }
    
    return true;
  } catch (error) {
    console.error('Error verificando:', error.message);
    return false;
  }
}

// =================== EJECUCIÓN ===================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'setup':
    case 'install':
      await ejecutarConfiguracion();
      break;
      
    case 'verify':
    case 'check':
      await verificarConfiguracion();
      break;
      
    case 'help':
    default:
      console.log('🔧 CONFIGURADOR DE WALLETS MAESTRAS');
      console.log('===================================');
      console.log('');
      console.log('Comandos disponibles:');
      console.log('  node setup-wallets.js setup   - Configurar wallets maestras');
      console.log('  node setup-wallets.js verify  - Verificar configuración');
      console.log('  node setup-wallets.js help    - Mostrar esta ayuda');
      console.log('');
      break;
  }
  
  process.exit(0);
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(error => {
    console.error('💥 ERROR:', error.message);
    process.exit(1);
  });
}

module.exports = {
  WalletMaestraSetup,
  ejecutarConfiguracion,
  verificarConfiguracion
};