// jobs/orderMatching.job.js
const orderBookService = require('../services/trading/orderBook.service');
const { Order, TradingPair } = require('../models');
const { Op } = require('sequelize');

class OrderMatchingJob {
  
  constructor() {
    this.interval = null;
    this.isRunning = false;
    // Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #2): el valor no
    // coincidía con lo que decía el propio comentario — 10000ms son 10
    // segundos, no 100ms. El matching corría 100 veces más lento que lo
    // documentado/intencionado.
    this.matchFrequency = 100; // 100ms = 10 veces por segundo
    this.errorCount = 0;
    this.maxErrors = 50;
    this.stats = {
      totalProcessed: 0,
      totalMatched: 0,
      totalTrades: 0,
      startTime: null
    };
  }

  /**
   * Inicia el job de matching
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Order Matching Job ya está corriendo');
      return;
    }

    console.log('🚀 Iniciando Order Matching Job...');
    console.log(`   Frecuencia: cada ${this.matchFrequency}ms (${1000 / this.matchFrequency}x por segundo)`);

    this.stats.startTime = new Date();

    // Ejecutar inmediatamente
    this.processOrders();

    // Luego ejecutar cada X milisegundos
    this.interval = setInterval(() => {
      this.processOrders();
    }, this.matchFrequency);

    this.isRunning = true;
    console.log('✅ Order Matching Job iniciado correctamente');
  }

  /**
   * Detiene el job
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Order Matching Job no está corriendo');
      return;
    }

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
    console.log('🛑 Order Matching Job detenido');
    this.printStats();
  }

  /**
   * Procesa órdenes pendientes de matching
   */
  async processOrders() {
  try {
    // ❌ ANTES (con error):
    // const orders = await Order.findAll({
    //   where: {...},
    //   include: [{ model: TradingPair, as: 'tradingPair', ... }]
    // });

    // ✅ AHORA (sin include en el findAll):
    const orders = await Order.findAll({
      where: {
        status: { [Op.in]: ['open', 'pending'] },
        tradingType: 'spot',
        quantityRemaining: { [Op.gt]: 0 }
      },
      order: [['created_at', 'ASC']],
      limit: 20
    });

    if (orders.length === 0) {
      return;
    }

    // Procesar cada orden
    for (const order of orders) {
      try {
        const result = await orderBookService.matchOrder(order.id);
        
        this.stats.totalProcessed++;

        if (result.matched && result.trades && result.trades.length > 0) {
          this.stats.totalMatched++;
          this.stats.totalTrades += result.trades.length;

          // Cargar tradingPair para mostrar el símbolo
          const tradingPair = await TradingPair.findByPk(order.tradingPairId);

          console.log(
            `🔄 Match ejecutado: Orden ${order.id.substring(0, 8)}... ` +
            `| ${result.trades.length} trade(s) | ` +
            `${order.side.toUpperCase()} ${tradingPair ? tradingPair.symbol : order.tradingPairId}`
          );
        }

        this.errorCount = 0;

      } catch (error) {
        console.error(`❌ Error procesando orden ${order.id}:`, error.message);
        this.errorCount++;
      }
    }

    if (this.errorCount >= this.maxErrors) {
      console.error(
        `❌ Demasiados errores consecutivos (${this.errorCount}). ` +
        `Deteniendo Order Matching Job`
      );
      this.stop();
    }

  } catch (error) {
    this.errorCount++;
    console.error('❌ Error en Order Matching Job:', error.message);
    
    if (this.errorCount >= this.maxErrors) {
      console.error('❌ Demasiados errores. Deteniendo Order Matching Job');
      this.stop();
    }
  }
}

  /**
   * Procesa matching para un par específico
   */
  async processSpecificPair(tradingPairId) {
    try {
      console.log(`🎯 Procesando matching para par ${tradingPairId}...`);
      
      const result = await orderBookService.matchAllPairOrders(tradingPairId);
      
      console.log(
        `✅ Matching completado: ${result.matched}/${result.total} órdenes | ` +
        `${result.trades.length} trades ejecutados`
      );

      return result;

    } catch (error) {
      console.error('❌ Error procesando par específico:', error);
      throw error;
    }
  }

  /**
   * Reinicia el job
   */
  restart() {
    console.log('🔄 Reiniciando Order Matching Job...');
    this.stop();
    this.errorCount = 0;
    setTimeout(() => {
      this.start();
    }, 1000);
  }

  /**
   * Obtiene estadísticas del job
   */
  getStats() {
    const uptime = this.stats.startTime ? 
      Date.now() - this.stats.startTime.getTime() : 0;
    
    const uptimeMinutes = Math.floor(uptime / 60000);
    const matchRate = this.stats.totalProcessed > 0 ? 
      (this.stats.totalMatched / this.stats.totalProcessed * 100).toFixed(2) : 0;

    return {
      isRunning: this.isRunning,
      uptime: uptimeMinutes,
      totalProcessed: this.stats.totalProcessed,
      totalMatched: this.stats.totalMatched,
      totalTrades: this.stats.totalTrades,
      matchRate: `${matchRate}%`,
      errorCount: this.errorCount
    };
  }

  /**
   * Imprime estadísticas
   */
  printStats() {
    const stats = this.getStats();
    console.log('\n📊 Order Matching Job - Estadísticas:');
    console.log(`   Tiempo activo: ${stats.uptime} minutos`);
    console.log(`   Órdenes procesadas: ${stats.totalProcessed}`);
    console.log(`   Órdenes con match: ${stats.totalMatched}`);
    console.log(`   Trades ejecutados: ${stats.totalTrades}`);
    console.log(`   Tasa de match: ${stats.matchRate}`);
    console.log(`   Errores: ${stats.errorCount}\n`);
  }

  /**
   * Resetea estadísticas
   */
  resetStats() {
    this.stats = {
      totalProcessed: 0,
      totalMatched: 0,
      totalTrades: 0,
      startTime: new Date()
    };
    this.errorCount = 0;
    console.log('📊 Estadísticas reseteadas');
  }

  /**
   * Obtiene el estado del job
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      matchFrequency: this.matchFrequency,
      errorCount: this.errorCount,
      maxErrors: this.maxErrors,
      stats: this.getStats()
    };
  }

  /**
   * Cambia la frecuencia de matching
   */
  setMatchFrequency(milliseconds) {
    if (milliseconds < 50) {
      console.warn('⚠️  Frecuencia mínima: 50ms');
      return;
    }

    console.log(`🔧 Cambiando frecuencia a ${milliseconds}ms`);
    this.matchFrequency = milliseconds;

    if (this.isRunning) {
      this.restart();
    }
  }
}

module.exports = new OrderMatchingJob();