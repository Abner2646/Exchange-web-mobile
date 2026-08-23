// services/trading/tradeExecutor.service.js
const { Trade, Order } = require('../../models');
const balanceManager = require('./balanceManager.service');
const feeCalculator = require('./feeCalculator.service');
const money = require('../../utils/money');

class TradeExecutorService {

  /**
   * Ejecuta un trade entre dos órdenes
   */
  async executeTrade(tradeData, transaction) {
    const { buyOrder, sellOrder, quantity, price } = tradeData;

    try {
      // 1. Determinar quién es maker y quién es taker
      const buyerIsMaker = buyOrder.createdAt < sellOrder.createdAt;

      // 2. Calcular fees para ambos lados
      const fees = feeCalculator.calculateBothSidesFees({
        tradingPair: buyOrder.tradingPair,
        quantity,
        price
      }, buyerIsMaker);

      // 3. Crear el registro del trade
      const trade = await Trade.create({
        tradingPairId: buyOrder.tradingPairId,
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        buyerId: buyOrder.userId,
        sellerId: sellOrder.userId,
        price,
        quantity,
        buyerFee: fees.buyer.fee,
        sellerFee: fees.seller.fee,
        buyerFeePercent: fees.buyer.feePercent,
        sellerFeePercent: fees.seller.feePercent,
        makerSide: buyerIsMaker ? 'buy' : 'sell',
        tradingType: buyOrder.tradingType || 'spot',
        totalValue: money.multiply(String(quantity), String(price))
      }, { transaction });

      // 4. Actualizar las órdenes
      await this.updateOrderAfterTrade(buyOrder, quantity, price, fees.buyer.isMaker, transaction);
      await this.updateOrderAfterTrade(sellOrder, quantity, price, fees.seller.isMaker, transaction);

      // 5. Actualizar balances de usuarios
      await balanceManager.updateBalancesAfterTrade(trade, buyOrder, sellOrder, transaction);

      // 6. Actualizar estadísticas del trading pair
      await this.updateTradingPairStats(buyOrder.tradingPairId, trade, transaction);

      return trade;

    } catch (error) {
      console.error('Error ejecutando trade:', error);
      throw error;
    }
  }

  /**
   * Actualiza una orden después de un trade
   */
  async updateOrderAfterTrade(order, matchedQuantity, executionPrice, isMaker, transaction) {
    try {
      const newFilled = money.add(String(order.quantityFilled), String(matchedQuantity));
      const newRemaining = money.subtract(String(order.quantity), newFilled);

      // Calcular precio promedio ponderado
      const previousTotal = money.multiply(String(order.quantityFilled), String(order.averagePrice || 0));
      const newTotal = money.multiply(String(matchedQuantity), String(executionPrice));
      const newAveragePrice = money.compare(newFilled, '0') > 0
        ? money.divide(money.add(previousTotal, newTotal), newFilled)
        : '0';

      // Umbral de polvo (1 satoshi): por debajo, colapsar el residual a 0 exacto.
      const dustCompare = money.compare(newRemaining, '0.00000001');

      const updateData = {
        quantityFilled: newFilled,
        quantityRemaining: dustCompare < 0 ? '0' : newRemaining, // Evitar decimales residuales
        averagePrice: newAveragePrice,
        makerOrTaker: isMaker ? 'maker' : 'taker',
        status: dustCompare <= 0 ? 'filled' : 'partially_filled'
      };

      if (updateData.status === 'filled') {
        updateData.executedAt = new Date();
      }

      await order.update(updateData, { transaction });

      return order;

    } catch (error) {
      console.error('Error actualizando orden después del trade:', error);
      throw error;
    }
  }

  /**
   * Actualiza estadísticas del trading pair después de un trade
   */
  async updateTradingPairStats(tradingPairId, trade, transaction) {
    try {
      const { TradingPair } = require('../../models');
      const tradingPair = await TradingPair.findByPk(tradingPairId, { transaction });

      if (!tradingPair) return;

      // Actualizar último precio
      const updateData = {
        lastPrice: trade.price
      };

      // Calcular volumen 24h (sumar al existente)
      updateData.volume24h = money.add(String(tradingPair.volume24h), String(trade.quantity));

      // Actualizar high/low si es necesario
      const currentPrice = String(trade.price);
      const currentHigh = String(tradingPair.high24h);
      const currentLow = String(tradingPair.low24h);

      if (money.compare(currentPrice, currentHigh) > 0 || money.compare(currentHigh, '0') === 0) {
        updateData.high24h = currentPrice;
      }

      if (money.compare(currentPrice, currentLow) < 0 || money.compare(currentLow, '0') === 0) {
        updateData.low24h = currentPrice;
      }

      await tradingPair.update(updateData, { transaction });

    } catch (error) {
      console.error('Error actualizando estadísticas del trading pair:', error);
      // No lanzar error, es solo estadística
    }
  }

  /**
   * Valida que un trade pueda ejecutarse
   */
  async validateTradeExecution(buyOrder, sellOrder, quantity) {
    try {
      // 1. Verificar que ambas órdenes existan y estén activas
      if (!buyOrder || !sellOrder) {
        return { valid: false, error: 'Órdenes no encontradas' };
      }

      if (!Order.canBeMatched(buyOrder) || !Order.canBeMatched(sellOrder)) {
        return { valid: false, error: 'Órdenes no disponibles para matching' };
      }

      // 2. Verificar que sean de lados opuestos
      if (buyOrder.side === sellOrder.side) {
        return { valid: false, error: 'Ambas órdenes son del mismo lado' };
      }

      // 3. Verificar que sean del mismo par
      if (buyOrder.tradingPairId !== sellOrder.tradingPairId) {
        return { valid: false, error: 'Órdenes de diferentes pares de trading' };
      }

      // 4. Verificar cantidad disponible
      const buyRemaining = String(buyOrder.quantityRemaining);
      const sellRemaining = String(sellOrder.quantityRemaining);
      const qty = String(quantity);

      if (money.compare(qty, buyRemaining) > 0 || money.compare(qty, sellRemaining) > 0) {
        return {
          valid: false,
          error: 'Cantidad excede lo disponible en las órdenes'
        };
      }

      // 5. Verificar que los precios sean compatibles
      const buyPrice = String(buyOrder.price);
      const sellPrice = String(sellOrder.price);

      if (money.compare(buyPrice, sellPrice) < 0) {
        return { 
          valid: false, 
          error: 'Precio de compra menor al precio de venta' 
        };
      }

      // 6. No permitir self-trading
      if (buyOrder.userId === sellOrder.userId) {
        return { valid: false, error: 'Self-trading no permitido' };
      }

      return { valid: true };

    } catch (error) {
      console.error('Error validando ejecución de trade:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Cancela una orden y libera sus fondos
   */
  async cancelOrder(orderId, userId, reason = 'User cancelled') {
    const transaction = await require('../../models').sequelize.transaction();

    try {
      const order = await Order.findByPk(orderId, {
        include: [{ model: require('../../models').TradingPair, as: 'tradingPair' }],
        transaction
      });

      if (!order) {
        await transaction.rollback();
        return { success: false, error: 'Orden no encontrada' };
      }

      // Verificar que pertenezca al usuario
      if (order.userId !== userId) {
        await transaction.rollback();
        return { success: false, error: 'No tienes permiso para cancelar esta orden' };
      }

      // Verificar que pueda ser cancelada
      if (!Order.canBeCancelled(order)) {
        await transaction.rollback();
        return { 
          success: false, 
          error: `La orden no puede ser cancelada (estado: ${order.status})` 
        };
      }

      // Liberar fondos bloqueados
      await balanceManager.unlockBalanceFromOrder(order, transaction);

      // Actualizar estado de la orden
      await order.update({
        status: 'cancelled',
        cancelledReason: reason
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        order
      };

    } catch (error) {
      await transaction.rollback();
      console.error('Error cancelando orden:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new TradeExecutorService();