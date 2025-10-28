// services/trading/orderBook.service.js
const { Order, Trade, TradingPair, sequelize } = require('../../models');
const { Op } = require('sequelize');
const tradeExecutor = require('./tradeExecutor.service');

class OrderBookService {

  /**
   * Obtener order book de un par de trading
   */
  async getOrderBook(tradingPairId, depth = 20) {
    try {
      const orderBook = await Order.getOrderBook(tradingPairId, depth);
      return orderBook;
    } catch (error) {
      console.error('Error obteniendo order book:', error);
      throw error;
    }
  }

  /**
   * Motor de matching - encuentra y ejecuta trades
   */
  /**
 * Motor de matching - encuentra y ejecuta trades
 */
async matchOrder(orderId) {
  const transaction = await sequelize.transaction();
  
  try {
    // 1. Obtener la orden con lock (SOLO la tabla orders)
    const order = await Order.findByPk(orderId, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!order) {
      await transaction.rollback();
      return { 
        matched: false, 
        reason: 'Orden no encontrada' 
      };
    }

    // 2. Cargar el trading pair con sus relaciones (sin lock)
    const tradingPair = await TradingPair.findByPk(order.tradingPairId, {
      include: [
        { association: 'baseAsset' },
        { association: 'quoteAsset' }
      ],
      transaction
    });

    if (!tradingPair) {
      await transaction.rollback();
      return { 
        matched: false, 
        reason: 'Trading pair no encontrado' 
      };
    }

    // Asignar manualmente
    order.tradingPair = tradingPair;

    // ✅ 3. CAMBIAR STATUS A 'OPEN' PRIMERO (antes de validar)
    if (order.status === 'pending') {
      await order.update({ status: 'open' }, { transaction });
      console.log(`📝 Orden ${order.id.substring(0, 8)}... cambió de pending → open`);
    }

    // ✅ 4. AHORA verificar que esté disponible para matching
    if (!Order.canBeMatched(order)) {
      await transaction.rollback();
      console.log(`⚠️  Orden ${order.id.substring(0, 8)}... no disponible para matching (status: ${order.status})`);
      return { 
        matched: false, 
        reason: `Orden no disponible para matching (status: ${order.status})` 
      };
    }

    // 5. Si es market order, convertirla a limit
    if (order.orderType === 'market') {
      const bestPrice = await this.getBestPrice(order.tradingPairId, order.side, transaction);
      if (!bestPrice) {
        await transaction.rollback();
        console.log(`⚠️  No hay liquidez para market order ${order.id.substring(0, 8)}...`);
        return { 
          matched: false, 
          reason: 'No hay liquidez disponible para market order' 
        };
      }
      order.price = bestPrice;
      console.log(`💱 Market order ${order.id.substring(0, 8)}... → precio ${bestPrice}`);
    }

    // 6. Buscar órdenes compatibles
    const matchingOrders = await this.findMatchingOrders(order, transaction);

    if (matchingOrders.length === 0) {
      await transaction.commit();
      console.log(`📋 Orden ${order.id.substring(0, 8)}... agregada al order book (sin match)`);
      return { 
        matched: false, 
        reason: 'No se encontraron órdenes compatibles',
        orderStatus: 'open'
      };
    }

    console.log(`🎯 Encontradas ${matchingOrders.length} órdenes compatibles para ${order.id.substring(0, 8)}...`);

    // 7. Ejecutar matches
    const trades = [];
    let remainingQuantity = parseFloat(order.quantityRemaining);

    for (const matchOrder of matchingOrders) {
      if (remainingQuantity <= 0) break;

      const matchQuantity = Math.min(
        remainingQuantity,
        parseFloat(matchOrder.quantityRemaining)
      );

      // Cargar tradingPair para la orden de match
      if (!matchOrder.tradingPair) {
        matchOrder.tradingPair = tradingPair;
      }

      console.log(`⚡ Ejecutando trade: ${matchQuantity} ${tradingPair.symbol.split('/')[0]} @ ${this.determineExecutionPrice(order, matchOrder)}`);

      // Ejecutar el trade
      const trade = await tradeExecutor.executeTrade({
        buyOrder: order.side === 'buy' ? order : matchOrder,
        sellOrder: order.side === 'sell' ? order : matchOrder,
        quantity: matchQuantity,
        price: this.determineExecutionPrice(order, matchOrder)
      }, transaction);

      if (trade) {
        trades.push(trade);
        remainingQuantity -= matchQuantity;
        console.log(`✅ Trade ejecutado: ID ${trade.id.substring(0, 8)}...`);
      }
    }

    await transaction.commit();

    console.log(`🎉 Matching completado: ${trades.length} trade(s) ejecutado(s)`);

    // 8. Recargar la orden actualizada
    const updatedOrder = await Order.findByPk(orderId, {
      include: [{ 
        model: TradingPair, 
        as: 'tradingPair',
        include: [
          { association: 'baseAsset' },
          { association: 'quoteAsset' }
        ]
      }]
    });

    return {
      matched: true,
      trades,
      order: updatedOrder,
      totalMatched: parseFloat(order.quantity) - remainingQuantity
    };

  } catch (error) {
    await transaction.rollback();
    console.error(`❌ Error en matching de orden ${orderId}:`, error.message);
    throw error;
  }
}

  /**
   * Encuentra órdenes compatibles para hacer match
   */
async findMatchingOrders(order, transaction) {
  try {
    const oppositeSide = order.side === 'buy' ? 'sell' : 'buy';
    
    const whereClause = {
      tradingPairId: order.tradingPairId,
      side: oppositeSide,
      status: 'open',
      tradingType: order.tradingType || 'spot',
      userId: { [Op.ne]: order.userId }, // No self-trading
      quantityRemaining: { [Op.gt]: 0 }
    };

    // Filtro de precio según el lado
    if (order.side === 'buy') {
      whereClause.price = { [Op.lte]: order.price };
      console.log(`🔍 Buscando VENTAS <= ${order.price}`);
    } else {
      whereClause.price = { [Op.gte]: order.price };
      console.log(`🔍 Buscando COMPRAS >= ${order.price}`);
    }

    const orderBy = order.side === 'buy' ? 
      [['price', 'ASC'], ['created_at', 'ASC']] :
      [['price', 'DESC'], ['created_at', 'ASC']];

    const matchingOrders = await Order.findAll({
      where: whereClause,
      order: orderBy,
      limit: 50,
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    console.log(`   → Encontradas ${matchingOrders.length} órdenes compatibles`);

    return matchingOrders;

  } catch (error) {
    console.error('Error buscando órdenes compatibles:', error);
    throw error;
  }
}

  /**
   * Determina el precio de ejecución (precio del maker)
   */
  determineExecutionPrice(order1, order2) {
    // El precio de ejecución es el precio de la orden que llegó primero (maker)
    const isBuyerMaker = order1.side === 'buy' && order1.createdAt < order2.createdAt;
    const isSellerMaker = order1.side === 'sell' && order1.createdAt < order2.createdAt;

    if (isBuyerMaker || (order1.side === 'buy' && order2.createdAt < order1.createdAt)) {
      return parseFloat(order1.price);
    } else {
      return parseFloat(order2.price);
    }
  }

  /**
   * Obtiene el mejor precio disponible para una market order
   */
  async getBestPrice(tradingPairId, side, transaction = null) {
    try {
      const oppositeSide = side === 'buy' ? 'sell' : 'buy';
      
      const bestOrder = await Order.findOne({
        where: {
          tradingPairId,
          side: oppositeSide,
          status: 'open',
          quantityRemaining: { [Op.gt]: 0 }
        },
        order: [
          side === 'buy' ? ['price', 'ASC'] : ['price', 'DESC']
        ],
        transaction
      });

      return bestOrder ? parseFloat(bestOrder.price) : null;

    } catch (error) {
      console.error('Error obteniendo mejor precio:', error);
      return null;
    }
  }

  /**
   * Intenta hacer matching de todas las órdenes abiertas de un par
   */
  async matchAllPairOrders(tradingPairId) {
    try {
      const openOrders = await Order.findAll({
        where: {
          tradingPairId,
          status: 'open',
          quantityRemaining: { [Op.gt]: 0 }
        },
        order: [['created_at', 'ASC']],
        limit: 100
      });

      const results = {
        total: openOrders.length,
        matched: 0,
        failed: 0,
        trades: []
      };

      for (const order of openOrders) {
        try {
          const result = await this.matchOrder(order.id);
          if (result.matched) {
            results.matched++;
            if (result.trades) {
              results.trades.push(...result.trades);
            }
          }
        } catch (error) {
          console.error(`Error matching order ${order.id}:`, error.message);
          results.failed++;
        }
      }

      return results;

    } catch (error) {
      console.error('Error matching all orders:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del order book
   */
  async getOrderBookStats(tradingPairId) {
    try {
      const [buyOrders, sellOrders] = await Promise.all([
        Order.findAll({
          where: {
            tradingPairId,
            side: 'buy',
            status: 'open'
          },
          attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('quantity_remaining')), 'totalQuantity'],
            [sequelize.fn('MAX', sequelize.col('price')), 'maxPrice']
          ],
          raw: true
        }),
        Order.findAll({
          where: {
            tradingPairId,
            side: 'sell',
            status: 'open'
          },
          attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            [sequelize.fn('SUM', sequelize.col('quantity_remaining')), 'totalQuantity'],
            [sequelize.fn('MIN', sequelize.col('price')), 'minPrice']
          ],
          raw: true
        })
      ]);

      const buyStats = buyOrders[0] || { count: 0, totalQuantity: 0, maxPrice: 0 };
      const sellStats = sellOrders[0] || { count: 0, totalQuantity: 0, minPrice: 0 };

      return {
        bids: {
          orders: parseInt(buyStats.count) || 0,
          totalQuantity: parseFloat(buyStats.totalQuantity) || 0,
          bestPrice: parseFloat(buyStats.maxPrice) || 0
        },
        asks: {
          orders: parseInt(sellStats.count) || 0,
          totalQuantity: parseFloat(sellStats.totalQuantity) || 0,
          bestPrice: parseFloat(sellStats.minPrice) || 0
        },
        spread: (parseFloat(sellStats.minPrice) || 0) - (parseFloat(buyStats.maxPrice) || 0),
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Error obteniendo estadísticas del order book:', error);
      throw error;
    }
  }

  /**
   * Obtiene el spread actual de un par
   */
  async getSpread(tradingPairId) {
    try {
      const [bestBid, bestAsk] = await Promise.all([
        Order.findOne({
          where: {
            tradingPairId,
            side: 'buy',
            status: 'open'
          },
          order: [['price', 'DESC']],
          attributes: ['price']
        }),
        Order.findOne({
          where: {
            tradingPairId,
            side: 'sell',
            status: 'open'
          },
          order: [['price', 'ASC']],
          attributes: ['price']
        })
      ]);

      const bidPrice = bestBid ? parseFloat(bestBid.price) : 0;
      const askPrice = bestAsk ? parseFloat(bestAsk.price) : 0;
      const spread = askPrice - bidPrice;
      const spreadPercent = bidPrice > 0 ? (spread / bidPrice) * 100 : 0;

      return {
        bid: bidPrice,
        ask: askPrice,
        spread,
        spreadPercent
      };

    } catch (error) {
      console.error('Error calculando spread:', error);
      throw error;
    }
  }
}

module.exports = new OrderBookService();