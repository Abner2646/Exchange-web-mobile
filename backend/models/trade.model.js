// models/trade.model.js
const initTrade = require('./entities/trade.entity');
const { Op } = require('sequelize');

function createTradeModel(sequelize) {
  const Trade = initTrade(sequelize);

  // Métodos de consulta básicos
  Trade.getById = async (id) => {
    try {
      const trade = await Trade.findByPk(id, {
        include: [
          {
            model: sequelize.models.TradingPair,
            as: 'tradingPair',
            include: [
              { model: sequelize.models.Criptomoneda, as: 'baseAsset' },
              { model: sequelize.models.Criptomoneda, as: 'quoteAsset' }
            ]
          },
          {
            model: sequelize.models.Order,
            as: 'buyOrder',
            attributes: ['id', 'userId', 'orderType']
          },
          {
            model: sequelize.models.Order,
            as: 'sellOrder',
            attributes: ['id', 'userId', 'orderType']
          }
        ]
      });
      return trade;
    } catch (error) {
      throw new Error(`Error al obtener trade por ID: ${error.message}`);
    }
  };

  Trade.getByTradingPair = async (tradingPairId, filters = {}) => {
    try {
      const where = { tradingPairId };
      
      if (filters.startDate) {
        where.created_at = { [Op.gte]: filters.startDate };
      }
      
      if (filters.endDate) {
        if (where.created_at) {
          where.created_at[Op.lte] = filters.endDate;
        } else {
          where.created_at = { [Op.lte]: filters.endDate };
        }
      }

      const trades = await Trade.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: filters.limit || 100,
        offset: filters.offset || 0
      });

      return trades;
    } catch (error) {
      throw new Error(`Error al obtener trades por par: ${error.message}`);
    }
  };

  Trade.getByUser = async (userId, filters = {}) => {
    try {
      const where = {
        [Op.or]: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      };
      
      if (filters.tradingPairId) {
        where.tradingPairId = filters.tradingPairId;
      }
      
      if (filters.startDate) {
        where.created_at = { [Op.gte]: filters.startDate };
      }
      
      if (filters.endDate) {
        if (where.created_at) {
          where.created_at[Op.lte] = filters.endDate;
        } else {
          where.created_at = { [Op.lte]: filters.endDate };
        }
      }

      const trades = await Trade.findAll({
        where,
        include: [
          {
            model: sequelize.models.TradingPair,
            as: 'tradingPair',
            include: [
              { model: sequelize.models.Criptomoneda, as: 'baseAsset' },
              { model: sequelize.models.Criptomoneda, as: 'quoteAsset' }
            ]
          }
        ],
        order: [['created_at', 'DESC']],
        limit: filters.limit || 50,
        offset: filters.offset || 0
      });

      return trades;
    } catch (error) {
      throw new Error(`Error al obtener trades por usuario: ${error.message}`);
    }
  };

  Trade.getRecent = async (tradingPairId = null, limit = 50) => {
    try {
      const where = {};
      if (tradingPairId) {
        where.tradingPairId = tradingPairId;
      }

      const trades = await Trade.findAll({
        where,
        include: [
          {
            model: sequelize.models.TradingPair,
            as: 'tradingPair',
            attributes: ['symbol']
          }
        ],
        order: [['created_at', 'DESC']],
        limit
      });

      return trades;
    } catch (error) {
      throw new Error(`Error al obtener trades recientes: ${error.message}`);
    }
  };

  // Métodos estadísticos
  Trade.getStats = async (tradingPairId = null, timeRange = '24h') => {
    try {
      const where = {};
      
      if (tradingPairId) {
        where.tradingPairId = tradingPairId;
      }

      // Calcular fecha de inicio según rango
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case '1h':
          startDate = new Date(now - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now - 24 * 60 * 60 * 1000);
      }
      
      where.created_at = { [Op.gte]: startDate };

      const [stats] = await Trade.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalTrades'],
          [sequelize.fn('SUM', sequelize.col('quantity')), 'totalVolume'],
          [sequelize.fn('SUM', sequelize.col('total_value')), 'totalValue'],
          [sequelize.fn('MAX', sequelize.col('price')), 'highPrice'],
          [sequelize.fn('MIN', sequelize.col('price')), 'lowPrice'],
          [sequelize.fn('AVG', sequelize.col('price')), 'avgPrice']
        ],
        where,
        raw: true
      });

      return {
        totalTrades: parseInt(stats.totalTrades) || 0,
        totalVolume: parseFloat(stats.totalVolume) || 0,
        totalValue: parseFloat(stats.totalValue) || 0,
        highPrice: parseFloat(stats.highPrice) || 0,
        lowPrice: parseFloat(stats.lowPrice) || 0,
        avgPrice: parseFloat(stats.avgPrice) || 0,
        timeRange,
        startDate,
        endDate: now
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de trades: ${error.message}`);
    }
  };

  Trade.getVolumeByPair = async (timeRange = '24h') => {
    try {
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case '1h':
          startDate = new Date(now - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now - 24 * 60 * 60 * 1000);
      }

      const volumes = await Trade.findAll({
        attributes: [
          'trading_pair_id',
          [sequelize.fn('SUM', sequelize.col('quantity')), 'volume'],
          [sequelize.fn('SUM', sequelize.col('total_value')), 'value'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'trades']
        ],
        where: {
          created_at: { [Op.gte]: startDate }
        },
        group: ['trading_pair_id'],
        include: [
          {
            model: sequelize.models.TradingPair,
            as: 'tradingPair',
            attributes: ['symbol'],
            include: [
              { model: sequelize.models.Criptomoneda, as: 'baseAsset', attributes: ['symbol', 'iconUrl'] },
              { model: sequelize.models.Criptomoneda, as: 'quoteAsset', attributes: ['symbol', 'iconUrl'] }
            ]
          }
        ],
        order: [[sequelize.literal('SUM("total_value")'), 'DESC']],
        limit: 20
      });

      return volumes;
    } catch (error) {
      throw new Error(`Error al obtener volumen por par: ${error.message}`);
    }
  };

  Trade.getUserTradeStats = async (userId, tradingPairId = null) => {
    try {
      const where = {
        [Op.or]: [
          { buyerId: userId },
          { sellerId: userId }
        ]
      };
      
      if (tradingPairId) {
        where.tradingPairId = tradingPairId;
      }

      // Total de trades
      const totalTrades = await Trade.count({ where });

      // Trades como comprador
      const buyTrades = await Trade.count({
        where: { ...where, buyerId: userId }
      });

      // Trades como vendedor
      const sellTrades = await Trade.count({
        where: { ...where, sellerId: userId }
      });

      // Fees pagados
      const [feeStats] = await Trade.findAll({
        attributes: [
          [sequelize.literal(`SUM(CASE WHEN buyer_id = '${userId}' THEN buyer_fee ELSE 0 END)`), 'totalBuyerFees'],
          [sequelize.literal(`SUM(CASE WHEN seller_id = '${userId}' THEN seller_fee ELSE 0 END)`), 'totalSellerFees']
        ],
        where,
        raw: true
      });

      const totalFees = (parseFloat(feeStats.totalBuyerFees) || 0) + (parseFloat(feeStats.totalSellerFees) || 0);

      return {
        totalTrades,
        buyTrades,
        sellTrades,
        totalFees,
        buyerFees: parseFloat(feeStats.totalBuyerFees) || 0,
        sellerFees: parseFloat(feeStats.totalSellerFees) || 0
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de usuario: ${error.message}`);
    }
  };

  // Método para obtener el último precio de un par
  Trade.getLastPrice = async (tradingPairId) => {
    try {
      const lastTrade = await Trade.findOne({
        where: { tradingPairId },
        order: [['created_at', 'DESC']],
        attributes: ['price', 'created_at']
      });

      return lastTrade ? {
        price: parseFloat(lastTrade.price),
        timestamp: lastTrade.created_at
      } : null;
    } catch (error) {
      throw new Error(`Error al obtener último precio: ${error.message}`);
    }
  };

  // Método para análisis de precio
  Trade.getPriceChange = async (tradingPairId, timeRange = '24h') => {
    try {
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case '1h':
          startDate = new Date(now - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now - 24 * 60 * 60 * 1000);
      }

      // Obtener primer y último trade del período
      const [firstTrade, lastTrade] = await Promise.all([
        Trade.findOne({
          where: {
            tradingPairId,
            created_at: { [Op.gte]: startDate }
          },
          order: [['created_at', 'ASC']],
          attributes: ['price']
        }),
        Trade.findOne({
          where: { tradingPairId },
          order: [['created_at', 'DESC']],
          attributes: ['price']
        })
      ]);

      if (!firstTrade || !lastTrade) {
        return {
          priceChange: 0,
          priceChangePercent: 0,
          firstPrice: 0,
          lastPrice: 0
        };
      }

      const firstPrice = parseFloat(firstTrade.price);
      const lastPrice = parseFloat(lastTrade.price);
      const priceChange = lastPrice - firstPrice;
      const priceChangePercent = (priceChange / firstPrice) * 100;

      return {
        priceChange,
        priceChangePercent,
        firstPrice,
        lastPrice,
        timeRange
      };
    } catch (error) {
      throw new Error(`Error al calcular cambio de precio: ${error.message}`);
    }
  };

  return Trade;
}

module.exports = createTradeModel;