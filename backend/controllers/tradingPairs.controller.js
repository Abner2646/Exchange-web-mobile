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
}

module.exports = new TradingPairsController();