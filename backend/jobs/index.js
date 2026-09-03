// jobs/index.js
const priceUpdaterJob = require('./priceUpdater.job');
const orderMatchingJob = require('./orderMatching.job');
const candleGeneratorJob = require('./candleGenerator.job');
const blockchainJobs = require('./blockchain.jobs'); // Tu job existente
const idempotencyCleanupJob = require('./idempotencyCleanup.job');
const reconciliationJob = require('./reconciliation.job');

class JobManager {

  constructor() {
    this.jobs = {
      priceUpdater: priceUpdaterJob,
      orderMatching: orderMatchingJob,
      candleGenerator: candleGeneratorJob,
      blockchain: blockchainJobs,
      idempotencyCleanup: idempotencyCleanupJob,
      reconciliation: reconciliationJob
    };
  }

  /**
   * Inicia todos los jobs
   */
  startAll() {
    console.log('\n🚀 ===== INICIANDO TODOS LOS JOBS ===== 🚀\n');

    // Jobs de Trading
    try {
      this.jobs.priceUpdater.start();
    } catch (error) {
      console.error('❌ Error iniciando Price Updater:', error.message);
    }

    try {
      this.jobs.orderMatching.start();
    } catch (error) {
      console.error('❌ Error iniciando Order Matching:', error.message);
    }

    try {
      this.jobs.candleGenerator.start();
    } catch (error) {
      console.error('❌ Error iniciando Candle Generator:', error.message);
    }

    // Jobs de Blockchain (si existen)
    if (this.jobs.blockchain && typeof this.jobs.blockchain.start === 'function') {
      try {
        this.jobs.blockchain.start();
      } catch (error) {
        console.error('❌ Error iniciando Blockchain Jobs:', error.message);
      }
    }

    try {
      this.jobs.idempotencyCleanup.start();
    } catch (error) {
      console.error('❌ Error iniciando Idempotency Cleanup:', error.message);
    }

    try {
      this.jobs.reconciliation.start();
    } catch (error) {
      console.error('❌ Error iniciando Reconciliation:', error.message);
    }

    console.log('\n✅ ===== TODOS LOS JOBS INICIADOS ===== ✅\n');
  }

  /**
   * Detiene todos los jobs
   */
  stopAll() {
    console.log('\n🛑 ===== DETENIENDO TODOS LOS JOBS ===== 🛑\n');

    Object.keys(this.jobs).forEach(jobName => {
      try {
        if (this.jobs[jobName] && typeof this.jobs[jobName].stop === 'function') {
          this.jobs[jobName].stop();
        }
      } catch (error) {
        console.error(`❌ Error deteniendo ${jobName}:`, error.message);
      }
    });

    console.log('\n✅ ===== TODOS LOS JOBS DETENIDOS ===== ✅\n');
  }

  /**
   * Inicia un job específico
   */
  start(jobName) {
    if (!this.jobs[jobName]) {
      console.error(`❌ Job '${jobName}' no encontrado`);
      return;
    }

    try {
      this.jobs[jobName].start();
    } catch (error) {
      console.error(`❌ Error iniciando ${jobName}:`, error.message);
    }
  }

  /**
   * Detiene un job específico
   */
  stop(jobName) {
    if (!this.jobs[jobName]) {
      console.error(`❌ Job '${jobName}' no encontrado`);
      return;
    }

    try {
      this.jobs[jobName].stop();
    } catch (error) {
      console.error(`❌ Error deteniendo ${jobName}:`, error.message);
    }
  }

  /**
   * Reinicia un job específico
   */
  restart(jobName) {
    if (!this.jobs[jobName]) {
      console.error(`❌ Job '${jobName}' no encontrado`);
      return;
    }

    try {
      if (typeof this.jobs[jobName].restart === 'function') {
        this.jobs[jobName].restart();
      } else {
        this.jobs[jobName].stop();
        setTimeout(() => {
          this.jobs[jobName].start();
        }, 1000);
      }
    } catch (error) {
      console.error(`❌ Error reiniciando ${jobName}:`, error.message);
    }
  }

  /**
   * Obtiene el estado de todos los jobs
   */
  getStatus() {
    const status = {};

    Object.keys(this.jobs).forEach(jobName => {
      try {
        if (this.jobs[jobName] && typeof this.jobs[jobName].getStatus === 'function') {
          status[jobName] = this.jobs[jobName].getStatus();
        } else {
          status[jobName] = { available: false };
        }
      } catch (error) {
        status[jobName] = { error: error.message };
      }
    });

    return status;
  }

  /**
   * Imprime el estado de todos los jobs
   */
  printStatus() {
    console.log('\n📊 ===== ESTADO DE JOBS ===== 📊\n');

    const status = this.getStatus();

    Object.keys(status).forEach(jobName => {
      const jobStatus = status[jobName];
      const running = jobStatus.isRunning ? '✅ Running' : '🛑 Stopped';
      
      console.log(`${jobName.toUpperCase()}:`);
      console.log(`  Estado: ${running}`);
      
      if (jobStatus.stats) {
        console.log(`  Stats:`, jobStatus.stats);
      }
      
      console.log('');
    });

    console.log('===============================\n');
  }

  /**
   * Obtiene estadísticas de todos los jobs
   */
  getStats() {
    const stats = {};

    Object.keys(this.jobs).forEach(jobName => {
      try {
        if (this.jobs[jobName] && typeof this.jobs[jobName].getStats === 'function') {
          stats[jobName] = this.jobs[jobName].getStats();
        }
      } catch (error) {
        stats[jobName] = { error: error.message };
      }
    });

    return stats;
  }

  /**
   * Manejo de señales para shutdown limpio
   */
  setupGracefulShutdown() {
    const shutdown = (signal) => {
      console.log(`\n\n⚠️  Señal ${signal} recibida, cerrando jobs...`);
      this.stopAll();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}

const jobManager = new JobManager();

// Setup graceful shutdown
jobManager.setupGracefulShutdown();

module.exports = jobManager;