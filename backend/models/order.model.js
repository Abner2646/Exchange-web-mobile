// models/order.model.js
const initOrder = require('./entities/order.entity');
const { Op } = require('sequelize');

function createOrderModel(sequelize) {
  const Order = initOrder(sequelize);

  // Métodos de consulta básicos
  Order.getById = async (id, options = {}) => {
    try {
      const order = await Order.findByPk(id, {
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
            model: sequelize.models.Usuario,
            as: 'user',
            attributes: ['id', 'email', 'nombre']
          }
        ],
        ...options
      });
      return order;
    } catch (error) {
      throw new Error(`Error al obtener orden por ID: ${error.message}`);
    }
  };

  Order.getByUserId = async (userId, filters = {}) => {
    try {
      const where = { userId };
      
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.tradingPairId) {
        where.tradingPairId = filters.tradingPairId;
      }
      
      if (filters.side) {
        where.side = filters.side;
      }
      
      if (filters.orderType) {
        where.orderType = filters.orderType;
      }

      const orders = await Order.findAll({
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

      return orders;
    } catch (error) {
      throw new Error(`Error al obtener órdenes por usuario: ${error.message}`);
    }
  };

  Order.getOpenOrders = async (tradingPairId = null, options = {}) => {
    try {
      const where = {
        status: 'open',
        tradingType: 'spot'
      };
      
      if (tradingPairId) {
        where.tradingPairId = tradingPairId;
      }

      const orders = await Order.findAll({
        where,
        include: [
          {
            model: sequelize.models.TradingPair,
            as: 'tradingPair'
          }
        ],
        order: [['created_at', 'ASC']],
        ...options
      });

      return orders;
    } catch (error) {
      throw new Error(`Error al obtener órdenes abiertas: ${error.message}`);
    }
  };

  Order.getOrderBook = async (tradingPairId, depth = 20) => {
    try {
      const [bids, asks] = await Promise.all([
        // Órdenes de compra (bids) - ordenadas de mayor a menor precio
        Order.findAll({
          where: {
            tradingPairId,
            side: 'buy',
            status: 'open',
            tradingType: 'spot',
            orderType: 'limit'
          },
          attributes: [
            'price',
            [sequelize.fn('SUM', sequelize.col('quantity_remaining')), 'totalQuantity'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'orderCount']
          ],
          group: ['price'],
          order: [['price', 'DESC']],
          limit: depth,
          raw: true
        }),
        
        // Órdenes de venta (asks) - ordenadas de menor a mayor precio
        Order.findAll({
          where: {
            tradingPairId,
            side: 'sell',
            status: 'open',
            tradingType: 'spot',
            orderType: 'limit'
          },
          attributes: [
            'price',
            [sequelize.fn('SUM', sequelize.col('quantity_remaining')), 'totalQuantity'],
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
    } catch (error) {
      throw new Error(`Error al obtener order book: ${error.message}`);
    }
  };

  // Métodos de creación y actualización
  Order.createOrder = async (data, transaction = null) => {
    try {
      const order = await Order.create({
        ...data,
        quantityRemaining: data.quantity,
        status: 'pending'
      }, { transaction });

      return order;
    } catch (error) {
      throw new Error(`Error al crear orden: ${error.message}`);
    }
  };

  Order.updateOrderStatus = async (orderId, status, additionalData = {}, transaction = null) => {
    try {
      const order = await Order.findByPk(orderId, { transaction });
      
      if (!order) {
        throw new Error('Orden no encontrada');
      }

      const updateData = { status, ...additionalData };
      
      if (status === 'filled') {
        updateData.executedAt = new Date();
        updateData.quantityRemaining = 0;
      }

      await order.update(updateData, { transaction });
      return order;
    } catch (error) {
      throw new Error(`Error al actualizar estado de orden: ${error.message}`);
    }
  };

  Order.cancelOrder = async (orderId, reason = 'User cancelled', transaction = null) => {
    try {
      const order = await Order.findByPk(orderId, { transaction });
      
      if (!order) {
        throw new Error('Orden no encontrada');
      }

      if (!['open', 'partially_filled', 'pending'].includes(order.status)) {
        throw new Error('La orden no puede ser cancelada');
      }

      await order.update({
        status: 'cancelled',
        cancelledReason: reason
      }, { transaction });

      return order;
    } catch (error) {
      throw new Error(`Error al cancelar orden: ${error.message}`);
    }
  };

  // Métodos de validación
  Order.canBeCancelled = (order) => {
    return ['open', 'partially_filled', 'pending'].includes(order.status);
  };

  Order.canBeMatched = (order) => {
    return ['open', 'partially_filled'].includes(order.status) && 
           parseFloat(order.quantityRemaining) > 0;
  };

  // Métodos estadísticos
  Order.getStats = async (userId = null) => {
    try {
      const where = {};
      if (userId) where.userId = userId;

      const stats = await Order.findAll({
        attributes: [
          'status',
          'side',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
          [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantity']
        ],
        where,
        group: ['status', 'side'],
        raw: true
      });

      return stats;
    } catch (error) {
      throw new Error(`Error al obtener estadísticas de órdenes: ${error.message}`);
    }
  };

  Order.getUserActiveOrders = async (userId) => {
    try {
      const orders = await Order.findAll({
        where: {
          userId,
          status: { [Op.in]: ['open', 'partially_filled'] }
        },
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
        order: [['created_at', 'DESC']]
      });

      return orders;
    } catch (error) {
      throw new Error(`Error al obtener órdenes activas del usuario: ${error.message}`);
    }
  };

  // Método para limpiar órdenes expiradas
  Order.expireOldOrders = async () => {
    try {
      const now = new Date();
      
      const [count] = await Order.update(
        { 
          status: 'expired',
          cancelledReason: 'Orden expirada automáticamente'
        },
        {
          where: {
            status: { [Op.in]: ['open', 'partially_filled'] },
            expiresAt: { [Op.lt]: now }
          }
        }
      );

      return count;
    } catch (error) {
      throw new Error(`Error al expirar órdenes: ${error.message}`);
    }
  };

  return Order;
}

module.exports = createOrderModel;