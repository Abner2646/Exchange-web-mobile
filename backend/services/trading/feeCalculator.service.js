// services/trading/feeCalculator.service.js
const { TradingPair } = require('../../models');

class FeeCalculatorService {

  /**
   * Calcula el fee para una orden
   */
  async calculateOrderFee(orderData) {
    const { tradingPairId, side, quantity, price, orderType } = orderData;

    try {
      const tradingPair = await TradingPair.findByPk(tradingPairId);
      
      if (!tradingPair) {
        throw new Error('Trading pair no encontrado');
      }

      // Para órdenes nuevas, asumimos taker fee (más conservador)
      // El fee real se determinará cuando se ejecute (maker vs taker)
      const feePercent = parseFloat(tradingPair.takerFeePercent);

      let feeAmount = 0;
      let feeCurrency = '';

      if (side === 'buy') {
        // Comprando: fee se cobra en BASE ASSET (lo que compras)
        // Ejemplo: Compras BTC, fee en BTC
        const effectivePrice = price || parseFloat(tradingPair.lastPrice);
        const totalValue = parseFloat(quantity) * effectivePrice;
        
        // Fee se calcula sobre la cantidad comprada
        feeAmount = parseFloat(quantity) * (feePercent / 100);
        feeCurrency = tradingPair.symbol.split('/')[0]; // Base asset

      } else {
        // Vendiendo: fee se cobra en QUOTE ASSET (lo que recibes)
        // Ejemplo: Vendes BTC por USDT, fee en USDT
        const effectivePrice = price || parseFloat(tradingPair.lastPrice);
        const totalValue = parseFloat(quantity) * effectivePrice;
        
        // Fee se calcula sobre el valor total en quote
        feeAmount = totalValue * (feePercent / 100);
        feeCurrency = tradingPair.symbol.split('/')[1]; // Quote asset
      }

      return {
        feePercent,
        feeAmount,
        feeCurrency,
        feeType: 'taker' // Asumimos taker hasta que se ejecute
      };

    } catch (error) {
      console.error('Error calculando fee de orden:', error);
      throw error;
    }
  }

  /**
   * Calcula el fee para un trade específico
   */
  calculateTradeFee(tradeData, isMaker = false) {
    const { tradingPair, quantity, price, side } = tradeData;

    try {
      // Determinar si es maker o taker
      const feePercent = isMaker ? 
        parseFloat(tradingPair.makerFeePercent) : 
        parseFloat(tradingPair.takerFeePercent);

      let feeAmount = 0;
      let feeCurrency = '';

      if (side === 'buy') {
        // Fee en base asset (lo que compras)
        feeAmount = parseFloat(quantity) * (feePercent / 100);
        feeCurrency = tradingPair.symbol.split('/')[0];
      } else {
        // Fee en quote asset (lo que recibes)
        const totalValue = parseFloat(quantity) * parseFloat(price);
        feeAmount = totalValue * (feePercent / 100);
        feeCurrency = tradingPair.symbol.split('/')[1];
      }

      return {
        feePercent,
        feeAmount,
        feeCurrency,
        feeType: isMaker ? 'maker' : 'taker'
      };

    } catch (error) {
      console.error('Error calculando fee de trade:', error);
      throw error;
    }
  }

  /**
   * Calcula fees para ambos lados de un trade (comprador y vendedor)
   */
  calculateBothSidesFees(tradeData, buyerIsMaker) {
    const { tradingPair, quantity, price } = tradeData;

    try {
      // Determinar fees
      const buyerFeePercent = buyerIsMaker ? 
        parseFloat(tradingPair.makerFeePercent) : 
        parseFloat(tradingPair.takerFeePercent);

      const sellerFeePercent = !buyerIsMaker ? 
        parseFloat(tradingPair.makerFeePercent) : 
        parseFloat(tradingPair.takerFeePercent);

      // Calcular fee del comprador (en base asset - lo que compra)
      const buyerFee = parseFloat(quantity) * (buyerFeePercent / 100);

      // Calcular fee del vendedor (en quote asset - lo que recibe)
      const totalValue = parseFloat(quantity) * parseFloat(price);
      const sellerFee = totalValue * (sellerFeePercent / 100);

      return {
        buyer: {
          fee: buyerFee,
          feePercent: buyerFeePercent,
          feeCurrency: tradingPair.symbol.split('/')[0],
          isMaker: buyerIsMaker
        },
        seller: {
          fee: sellerFee,
          feePercent: sellerFeePercent,
          feeCurrency: tradingPair.symbol.split('/')[1],
          isMaker: !buyerIsMaker
        }
      };

    } catch (error) {
      console.error('Error calculando fees de ambos lados:', error);
      throw error;
    }
  }

  /**
   * Calcula el total que necesita un usuario para crear una orden
   */
  async calculateRequiredAmount(orderData) {
    const { tradingPairId, side, quantity, price } = orderData;

    try {
      const tradingPair = await TradingPair.findByPk(tradingPairId);
      
      if (!tradingPair) {
        throw new Error('Trading pair no encontrado');
      }

      const effectivePrice = price || parseFloat(tradingPair.lastPrice);
      let requiredAmount = 0;
      let assetNeeded = '';

      if (side === 'buy') {
        // Comprando: necesitamos QUOTE ASSET
        assetNeeded = tradingPair.quoteAssetId;
        const totalValue = parseFloat(quantity) * effectivePrice;
        
        // Agregar fee (en este caso, el fee extra que pagará en base asset
        // pero necesitamos más quote para comprarlo)
        const feePercent = parseFloat(tradingPair.takerFeePercent);
        const feeInQuote = totalValue * (feePercent / 100);
        
        requiredAmount = totalValue + feeInQuote;

      } else {
        // Vendiendo: necesitamos BASE ASSET
        assetNeeded = tradingPair.baseAssetId;
        requiredAmount = parseFloat(quantity);
      }

      return {
        assetNeeded,
        requiredAmount,
        withoutFee: side === 'buy' ? parseFloat(quantity) * effectivePrice : parseFloat(quantity)
      };

    } catch (error) {
      console.error('Error calculando monto requerido:', error);
      throw error;
    }
  }

  /**
   * Calcula estadísticas de fees para un usuario
   */
  async calculateUserFeeStats(userId, tradingPairId = null, timeRange = '30d') {
    try {
      // TODO: Implementar cuando tengamos trades guardados
      // Por ahora retornamos estructura vacía
      return {
        totalFeesPaid: 0,
        totalMakerFees: 0,
        totalTakerFees: 0,
        avgFeePercent: 0,
        timeRange
      };
    } catch (error) {
      console.error('Error calculando estadísticas de fees:', error);
      throw error;
    }
  }

  /**
   * Obtiene la estructura de fees de un par de trading
   */
  async getTradingPairFees(tradingPairId) {
    try {
      const tradingPair = await TradingPair.findByPk(tradingPairId);
      
      if (!tradingPair) {
        throw new Error('Trading pair no encontrado');
      }

      return {
        symbol: tradingPair.symbol,
        makerFeePercent: parseFloat(tradingPair.makerFeePercent),
        takerFeePercent: parseFloat(tradingPair.takerFeePercent),
        makerFeeDescription: `${tradingPair.makerFeePercent}% - Pones liquidez (limit orders que se quedan en el book)`,
        takerFeeDescription: `${tradingPair.takerFeePercent}% - Tomas liquidez (ejecutas contra órdenes existentes)`
      };

    } catch (error) {
      console.error('Error obteniendo fees del par:', error);
      throw error;
    }
  }
}

module.exports = new FeeCalculatorService();