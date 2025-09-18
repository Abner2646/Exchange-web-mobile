// jobs/blockchain.jobs.js - VERSIÓN OPTIMIZADA PARA DEPÓSITOS
const BlockchainServiceManager = require('../services/blockchain');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda } = require('../models');
require('dotenv').config();

class BlockchainJobManager {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    this.intervals = {
      depositScan: parseInt(process.env.DEPOSIT_SCAN_INTERVAL_MS) || 60000, // 1 minuto
      confirmationUpdate: parseInt(process.env.CONFIRMATION_UPDATE_INTERVAL_MS) || 30000, // 30 segundos
    };
    
    // Contadores para estadísticas
    this.stats = {
      lastScanTime: null,
      totalDepositsFound: 0,
      successfulScans: 0,
      failedScans: 0,
      networksScanned: 0,
      addressesScanned: 0
    };
  }

  // =================== JOB PRINCIPAL: ESCANEAR DEPÓSITOS ===================
  async runDepositScanJob() {
    const startTime = Date.now();
    
    try {
      console.log('🔍 [DEPOSIT_SCAN] =================== INICIANDO ESCANEO ===================');
      
      // Obtener estadísticas pre-escaneo
      const preStats = await this.getPreScanStats();
      console.log(`🔍 [DEPOSIT_SCAN] Direcciones activas: ${preStats.totalAddresses}`);
      console.log(`🔍 [DEPOSIT_SCAN] Redes disponibles: ${preStats.networks.join(', ')}`);
      
      // Escanear cada red por separado para mejor control
      const networkResults = [];
      
      for (const network of preStats.networks) {
        try {
          console.log(`🔍 [DEPOSIT_SCAN] Escaneando red: ${network.toUpperCase()}`);
          const result = await this.scanNetworkForDeposits(network);
          networkResults.push(result);
          
          // Log inmediato del resultado
          if (result.success) {
            console.log(`✅ [DEPOSIT_SCAN] ${network}: ${result.deposits} depósitos, ${result.addressesScanned} direcciones`);
          } else {
            console.error(`❌ [DEPOSIT_SCAN] ${network}: ${result.error}`);
          }
          
        } catch (networkError) {
          console.error(`❌ [DEPOSIT_SCAN] Error crítico en ${network}:`, networkError.message);
          networkResults.push({
            network,
            success: false,
            error: networkError.message,
            deposits: 0,
            addressesScanned: 0
          });
        }
      }
      
      // Consolidar resultados
      const totalDeposits = networkResults.reduce((sum, r) => sum + (r.deposits || 0), 0);
      const totalAddressesScanned = networkResults.reduce((sum, r) => sum + (r.addressesScanned || 0), 0);
      const networksWithErrors = networkResults.filter(r => !r.success).length;
      
      // Actualizar estadísticas
      this.stats.lastScanTime = new Date();
      this.stats.totalDepositsFound += totalDeposits;
      this.stats.successfulScans += networkResults.filter(r => r.success).length;
      this.stats.failedScans += networksWithErrors;
      this.stats.networksScanned += networkResults.length;
      this.stats.addressesScanned += totalAddressesScanned;
      
      const duration = Date.now() - startTime;
      
      console.log(`✅ [DEPOSIT_SCAN] =================== ESCANEO COMPLETADO ===================`);
      console.log(`✅ [DEPOSIT_SCAN] Duración: ${duration}ms`);
      console.log(`✅ [DEPOSIT_SCAN] Depósitos encontrados: ${totalDeposits}`);
      console.log(`✅ [DEPOSIT_SCAN] Direcciones escaneadas: ${totalAddressesScanned}`);
      console.log(`✅ [DEPOSIT_SCAN] Redes exitosas: ${networkResults.length - networksWithErrors}/${networkResults.length}`);
      
      if (networksWithErrors > 0) {
        console.log(`⚠️ [DEPOSIT_SCAN] Redes con errores: ${networksWithErrors}`);
      }
      
      return {
        success: true,
        totalDeposits,
        totalAddressesScanned,
        networkResults,
        duration,
        timestamp: new Date()
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [DEPOSIT_SCAN] Error general después de ${duration}ms:`, error.message);
      console.error(`❌ [DEPOSIT_SCAN] Stack trace:`, error.stack);
      
      this.stats.failedScans++;
      
      return {
        success: false,
        error: error.message,
        duration,
        timestamp: new Date()
      };
    }
  }

  // =================== ESCANEO POR RED ===================
  async scanNetworkForDeposits(network) {
    try {
      // Obtener direcciones activas para esta red
      const addresses = await this.getActiveAddressesForNetwork(network);
      
      if (addresses.length === 0) {
        return {
          network,
          success: true,
          deposits: 0,
          addressesScanned: 0,
          message: 'No hay direcciones activas para esta red'
        };
      }
      
      console.log(`🔍 [${network.toUpperCase()}] Direcciones a escanear: ${addresses.length}`);
      
      // Validar direcciones antes del escaneo
      const validAddresses = await this.validateAddresses(addresses, network);
      
      if (validAddresses.length !== addresses.length) {
        console.warn(`⚠️ [${network.toUpperCase()}] Direcciones inválidas detectadas: ${addresses.length - validAddresses.length}`);
      }
      
      // Obtener servicio de blockchain
      const service = BlockchainServiceManager.getService(network);
      if (!service) {
        throw new Error(`Servicio blockchain no disponible para ${network}`);
      }
      
      // Escanear usando el servicio específico
      console.log(`🔍 [${network.toUpperCase()}] Iniciando escaneo con servicio...`);
      const deposits = await service.scanForDeposits();
      
      console.log(`🔍 [${network.toUpperCase()}] Escaneo completado: ${deposits.length} depósitos`);
      
      // Procesar cada depósito encontrado
      const processedDeposits = [];
      for (const deposit of deposits) {
        try {
          // Log del depósito procesado
          console.log(`💰 [${network.toUpperCase()}] Depósito procesado:`, {
            usuario: deposit.userId,
            cantidad: deposit.cantidad,
            crypto: deposit.criptomoneda?.symbol,
            txHash: deposit.txHash,
            confirmaciones: deposit.confirmaciones
          });
          
          processedDeposits.push(deposit);
        } catch (processError) {
          console.error(`❌ [${network.toUpperCase()}] Error procesando depósito:`, processError.message);
        }
      }
      
      return {
        network,
        success: true,
        deposits: processedDeposits.length,
        addressesScanned: validAddresses.length,
        processedDeposits
      };
      
    } catch (error) {
      console.error(`❌ [${network.toUpperCase()}] Error en escaneo:`, error.message);
      return {
        network,
        success: false,
        error: error.message,
        deposits: 0,
        addressesScanned: 0
      };
    }
  }

  // =================== MÉTODOS AUXILIARES ===================
  
  async getPreScanStats() {
    try {
      // Obtener todas las direcciones activas agrupadas por red
      const addressStats = await DireccionDeposito.findAll({
        where: { activa: true },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { activa: true },
            attributes: ['red', 'symbol']
          }
        ],
        attributes: ['id', 'direccion', 'criptomonedaId']
      });
      
      const networkCounts = {};
      addressStats.forEach(addr => {
        const network = addr.criptomoneda.red;
        if (!networkCounts[network]) {
          networkCounts[network] = 0;
        }
        networkCounts[network]++;
      });
      
      return {
        totalAddresses: addressStats.length,
        networks: Object.keys(networkCounts),
        networkCounts
      };
      
    } catch (error) {
      console.error('Error obteniendo estadísticas pre-escaneo:', error.message);
      return {
        totalAddresses: 0,
        networks: [],
        networkCounts: {}
      };
    }
  }
  
  async getActiveAddressesForNetwork(network) {
    try {
      return await DireccionDeposito.findAll({
        where: { activa: true },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { 
              red: network.toLowerCase(),
              activa: true 
            }
          }
        ]
      });
    } catch (error) {
      console.error(`Error obteniendo direcciones para ${network}:`, error.message);
      return [];
    }
  }
  
  async validateAddresses(addresses, network) {
    const validAddresses = [];
    
    for (const address of addresses) {
      try {
        // Validación básica de formato
        if (!address.direccion || address.direccion.length < 10) {
          console.warn(`⚠️ Dirección inválida detectada: ${address.direccion}`);
          continue;
        }
        
        // Validación específica por red
        let isValid = false;
        
        switch (network.toLowerCase()) {
          case 'bitcoin':
          case 'testnet3':
            // Bitcoin: debe empezar con 1, 3, bc1, tb1, m, n, 2
            isValid = /^[13mn2]|^bc1|^tb1/.test(address.direccion);
            break;
            
          case 'ethereum':
          case 'sepolia':
          case 'bsc':
          case 'bsc-testnet':
            // Ethereum/BSC: formato hexadecimal 0x...
            isValid = /^0x[a-fA-F0-9]{40}$/.test(address.direccion);
            break;
            
          default:
            isValid = true; // Asumir válida para redes desconocidas
        }
        
        if (isValid) {
          validAddresses.push(address);
        } else {
          console.warn(`⚠️ [${network}] Dirección con formato inválido: ${address.direccion}`);
        }
        
      } catch (error) {
        console.error(`Error validando dirección ${address.direccion}:`, error.message);
      }
    }
    
    return validAddresses;
  }

  // =================== JOB: ACTUALIZAR CONFIRMACIONES ===================
  async runConfirmationUpdateJob() {
    const startTime = Date.now();
    
    try {
      console.log('🔄 [CONFIRMATION_UPDATE] Iniciando actualización de confirmaciones...');
      
      // Obtener transacciones pendientes por red
      const pendingByNetwork = await this.getPendingTransactionsByNetwork();
      
      const results = [];
      
      for (const [network, transactions] of Object.entries(pendingByNetwork)) {
        if (transactions.length === 0) continue;
        
        try {
          console.log(`🔄 [${network.toUpperCase()}] Actualizando ${transactions.length} transacciones...`);
          
          const service = BlockchainServiceManager.getService(network);
          if (!service) {
            console.warn(`⚠️ Servicio no disponible para ${network}`);
            continue;
          }
          
          const updated = await service.updateConfirmations();
          
          results.push({
            network,
            success: true,
            updated: updated.length,
            pending: transactions.length
          });
          
          console.log(`✅ [${network.toUpperCase()}] ${updated.length} transacciones actualizadas`);
          
        } catch (error) {
          console.error(`❌ [${network.toUpperCase()}] Error actualizando confirmaciones:`, error.message);
          results.push({
            network,
            success: false,
            error: error.message,
            updated: 0,
            pending: transactions.length
          });
        }
      }
      
      const duration = Date.now() - startTime;
      const totalUpdated = results.reduce((sum, r) => sum + (r.updated || 0), 0);
      
      console.log(`✅ [CONFIRMATION_UPDATE] Completado en ${duration}ms. Total actualizadas: ${totalUpdated}`);
      
      return results;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [CONFIRMATION_UPDATE] Error general después de ${duration}ms:`, error.message);
      return [];
    }
  }
  
  async getPendingTransactionsByNetwork() {
    try {
      const pendingTxs = await TransaccionBlockchain.findAll({
        where: {
          estado: ['pendiente', 'procesando'],
          txHash: { [require('sequelize').Op.ne]: null }
        },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            attributes: ['red']
          }
        ]
      });
      
      // Agrupar por red
      const byNetwork = {};
      pendingTxs.forEach(tx => {
        const network = tx.criptomoneda.red;
        if (!byNetwork[network]) {
          byNetwork[network] = [];
        }
        byNetwork[network].push(tx);
      });
      
      return byNetwork;
    } catch (error) {
      console.error('Error obteniendo transacciones pendientes:', error.message);
      return {};
    }
  }

  // =================== CONTROL DE JOBS ===================
  
  start() {
    if (this.isRunning) {
      console.log('⚠️ Los jobs de depósitos ya están ejecutándose');
      return;
    }

    console.log('🚀 Iniciando jobs de detección de depósitos...');
    this.isRunning = true;

    // Job principal: escanear depósitos
    this.jobs.set('depositScan', setInterval(async () => {
      await this.runDepositScanJob();
    }, this.intervals.depositScan));

    // Job secundario: actualizar confirmaciones
    this.jobs.set('confirmationUpdate', setInterval(async () => {
      await this.runConfirmationUpdateJob();
    }, this.intervals.confirmationUpdate));

    console.log('✅ Jobs de depósitos iniciados exitosamente');
    this.logJobStatus();
    
    // Ejecutar primer escaneo inmediatamente
    setTimeout(() => {
      console.log('🔍 Ejecutando primer escaneo de depósitos...');
      this.runDepositScanJob();
    }, 5000); // Esperar 5 segundos
  }

  stop() {
    console.log('🛑 Deteniendo jobs de depósitos...');
    
    for (const [jobName, intervalId] of this.jobs) {
      clearInterval(intervalId);
      console.log(`✅ Job ${jobName} detenido`);
    }

    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Todos los jobs de depósitos detenidos');
  }

  restart() {
    this.stop();
    setTimeout(() => {
      this.start();
    }, 2000);
  }

  // Ejecutar job específico manualmente
  async runJobManually(jobName) {
    console.log(`🔧 Ejecutando job ${jobName} manualmente...`);
    
    switch (jobName) {
      case 'depositScan':
        return await this.runDepositScanJob();
      case 'confirmationUpdate':
        return await this.runConfirmationUpdateJob();
      default:
        throw new Error(`Job desconocido: ${jobName}`);
    }
  }

  // Obtener estadísticas detalladas
  getDetailedStats() {
    return {
      running: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      intervals: this.intervals,
      stats: this.stats,
      uptime: this.stats.lastScanTime ? 
        Date.now() - new Date(this.stats.lastScanTime).getTime() : null
    };
  }

  logJobStatus() {
    const status = this.getDetailedStats();
    console.log('📊 Estado de jobs de depósitos:');
    console.log(`   - Estado: ${status.running ? '🟢 Ejecutándose' : '🔴 Detenidos'}`);
    console.log(`   - Jobs activos: ${status.activeJobs.join(', ')}`);
    console.log(`   - Depósitos encontrados: ${status.stats.totalDepositsFound}`);
    console.log(`   - Direcciones escaneadas: ${status.stats.addressesScanned}`);
    console.log(`   - Último escaneo: ${status.stats.lastScanTime || 'Nunca'}`);
    console.log(`   - Intervalos:`);
    Object.entries(status.intervals).forEach(([job, interval]) => {
      console.log(`     • ${job}: cada ${interval / 1000}s`);
    });
  }
}

// Crear instancia global
const blockchainJobManager = new BlockchainJobManager();

// Manejo de señales para cierre limpio
process.on('SIGINT', () => {
  console.log('\n🛑 Señal SIGINT recibida, deteniendo jobs...');
  blockchainJobManager.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Señal SIGTERM recibida, deteniendo jobs...');
  blockchainJobManager.stop();
  process.exit(0);
});

module.exports = blockchainJobManager;