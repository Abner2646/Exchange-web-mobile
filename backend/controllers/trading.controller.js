// controllers/trading.controller.js
const orderBookService = require('../services/trading/orderBook.service');
const orderValidator = require('../services/trading/orderValidator.service');
const balanceManager = require('../services/trading/balanceManager.service');
const feeCalculator = require('../services/trading/feeCalculator.service');
const tradeExecutor = require('../services/trading/tradeExecutor.service');
const { Order, TradingPair, Trade } = require('../models');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');

class TradingController {

  /**
   * Crear nueva orden
   * POST /api/trading/orders
   */
  async createOrder(req, res) {
    const {
      tradingPairId,
      orderType,
      side,
      quantity,
      price,
      stopPrice,
      timeInForce = 'GTC',
      clientOrderId
    } = req.body;

    const userId = req.user.id;

    // 1. Validar trading pair
    const tradingPair = await TradingPair.findByPk(tradingPairId, {
      include: [
        { association: 'baseAsset' },
        { association: 'quoteAsset' }
      ]
    });

    if (!tradingPair || tradingPair.status !== 'active') {
      throw new AppError(400, errorCodes.TRADING_PAIR_NOT_FOUND, 'Par de trading no disponible');
    }

    // 2. Validar orden
    const validation = await orderValidator.validateOrder({
      tradingPairId,
      orderType,
      side,
      quantity,
      price,
      stopPrice,
      timeInForce,
      userId
    });

    if (!validation.valid) {
      throw new AppError(400, errorCodes.INVALID_ORDER, validation.error);
    }

    // 3. Verificar balance suficiente
    const balanceCheck = await balanceManager.checkSufficientBalance(
      userId,
      tradingPairId,
      side,
      quantity,
      price
    );

    if (!balanceCheck.sufficient) {
      throw new AppError(400, errorCodes.INSUFFICIENT_BALANCE, balanceCheck.error);
    }

    // 4. Bloquear balance
    const balanceLocked = await balanceManager.lockBalanceForOrder({
      userId,
      tradingPair,
      side,
      quantity,
      price: orderType === 'market' ? null : price
    });

    if (!balanceLocked.success) {
      throw new AppError(400, errorCodes.INSUFFICIENT_BALANCE, balanceLocked.error);
    }

    // 5. Calcular fee
    const feeData = await feeCalculator.calculateOrderFee({
      tradingPairId,
      side,
      quantity,
      price,
      orderType
    });

    // 6. Crear orden
    const order = await Order.create({
      userId,
      tradingPairId,
      orderType,
      side,
      quantity,
      quantityRemaining: quantity,
      price: orderType === 'limit' ? price : null,
      stopPrice,
      timeInForce,
      status: 'pending',
      tradingType: 'spot',
      feePercent: feeData.feePercent,
      feeCurrency: feeData.feeCurrency,
      clientOrderId,
      leverage: 1
    });

    // 7. Intentar matching inmediato (asíncrono)
    orderBookService.matchOrder(order.id)
      .then(matchResult => {
        // Emitir evento WebSocket si está disponible
        if (req.io) {
          req.io.to(`orderbook:${tradingPairId}`).emit('orderbook_update', {
            action: 'new_order',
            orderId: order.id,
            side: order.side
          });

          if (matchResult.matched && matchResult.trades.length > 0) {
            req.io.to(`user:${userId}`).emit('order_filled', {
              orderId: order.id,
              trades: matchResult.trades
            });
          }
        }
      })
      .catch(err => {
        console.error('Error en matching asíncrono:', err);
      });

    // 8. Recargar orden con relaciones
    const createdOrder = await Order.findByPk(order.id, {
      include: [{
        model: TradingPair,
        as: 'tradingPair',
        include: [
          { association: 'baseAsset' },
          { association: 'quoteAsset' }
        ]
      }]
    });

    res.status(201).json({
      success: true,
      order: createdOrder,
      message: 'Orden creada exitosamente'
    });
  }

  /**
   * Cancelar orden
   * DELETE /api/trading/orders/:orderId
   */
  async cancelOrder(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const result = await tradeExecutor.cancelOrder(orderId, userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Emitir WebSocket
      if (req.io && result.order) {
        req.io.to(`orderbook:${result.order.tradingPairId}`).emit('orderbook_update', {
          action: 'order_cancelled',
          orderId: result.order.id
        });
      }

      res.json(result);

    } catch (error) {
      console.error('Error cancelando orden:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al cancelar orden' 
      });
    }
  }

  /**
   * Obtener órdenes del usuario
   * GET /api/trading/orders
   */
  async getUserOrders(req, res) {
    try {
      const userId = req.user.id;
      const { 
        status, 
        tradingPairId, 
        side,
        limit = 50, 
        offset = 0 
      } = req.query;

      const filters = {
        status,
        tradingPairId,
        side,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const orders = await Order.getByUserId(userId, filters);

      res.json({
        success: true,
        orders,
        total: orders.length
      });

    } catch (error) {
      console.error('Error obteniendo órdenes:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener órdenes' 
      });
    }
  }

  /**
   * Obtener órdenes activas del usuario
   * GET /api/trading/orders/active
   */
  async getUserActiveOrders(req, res) {
    try {
      const userId = req.user.id;

      const orders = await Order.getUserActiveOrders(userId);

      res.json({
        success: true,
        orders,
        total: orders.length
      });

    } catch (error) {
      console.error('Error obteniendo órdenes activas:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener órdenes activas' 
      });
    }
  }

  /**
   * Obtener detalle de una orden
   * GET /api/trading/orders/:orderId
   */
  async getOrderDetail(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      const order = await Order.getById(orderId);

      if (!order) {
        return res.status(404).json({ 
          success: false,
          error: 'Orden no encontrada' 
        });
      }

      // Verificar que pertenezca al usuario (o sea admin)
      // Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #4): req.user.isAdmin
      // nunca existe (authMiddleware setea req.user.rol) — la condición
      // "o sos admin" nunca se cumplía, ningún admin podía ver órdenes
      // ajenas pese a que el código aparentaba permitirlo.
      const isAdmin = ['admin', 'super_admin'].includes(req.user.rol);
      if (order.userId !== userId && !isAdmin) {
        return res.status(403).json({ 
          success: false,
          error: 'No tienes permiso para ver esta orden' 
        });
      }

      // Obtener trades de esta orden
      const trades = await Trade.findAll({
        where: {
          [require('sequelize').Op.or]: [
            { buyOrderId: orderId },
            { sellOrderId: orderId }
          ]
        },
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        order,
        trades,
        tradesCount: trades.length
      });

    } catch (error) {
      console.error('Error obteniendo detalle de orden:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener detalle de orden' 
      });
    }
  }

  /**
   * Obtener order book
   * GET /api/trading/orderbook/:tradingPairId
   */
  async getOrderBook(req, res) {
    try {
      const { tradingPairId } = req.params;
      const { depth = 20 } = req.query;

      const orderBook = await orderBookService.getOrderBook(
        tradingPairId, 
        parseInt(depth)
      );

      res.json({
        success: true,
        orderBook
      });

    } catch (error) {
      console.error('Error obteniendo order book:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener order book' 
      });
    }
  }

  /**
   * Obtener estadísticas del order book
   * GET /api/trading/orderbook/:tradingPairId/stats
   */
  async getOrderBookStats(req, res) {
    try {
      const { tradingPairId } = req.params;

      const stats = await orderBookService.getOrderBookStats(tradingPairId);

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
   * Obtener spread actual
   * GET /api/trading/spread/:tradingPairId
   */
  async getSpread(req, res) {
    try {
      const { tradingPairId } = req.params;

      const spread = await orderBookService.getSpread(tradingPairId);

      res.json({
        success: true,
        spread
      });

    } catch (error) {
      console.error('Error obteniendo spread:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener spread' 
      });
    }
  }

  /**
   * Obtener balance de trading del usuario
   * GET /api/trading/balance
   */
  async getTradingBalance(req, res) {
    try {
      const userId = req.user.id;
      const { criptomonedaId } = req.query;

      if (criptomonedaId) {
        const balance = await balanceManager.getTradingBalance(userId, criptomonedaId);
        return res.json({
          success: true,
          balance
        });
      }

      const balances = await balanceManager.getAllTradingBalances(userId);
      
      res.json({
        success: true,
        balances
      });

    } catch (error) {
      console.error('Error obteniendo balance de trading:', error);
      res.status(500).json({ 
        success: false,
        error: 'Error al obtener balance' 
      });
    }
  }
}

module.exports = new TradingController();