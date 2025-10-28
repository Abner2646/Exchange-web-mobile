// services/trading/orderBook.service.js
const { Order, Trade, TradingBalance, TradingPair } = require('../../models');
const { Op } = require('sequelize');
const sequelize = require('../../config/database');

class OrderBookService {
  
  /**
   * Obtener order book de un par
   */
  async getOrderBook(tradingPairId, depth = 20) {
    const [bids, asks] = await Promise.all([
      // Órdenes de compra (bids)
      Order.findAll({
        where: {
          tradingPairId,
          side: 'buy',
          status: 'open',
          tradingType: 'spot'
        },
        attributes: [
          'price',
          [sequelize.fn('SUM', sequelize.col('quantityRemaining')), 'totalQuantity'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'orderCount']
        ],
        group: ['price'],
        order: [['price', 'DESC']],
        limit: depth,
        raw: true
      }),
      
      // Órdenes de venta (asks)
      Order.findAll({
        where: {
          tradingPairId,
          side: 'sell',
          status: 'open',
          tradingType: 'spot'
        },
        attributes: [
          'price',
          [sequelize.fn('SUM', sequelize.col('quantityRemaining')), 'totalQuantity'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'orderCount']
        ],
        group: ['price'],
        order: [['price', 'ASC']],
        limit: depth,
        raw: true
      })
    ]);

    return {
      bids: bids.map(b => ({
        price: parseFloat(b.price),
        quantity: parseFloat(b.totalQuantity),
        total: parseFloat(b.price) * parseFloat(b.totalQuantity),
        orders: parseInt(b.orderCount)
      })),
      asks: asks.map(a => ({
        price: parseFloat(a.price),
        quantity: parseFloat(a.totalQuantity),
        total: parseFloat(a.price) * parseFloat(a.totalQuantity),
        orders: parseInt(a.orderCount)
      })),
      timestamp: new Date()
    };
  }

  /**
   * Matching Engine - El corazón del sistema
   */
  async matchOrders(orderId) {
    const transaction = await sequelize.transaction();
    
    try {
      const order = await Order.findByPk(orderId, {
        include: [{ model: TradingPair, as: 'tradingPair' }],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!order || order.status !== 'open') {
        await transaction.rollback();
        return { matched: false, reason: 'Order not available' };
      }

      const trades = [];
      let remainingQuantity = parseFloat(order.quantityRemaining);

      // Buscar órdenes compatibles
      const matchingOrders = await this.findMatchingOrders(order, transaction);

      for (const matchOrder of matchingOrders) {
        if (remainingQuantity <= 0) break;

        const matchQuantity = Math.min(
          remainingQuantity,
          parseFloat(matchOrder.quantityRemaining)
        );

        // Ejecutar el trade
        const trade = await this.executeTrade(
          order,
          matchOrder,
          matchQuantity,
          transaction
        );

        trades.push(trade);
        remainingQuantity -= matchQuantity;

        // Actualizar orden matched
        await this.updateOrderAfterMatch(matchOrder, matchQuantity, transaction);
      }

      // Actualizar orden original
      await this.updateOrderAfterMatch(order, 
        parseFloat(order.quantityRemaining) - remainingQuantity, 
        transaction
      );

      await transaction.commit();

      return {
        matched: true,
        trades,
        order: await Order.findByPk(orderId)
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Encuentra órdenes compatibles para matching
   */
  async findMatchingOrders(order, transaction) {
    const oppositeSide = order.side === 'buy' ? 'sell' : 'buy';
    
    const whereClause = {
      tradingPairId: order.tradingPairId,
      side: oppositeSide,
      status: 'open',
      tradingType: order.tradingType,
      userId: { [Op.ne]: order.userId } // No self-trading
    };

    // Filtro de precio según tipo de orden
    if (order.orderType === 'limit') {
      if (order.side === 'buy') {
        // Compra: precio de venta <= precio de compra
        whereClause.price = { [Op.lte]: order.price };
      } else {
        // Venta: precio de compra >= precio de venta
        whereClause.price = { [Op.gte]: order.price };
      }
    }

    return await Order.findAll({
      where: whereClause,
      order: [
        // Price priority
        order.side === 'buy' ? ['price', 'ASC'] : ['price', 'DESC'],
        // Time priority
        ['createdAt', 'ASC']
      ],
      limit: 100,
      transaction,
      lock: transaction.LOCK.UPDATE
    });
  }

  /**
   * Ejecuta un trade entre dos órdenes
   */
  async executeTrade(buyOrder, sellOrder, quantity, transaction) {
    const tradingPair = buyOrder.tradingPair || sellOrder.tradingPair;
    
    // Determinar precio de ejecución (precio del maker)
    const isBuyerMaker = buyOrder.createdAt < sellOrder.createdAt;
    const executionPrice = isBuyerMaker ? buyOrder.price : sellOrder.price;

    // Calcular fees
    const buyerFeePercent = isBuyerMaker ? 
      tradingPair.makerFeePercent : tradingPair.takerFeePercent;
    const sellerFeePercent = !isBuyerMaker ? 
      tradingPair.makerFeePercent : tradingPair.takerFeePercent;

    const buyerFee = parseFloat(quantity) * parseFloat(buyerFeePercent) / 100;
    const sellerFee = parseFloat(quantity) * parseFloat(executionPrice) * 
                      parseFloat(sellerFeePercent) / 100;

    // Crear trade
    const trade = await Trade.create({
      tradingPairId: tradingPair.id,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      buyerId: buyOrder.userId,
      sellerId: sellOrder.userId,
      price: executionPrice,
      quantity: quantity,
      buyerFee,
      sellerFee,
      buyerFeePercent,
      sellerFeePercent,
      makerSide: isBuyerMaker ? 'buy' : 'sell',
      tradingType: buyOrder.tradingType,
      totalBase: parseFloat(quantity) * parseFloat(executionPrice),
      totalQuote: quantity
    }, { transaction });

    // Actualizar balances
    await this.updateBalancesAfterTrade(trade, buyOrder, sellOrder, transaction);

    return trade;
  }

  /**
   * Actualiza balances después de un trade
   */
  async updateBalancesAfterTrade(trade, buyOrder, sellOrder, transaction) {
    const tradingPair = buyOrder.tradingPair;
    
    // Balance del comprador
    // Recibe: base asset (BTC)
    // Paga: quote asset (USDT)
    await TradingBalance.increment(
      { available: parseFloat(trade.quantity) - parseFloat(trade.buyerFee) },
      {
        where: {
          userId: trade.buyerId,
          criptomonedaId: tradingPair.baseAssetId,
          accountType: trade.tradingType
        },
        transaction
      }
    );

    await TradingBalance.decrement(
      { locked: parseFloat(trade.totalBase) },
      {
        where: {
          userId: trade.buyerId,
          criptomonedaId: tradingPair.quoteAssetId,
          accountType: trade.tradingType
        },
        transaction
      }
    );

    // Balance del vendedor
    // Recibe: quote asset (USDT)
    // Paga: base asset (BTC)
    await TradingBalance.increment(
      { available: parseFloat(trade.totalBase) - parseFloat(trade.sellerFee) },
      {
        where: {
          userId: trade.sellerId,
          criptomonedaId: tradingPair.quoteAssetId,
          accountType: trade.tradingType
        },
        transaction
      }
    );

    await TradingBalance.decrement(
      { locked: parseFloat(trade.quantity) },
      {
        where: {
          userId: trade.sellerId,
          criptomonedaId: tradingPair.baseAssetId,
          accountType: trade.tradingType
        },
        transaction
      }
    );
  }

  /**
   * Actualiza orden después de match
   */
  async updateOrderAfterMatch(order, matchedQuantity, transaction) {
    const newRemaining = parseFloat(order.quantityRemaining) - matchedQuantity;
    const newFilled = parseFloat(order.quantityFilled) + matchedQuantity;

    const updateData = {
      quantityFilled: newFilled,
      quantityRemaining: newRemaining,
      status: newRemaining <= 0 ? 'filled' : 'partially_filled'
    };

    if (updateData.status === 'filled') {
      updateData.executedAt = new Date();
    }

    await order.update(updateData, { transaction });
  }
}

module.exports = new OrderBookService();