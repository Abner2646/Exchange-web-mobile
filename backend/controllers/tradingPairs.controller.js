// controllers/tradingPairs.controller.js
const { TradingPair, Criptomoneda } = require('../models');

class TradingPairsController {

  /**
   * Obtener todos los pares de trading
   * GET /api/trading/pairs
   */
  async getAllPairs(req, res) {
    try {
      const { status, baseAssetId, quoteAssetId } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (baseAssetId) filters.baseAssetId = baseAssetId;
      if (quoteAssetId) filters.quoteAssetId = quoteAssetId;

      const pairs = await TradingPair.getAll(filters);

      res.json({
        success: true,
        pairs,
        count: pairs.length
      });

    } catch (error) {
      console.error('Error obteniendo pares:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener pares de trading'
      });
    }
  }

  /**
   * Obtener pares activos
   * GET /api/trading/pairs/active
   */
  async getActivePairs(req, res) {
    try {
      const pairs = await TradingPair.getActive();

      res.json({
        success: true,
        pairs,
        count: pairs.length
      });

    } catch (error) {
      console.error('Error obteniendo pares activos:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener pares activos'
      });
    }
  }

  /**
   * Obtener detalle de un par
   * GET /api/trading/pairs/:pairId
   */
  async getPairDetail(req, res) {
    try {
      const { pairId } = req.params;

      const pair = await TradingPair.getById(pairId);

      if (!pair) {
        return res.status(404).json({
          success: false,
          error: 'Par de trading no encontrado'
        });
      }

      res.json({
        success: true,
        pair
      });

    } catch (error) {
      console.error('Error obteniendo detalle de par:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener detalle del par'
      });
    }
  }

  /**
   * Obtener par por símbolo
   * GET /api/trading/pairs/symbol/:symbol
   */
  async getPairBySymbol(req, res) {
    try {
      const { symbol } = req.params;

      const pair = await TradingPair.getBySymbol(symbol);

      if (!pair) {
        return res.status(404).json({
          success: false,
          error: 'Par de trading no encontrado'
        });
      }

      res.json({
        success: true,
        pair
      });

    } catch (error) {
      console.error('Error obteniendo par por símbolo:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener par'
      });
    }
  }

  /**
   * Crear nuevo par de trading (ADMIN)
   * POST /api/trading/pairs
   */
  async createPair(req, res) {
    try {
      const {
        symbol,
        baseAssetId,
        quoteAssetId,
        minOrderAmount,
        maxOrderAmount,
        pricePrecision,
        quantityPrecision,
        makerFeePercent,
        takerFeePercent
      } = req.body;

      const pair = await TradingPair.createPair({
        symbol,
        baseAssetId,
        quoteAssetId,
        minOrderAmount: minOrderAmount || 0,
        maxOrderAmount,
        pricePrecision,
        quantityPrecision,
        makerFeePercent: makerFeePercent || 0.1,
        takerFeePercent: takerFeePercent || 0.1
      });

      res.status(201).json({
        success: true,
        pair,
        message: 'Par de trading creado exitosamente'
      });

    } catch (error) {
      console.error('Error creando par:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al crear par de trading'
      });
    }
  }

  /**
   * Actualizar par de trading (ADMIN)
   * PUT /api/trading/pairs/:pairId
   */
  async updatePair(req, res) {
    try {
      const { pairId } = req.params;
      const updateData = req.body;

      const pair = await TradingPair.updatePair(pairId, updateData);

      res.json({
        success: true,
        pair,
        message: 'Par actualizado exitosamente'
      });

    } catch (error) {
      console.error('Error actualizando par:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al actualizar par'
      });
    }
  }

  /**
   * Cambiar estado de par (ADMIN)
   * PATCH /api/trading/pairs/:pairId/status
   */
  async updatePairStatus(req, res) {
    try {
      const { pairId } = req.params;
      const { status } = req.body;

      if (!['active', 'paused', 'delisted'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Estado inválido'
        });
      }

      const pair = await TradingPair.updateStatus(pairId, status);

      res.json({
        success: true,
        pair,
        message: `Par ${status === 'active' ? 'activado' : status === 'paused' ? 'pausado' : 'eliminado'} exitosamente`
      });

    } catch (error) {
      console.error('Error cambiando estado:', error);
      res.status(500).json({
        success: false,
        error: 'Error al cambiar estado del par'
      });
    }
  }

  /**
   * Obtener top pares por volumen
   * GET /api/trading/pairs/top
   */
  async getTopPairs(req, res) {
    try {
      const { limit = 10 } = req.query;

      const pairs = await TradingPair.getTopByVolume(parseInt(limit));

      res.json({
        success: true,
        pairs,
        count: pairs.length
      });

    } catch (error) {
      console.error('Error obteniendo top pares:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener top pares'
      });
    }
  }

  /**
   * Obtener estadísticas generales de pares
   * GET /api/trading/pairs/stats
   */
  async getPairsStats(req, res) {
    try {
      const stats = await TradingPair.getStats();

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener estadísticas'
      });
    }
  }

  /**
   * 🚀 AUTO-CREAR PARES DE TRADING
   * POST /api/trading/pairs/auto-create
   * 
   * Crea automáticamente todos los pares contra stablecoins, BTC y ETH
   */
  async autoCreatePairs(req, res) {
    try {
      const {
        dryRun = false,
        customQuoteAssets = null,
        skipExisting = true,
        defaultFees = {
          makerFeePercent: 0.1,
          takerFeePercent: 0.15
        }
      } = req.body;

      // ================================
      // 1. DEFINIR QUOTE ASSETS
      // ================================
      const STABLECOINS = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDD', 'FDUSD'];
      const MAJOR_CRYPTOS = ['BTC', 'ETH'];
      
      const QUOTE_ASSETS = customQuoteAssets || [...STABLECOINS, ...MAJOR_CRYPTOS];

      console.log('🔍 Iniciando auto-creación de pares...');
      console.log('Quote Assets:', QUOTE_ASSETS);

      // ================================
      // 2. OBTENER TODAS LAS CRIPTOMONEDAS ACTIVAS
      // ================================
      const allCryptos = await Criptomoneda.getActive();
      
      if (allCryptos.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No hay criptomonedas activas en el sistema'
        });
      }

      console.log(`📊 Total de criptomonedas activas: ${allCryptos.length}`);

      // ================================
      // 3. SEPARAR BASE Y QUOTE ASSETS
      // ================================
      const quoteAssetsList = allCryptos.filter(crypto => 
        QUOTE_ASSETS.includes(crypto.symbol)
      );

      const baseAssetsList = allCryptos.filter(crypto => 
        !QUOTE_ASSETS.includes(crypto.symbol)
      );

      if (quoteAssetsList.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No se encontraron quote assets (USDT, BTC, ETH, etc.) en el sistema. Debes crear estas criptomonedas primero.'
        });
      }

      console.log(`💰 Quote Assets encontradas: ${quoteAssetsList.map(q => q.symbol).join(', ')}`);
      console.log(`🪙  Base Assets encontradas: ${baseAssetsList.length}`);

      // ================================
      // 4. GENERAR LISTA DE PARES A CREAR
      // ================================
      const pairsToCreate = [];
      const existingPairs = await TradingPair.getAll();
      const existingPairSymbols = new Set(existingPairs.map(p => p.symbol));

      // 4.1 Pares normales: baseAsset/quoteAsset
      for (const baseAsset of baseAssetsList) {
        for (const quoteAsset of quoteAssetsList) {
          const symbol = `${baseAsset.symbol}/${quoteAsset.symbol}`;
          
          if (skipExisting && existingPairSymbols.has(symbol)) {
            console.log(`⏭️  Saltando par existente: ${symbol}`);
            continue;
          }

          pairsToCreate.push({
            symbol,
            baseAsset,
            quoteAsset,
            type: 'normal'
          });
        }
      }

      // 4.2 Pares entre quote assets (ej: ETH/BTC, ETH/USDT, BTC/USDT)
      // Convención: Major primero (ETH antes que BTC, crypto antes que stable)
      const majorOrder = ['ETH', 'BTC', ...STABLECOINS];
      
      for (let i = 0; i < quoteAssetsList.length; i++) {
        for (let j = i + 1; j < quoteAssetsList.length; j++) {
          const asset1 = quoteAssetsList[i];
          const asset2 = quoteAssetsList[j];
          
          // Determinar orden correcto (major primero)
          const index1 = majorOrder.indexOf(asset1.symbol);
          const index2 = majorOrder.indexOf(asset2.symbol);
          
          let baseAsset, quoteAsset;
          if (index1 < index2) {
            baseAsset = asset1;
            quoteAsset = asset2;
          } else {
            baseAsset = asset2;
            quoteAsset = asset1;
          }

          const symbol = `${baseAsset.symbol}/${quoteAsset.symbol}`;
          
          if (skipExisting && existingPairSymbols.has(symbol)) {
            console.log(`⏭️  Saltando par existente: ${symbol}`);
            continue;
          }

          pairsToCreate.push({
            symbol,
            baseAsset,
            quoteAsset,
            type: 'quote-to-quote'
          });
        }
      }

      console.log(`\n📝 Total de pares a crear: ${pairsToCreate.length}`);

      // ================================
      // 5. DRY RUN - SOLO MOSTRAR SIN CREAR
      // ================================
      if (dryRun) {
        const summary = {};
        pairsToCreate.forEach(pair => {
          if (!summary[pair.quoteAsset.symbol]) {
            summary[pair.quoteAsset.symbol] = 0;
          }
          summary[pair.quoteAsset.symbol]++;
        });

        return res.json({
          success: true,
          dryRun: true,
          totalPairs: pairsToCreate.length,
          pairs: pairsToCreate.map(p => ({
            symbol: p.symbol,
            type: p.type,
            baseAsset: p.baseAsset.symbol,
            quoteAsset: p.quoteAsset.symbol
          })),
          summary
        });
      }

      // ================================
      // 6. CREAR PARES EN LA BASE DE DATOS
      // ================================
      const results = {
        created: [],
        skipped: [],
        errors: []
      };

      for (const pairData of pairsToCreate) {
        try {
          console.log(`\n✨ Creando: ${pairData.symbol}`);

          const newPair = await TradingPair.createPair({
            symbol: pairData.symbol,
            baseAssetId: pairData.baseAsset.id,
            quoteAssetId: pairData.quoteAsset.id,
            minOrderAmount: 0,
            maxOrderAmount: null,
            pricePrecision: pairData.quoteAsset.decimales,
            quantityPrecision: pairData.baseAsset.decimales,
            makerFeePercent: defaultFees.makerFeePercent,
            takerFeePercent: defaultFees.takerFeePercent
          });

          results.created.push({
            id: newPair.id,
            symbol: newPair.symbol,
            type: pairData.type
          });

          console.log(`   ✅ Creado exitosamente`);

        } catch (error) {
          console.log(`   ❌ Error: ${error.message}`);
          
          if (error.message.includes('Ya existe')) {
            results.skipped.push({
              symbol: pairData.symbol,
              reason: 'Ya existe'
            });
          } else {
            results.errors.push({
              symbol: pairData.symbol,
              error: error.message
            });
          }
        }
      }

      // ================================
      // 7. GENERAR RESUMEN
      // ================================
      const summary = {};
      results.created.forEach(pair => {
        const quoteSymbol = pair.symbol.split('/')[1];
        if (!summary[quoteSymbol]) {
          summary[quoteSymbol] = 0;
        }
        summary[quoteSymbol]++;
      });

      console.log('\n' + '='.repeat(50));
      console.log('✅ RESUMEN DE CREACIÓN DE PARES');
      console.log('='.repeat(50));
      console.log(`✨ Creados: ${results.created.length}`);
      console.log(`⏭️  Saltados: ${results.skipped.length}`);
      console.log(`❌ Errores: ${results.errors.length}`);
      console.log('='.repeat(50));

      res.status(201).json({
        success: true,
        created: results.created.length,
        skipped: results.skipped.length,
        errors: results.errors.length,
        pairs: results.created,
        skippedPairs: results.skipped,
        errorPairs: results.errors,
        summary: {
          totalPairs: results.created.length,
          byQuoteAsset: summary
        }
      });

    } catch (error) {
      console.error('❌ Error en auto-creación de pares:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al auto-crear pares de trading'
      });
    }
  }
}

module.exports = new TradingPairsController();