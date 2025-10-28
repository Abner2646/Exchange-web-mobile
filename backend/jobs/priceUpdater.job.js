// jobs/priceUpdater.job.js
const priceUpdater = require('../services/trading/priceUpdater.service');

class PriceUpdaterJob {
  
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.updateFrequency = 10000; // 10 segundos | Antes s
    this.errorCount = 0;
    this.maxErrors = 10;
  }

  /**
   * Inicia el job de actualización de precios
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Price Updater Job ya está corriendo');
      return;
    }

    console.log('🚀 Iniciando Price Updater Job...');
    console.log(`   Frecuencia: cada ${this.updateFrequency / 1000} segundos`);

    // Ejecutar inmediatamente la primera vez
    this.updatePrices();

    // Luego ejecutar cada X segundos
    this.interval = setInterval(() => {
      this.updatePrices();
    }, this.updateFrequency);

    this.isRunning = true;
    console.log('✅ Price Updater Job iniciado correctamente');
  }

  /**
   * Detiene el job
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Price Updater Job no está corriendo');
      return;
    }

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
    console.log('🛑 Price Updater Job detenido');
  }

  /**
   * Actualiza todos los precios
   */
  async updatePrices() {
    try {
      const startTime = Date.now();
      
      const result = await priceUpdater.updateAllPrices();
      
      const duration = Date.now() - startTime;
      
      if (result.successful > 0) {
        console.log(
          `💰 Precios actualizados: ${result.successful}/${result.total} ` +
          `(${duration}ms) [${new Date().toLocaleTimeString()}]`
        );
        
        // Resetear contador de errores si fue exitoso
        this.errorCount = 0;
      }

      if (result.failed > 0) {
        console.warn(`⚠️  Fallos en actualización: ${result.failed}/${result.total}`);
        this.errorCount++;
      }

      // Si hay demasiados errores consecutivos, detener el job
      if (this.errorCount >= this.maxErrors) {
        console.error(
          `❌ Demasiados errores consecutivos (${this.errorCount}). ` +
          `Deteniendo Price Updater Job`
        );
        this.stop();
      }

    } catch (error) {
      this.errorCount++;
      console.error('❌ Error en Price Updater Job:', error.message);
      
      if (this.errorCount >= this.maxErrors) {
        console.error('❌ Demasiados errores. Deteniendo Price Updater Job');
        this.stop();
      }
    }
  }

  /**
   * Reinicia el job
   */
  restart() {
    console.log('🔄 Reiniciando Price Updater Job...');
    this.stop();
    this.errorCount = 0;
    setTimeout(() => {
      this.start();
    }, 1000);
  }

  /**
   * Obtiene el estado del job
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      updateFrequency: this.updateFrequency,
      errorCount: this.errorCount,
      maxErrors: this.maxErrors
    };
  }

  /**
   * Cambia la frecuencia de actualización
   */
  setUpdateFrequency(milliseconds) {
    if (milliseconds < 1000) {
      console.warn('⚠️  Frecuencia mínima: 1 segundo');
      return;
    }

    console.log(`🔧 Cambiando frecuencia a ${milliseconds / 1000} segundos`);
    this.updateFrequency = milliseconds;

    if (this.isRunning) {
      this.restart();
    }
  }

  /**
   * Fuerza una actualización inmediata
   */
  async forceUpdate() {
    console.log('⚡ Forzando actualización de precios...');
    await this.updatePrices();
  }
}

module.exports = new PriceUpdaterJob();