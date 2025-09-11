// bootstrap/blockchain.bootstrap.js
const sequelize = require('../config/database');
const BlockchainServiceManager = require('../services/blockchain');
const JobManager = require('../jobs');
const { Criptomoneda, WalletMaestra, DireccionDeposito } = require('../models');

class BlockchainBootstrap {
  constructor() {
    this.initialized = false;
    this.services = {
      database: false,
      blockchain: false,
      jobs: false
    };
  }

  async initialize() {
    try {
      console.log('🚀 Inicializando sistema de blockchain...');
      
      // 1. Verificar conexión a base de datos
      await this.initializeDatabase();
      
      // 2. Verificar configuraciones de blockchain
      await this.initializeBlockchainServices();
      
      // 3. Verificar wallets maestras
      await this.verifyMasterWallets();
      
      // 4. Inicializar jobs automáticos
      await this.initializeJobs();
      
      // 5. Verificación final
      await this.performHealthCheck();
      
      this.initialized = true;
      console.log('✅ Sistema de blockchain inicializado correctamente');
      
      return {
        success: true,
        message: 'Sistema inicializado correctamente',
        services: this.services
      };
    } catch (error) {
      console.error('❌ Error inicializando sistema de blockchain:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    try {
      console.log('📦 Verificando conexión a base de datos...');
      
      await sequelize.authenticate();
      console.log('✅ Conexión a base de datos verificada');
      
      // Verificar que las tablas existen
      const tables = ['criptomonedas', 'wallets_maestras', 'direcciones_deposito', 'transacciones_blockchain'];
      for (const table of tables) {
        const tableExists = await sequelize.getQueryInterface().showAllTables()
          .then(tableNames => tableNames.includes(table));
        
        if (!tableExists) {
          throw new Error(`Tabla ${table} no encontrada. Ejecuta las migraciones.`);
        }
      }
      
      this.services.database = true;
      console.log('✅ Todas las tablas verificadas');
    } catch (error) {
      console.error('❌ Error en base de datos:', error.message);
      throw error;
    }
  }

  async initializeBlockchainServices() {
    try {
      console.log('🔗 Inicializando servicios de blockchain...');
      
      const networks = ['ethereum', 'bsc', 'bitcoin'];
      const results = {};
      
      for (const network of networks) {
        try {
          const service = BlockchainServiceManager.getService(network);
          
          // Verificar configuración específica por red
          if (network === 'ethereum') {
            if (!process.env.ETHEREUM_RPC_URL || !process.env.ETH_PRIVATE_KEY) {
              throw new Error('Configuración de Ethereum incompleta');
            }
          } else if (network === 'bsc') {
            if (!process.env.BSC_RPC_URL || !process.env.BNB_PRIVATE_KEY) {
              throw new Error('Configuración de BSC incompleta');
            }
          }
          
          results[network] = { status: 'configured', service: true };
          console.log(`✅ Servicio ${network} configurado`);
        } catch (error) {
          results[network] = { status: 'error', error: error.message };
          console.warn(`⚠️ Problema con servicio ${network}: ${error.message}`);
        }
      }
      
      this.services.blockchain = true;
      console.log('✅ Servicios de blockchain inicializados');
      return results;
    } catch (error) {
      console.error('❌ Error inicializando servicios blockchain:', error.message);
      throw error;
    }
  }

  async verifyMasterWallets() {
    try {
      console.log('🔑 Verificando wallets maestras...');
      
      const criptomonedas = await Criptomoneda.findAll({
        where: { activa: true }
      });
      
      const walletsCreated = [];
      const walletsExisting = [];
      
      for (const cripto of criptomonedas) {
        let wallet = await WalletMaestra.findOne({
          where: { criptomonedaId: cripto.id }
        });
        
        if (!wallet) {
          // Crear wallet maestra si no existe
          console.log(`⚠️ Wallet maestra para ${cripto.symbol} no encontrada, creando...`);
          
          const walletData = {
            criptomonedaId: cripto.id,
            nombre: `${cripto.nombre} Master Wallet`,
            red: cripto.red,
            symbol: cripto.symbol,
            xpub: this.generateTestXpub(cripto.red),
            derivationPath: "m/44'/60'/0'",
            direccionPublica: this.generateTestAddress(cripto.red),
            balanceTotal: 0,
            activa: true,
            fingerprint: this.generateTestFingerprint(),
            publicKey: this.generateTestPublicKey(),
            nextDerivationIndex: 0,
            metadata: {
              createdBy: 'bootstrap',
              version: '1.0',
              purpose: `${cripto.symbol}_testnet`
            }
          };
          
          wallet = await WalletMaestra.create(walletData);
          walletsCreated.push(cripto.symbol);
          console.log(`✅ Wallet maestra para ${cripto.symbol} creada`);
        } else {
          walletsExisting.push(cripto.symbol);
          console.log(`✅ Wallet maestra para ${cripto.symbol} ya existe`);
        }
      }
      
      console.log(`✅ Wallets verificadas: ${walletsExisting.length} existentes, ${walletsCreated.length} creadas`);
      return { existing: walletsExisting, created: walletsCreated };
    } catch (error) {
      console.error('❌ Error verificando wallets maestras:', error.message);
      throw error;
    }
  }

  async initializeJobs() {
    try {
      console.log('⚙️ Inicializando jobs automáticos...');
      
      // Verificar configuraciones de jobs
      const requiredEnvVars = [
        'DEPOSIT_SCAN_INTERVAL_MS',
        'CONFIRMATION_UPDATE_INTERVAL_MS',
        'WITHDRAWAL_PROCESS_INTERVAL_MS'
      ];
      
      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          console.warn(`⚠️ Variable de entorno ${envVar} no configurada, usando valor por defecto`);
        }
      }
      
      // Inicializar job manager
      await JobManager.startAll();
      
      this.services.jobs = true;
      console.log('✅ Jobs automáticos inicializados');
    } catch (error) {
      console.error('❌ Error inicializando jobs:', error.message);
      throw error;
    }
  }

  async performHealthCheck() {
    try {
      console.log('💓 Realizando verificación de salud del sistema...');
      
      const healthData = {
        database: this.services.database,
        blockchain: this.services.blockchain,
        jobs: this.services.jobs,
        timestamp: new Date()
      };
      
      // Verificar conteo de datos críticos
      const cryptoCount = await Criptomoneda.count({ where: { activa: true } });
      const walletCount = await WalletMaestra.count({ where: { activa: true } });
      
      healthData.stats = {
        activeCryptocurrencies: cryptoCount,
        activeMasterWallets: walletCount
      };
      
      if (cryptoCount === 0) {
        throw new Error('No hay criptomonedas activas configuradas');
      }
      
      if (walletCount === 0) {
        throw new Error('No hay wallets maestras activas');
      }
      
      console.log('✅ Verificación de salud completada exitosamente');
      return healthData;
    } catch (error) {
      console.error('❌ Error en verificación de salud:', error.message);
      throw error;
    }
  }

  // Métodos auxiliares para generar datos de prueba
  generateTestXpub(network) {
    const prefix = network === 'bitcoin' ? 'xpub' : 'ypub';
    const randomSuffix = Math.random().toString(36).substring(2, 50);
    return `${prefix}6XiW9nhToS1gjVsFKzgmtWZuqo6V8dKgQWv1BmQqGGH4TFEGJzXA2VDjrWRQEeYd7sYd47qyWH4fBV2rHRvGi1Ec5QdcWZ2DU9ZsZR4x${randomSuffix}`;
  }

  generateTestAddress(network) {
    if (network === 'bitcoin') {
      return '1' + Math.random().toString(36).substring(2, 35);
    }
    return '0x' + Math.random().toString(16).substring(2, 42).padEnd(40, '0');
  }

  generateTestFingerprint() {
    return Math.random().toString(16).substring(2, 10);
  }

  generateTestPublicKey() {
    return '04' + Math.random().toString(16).substring(2).padEnd(126, '0');
  }

  async shutdown() {
    try {
      console.log('🛑 Cerrando sistema de blockchain...');
      
      if (this.services.jobs) {
        await JobManager.stopAll();
        console.log('✅ Jobs detenidos');
      }
      
      if (this.services.database) {
        await sequelize.close();
        console.log('✅ Conexión a base de datos cerrada');
      }
      
      this.initialized = false;
      console.log('✅ Sistema de blockchain cerrado correctamente');
    } catch (error) {
      console.error('❌ Error cerrando sistema:', error.message);
      throw error;
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      services: this.services,
      timestamp: new Date()
    };
  }
}

// Crear instancia global
const blockchainBootstrap = new BlockchainBootstrap();

module.exports = blockchainBootstrap;