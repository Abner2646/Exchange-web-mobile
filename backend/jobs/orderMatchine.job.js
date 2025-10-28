// jobs/orderMatching.job.js
const cron = require('node-cron');
const { Order } = require('../models');
const orderBookService = require('../services/trading/orderBook.service');

class OrderMatchingJob {
  
  start() {
    // Ejecutar matching cada 100ms (10 veces por segundo)
    this.interval = setInterval(async () => {
      await this.processOrders();
    }, 100);

    console.log('Order Matching Job started');
  }

  async processOrders() {
    try {
      // Obtener órdenes pendientes de matching
      const orders = await Order.findAll({
        where: {
          status: 'open',
          tradingType: 'spot'
        },
        order: [['createdAt', 'ASC']],
        limit: 50
      });

      for (const order of orders) {
        await orderBookService.matchOrders(order.id);
      }

    } catch (error) {
      console.error('Error in order matching job:', error);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('Order Matching Job stopped');
    }
  }
}

module.exports = new OrderMatchingJob();