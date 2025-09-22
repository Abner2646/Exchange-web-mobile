// scripts/initPriceService.js
// Script para inicializar el servicio de precios automáticamente al arrancar la aplicación

const priceService = require('../services/priceService');
const { ParExchange } = require('../models/index.js');

class PriceServiceInitializer {
  static async initializeService() {
    try {
      console.log('🚀 Inicializando servicio de precios...');
      
      // Verificar configuración del entorno
      const autoStart = process.env.AUTO_START_PRICE_SERVICE !== 'false';
      const updateInterval = parseInt(process.env.PRICE_UPDATE_INTERVAL) || 2; // 2 minutos por defecto
      
      if (!autoStart) {
        console.log('⏸️  Inicio automático del servicio de precios deshabilitado');
        return;
      }

      // Verificar que hay pares activos para actualizar
      const paresActivos = await ParExchange.count({
        where: { activo: true }
      });

      if (paresActivos === 0) {
        console.log('⚠️  No hay pares activos para actualizar precios');
        return;
      }

      console.log(`📊 Encontrados ${paresActivos} pares activos para actualizar`);

      // Inicializar fuentes de precio automáticas
      await this.initializePriceSources();

      // Iniciar actualización automática
      priceService.startPriceUpdates(updateInterval);

      console.log(`✅ Servicio de precios iniciado correctamente`);
      console.log(`🔄 Actualizando cada ${updateInterval} minuto(s)`);
      
      // Configurar listeners para cierre graceful
      this.setupGracefulShutdown();

      return true;
    } catch (error) {
      console.error('❌ Error inicializando servicio de precios:', error.message);
      return false;
    }
  }

  static async initializePriceSources() {
    try {
      // Configurar pares que deberían usar CoinGecko automáticamente
      const coingeckoSymbols = Object.keys(priceService.constructor.COINGECKO_MAP);
      
      // Buscar pares que tengan ambas monedas en CoinGecko pero estén configurados como manuales
      const { Op } = require('sequelize');
      const { Criptomoneda } = require('../models/index.js');
      
      const paresParaActualizar = await ParExchange.findAll({
        where: {
          activo: true,
          fuentePrecio: 'manual'
        },
        include: [
          {
            model: Criptomoneda,
            as: 'criptoBase',
            where: { symbol: { [Op.in]: coingeckoSymbols } }
          },
          {
            model: Criptomoneda,
            as: 'criptoQuote',
            where: { symbol: { [Op.in]: coingeckoSymbols } }
          }
        ]
      });

      console.log(`🔧 Configurando ${paresParaActualizar.length} pares para usar CoinGecko`);

      // Actualizar fuente de precio a CoinGecko para pares compatibles
      for (const par of paresParaActualizar) {
        try {
          await ParExchange.updatePar(par.id, {
            fuentePrecio: 'coingecko'
          });
          console.log(`   ✓ ${par.criptoBase.symbol}/${par.criptoQuote.symbol} → CoinGecko`);
        } catch (error) {
          console.warn(`   ⚠️  Error actualizando ${par.criptoBase.symbol}/${par.criptoQuote.symbol}:`, error.message);
        }
      }

    } catch (error) {
      console.warn('⚠️  Error configurando fuentes de precio automáticas:', error.message);
    }
  }

  static setupGracefulShutdown() {
    const shutdown = () => {
      console.log('\n🛑 Deteniendo servicio de precios...');
      priceService.stopPriceUpdates();
      console.log('✅ Servicio de precios detenido correctamente');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  static async getServiceStatus() {
    try {
      const stats = priceService.getServiceStats();
      const paresActivos = await ParExchange.count({
        where: { activo: true }
      });
      
      const paresPorFuente = await ParExchange.findAll({
        attributes: [
          'fuentePrecio',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where: { activo: true },
        group: ['fuentePrecio'],
        raw: true
      });

      return {
        serviceStats: stats,
        paresActivos: paresActivos,
        distribucionFuentes: paresPorFuente,
        ultimaActualizacion: new Date()
      };
    } catch (error) {
      throw new Error(`Error obteniendo estado del servicio: ${error.message}`);
    }
  }

  // Método para crear pares de ejemplo si no existen
  static async createSamplePairs() {
    try {
      const existingPairs = await ParExchange.count();
      
      if (existingPairs > 0) {
        console.log('✅ Ya existen pares en la base de datos');
        return;
      }

      console.log('🔨 Creando pares de ejemplo...');

      // Obtener o crear criptomonedas necesarias
      const { Criptomoneda } = require('../models/index.js');
      
      const cryptos = [
        { symbol: 'BTC', nombre: 'Bitcoin', red: 'bitcoin' },
        { symbol: 'ETH', nombre: 'Ethereum', red: 'ethereum' },
        { symbol: 'USDT', nombre: 'Tether', red: 'ethereum' },
        { symbol: 'USDC', nombre: 'USD Coin', red: 'ethereum' },
        { symbol: 'BNB', nombre: 'Binance Coin', red: 'bsc' }
      ];

      const createdCryptos = {};
      
      for (const crypto of cryptos) {
        let [cryptoInstance] = await Criptomoneda.findOrCreate({
          where: { symbol: crypto.symbol },
          defaults: crypto
        });
        createdCryptos[crypto.symbol] = cryptoInstance;
      }

      // Crear pares de ejemplo
      const samplePairs = [
        { base: 'BTC', quote: 'USDT', price: 45000, commission: 0.001 },
        { base: 'ETH', quote: 'USDT', price: 3000, commission: 0.001 },
        { base: 'BNB', quote: 'USDT', price: 300, commission: 0.002 },
        { base: 'ETH', quote: 'BTC', price: 0.067, commission: 0.001 },
        { base: 'BTC', quote: 'USDC', price: 44980, commission: 0.001 }
      ];

      for (const pair of samplePairs) {
        try {
          await ParExchange.createPar({
            criptoBaseId: createdCryptos[pair.base].id,
            criptoQuoteId: createdCryptos[pair.quote].id,
            precioActual: pair.price,
            comisionPorcentaje: pair.commission,
            fuentePrecio: 'coingecko',
            activo: true
          });
          console.log(`   ✓ Creado par ${pair.base}/${pair.quote}`);
        } catch (error) {
          console.warn(`   ⚠️  Error creando par ${pair.base}/${pair.quote}:`, error.message);
        }
      }

      console.log('✅ Pares de ejemplo creados correctamente');
    } catch (error) {
      console.error('❌ Error creando pares de ejemplo:', error.message);
    }
  }
}

// Exportar para uso en la aplicación principal
module.exports = PriceServiceInitializer;

// Si se ejecuta directamente, inicializar el servicio
if (require.main === module) {
  (async () => {
    try {
      // Esperar a que la base de datos esté lista
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Crear pares de ejemplo si es necesario
      await PriceServiceInitializer.createSamplePairs();
      
      // Inicializar servicio
      await PriceServiceInitializer.initializeService();
      
      console.log('🎉 Inicialización completa');
    } catch (error) {
      console.error('💥 Error en inicialización:', error);
      process.exit(1);
    }
  })();
}