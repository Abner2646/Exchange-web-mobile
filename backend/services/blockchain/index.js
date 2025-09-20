// services/blockchain/index.js - Service Manager Corregido
require('dotenv').config();

class BlockchainServiceManager {
  constructor() {
    this.services = new Map();
    this.initializeServices();
  }

  initializeServices() {
    try {
      console.log('🔧 Inicializando servicios blockchain...');

      // ✅ ETHEREUM
      try {
        const EthereumService = require('./ethereum.service');
        const ethService = new EthereumService();
        
        // Registrar tanto para ethereum como sepolia
        this.services.set('ethereum', ethService);
        this.services.set('sepolia', ethService);
        
        console.log('✅ Ethereum Service inicializado');
      } catch (ethError) {
        console.error('❌ Error inicializando Ethereum Service:', ethError.message);
      }

      // ✅ BSC - SOPORTE PARA MAINNET Y TESTNET
      try {
        console.log('🔧 Intentando cargar BSC Service...');
        console.log('🔧 BSC_NETWORK:', process.env.BSC_NETWORK);
        console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
        
        const BscService = require('./bsc.service');
        console.log('✅ BSC Service requerido exitosamente');
        
        const bscService = new BscService();
        console.log('✅ BSC Service instanciado exitosamente');
        console.log('🔧 BSC Service network:', bscService.network);
        console.log('🔧 BSC Service actualNetwork:', bscService.actualNetwork);
        
        // ✅ CORRECCIÓN: Registrar según la configuración actual
        const isTestnet = process.env.BSC_NETWORK === 'testnet' || process.env.NODE_ENV !== 'production';
        console.log('🔧 Es testnet:', isTestnet);
        
        if (isTestnet) {
          this.services.set('bsc-testnet', bscService);
          this.services.set('bsc', bscService); // También registrar como 'bsc' para compatibilidad
          console.log('✅ BSC Testnet Service registrado como: bsc-testnet, bsc');
        } else {
          this.services.set('bsc', bscService);
          this.services.set('bsc-mainnet', bscService);
          console.log('✅ BSC Mainnet Service registrado como: bsc, bsc-mainnet');
        }
        
        // Debug: verificar que se registró
        console.log('🔧 Servicios después de BSC:', Array.from(this.services.keys()));
        
        console.log('✅ BSC Service inicialización completa');
      } catch (bscError) {
        console.error('❌ Error detallado inicializando BSC Service:', bscError.message);
        console.error('❌ Stack trace BSC:', bscError.stack);
      }

      // ✅ BITCOIN
      try {
        const BitcoinService = require('./bitcoin.service');
        const btcService = new BitcoinService();
        
        // Registrar tanto para bitcoin como testnet3
        const networkName = process.env.BITCOIN_NETWORK || 'testnet3';
        this.services.set(networkName, btcService);
        this.services.set('bitcoin', btcService); // También como 'bitcoin' para compatibilidad
        
        if (networkName === 'testnet3') {
          this.services.set('testnet3', btcService);
        }
        
        console.log(`✅ Bitcoin Service inicializado para ${networkName}`);
      } catch (btcError) {
        console.error('❌ Error inicializando Bitcoin Service:', btcError.message);
      }

      console.log(`🔧 Servicios inicializados: ${Array.from(this.services.keys()).join(', ')}`);
    } catch (error) {
      console.error('❌ Error general inicializando servicios:', error.message);
    }
  }

  // ✅ MÉTODO MEJORADO CON MEJOR LOGGING
  getService(network) {
    try {
      const normalizedNetwork = network.toLowerCase();
      
      console.log(`🔍 Buscando servicio para red: ${normalizedNetwork}`);
      console.log(`🔍 Servicios disponibles: ${Array.from(this.services.keys()).join(', ')}`);
      
      const service = this.services.get(normalizedNetwork);
      
      if (!service) {
        console.error(`❌ Servicio no encontrado para red: ${normalizedNetwork}`);
        console.error(`❌ Servicios disponibles: ${Array.from(this.services.keys()).join(', ')}`);
        return null;
      }
      
      console.log(`✅ Servicio encontrado para red: ${normalizedNetwork}`);
      return service;
    } catch (error) {
      console.error(`❌ Error obteniendo servicio para ${network}:`, error.message);
      return null;
    }
  }

  // ✅ MÉTODO PARA OBTENER TODOS LOS SERVICIOS DISPONIBLES
  getAvailableServices() {
    return Array.from(this.services.keys());
  }

  // ✅ MÉTODO PARA VERIFICAR SI UN SERVICIO ESTÁ DISPONIBLE
  hasService(network) {
    return this.services.has(network.toLowerCase());
  }

  // ✅ MÉTODO PARA OBTENER ESTADÍSTICAS DE SERVICIOS
  getServicesStatus() {
    const status = {};
    
    for (const [network, service] of this.services) {
      try {
        status[network] = {
          available: true,
          type: service.constructor.name,
          network: service.network || network
        };
      } catch (error) {
        status[network] = {
          available: false,
          error: error.message
        };
      }
    }
    
    return status;
  }

  // ✅ MÉTODO PARA REINICIALIZAR SERVICIOS
  reinitialize() {
    console.log('🔄 Reinicializando servicios blockchain...');
    this.services.clear();
    this.initializeServices();
  }

  // ✅ MÉTODO PARA REGISTRAR SERVICIO MANUALMENTE
  registerService(network, service) {
    try {
      this.services.set(network.toLowerCase(), service);
      console.log(`✅ Servicio registrado manualmente para ${network}`);
    } catch (error) {
      console.error(`❌ Error registrando servicio para ${network}:`, error.message);
    }
  }
}

// Crear instancia singleton
const blockchainServiceManager = new BlockchainServiceManager();

module.exports = blockchainServiceManager;