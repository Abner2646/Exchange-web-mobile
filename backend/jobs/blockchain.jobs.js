// jobs/blockchain.jobs.js - VERSIÓN MEJORADA CON DIAGNÓSTICOS
const BlockchainServiceManager = require('../services/blockchain');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda, BlockchainState } = require('../models');
require('dotenv').config();

class BlockchainJobManager {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    this.intervals = {
      depositScan: parseInt(process.env.DEPOSIT_SCAN_INTERVAL_MS) || 60000, // 1 minuto
      confirmationUpdate: parseInt(process.env.CONFIRMATION_UPDATE_INTERVAL_MS) || 30000, // 30 segundos
      // Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #8): este intervalo ya
      // estaba en .env.template (WITHDRAWAL_PROCESS_INTERVAL_MS) pero nunca
      // se usaba en ningún lado — no existía el job que lo consumiera.
      withdrawalProcess: parseInt(process.env.WITHDRAWAL_PROCESS_INTERVAL_MS) || 120000, // 2 minutos
    };
    
    // Contadores para estadísticas
    this.stats = {
      lastScanTime: null,
      totalDepositsFound: 0,
      successfulScans: 0,
      failedScans: 0,
      networksScanned: 0,
      addressesScanned: 0,
      lastDiagnostic: null
    };
  }

  // =================== DIAGNÓSTICO DEL SISTEMA ===================
  async runSystemDiagnostic() {
    console.log('🔬 =================== DIAGNÓSTICO DEL SISTEMA ===================');
    
    const diagnostic = {
      timestamp: new Date(),
      services: {},
      networks: {},
      apiKeys: {},
      database: {},
      overallHealth: 'unknown'
    };

    try {
      // ✅ 1. Verificar servicios blockchain
      console.log('🔬 Verificando servicios blockchain...');
      const availableServices = ['ethereum', 'bsc', 'bitcoin'];
      
      for (const network of availableServices) {
        try {
          const service = BlockchainServiceManager.getService(network);
          diagnostic.services[network] = {
            available: !!service,
            initialized: !!service,
            error: null
          };
          
          if (service) {
            console.log(`✅ Servicio ${network}: Disponible`);
          } else {
            console.log(`❌ Servicio ${network}: No disponible`);
          }
        } catch (error) {
          diagnostic.services[network] = {
            available: false,
            initialized: false,
            error: error.message
          };
          console.log(`❌ Servicio ${network}: Error - ${error.message}`);
        }
      }

      // ✅ 2. Verificar API Keys
      console.log('🔬 Verificando API Keys...');
      diagnostic.apiKeys = {
        etherscan: !!process.env.ETHERSCAN_API_KEY,
        blockcypher: !!process.env.BLOCKCYPHER_TOKEN
      };

      console.log(`   - Etherscan API V2 (todas las redes EVM): ${diagnostic.apiKeys.etherscan ? '✅' : '❌'}`);
      console.log(`   - BlockCypher API (Bitcoin): ${diagnostic.apiKeys.blockcypher ? '✅' : '❌'}`);
      
      if (!diagnostic.apiKeys.etherscan) {
        console.log(`   ⚠️ Sin Etherscan API, Ethereum y BSC NO funcionarán`);
      }

      // ✅ 3. Verificar estado de redes en DB
      console.log('🔬 Verificando estado de redes...');
      for (const network of availableServices) {
        try {
          const stats = await BlockchainState.getNetworkStats(network);
          diagnostic.networks[network] = stats || {
            lastProcessedBlock: 0,
            totalDepositsFound: 0,
            lastScanTimestamp: null
          };
          console.log(`✅ Red ${network}: Último bloque ${diagnostic.networks[network].lastProcessedBlock}`);
        } catch (error) {
          diagnostic.networks[network] = { error: error.message };
          console.log(`❌ Red ${network}: Error - ${error.message}`);
        }
      }

      // ✅ 4. Verificar base de datos
      console.log('🔬 Verificando base de datos...');
      try {
        const addressCount = await DireccionDeposito.count({ where: { activa: true } });
        const pendingTxCount = await TransaccionBlockchain.count({ 
          where: { estado: ['pendiente', 'procesando'] } 
        });
        
        diagnostic.database = {
          activeAddresses: addressCount,
          pendingTransactions: pendingTxCount,
          connected: true
        };
        
        console.log(`✅ DB: ${addressCount} direcciones activas, ${pendingTxCount} transacciones pendientes`);
      } catch (error) {
        diagnostic.database = {
          connected: false,
          error: error.message
        };
        console.log(`❌ DB: Error - ${error.message}`);
      }

      // ✅ 5. Determinar salud general
      const criticalIssues = [];
      
      if (!diagnostic.database.connected) {
        criticalIssues.push('Base de datos no disponible');
      }
      
      if (!diagnostic.apiKeys.etherscan && !diagnostic.apiKeys.bscscan) {
        criticalIssues.push('Ninguna API key disponible');
      }
      
      const workingServices = Object.values(diagnostic.services).filter(s => s.available).length;
      if (workingServices === 0) {
        criticalIssues.push('Ningún servicio blockchain disponible');
      }

      if (criticalIssues.length === 0) {
        diagnostic.overallHealth = 'healthy';
        console.log('✅ Sistema: Saludable');
      } else if (criticalIssues.length <= 2) {
        diagnostic.overallHealth = 'warning';
        console.log('⚠️ Sistema: Advertencias');
      } else {
        diagnostic.overallHealth = 'critical';
        console.log('❌ Sistema: Crítico');
      }

      if (criticalIssues.length > 0) {
        console.log('🔬 Problemas encontrados:');
        criticalIssues.forEach(issue => console.log(`   - ${issue}`));
      }

      this.stats.lastDiagnostic = diagnostic;
      
      console.log('🔬 =================== DIAGNÓSTICO COMPLETADO ===================');
      return diagnostic;

    } catch (error) {
      console.error('❌ Error en diagnóstico del sistema:', error.message);
      diagnostic.overallHealth = 'critical';
      diagnostic.error = error.message;
      return diagnostic;
    }
  }

  // =================== JOB PRINCIPAL: ESCANEAR DEPÓSITOS ===================
  async runDepositScanJob() {
    const startTime = Date.now();
    
    try {
      console.log('🔍 [DEPOSIT_SCAN] =================== INICIANDO ESCANEO ===================');
      
      // ✅ Ejecutar diagnóstico antes del escaneo si es necesario
      if (!this.stats.lastDiagnostic || 
          (Date.now() - new Date(this.stats.lastDiagnostic.timestamp).getTime()) > 300000) { // 5 minutos
        await this.runSystemDiagnostic();
      }

      // ✅ Verificar que el sistema esté saludable
      if (this.stats.lastDiagnostic?.overallHealth === 'critical') {
        console.log('❌ [DEPOSIT_SCAN] Sistema en estado crítico, abortando escaneo');
        return {
          success: false,
          error: 'Sistema en estado crítico',
          duration: Date.now() - startTime,
          timestamp: new Date()
        };
      }
      
      // Obtener estadísticas pre-escaneo
      const preStats = await this.getPreScanStats();
      console.log(`🔍 [DEPOSIT_SCAN] Direcciones activas: ${preStats.totalAddresses}`);
      console.log(`🔍 [DEPOSIT_SCAN] Redes disponibles: ${preStats.networks.join(', ')}`);
      
      // Escanear cada red por separado para mejor control
      const networkResults = [];
      
      for (const network of preStats.networks) {
        try {
          console.log(`🔍 [DEPOSIT_SCAN] Escaneando red: ${network.toUpperCase()}`);
          
          // ✅ Verificar si el servicio está disponible
          const service = BlockchainServiceManager.getService(network);
          if (!service) {
            console.log(`⚠️ [DEPOSIT_SCAN] Servicio ${network} no disponible, saltando...`);
            networkResults.push({
              network,
              success: false,
              error: 'Servicio no disponible',
              deposits: 0,
              addressesScanned: 0
            });
            continue;
          }
          
          const result = await this.scanNetworkForDeposits(network);
          networkResults.push(result);
          
          // Log inmediato del resultado
          if (result.success) {
            console.log(`✅ [DEPOSIT_SCAN] ${network}: ${result.deposits} depósitos, ${result.addressesScanned} direcciones`);
            
            // ✅ Actualizar estadísticas en BlockchainState
            if (result.deposits > 0) {
              await BlockchainState.incrementDepositsFound(network, result.deposits);
            }
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

  // =================== ESCANEO POR RED (MEJORADO) ===================
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
      
      // ✅ Verificar configuración de red antes de escanear
      const diagnostic = this.stats.lastDiagnostic;
      if (!diagnostic?.services[network]?.available) {
        throw new Error(`Servicio ${network} reportado como no disponible en diagnóstico`);
      }

      // ✅ Verificar API keys necesarias
      if ((network === 'ethereum' || network === 'sepolia') && !diagnostic?.apiKeys?.etherscan) {
        throw new Error('Etherscan API key requerida para escanear Ethereum/Sepolia');
      }
      if ((network === 'bsc' || network === 'bsc-testnet') && !diagnostic?.apiKeys?.etherscan) {
        throw new Error('Etherscan API key requerida para escanear BSC');
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

  // =================== MÉTODOS AUXILIARES (mantenemos los existentes) ===================
  
  async getPreScanStats() {
    try {
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
        if (!address.direccion || address.direccion.length < 10) {
          console.warn(`⚠️ Dirección inválida detectada: ${address.direccion}`);
          continue;
        }
        
        let isValid = false;
        
        switch (network.toLowerCase()) {
          case 'bitcoin':
          case 'testnet3':
            isValid = /^[13mn2]|^bc1|^tb1/.test(address.direccion);
            break;
            
          case 'ethereum':
          case 'sepolia':
          case 'bsc':
          case 'bsc-testnet':
            isValid = /^0x[a-fA-F0-9]{40}$/.test(address.direccion);
            break;
            
          default:
            isValid = true;
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

  // =================== JOB: ACTUALIZAR CONFIRMACIONES (mantenemos existente) ===================
  async runConfirmationUpdateJob() {
    const startTime = Date.now();
    
    try {
      console.log('🔄 [CONFIRMATION_UPDATE] Iniciando actualización de confirmaciones...');
      
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
  
  // Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #8): createWithdrawal
  // bloquea el balance del usuario apenas se crea el retiro, pero hasta
  // ahora ningún job ni ruta llamaba a processPendingWithdrawals() — que sí
  // está bien implementada en cada servicio de red — así que todo retiro
  // quedaba con fondos bloqueados para siempre, sin nada que lo complete ni
  // lo libere. Mismo patrón que runConfirmationUpdateJob: iterar por red,
  // dejar que cada service resuelva sus propios retiros pendientes.
  async runWithdrawalProcessJob() {
    const startTime = Date.now();

    try {
      console.log('💸 [WITHDRAWAL_PROCESS] Iniciando procesamiento de retiros pendientes...');

      if (this.stats.lastDiagnostic?.overallHealth === 'critical') {
        console.log('❌ [WITHDRAWAL_PROCESS] Sistema en estado crítico, abortando procesamiento');
        return { success: false, error: 'Sistema en estado crítico', duration: Date.now() - startTime };
      }

      const networks = ['ethereum', 'bsc', 'bitcoin'];
      const results = [];

      for (const network of networks) {
        try {
          const service = BlockchainServiceManager.getService(network);
          if (!service) {
            console.warn(`⚠️ [WITHDRAWAL_PROCESS] Servicio no disponible para ${network}`);
            continue;
          }

          const processed = await service.processPendingWithdrawals();
          results.push({ network, success: true, processed: processed.length });

          if (processed.length > 0) {
            console.log(`✅ [WITHDRAWAL_PROCESS] ${network}: ${processed.length} retiros procesados`);
          }
        } catch (error) {
          console.error(`❌ [WITHDRAWAL_PROCESS] Error en ${network}:`, error.message);
          results.push({ network, success: false, error: error.message, processed: 0 });
        }
      }

      const duration = Date.now() - startTime;
      const totalProcessed = results.reduce((sum, r) => sum + (r.processed || 0), 0);
      console.log(`✅ [WITHDRAWAL_PROCESS] Completado en ${duration}ms. Total procesados: ${totalProcessed}`);

      return { success: true, totalProcessed, results, duration, timestamp: new Date() };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [WITHDRAWAL_PROCESS] Error general después de ${duration}ms:`, error.message);
      return { success: false, error: error.message, duration, timestamp: new Date() };
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

  // =================== CONTROL DE JOBS MEJORADO ===================
  
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

    // Job de retiros: antes no existía, ver runWithdrawalProcessJob
    this.jobs.set('withdrawalProcess', setInterval(async () => {
      await this.runWithdrawalProcessJob();
    }, this.intervals.withdrawalProcess));

    // Job de diagnóstico periódico (cada 10 minutos)
    this.jobs.set('systemDiagnostic', setInterval(async () => {
      await this.runSystemDiagnostic();
    }, 600000));

    console.log('✅ Jobs de depósitos iniciados exitosamente');
    this.logJobStatus();
    
    // Ejecutar primer diagnóstico y escaneo inmediatamente
    setTimeout(async () => {
      console.log('🔬 Ejecutando diagnóstico inicial...');
      await this.runSystemDiagnostic();
      
      setTimeout(async () => {
        console.log('🔍 Ejecutando primer escaneo de depósitos...');
        await this.runDepositScanJob();
      }, 5000);
    }, 2000);
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
      case 'withdrawalProcess':
        return await this.runWithdrawalProcessJob();
      case 'systemDiagnostic':
        return await this.runSystemDiagnostic();
      default:
        throw new Error(`Job desconocido: ${jobName}`);
    }
  }

  // =================== MÉTODOS DE MONITOREO MEJORADOS ===================

  async getDetailedStats() {
    try {
      // Obtener estadísticas de todas las redes
      const networkStats = await BlockchainState.getAllNetworksStats();
      
      return {
        running: this.isRunning,
        activeJobs: Array.from(this.jobs.keys()),
        intervals: this.intervals,
        stats: this.stats,
        networks: networkStats,
        lastDiagnostic: this.stats.lastDiagnostic,
        uptime: this.stats.lastScanTime ? 
          Date.now() - new Date(this.stats.lastScanTime).getTime() : null
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas detalladas:', error.message);
      return {
        running: this.isRunning,
        activeJobs: Array.from(this.jobs.keys()),
        intervals: this.intervals,
        stats: this.stats,
        networks: [],
        error: error.message
      };
    }
  }

  async logJobStatus() {
    try {
      const status = await this.getDetailedStats();
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

      if (status.networks && status.networks.length > 0) {
        console.log(`   - Estado de redes:`);
        status.networks.forEach(network => {
          console.log(`     • ${network.network}: Bloque ${network.lastProcessedBlock}, ${network.totalDepositsFound} depósitos`);
        });
      }

      if (status.lastDiagnostic) {
        console.log(`   - Último diagnóstico: ${status.lastDiagnostic.timestamp}`);
        console.log(`   - Salud del sistema: ${status.lastDiagnostic.overallHealth}`);
      }
    } catch (error) {
      console.error('Error mostrando estado de jobs:', error.message);
    }
  }

  // =================== MÉTODOS DE LIMPIEZA ===================

  async cleanupStuckTransactions() {
    try {
      console.log('🧹 Iniciando limpieza de transacciones problemáticas...');
      
      const BalanceCheckCleanup = require('../scripts/cleanup-balance-checks');
      const cleanup = new BalanceCheckCleanup();
      
      const results = await cleanup.findProblematicTransactions();
      
      if (results.total > 0) {
        console.log(`🧹 Encontradas ${results.total} transacciones problemáticas`);
        console.log('🧹 Ejecute el script de limpieza manualmente para corregirlas:');
        console.log('🧹 node scripts/cleanup-balance-checks.js --dry-run');
      } else {
        console.log('✅ No se encontraron transacciones problemáticas');
      }
      
      return results;
    } catch (error) {
      console.error('Error en limpieza de transacciones:', error.message);
      throw error;
    }
  }

  // =================== MÉTODOS DE CONFIGURACIÓN ===================

  async updateNetworkConfig(network, config) {
    try {
      for (const [key, value] of Object.entries(config)) {
        await BlockchainState.setConfig(network, key, value);
      }
      console.log(`✅ Configuración actualizada para ${network}`);
    } catch (error) {
      console.error(`Error actualizando configuración de ${network}:`, error.message);
      throw error;
    }
  }

  async getNetworkConfig(network) {
    try {
      return await BlockchainState.getNetworkStats(network);
    } catch (error) {
      console.error(`Error obteniendo configuración de ${network}:`, error.message);
      return null;
    }
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