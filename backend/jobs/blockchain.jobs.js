// jobs/blockchainJobs.js
const BlockchainServiceManager = require('../services/blockchain');
const { TransaccionBlockchain } = require('../models');

class BlockchainJobManager {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
    this.intervals = {
      depositScan: parseInt(process.env.DEPOSIT_SCAN_INTERVAL_MS) || 60000, // 1 minuto
      confirmationUpdate: parseInt(process.env.CONFIRMATION_UPDATE_INTERVAL_MS) || 30000, // 30 segundos
      withdrawalProcess: parseInt(process.env.WITHDRAWAL_PROCESS_INTERVAL_MS) || 120000, // 2 minutos
      healthCheck: parseInt(process.env.HEALTH_CHECK_INTERVAL) * 60000 || 600000 // 10 minutos
    };
  }

  // Iniciar todos los jobs
  start() {
    if (this.isRunning) {
      console.log('⚠️ Los jobs de blockchain ya están ejecutándose');
      return;
    }

    console.log('🚀 Iniciando jobs de blockchain...');
    this.isRunning = true;

    // Job 1: Escanear depósitos
    this.jobs.set('depositScan', setInterval(async () => {
      await this.runDepositScanJob();
    }, this.intervals.depositScan));

    // Job 2: Actualizar confirmaciones
    this.jobs.set('confirmationUpdate', setInterval(async () => {
      await this.runConfirmationUpdateJob();
    }, this.intervals.confirmationUpdate));

    // Job 3: Procesar retiros
    this.jobs.set('withdrawalProcess', setInterval(async () => {
      await this.runWithdrawalProcessJob();
    }, this.intervals.withdrawalProcess));

    // Job 4: Health check
    this.jobs.set('healthCheck', setInterval(async () => {
      await this.runHealthCheckJob();
    }, this.intervals.healthCheck));

    console.log('✅ Todos los jobs de blockchain iniciados exitosamente');
    this.logJobStatus();
  }

  // Detener todos los jobs
  stop() {
    console.log('🛑 Deteniendo jobs de blockchain...');
    
    for (const [jobName, intervalId] of this.jobs) {
      clearInterval(intervalId);
      console.log(`✅ Job ${jobName} detenido`);
    }

    this.jobs.clear();
    this.isRunning = false;
    console.log('✅ Todos los jobs de blockchain detenidos');
  }

  // Reiniciar todos los jobs
  restart() {
    this.stop();
    setTimeout(() => {
      this.start();
    }, 2000);
  }

  // =================== JOB: ESCANEAR DEPÓSITOS ===================
  async runDepositScanJob() {
    const startTime = Date.now();
    
    try {
      console.log('🔍 [DEPOSIT_SCAN] Iniciando escaneo de depósitos...');
      
      const results = await BlockchainServiceManager.scanAllNetworksForDeposits();
      
      let totalDeposits = 0;
      let networksWithErrors = 0;

      for (const result of results) {
        if (result.success) {
          totalDeposits += result.deposits;
          if (result.deposits > 0) {
            console.log(`✅ [DEPOSIT_SCAN] ${result.network}: ${result.deposits} nuevos depósitos`);
          }
        } else {
          networksWithErrors++;
          console.error(`❌ [DEPOSIT_SCAN] Error en ${result.network}: ${result.error}`);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [DEPOSIT_SCAN] Completado en ${duration}ms. Total: ${totalDeposits} depósitos, ${networksWithErrors} errores`);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [DEPOSIT_SCAN] Error general después de ${duration}ms:`, error.message);
    }
  }

  // =================== JOB: ACTUALIZAR CONFIRMACIONES ===================
  async runConfirmationUpdateJob() {
    const startTime = Date.now();
    
    try {
      console.log('🔄 [CONFIRMATION_UPDATE] Iniciando actualización de confirmaciones...');
      
      const results = await BlockchainServiceManager.updateAllConfirmations();
      
      let totalUpdated = 0;
      let networksWithErrors = 0;

      for (const result of results) {
        if (result.success) {
          totalUpdated += result.updated;
          if (result.updated > 0) {
            console.log(`✅ [CONFIRMATION_UPDATE] ${result.network}: ${result.updated} transacciones actualizadas`);
          }
        } else {
          networksWithErrors++;
          console.error(`❌ [CONFIRMATION_UPDATE] Error en ${result.network}: ${result.error}`);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [CONFIRMATION_UPDATE] Completado en ${duration}ms. Total: ${totalUpdated} actualizaciones, ${networksWithErrors} errores`);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [CONFIRMATION_UPDATE] Error general después de ${duration}ms:`, error.message);
    }
  }

  // =================== JOB: PROCESAR RETIROS ===================
  async runWithdrawalProcessJob() {
    const startTime = Date.now();
    
    try {
      console.log('💸 [WITHDRAWAL_PROCESS] Iniciando procesamiento de retiros...');
      
      const results = await BlockchainServiceManager.processAllPendingWithdrawals();
      
      let totalProcessed = 0;
      let networksWithErrors = 0;

      for (const result of results) {
        if (result.success) {
          totalProcessed += result.processed;
          if (result.processed > 0) {
            console.log(`✅ [WITHDRAWAL_PROCESS] ${result.network}: ${result.processed} retiros procesados`);
          }
        } else {
          networksWithErrors++;
          console.error(`❌ [WITHDRAWAL_PROCESS] Error en ${result.network}: ${result.error}`);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`✅ [WITHDRAWAL_PROCESS] Completado en ${duration}ms. Total: ${totalProcessed} retiros, ${networksWithErrors} errores`);

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [WITHDRAWAL_PROCESS] Error general después de ${duration}ms:`, error.message);
    }
  }

  // =================== JOB: HEALTH CHECK ===================
  async runHealthCheckJob() {
    const startTime = Date.now();
    
    try {
      console.log('💓 [HEALTH_CHECK] Iniciando verificación de salud del sistema...');
      
      const healthData = {
        timestamp: new Date(),
        services: {},
        transactionStats: {},
        systemAlerts: []
      };

      // Verificar estado de servicios blockchain
      for (const [network, service] of Object.entries(BlockchainServiceManager.services)) {
        try {
          if (network === 'bitcoin') {
            healthData.services[network] = { status: 'connected', lastBlock: 'N/A' };
          } else {
            const blockNumber = await service.provider.getBlockNumber();
            healthData.services[network] = { status: 'connected', lastBlock: blockNumber };
          }
        } catch (error) {
          healthData.services[network] = { status: 'error', error: error.message };
          healthData.systemAlerts.push(`Servicio ${network} desconectado: ${error.message}`);
        }
      }

      // Estadísticas rápidas de transacciones
      const stats = await this.getQuickTransactionStats();
      healthData.transactionStats = stats;

      // Alertas del sistema
      await this.checkSystemAlerts(healthData);

      const duration = Date.now() - startTime;
      console.log(`✅ [HEALTH_CHECK] Completado en ${duration}ms. Servicios: ${Object.keys(healthData.services).length}, Alertas: ${healthData.systemAlerts.length}`);

      // Log alertas si existen
      if (healthData.systemAlerts.length > 0) {
        console.warn('⚠️ [HEALTH_CHECK] Alertas del sistema:');
        healthData.systemAlerts.forEach(alert => console.warn(`   - ${alert}`));
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [HEALTH_CHECK] Error general después de ${duration}ms:`, error.message);
    }
  }

  // =================== MÉTODOS AUXILIARES ===================

  async getQuickTransactionStats() {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const stats = await TransaccionBlockchain.findAll({
        attributes: [
          'tipo',
          'estado',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where: {
          created_at: { [require('sequelize').Op.gte]: last24h }
        },
        group: ['tipo', 'estado'],
        raw: true
      });

      return stats.reduce((acc, stat) => {
        const key = `${stat.tipo}_${stat.estado}`;
        acc[key] = parseInt(stat.count);
        return acc;
      }, {});
    } catch (error) {
      console.error('Error obteniendo estadísticas rápidas:', error.message);
      return {};
    }
  }

  async checkSystemAlerts(healthData) {
    try {
      // Alerta 1: Retiros pendientes por mucho tiempo
      const oldWithdrawals = await TransaccionBlockchain.count({
        where: {
          tipo: 'retiro',
          estado: 'pendiente',
          created_at: {
            [require('sequelize').Op.lt]: new Date(Date.now() - 30 * 60 * 1000) // 30 minutos
          }
        }
      });

      if (oldWithdrawals > 0) {
        healthData.systemAlerts.push(`${oldWithdrawals} retiros pendientes por más de 30 minutos`);
      }

      // Alerta 2: Muchos depósitos sin confirmar
      const unconfirmedDeposits = await TransaccionBlockchain.count({
        where: {
          tipo: 'deposito',
          estado: ['pendiente', 'procesando'],
          created_at: {
            [require('sequelize').Op.lt]: new Date(Date.now() - 60 * 60 * 1000) // 1 hora
          }
        }
      });

      if (unconfirmedDeposits > 10) {
        healthData.systemAlerts.push(`${unconfirmedDeposits} depósitos sin confirmar por más de 1 hora`);
      }

      // Alerta 3: Transacciones fallidas recientes
      const recentFailures = await TransaccionBlockchain.count({
        where: {
          estado: 'fallido',
          created_at: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 60 * 60 * 1000) // última hora
          }
        }
      });

      if (recentFailures > 5) {
        healthData.systemAlerts.push(`${recentFailures} transacciones fallidas en la última hora`);
      }

    } catch (error) {
      console.error('Error verificando alertas del sistema:', error.message);
      healthData.systemAlerts.push('Error verificando alertas del sistema');
    }
  }

  // Ejecutar job específico manualmente
  async runJobManually(jobName) {
    console.log(`🔧 Ejecutando job ${jobName} manualmente...`);
    
    switch (jobName) {
      case 'depositScan':
        await this.runDepositScanJob();
        break;
      case 'confirmationUpdate':
        await this.runConfirmationUpdateJob();
        break;
      case 'withdrawalProcess':
        await this.runWithdrawalProcessJob();
        break;
      case 'healthCheck':
        await this.runHealthCheckJob();
        break;
      default:
        throw new Error(`Job desconocido: ${jobName}`);
    }
  }

  // Obtener estado de los jobs
  getStatus() {
    return {
      running: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      intervals: this.intervals
    };
  }

  // Log del estado actual
  logJobStatus() {
    const status = this.getStatus();
    console.log('📊 Estado de jobs de blockchain:');
    console.log(`   - Estado: ${status.running ? '🟢 Ejecutándose' : '🔴 Detenidos'}`);
    console.log(`   - Jobs activos: ${status.activeJobs.join(', ')}`);
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
