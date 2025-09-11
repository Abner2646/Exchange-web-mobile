// jobs/index.js - Archivo principal para inicializar todos los jobs
const blockchainJobManager = require('./blockchain.jobs');

class JobManager {
  constructor() {
    this.jobManagers = {
      blockchain: blockchainJobManager
    };
  }

  // Inicializar todos los job managers
  async startAll() {
    console.log('🚀 Iniciando todos los job managers...');
    
    try {
      // Iniciar jobs de blockchain
      this.jobManagers.blockchain.start();
      
      console.log('✅ Todos los job managers iniciados exitosamente');
    } catch (error) {
      console.error('❌ Error iniciando job managers:', error);
      throw error;
    }
  }

  // Detener todos los job managers
  async stopAll() {
    console.log('🛑 Deteniendo todos los job managers...');
    
    try {
      this.jobManagers.blockchain.stop();
      
      console.log('✅ Todos los job managers detenidos exitosamente');
    } catch (error) {
      console.error('❌ Error deteniendo job managers:', error);
      throw error;
    }
  }

  // Obtener estado de todos los job managers
  getOverallStatus() {
    return {
      blockchain: this.jobManagers.blockchain.getStatus()
    };
  }
}

module.exports = new JobManager();