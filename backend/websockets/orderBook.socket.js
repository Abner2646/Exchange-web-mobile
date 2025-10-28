// websockets/orderBook.socket.js
const orderBookService = require('../services/trading/orderBook.service');

module.exports = (io) => {
  
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Suscribirse a order book de un par
    socket.on('subscribe_orderbook', async (tradingPairId) => {
      socket.join(`orderbook:${tradingPairId}`);
      
      // Enviar estado inicial
      const orderBook = await orderBookService.getOrderBook(tradingPairId);
      socket.emit('orderbook_snapshot', orderBook);
    });

    // Desuscribirse
    socket.on('unsubscribe_orderbook', (tradingPairId) => {
      socket.leave(`orderbook:${tradingPairId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};