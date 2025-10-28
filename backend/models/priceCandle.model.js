// models/priceCandle.model.js
const initPriceCandle = require('./entities/priceCandle.entity');
const { Op } = require('sequelize');

function createPriceCandleModel(sequelize) {
  const PriceCandle = initPriceCandle(sequelize);

  // Métodos de consulta básicos
  PriceCandle.getById = async (id) => {
    try {
      const candle = await PriceCandle.findByPk(id);
      return candle;
    } catch (error) {
      throw new Error(`Error al obtener vela por ID: ${error.message}`);
    }
  };

  PriceCandle.getCandles = async (tradingPairId, interval, filters = {}) => {
    try {
      const where = {
        tradingPairId,
        interval,
        isClosed: true
      };
      
      if (filters.startTime) {
        where.openTime = { [Op.gte]: filters.startTime };
      }
      
      if (filters.endTime) {
        if (where.openTime) {
          where.openTime[Op.lte] = filters.endTime;
        } else {
          where.openTime = { [Op.lte]: filters.endTime };
        }
      }

      const candles = await PriceCandle.findAll({
        where,
        order: [['open_time', filters.order || 'ASC']],
        limit: filters.limit || 500
      });

      return candles;
    } catch (error) {
      throw new Error(`Error al obtener velas: ${error.message}`);
    }
  };

  PriceCandle.getLatestCandle = async (tradingPairId, interval) => {
    try {
      const candle = await PriceCandle.findOne({
        where: {
          tradingPairId,
          interval
        },
        order: [['open_time', 'DESC']]
      });

      return candle;
    } catch (error) {
      throw new Error(`Error al obtener última vela: ${error.message}`);
    }
  };

  PriceCandle.getCurrentCandle = async (tradingPairId, interval) => {
    try {
      const candle = await PriceCandle.findOne({
        where: {
          tradingPairId,
          interval,
          isClosed: false
        },
        order: [['open_time', 'DESC']]
      });

      return candle;
    } catch (error) {
      throw new Error(`Error al obtener vela actual: ${error.message}`);
    }
  };

  // Métodos de creación y actualización
  PriceCandle.createOrUpdateCandle = async (data, transaction = null) => {
    try {
      const { tradingPairId, interval, openTime, open, high, low, close, volume, quoteVolume, trades } = data;

      // Buscar si ya existe una vela para este período
      const [candle, created] = await PriceCandle.findOrCreate({
        where: {
          tradingPairId,
          interval,
          openTime
        },
        defaults: {
          tradingPairId,
          interval,
          openTime,
          closeTime: data.closeTime,
          open,
          high,
          low,
          close,
          volume: volume || 0,
          quoteVolume: quoteVolume || 0,
          trades: trades || 0,
          isClosed: false
        },
        transaction
      });

      if (!created) {
        // Actualizar vela existente
        await candle.update({
          high: Math.max(parseFloat(candle.high), parseFloat(high)),
          low: Math.min(parseFloat(candle.low), parseFloat(low)),
          close,
          volume: parseFloat(candle.volume) + parseFloat(volume || 0),
          quoteVolume: parseFloat(candle.quoteVolume) + parseFloat(quoteVolume || 0),
          trades: parseInt(candle.trades) + parseInt(trades || 0)
        }, { transaction });
      }

      return candle;
    } catch (error) {
      throw new Error(`Error al crear/actualizar vela: ${error.message}`);
    }
  };

  PriceCandle.closeCandle = async (candleId, transaction = null) => {
    try {
      const candle = await PriceCandle.findByPk(candleId, { transaction });
      
      if (!candle) {
        throw new Error('Vela no encontrada');
      }

      await candle.update({ isClosed: true }, { transaction });
      return candle;
    } catch (error) {
      throw new Error(`Error al cerrar vela: ${error.message}`);
    }
  };

  PriceCandle.closeExpiredCandles = async (interval) => {
    try {
      const now = new Date();
      
      // Calcular cuánto tiempo debe haber pasado según el intervalo
      let milliseconds;
      switch (interval) {
        case '1m': milliseconds = 60 * 1000; break;
        case '5m': milliseconds = 5 * 60 * 1000; break;
        case '15m': milliseconds = 15 * 60 * 1000; break;
        case '30m': milliseconds = 30 * 60 * 1000; break;
        case '1h': milliseconds = 60 * 60 * 1000; break;
        case '4h': milliseconds = 4 * 60 * 60 * 1000; break;
        case '1d': milliseconds = 24 * 60 * 60 * 1000; break;
        case '1w': milliseconds = 7 * 24 * 60 * 60 * 1000; break;
        default: milliseconds = 60 * 1000;
      }

      const expirationTime = new Date(now - milliseconds);

      const [count] = await PriceCandle.update(
        { isClosed: true },
        {
          where: {
            interval,
            isClosed: false,
            openTime: { [Op.lt]: expirationTime }
          }
        }
      );

      return count;
    } catch (error) {
      throw new Error(`Error al cerrar velas expiradas: ${error.message}`);
    }
  };

  // Métodos de generación desde trades
  PriceCandle.generateFromTrades = async (tradingPairId, interval, startTime, endTime) => {
    try {
      const Trade = sequelize.models.Trade;

      // Obtener todos los trades en el período
      const trades = await Trade.findAll({
        where: {
          tradingPairId,
          created_at: {
            [Op.gte]: startTime,
            [Op.lt]: endTime
          }
        },
        order: [['created_at', 'ASC']]
      });

      if (trades.length === 0) {
        return null;
      }

      // Calcular OHLCV
      const prices = trades.map(t => parseFloat(t.price));
      const open = prices[0];
      const close = prices[prices.length - 1];
      const high = Math.max(...prices);
      const low = Math.min(...prices);
      const volume = trades.reduce((sum, t) => sum + parseFloat(t.quantity), 0);
      const quoteVolume = trades.reduce((sum, t) => sum + parseFloat(t.totalValue), 0);

      // Crear o actualizar la vela
      const candle = await PriceCandle.createOrUpdateCandle({
        tradingPairId,
        interval,
        openTime: startTime,
        closeTime: endTime,
        open,
        high,
        low,
        close,
        volume,
        quoteVolume,
        trades: trades.length
      });

      return candle;
    } catch (error) {
      throw new Error(`Error al generar vela desde trades: ${error.message}`);
    }
  };

  // Método helper para calcular rangos de tiempo
  PriceCandle.calculateTimeRange = (interval, referenceTime = new Date()) => {
    const ref = new Date(referenceTime);
    let openTime, closeTime;

    switch (interval) {
      case '1m':
        openTime = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), ref.getHours(), ref.getMinutes(), 0, 0);
        closeTime = new Date(openTime.getTime() + 60 * 1000);
        break;
      case '5m':
        const minutes5 = Math.floor(ref.getMinutes() / 5) * 5;
        openTime = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), ref.getHours(), minutes5, 0, 0);
        closeTime = new Date(openTime.getTime() + 5 * 60 * 1000);
        break;
      case '15m':
        const minutes15 = Math.floor(ref.getMinutes() / 15) * 15;
        openTime = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), ref.getHours(), minutes15, 0, 0);
        closeTime = new Date(openTime.getTime() + 15 * 60 * 1000);
        break;
      case '30m':
        const minutes30 = Math.floor(ref.getMinutes() / 30) * 30;
        openTime = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), ref.getHours(), minutes30, 0, 0);
        closeTime = new Date(openTime.getTime() + 30 * 60 * 1000);
        break;
      case '1h':
        openTime = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), ref.getHours(), 0, 0, 0);
        closeTime = new Date(openTime.getTime() + 60 * 60 * 1000);
        break;
      case '4h':
        const hours4 = Math.floor(ref.getHours() / 4) * 4;
        openTime = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), hours4, 0, 0, 0);
        closeTime = new Date(openTime.getTime() + 4 * 60 * 60 * 1000);
        break;
      case '1d':
        openTime = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
        closeTime = new Date(openTime.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '1w':
        const dayOfWeek = ref.getDay();
        const daysToMonday = (dayOfWeek + 6) % 7;
        openTime = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - daysToMonday, 0, 0, 0, 0);
        closeTime = new Date(openTime.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        throw new Error('Intervalo no válido');
    }

    return { openTime, closeTime };
  };

  // Método de estadísticas
  PriceCandle.getStats = async (tradingPairId, interval) => {
    try {
      const [stats] = await PriceCandle.findAll({
        attributes: [
          [sequelize.fn('COUNT', sequelize.col('id')), 'totalCandles'],
          [sequelize.fn('SUM', sequelize.col('volume')), 'totalVolume'],
          [sequelize.fn('SUM', sequelize.col('quote_volume')), 'totalQuoteVolume'],
          [sequelize.fn('SUM', sequelize.col('trades')), 'totalTrades']
        ],
        where: {
          tradingPairId,
          interval,
          isClosed: true
        },
        raw: true
      });

      return {
        totalCandles: parseInt(stats.totalCandles) || 0,
        totalVolume: parseFloat(stats.totalVolume) || 0,
        totalQuoteVolume: parseFloat(stats.totalQuoteVolume) || 0,
        totalTrades: parseInt(stats.totalTrades) || 0
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de velas: ${error.message}`);
    }
  };

  return PriceCandle;
}

module.exports = createPriceCandleModel;