// services/blockchain/index.js - ORDEN CORREGIDO
const EthereumService = require('./ethereum.service');
const BitcoinService = require('./bitcoin.service');
const BscService = require('./bsc.service');

// DEBUG:
console.log('🔧 INIT: Creando BlockchainServiceManager...');

// ✅ CORRECTO: Declarar la clase PRIMERO
class BlockchainServiceManager {
  constructor() {
    console.log('🔧 CONSTRUCTOR: Iniciando constructor...');
    this.services = {};
    this.symbolToService = {
      'ETH': 'ethereum',
      'USDT': 'ethereum',
      'USDC': 'ethereum',
      'BTC': 'bitcoin',
      'BNB': 'bsc',
      'BUSD': 'bsc'
    };
    console.log('🔧 CONSTRUCTOR: Constructor terminado');
    
    this.initializeServices();
  }

  initializeServices() {
    console.log('🔧 INIT_SERVICES: Iniciando servicios...');
    try {
      this.services.ethereum = new EthereumService();
      console.log('✅ Servicio Ethereum inicializado');
    } catch (error) {
      console.error('❌ Error inicializando Ethereum service:', error.message);
    }
    
    try {
      this.services.bsc = new BscService();
      console.log('✅ Servicio BSC inicializado');
    } catch (error) {
      console.error('❌ Error inicializando BSC service:', error.message);
    }
    
    try {
      this.services.bitcoin = new BitcoinService();
      console.log('✅ Servicio Bitcoin inicializado');
    } catch (error) {
      console.error('❌ Error inicializando Bitcoin service:', error.message);
    }
    
    // DEBUG TEMPORAL:
    console.log('🔧 DEBUG - Servicios creados:');
    console.log('- ethereum:', !!this.services.ethereum);
    console.log('- bsc:', !!this.services.bsc);
    console.log('- bitcoin:', !!this.services.bitcoin);
    console.log('- Total servicios:', Object.keys(this.services).length);
    console.log('🔧 INIT_SERVICES: Servicios terminados');
  }

  getService(networkOrSymbol) {
    // Primero intentar como red directa
    if (this.services[networkOrSymbol.toLowerCase()]) {
      return this.services[networkOrSymbol.toLowerCase()];
    }

    // Luego como símbolo de criptomoneda
    const serviceName = this.symbolToService[networkOrSymbol.toUpperCase()];
    if (serviceName && this.services[serviceName]) {
      return this.services[serviceName];
    }

    throw new Error(`Servicio de blockchain no encontrado para: ${networkOrSymbol}`);
  }

  // Método unificado mejorado para escanear depósitos
  async scanAllNetworksForDeposits() {
    const results = [];
    
    for (const [network, service] of Object.entries(this.services)) {
      if (!service) continue;
      
      try {
        console.log(`🔍 Escaneando ${network} para depósitos...`);
        const startTime = Date.now();
        
        const deposits = await service.scanForDeposits();
        const duration = Date.now() - startTime;
        
        results.push({
          network,
          success: true,
          deposits: deposits.length,
          data: deposits,
          duration: `${duration}ms`
        });
        
        if (deposits.length > 0) {
          console.log(`✅ ${network}: ${deposits.length} nuevos depósitos (${duration}ms)`);
        }
      } catch (error) {
        console.error(`❌ Error escaneando ${network}:`, error.message);
        results.push({
          network,
          success: false,
          error: error.message,
          deposits: 0,
          data: []
        });
      }
    }

    return results;
  }

  async processAllPendingWithdrawals() {
    const results = [];
    
    for (const [network, service] of Object.entries(this.services)) {
      if (!service) continue;
      
      try {
        console.log(`💸 Procesando retiros pendientes en ${network}...`);
        const startTime = Date.now();
        
        const processed = await service.processPendingWithdrawals();
        const duration = Date.now() - startTime;
        
        results.push({
          network,
          success: true,
          processed: processed.length,
          data: processed,
          duration: `${duration}ms`
        });
        
        if (processed.length > 0) {
          console.log(`✅ ${network}: ${processed.length} retiros procesados (${duration}ms)`);
        }
      } catch (error) {
        console.error(`❌ Error procesando retiros en ${network}:`, error.message);
        results.push({
          network,
          success: false,
          error: error.message,
          processed: 0,
          data: []
        });
      }
    }

    return results;
  }

  async updateAllConfirmations() {
    const results = [];
    
    for (const [network, service] of Object.entries(this.services)) {
      if (!service) continue;
      
      try {
        const startTime = Date.now();
        const updated = await service.updateConfirmations();
        const duration = Date.now() - startTime;
        
        results.push({
          network,
          success: true,
          updated: updated.length,
          data: updated,
          duration: `${duration}ms`
        });
        
        if (updated.length > 0) {
          console.log(`🔄 ${network}: ${updated.length} confirmaciones actualizadas (${duration}ms)`);
        }
      } catch (error) {
        console.error(`❌ Error actualizando confirmaciones en ${network}:`, error.message);
        results.push({
          network,
          success: false,
          error: error.message,
          updated: 0,
          data: []
        });
      }
    }

    return results;
  }

  // Nuevo método para verificar salud de servicios
  async checkServicesHealth() {
    const health = {};
    
    for (const [network, service] of Object.entries(this.services)) {
      if (!service) {
        health[network] = { status: 'not_initialized' };
        continue;
      }
      
      try {
        if (network === 'bitcoin') {
          health[network] = { status: 'configured', lastBlock: 'N/A' };
        } else {
          const blockNumber = await service.provider.getBlockNumber();
          const walletBalance = await service.provider.getBalance(service.wallet.address);
          
          health[network] = {
            status: 'connected',
            lastBlock: blockNumber,
            walletBalance: require('ethers').formatEther(walletBalance),
            walletAddress: service.wallet.address
          };
        }
      } catch (error) {
        health[network] = {
          status: 'error',
          error: error.message
        };
      }
    }
    
    return health;
  }
}

// ✅ CORRECTO: Crear la instancia DESPUÉS de declarar la clase
console.log('🔧 EXPORT: Creando singleton...');
module.exports = new BlockchainServiceManager();
console.log('🔧 EXPORT: Singleton creado');