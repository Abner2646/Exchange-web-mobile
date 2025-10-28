// jobs/candleGenerator.job.js

const { PriceCandle, TradingPair } = require('../models');
const cron = require('node-cron');

class CandleGeneratorJob {
  
  constructor() {
    this.tasks = {};
    this.isRunning = false;
    this.stats = {
      '1m': { generated: 0, errors: 0 },
      '5m': { generated: 0, errors: 0 },
      '15m': { generated: 0, errors: 0 },
      '1h': { generated: 0, errors: 0 },
      '1d': { generated: 0, errors: 0 }
    };
  }

  /**
   * Inicia todos los generadores de velas
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Candle Generator Job ya está corriendo');
      return;
    }

    console.log('🚀 Iniciando Candle Generator Jobs...');

    // Velas de 1 minuto - cada minuto
    this.tasks['1m'] = cron.schedule('* * * * *', () => {
      this.generateCandles('1m');
    });

    // Velas de 5 minutos - cada 5 minutos
    this.tasks['5m'] = cron.schedule('*/5 * * * *', () => {
      this.generateCandles('5m');
    });

    // Velas de 15 minutos - cada 15 minutos
    this.tasks['15m'] = cron.schedule('*/15 * * * *', () => {
      this.generateCandles('15m');
    });

    // Velas de 1 hora - cada hora
    this.tasks['1h'] = cron.schedule('0 * * * *', () => {
      this.generateCandles('1h');
    });

    // Velas de 1 día - cada día a medianoche
    this.tasks['1d'] = cron.schedule('0 0 * * *', () => {
      this.generateCandles('1d');
    });

    // Cerrar velas expiradas cada minuto
    this.tasks['cleanup'] = cron.schedule('* * * * *', () => {
      this.closeExpiredCandles();
    });

    this.isRunning = true;
    console.log('✅ Candle Generator Jobs iniciados:');
    console.log('   📊 1m  - Cada minuto');
    console.log('   📊 5m  - Cada 5 minutos');
    console.log('   📊 15m - Cada 15 minutos');
    console.log('   📊 1h  - Cada hora');
    console.log('   📊 1d  - Cada día');
  }

  /**
   * Detiene todos los generadores
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️  Candle Generator Job no está corriendo');
      return;
    }

    Object.keys(this.tasks).forEach(interval => {
      if (this.tasks[interval]) {
        this.tasks[interval].stop();
      }
    });

    this.tasks = {};
    this.isRunning = false;
    console.log('🛑 Candle Generator Jobs detenidos');
    this.printStats();
  }

  /**
   * Genera velas para todos los pares activos
   */
  async generateCandles(interval) {
    try {
      console.log(`📊 Generando velas ${interval}... [${new Date().toLocaleTimeString()}]`);

      // Obtener todos los pares activos
      const activePairs = await TradingPair.findAll({
        where: { status: 'active' }
      });

      if (activePairs.length === 0) {
        console.log('   No hay pares activos');
        return;
      }

      // Calcular el rango de tiempo
      const now = new Date();
      const { openTime, closeTime } = PriceCandle.calculateTimeRange(interval, now);

      let successCount = 0;
      let errorCount = 0;

      // Generar vela para cada par
      for (const pair of activePairs) {
        try {
          const candle = await PriceCandle.generateFromTrades(
            pair.id,
            interval,
            openTime,
            closeTime
          );

          if (candle) {
            successCount++;
          }

        } catch (error) {
          console.error(`   ❌ Error generando vela para ${pair.symbol}:`, error.message);
          errorCount++;
        }
      }

      // Actualizar estadísticas
      this.stats[interval].generated += successCount;
      this.stats[interval].errors += errorCount;

      console.log(
        `   ✅ Velas ${interval} generadas: ${successCount}/${activePairs.length} ` +
        `(${errorCount} errores)`
      );

    } catch (error) {
      console.error(`❌ Error en generación de velas ${interval}:`, error.message);
    }
  }

  /**
   * Cierra velas que ya deberían estar cerradas
   */
  async closeExpiredCandles() {
    try {
      const intervals = ['1m', '5m', '15m', '1h', '1d'];
      
      for (const interval of intervals) {
        const count = await PriceCandle.closeExpiredCandles(interval);
        
        if (count > 0) {
          console.log(`   🔒 ${count} velas ${interval} cerradas`);
        }
      }

    } catch (error) {
      console.error('❌ Error cerrando velas expiradas:', error.message);
    }
  }

  /**
   * Genera velas manualmente para un período específico
   */
  async generateHistoricalCandles(tradingPairId, interval, startDate, endDate) {
    try {
      console.log(`📊 Generando velas históricas ${interval} para par ${tradingPairId}...`);
      console.log(`   Período: ${startDate} - ${endDate}`);

      const intervalMs = this.getIntervalMilliseconds(interval);
      const candles = [];

      let currentTime = new Date(startDate);
      while (currentTime < endDate) {
        const nextTime = new Date(currentTime.getTime() + intervalMs);

        try {
          const candle = await PriceCandle.generateFromTrades(
            tradingPairId,
            interval,
            currentTime,
            nextTime
          );

          if (candle) {
            candles.push(candle);
            await PriceCandle.closeCandle(candle.id);
          }

        } catch (error) {
          console.error(`   ❌ Error en vela ${currentTime}:`, error.message);
        }

        currentTime = nextTime;
      }

      console.log(`   ✅ ${candles.length} velas históricas generadas`);
      return candles;

    } catch (error) {
      console.error('❌ Error generando velas históricas:', error);
      throw error;
    }
  }

  /**
   * Convierte intervalo a milisegundos
   */
  getIntervalMilliseconds(interval) {
    const intervals = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000
    };

    return intervals[interval] || 60 * 1000;
  }

  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      intervals: this.stats
    };
  }

  /**
   * Imprime estadísticas
   */
  printStats() {
    console.log('\n📊 Candle Generator Job - Estadísticas:');
    Object.keys(this.stats).forEach(interval => {
      const stats = this.stats[interval];
      console.log(
        `   ${interval}: ${stats.generated} generadas, ${stats.errors} errores`
      );
    });
    console.log('');
  }

  /**
   * Resetea estadísticas
   */
  resetStats() {
    Object.keys(this.stats).forEach(interval => {
      this.stats[interval] = { generated: 0, errors: 0 };
    });
    console.log('📊 Estadísticas reseteadas');
  }

  /**
   * Obtiene el estado del job
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeIntervals: Object.keys(this.tasks),
      stats: this.getStats()
    };
  }

  /**
   * Fuerza la generación de velas para todos los intervalos
   */
  async forceGenerate() {
    console.log('⚡ Forzando generación de velas para todos los intervalos...');
    
    const intervals = ['1m', '5m', '15m', '1h', '1d'];
    
    for (const interval of intervals) {
      await this.generateCandles(interval);
    }
    
    console.log('✅ Generación forzada completada');
  }
}

module.exports = new CandleGeneratorJob();