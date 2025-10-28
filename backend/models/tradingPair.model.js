// models/tradingPair.model.js
const initTradingPair = require('./entities/tradingPair.entity');
const { Op } = require('sequelize');

function createTradingPairModel(sequelize) {
  const TradingPair = initTradingPair(sequelize);

  // Métodos de consulta básicos
  TradingPair.getById = async (id) => {
    try {
      const pair = await TradingPair.findByPk(id, {
        include: [
          { 
            model: sequelize.models.Criptomoneda, 
            as: 'baseAsset',
            attributes: ['id', 'symbol', 'nombre', 'decimales', 'iconUrl']
          },
          { 
            model: sequelize.models.Criptomoneda, 
            as: 'quoteAsset',
            attributes: ['id', 'symbol', 'nombre', 'decimales', 'iconUrl']
          }
        ]
      });
      return pair;
    } catch (error) {
      throw new Error(`Error al obtener par de trading por ID: ${error.message}`);
    }
  };

  TradingPair.getBySymbol = async (symbol) => {
    try {
      const pair = await TradingPair.findOne({
        where: { symbol: symbol.toUpperCase() },
        include: [
          { 
            model: sequelize.models.Criptomoneda, 
            as: 'baseAsset',
            attributes: ['id', 'symbol', 'nombre', 'decimales', 'iconUrl']
          },
          { 
            model: sequelize.models.Criptomoneda, 
            as: 'quoteAsset',
            attributes: ['id', 'symbol', 'nombre', 'decimales', 'iconUrl']
          }
        ]
      });
      return pair;
    } catch (error) {
      throw new Error(`Error al obtener par por símbolo: ${error.message}`);
    }
  };

  TradingPair.getAll = async (filters = {}) => {
    try {
      const where = {};
      
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.baseAssetId) {
        where.baseAssetId = filters.baseAssetId;
      }
      
      if (filters.quoteAssetId) {
        where.quoteAssetId = filters.quoteAssetId;
      }

      const pairs = await TradingPair.findAll({
        where,
        include: [
          { 
            model: sequelize.models.Criptomoneda, 
            as: 'baseAsset',
            attributes: ['id', 'symbol', 'nombre', 'decimales', 'iconUrl']
          },
          { 
            model: sequelize.models.Criptomoneda, 
            as: 'quoteAsset',
            attributes: ['id', 'symbol', 'nombre', 'decimales', 'iconUrl']
          }
        ],
        order: [['symbol', 'ASC']],
        limit: filters.limit || 100,
        offset: filters.offset || 0
      });

      return pairs;
    } catch (error) {
      throw new Error(`Error al obtener pares de trading: ${error.message}`);
    }
  };

  TradingPair.getActive = async () => {
    try {
      const pairs = await TradingPair.findAll({
        where: { status: 'active' },
        include: [
          { 
            model: sequelize.models.Criptomoneda, 
            as: 'baseAsset',
            attributes: ['id', 'symbol', 'nombre', 'decimales', 'iconUrl']
          },
          { 
            model: sequelize.models.Criptomoneda, 
            as: 'quoteAsset',
            attributes: ['id', 'symbol', 'nombre', 'decimales', 'iconUrl']
          }
        ],
        order: [['symbol', 'ASC']]
      });
      return pairs;
    } catch (error) {
      throw new Error(`Error al obtener pares activos: ${error.message}`);
    }
  };

  // Métodos administrativos
  TradingPair.createPair = async (data) => {
    try {
      // Verificar que no exista ya
      const existing = await TradingPair.findOne({
        where: {
          [Op.or]: [
            { symbol: data.symbol.toUpperCase() },
            {
              baseAssetId: data.baseAssetId,
              quoteAssetId: data.quoteAssetId
            }
          ]
        }
      });

      if (existing) {
        throw new Error('Ya existe un par con ese símbolo o combinación de activos');
      }

      // Verificar que las criptomonedas existan y estén activas
      const [baseAsset, quoteAsset] = await Promise.all([
        sequelize.models.Criptomoneda.findByPk(data.baseAssetId),
        sequelize.models.Criptomoneda.findByPk(data.quoteAssetId)
      ]);

      if (!baseAsset || !baseAsset.activa) {
        throw new Error('Base asset no encontrado o inactivo');
      }

      if (!quoteAsset || !quoteAsset.activa) {
        throw new Error('Quote asset no encontrado o inactivo');
      }

      // Crear el par
      const pair = await TradingPair.create({
        ...data,
        symbol: data.symbol.toUpperCase(),
        pricePrecision: data.pricePrecision || quoteAsset.decimales,
        quantityPrecision: data.quantityPrecision || baseAsset.decimales
      });

      return await TradingPair.getById(pair.id);
    } catch (error) {
      throw new Error(`Error al crear par de trading: ${error.message}`);
    }
  };

  TradingPair.updatePair = async (id, data) => {
    try {
      const pair = await TradingPair.findByPk(id);
      if (!pair) {
        throw new Error('Par de trading no encontrado');
      }

      // Si se cambia el símbolo, verificar que no exista
      if (data.symbol && data.symbol !== pair.symbol) {
        const existing = await TradingPair.findOne({
          where: {
            symbol: data.symbol.toUpperCase(),
            id: { [Op.ne]: id }
          }
        });

        if (existing) {
          throw new Error('Ya existe un par con ese símbolo');
        }
        data.symbol = data.symbol.toUpperCase();
      }

      await pair.update(data);
      return await TradingPair.getById(id);
    } catch (error) {
      throw new Error(`Error al actualizar par de trading: ${error.message}`);
    }
  };

  TradingPair.updateStatus = async (id, status) => {
    try {
      const pair = await TradingPair.findByPk(id);
      if (!pair) {
        throw new Error('Par de trading no encontrado');
      }

      await pair.update({ status });
      return await TradingPair.getById(id);
    } catch (error) {
      throw new Error(`Error al actualizar estado del par: ${error.message}`);
    }
  };

  // Métodos de precio
  TradingPair.updatePrice = async (id, priceData) => {
    try {
      const pair = await TradingPair.findByPk(id);
      if (!pair) {
        throw new Error('Par de trading no encontrado');
      }

      await pair.update({
        lastPrice: priceData.lastPrice || pair.lastPrice,
        priceChange24h: priceData.priceChange24h || pair.priceChange24h,
        volume24h: priceData.volume24h || pair.volume24h,
        high24h: priceData.high24h || pair.high24h,
        low24h: priceData.low24h || pair.low24h
      });

      return pair;
    } catch (error) {
      throw new Error(`Error al actualizar precio: ${error.message}`);
    }
  };

  TradingPair.updatePriceBySymbol = async (symbol, priceData) => {
    try {
      const pair = await TradingPair.findOne({
        where: { symbol: symbol.toUpperCase() }
      });

      if (!pair) {
        throw new Error('Par de trading no encontrado');
      }

      return await TradingPair.updatePrice(pair.id, priceData);
    } catch (error) {
      throw new Error(`Error al actualizar precio por símbolo: ${error.message}`);
    }
  };

  // Métodos de validación
  TradingPair.validateOrder = async (pairId, quantity, price = null) => {
    try {
      const pair = await TradingPair.findByPk(pairId);
      
      if (!pair) {
        throw new Error('Par de trading no encontrado');
      }

      if (pair.status !== 'active') {
        throw new Error('El par de trading no está activo');
      }

      // Validar cantidad mínima
      if (parseFloat(quantity) < parseFloat(pair.minOrderAmount)) {
        throw new Error(`Cantidad mínima: ${pair.minOrderAmount}`);
      }

      // Validar cantidad máxima
      if (pair.maxOrderAmount && parseFloat(quantity) > parseFloat(pair.maxOrderAmount)) {
        throw new Error(`Cantidad máxima: ${pair.maxOrderAmount}`);
      }

      // Validar decimales de cantidad
      const quantityDecimals = (quantity.toString().split('.')[1] || '').length;
      if (quantityDecimals > pair.quantityPrecision) {
        throw new Error(`Máximo ${pair.quantityPrecision} decimales en cantidad`);
      }

      // Validar decimales de precio (si aplica)
      if (price !== null) {
        const priceDecimals = (price.toString().split('.')[1] || '').length;
        if (priceDecimals > pair.pricePrecision) {
          throw new Error(`Máximo ${pair.pricePrecision} decimales en precio`);
        }
      }

      return { valid: true, pair };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  };

  // Métodos de estadísticas
  TradingPair.getStats = async () => {
    try {
      const stats = await TradingPair.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      const totalVolume = await TradingPair.sum('volume_24h');
      
      return {
        byStatus: stats,
        totalVolume24h: totalVolume || 0
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  };

  TradingPair.getTopByVolume = async (limit = 10) => {
    try {
      const pairs = await TradingPair.findAll({
        where: { status: 'active' },
        include: [
          { 
            model: sequelize.models.Criptomoneda, 
            as: 'baseAsset',
            attributes: ['symbol', 'nombre', 'iconUrl']
          },
          { 
            model: sequelize.models.Criptomoneda, 
            as: 'quoteAsset',
            attributes: ['symbol', 'nombre', 'iconUrl']
          }
        ],
        order: [['volume_24h', 'DESC']],
        limit
      });

      return pairs;
    } catch (error) {
      throw new Error(`Error al obtener top pares por volumen: ${error.message}`);
    }
  };

  return TradingPair;
}

module.exports = createTradingPairModel;