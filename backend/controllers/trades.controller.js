// controllers/trades.controller.js 
const { Trade, TradingPair, Order, PriceCandle, Criptomoneda } = require('../models');
const { Op } = require('sequelize');
const axios = require('axios');

class TradesController {

  /**
   * Obtener trades recientes de un par
   * GET /api/trading/trades/:tradingPairId
   */
  async getRecentTrades(req, res) {
    try {
      const { tradingPairId } = req.params;
      const { limit = 50 } = req.query;

      const trades = await Trade.findAll({
        where: { tradingPairId },
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        attributes: [
          'id',
          'price',
          'quantity',
          'totalValue',
          'makerSide',
          'created_at'
        ]
      });

      // Formatear para el frontend
      const formattedTrades = trades.map(trade => ({
        id: trade.id,
        price: parseFloat(trade.price),
        quantity: parseFloat(trade.quantity),
        total: parseFloat(trade.totalValue),
        side: trade.makerSide === 'buy' ? 'sell' : 'buy', // El lado del taker
        time: trade.created_at,
        timestamp: new Date(trade.created_at).getTime()
      }));

      res.json({
        success: true,
        trades: formattedTrades,
        count: formattedTrades.length
      });

    } catch (error) {
      console.error('Error obteniendo trades recientes:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener trades recientes'
      });
    }
  }

  /**
   * Obtener trades del usuario
   * GET /api/trading/trades/user
   */
  async getUserTrades(req, res) {
    try {
      const userId = req.user.id;
      const {
        tradingPairId,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = req.query;

      const filters = {
        tradingPairId,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      if (startDate) {
        filters.startDate = new Date(startDate);
      }

      if (endDate) {
        filters.endDate = new Date(endDate);
      }

      const trades = await Trade.getByUser(userId, filters);

      // Formatear respuesta
      const formattedTrades = trades.map(trade => {
        const isBuyer = trade.buyerId === userId;
        
        return {
          id: trade.id,
          tradingPair: trade.tradingPair.symbol,
          side: isBuyer ? 'buy' : 'sell',
          price: parseFloat(trade.price),
          quantity: parseFloat(trade.quantity),
          total: parseFloat(trade.totalValue),
          fee: parseFloat(isBuyer ? trade.buyerFee : trade.sellerFee),
          feePercent: parseFloat(isBuyer ? trade.buyerFeePercent : trade.sellerFeePercent),
          role: isBuyer ? 
            (trade.makerSide === 'buy' ? 'maker' : 'taker') :
            (trade.makerSide === 'sell' ? 'maker' : 'taker'),
          time: trade.created_at,
          timestamp: new Date(trade.created_at).getTime()
        };
      });

      res.json({
        success: true,
        trades: formattedTrades,
        count: formattedTrades.length
      });

    } catch (error) {
      console.error('Error obteniendo trades del usuario:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener trades del usuario'
      });
    }
  }

  /**
   * Obtener estadísticas de trades de un usuario
   * GET /api/trading/trades/user/stats
   */
  async getUserTradeStats(req, res) {
    try {
      const userId = req.user.id;
      const { tradingPairId } = req.query;

      const stats = await Trade.getUserTradeStats(userId, tradingPairId);

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
   * Obtener datos OHLCV para gráficos (desde nuestra DB)
   * GET /api/trading/chart/:tradingPairId
   */
  async getChartData(req, res) {
    try {
      const { tradingPairId } = req.params;
      const {
        interval = '1h',
        limit = 100,
        startTime,
        endTime
      } = req.query;

      // Validar intervalo
      const validIntervals = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
      if (!validIntervals.includes(interval)) {
        return res.status(400).json({
          success: false,
          error: `Intervalo inválido. Válidos: ${validIntervals.join(', ')}`
        });
      }

      const filters = {
        limit: parseInt(limit)
      };

      if (startTime) {
        filters.startTime = new Date(parseInt(startTime));
      }

      if (endTime) {
        filters.endTime = new Date(parseInt(endTime));
      }

      const candles = await PriceCandle.getCandles(
        tradingPairId,
        interval,
        filters
      );

      // Formatear para TradingView / Chart.js
      const formattedCandles = candles.map(candle => ({
        time: new Date(candle.openTime).getTime(),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume)
      }));

      res.json({
        success: true,
        interval,
        candles: formattedCandles,
        count: formattedCandles.length
      });

    } catch (error) {
      console.error('Error obteniendo datos de gráfico:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener datos de gráfico'
      });
    }
  }

  /**
   * Obtener datos de Binance (como referencia/comparación)
   * GET /api/trading/chart/:tradingPairId/binance
   */
  async getBinanceChartData(req, res) {
    try {
      const { tradingPairId } = req.params;
      const {
        interval = '1h',
        limit = 100
      } = req.query;

      // Obtener el par de trading para construir el símbolo de Binance
      const tradingPair = await TradingPair.findByPk(tradingPairId, {
        include: [
          { association: 'baseAsset', attributes: ['symbol'] },
          { association: 'quoteAsset', attributes: ['symbol'] }
        ]
      });

      if (!tradingPair) {
        return res.status(404).json({
          success: false,
          error: 'Par de trading no encontrado'
        });
      }

      // Construir símbolo de Binance
      const binanceSymbol = `${tradingPair.baseAsset.symbol}${tradingPair.quoteAsset.symbol}`;

      // Mapear intervalos
      const intervalMap = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
        '4h': '4h',
        '1d': '1d',
        '1w': '1w'
      };

      const binanceInterval = intervalMap[interval] || '1h';

      // Consultar a Binance
      const response = await axios.get('https://api.binance.com/api/v3/klines', {
        params: {
          symbol: binanceSymbol,
          interval: binanceInterval,
          limit: parseInt(limit)
        },
        timeout: 10000
      });

      // Formatear datos de Binance
      const formattedCandles = response.data.map(kline => ({
        time: kline[0], // Open time
        open: parseFloat(kline[1]),
        high: parseFloat(kline[2]),
        low: parseFloat(kline[3]),
        close: parseFloat(kline[4]),
        volume: parseFloat(kline[5])
      }));

      res.json({
        success: true,
        source: 'binance',
        symbol: binanceSymbol,
        interval,
        candles: formattedCandles,
        count: formattedCandles.length
      });

    } catch (error) {
      console.error('Error obteniendo datos de Binance:', error);
      
      if (error.response?.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Par no encontrado en Binance'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error al obtener datos de Binance',
        details: error.message
      });
    }
  }

  /**
   * Obtener estadísticas de trading de un par
   * GET /api/trading/stats/:tradingPairId
   */
  async getTradingPairStats(req, res) {
    try {
      const { tradingPairId } = req.params;
      const { timeRange = '24h' } = req.query;

      const stats = await Trade.getStats(tradingPairId, timeRange);

      // Obtener cambio de precio
      const priceChange = await Trade.getPriceChange(tradingPairId, timeRange);

      res.json({
        success: true,
        stats: {
          ...stats,
          priceChange: priceChange.priceChange,
          priceChangePercent: priceChange.priceChangePercent,
          firstPrice: priceChange.firstPrice,
          lastPrice: priceChange.lastPrice
        }
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
   * Obtener volumen de todos los pares
   * GET /api/trading/volume
   */
  async getVolumeStats(req, res) {
    try {
      const { timeRange = '24h' } = req.query;

      const volumes = await Trade.getVolumeByPair(timeRange);

      res.json({
        success: true,
        timeRange,
        volumes
      });

    } catch (error) {
      console.error('Error obteniendo volúmenes:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener volúmenes'
      });
    }
  }

  /**
   * Obtener últimos trades (ticker) de todos los pares activos
   * GET /api/trading/tickers
   */
  async getTickers(req, res) {
    try {
      const activePairs = await TradingPair.findAll({
        where: { status: 'active' },
        include: [
          { association: 'baseAsset', attributes: ['symbol', 'iconUrl'] },
          { association: 'quoteAsset', attributes: ['symbol', 'iconUrl'] }
        ]
      });

      const tickers = await Promise.all(
        activePairs.map(async (pair) => {
          // Obtener último trade
          const lastTrade = await Trade.findOne({
            where: { tradingPairId: pair.id },
            order: [['created_at', 'DESC']],
            attributes: ['price', 'created_at']
          });

          // Obtener stats de 24h
          const stats24h = await Trade.getStats(pair.id, '24h');

          return {
            tradingPairId: pair.id,
            symbol: pair.symbol,
            baseAsset: pair.baseAsset,
            quoteAsset: pair.quoteAsset,
            lastPrice: lastTrade ? parseFloat(lastTrade.price) : parseFloat(pair.lastPrice),
            priceChange24h: parseFloat(pair.priceChange24h),
            high24h: parseFloat(pair.high24h),
            low24h: parseFloat(pair.low24h),
            volume24h: parseFloat(pair.volume24h),
            trades24h: stats24h.totalTrades,
            lastUpdate: lastTrade ? lastTrade.created_at : null
          };
        })
      );

      res.json({
        success: true,
        tickers,
        count: tickers.length,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error obteniendo tickers:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener tickers'
      });
    }
  }

  /**
   * Obtener detalle de un trade específico
   * GET /api/trading/trades/:tradeId
   */
  async getTradeDetail(req, res) {
    try {
      const { tradeId } = req.params;
      const userId = req.user.id;

      const trade = await Trade.getById(tradeId);

      if (!trade) {
        return res.status(404).json({
          success: false,
          error: 'Trade no encontrado'
        });
      }

      // Verificar que el usuario sea parte del trade (o sea admin)
      // Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #4): req.user.isAdmin
      // nunca existe (authMiddleware setea req.user.rol).
      const isAdmin = ['admin', 'super_admin'].includes(req.user.rol);
      if (trade.buyerId !== userId && trade.sellerId !== userId && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'No tienes permiso para ver este trade'
        });
      }

      res.json({
        success: true,
        trade
      });

    } catch (error) {
      console.error('Error obteniendo detalle de trade:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener detalle de trade'
      });
    }
  }

  /**
   * Obtener resumen de trading del usuario
   * GET /api/trading/summary
   */
  async getUserTradingSummary(req, res) {
    try {
      const userId = req.user.id;

      // Obtener estadísticas generales
      const stats = await Trade.getUserTradeStats(userId);

      // Obtener órdenes activas
      const activeOrders = await Order.getUserActiveOrders(userId);

      // Obtener últimos trades
      const recentTrades = await Trade.getByUser(userId, { limit: 10 });

      // No hay cálculo de PnL implementado todavía — esto es solo el total de fees pagadas
      const totalFees = stats.totalFees;

      res.json({
        success: true,
        summary: {
          totalTrades: stats.totalTrades,
          buyTrades: stats.buyTrades,
          sellTrades: stats.sellTrades,
          totalFeesPaid: totalFees,
          activeOrders: activeOrders.length,
          recentTrades: recentTrades.slice(0, 5).map(trade => ({
            id: trade.id,
            symbol: trade.tradingPair.symbol,
            side: trade.buyerId === userId ? 'buy' : 'sell',
            price: parseFloat(trade.price),
            quantity: parseFloat(trade.quantity),
            time: trade.created_at
          }))
        }
      });

    } catch (error) {
      console.error('Error obteniendo resumen de trading:', error);
      res.status(500).json({
        success: false,
        error: 'Error al obtener resumen de trading'
      });
    }
  }
}

module.exports = new TradesController();