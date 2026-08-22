// services/trading/feeCalculator.service.js
const { TradingPair } = require('../../models');
const money = require('../../utils/money');

// fee = amount * (feePercent / 100), exacto y como string canónico. Los montos
// se normalizan con String() en el borde por si algún caller todavía pasa un
// Number — el contrato de "montos como string" en la API es trabajo de la Fase
// 7.3. De acá para adentro, toda la aritmética pasa por money.js (decimal.js),
// nunca por el float binario.
function feeOf(amount, feePercent) {
  return money.divide(money.multiply(String(amount), String(feePercent)), '100');
}

class FeeCalculatorService {

  /**
   * Calcula el fee para una orden
   */
  async calculateOrderFee(orderData) {
    const { tradingPairId, side, quantity, price } = orderData;

    try {
      const tradingPair = await TradingPair.findByPk(tradingPairId);

      if (!tradingPair) {
        throw new Error('Trading pair no encontrado');
      }

      // Para órdenes nuevas, asumimos taker fee (más conservador).
      // El fee real se determinará cuando se ejecute (maker vs taker).
      const feePercent = String(tradingPair.takerFeePercent);

      let feeAmount;
      let feeCurrency;

      if (side === 'buy') {
        // Comprando: fee se cobra en BASE ASSET, sobre la cantidad comprada.
        feeAmount = feeOf(quantity, feePercent);
        feeCurrency = tradingPair.symbol.split('/')[0];
      } else {
        // Vendiendo: fee se cobra en QUOTE ASSET, sobre el valor total.
        const effectivePrice = price || tradingPair.lastPrice;
        const totalValue = money.multiply(String(quantity), String(effectivePrice));
        feeAmount = feeOf(totalValue, feePercent);
        feeCurrency = tradingPair.symbol.split('/')[1];
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
      const feePercent = String(isMaker ? tradingPair.makerFeePercent : tradingPair.takerFeePercent);

      let feeAmount;
      let feeCurrency;

      if (side === 'buy') {
        // Fee en base asset (lo que compras)
        feeAmount = feeOf(quantity, feePercent);
        feeCurrency = tradingPair.symbol.split('/')[0];
      } else {
        // Fee en quote asset (lo que recibes)
        const totalValue = money.multiply(String(quantity), String(price));
        feeAmount = feeOf(totalValue, feePercent);
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
      const buyerFeePercent = String(buyerIsMaker ? tradingPair.makerFeePercent : tradingPair.takerFeePercent);
      const sellerFeePercent = String(!buyerIsMaker ? tradingPair.makerFeePercent : tradingPair.takerFeePercent);

      // Fee del comprador (en base asset - lo que compra)
      const buyerFee = feeOf(quantity, buyerFeePercent);

      // Fee del vendedor (en quote asset - lo que recibe)
      const totalValue = money.multiply(String(quantity), String(price));
      const sellerFee = feeOf(totalValue, sellerFeePercent);

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

      let requiredAmount;
      let assetNeeded;
      let withoutFee;

      if (side === 'buy') {
        // Comprando: necesitamos QUOTE ASSET (valor + fee)
        assetNeeded = tradingPair.quoteAssetId;
        const effectivePrice = price || tradingPair.lastPrice;
        const totalValue = money.multiply(String(quantity), String(effectivePrice));
        const feeInQuote = feeOf(totalValue, tradingPair.takerFeePercent);

        requiredAmount = money.add(totalValue, feeInQuote);
        withoutFee = totalValue;

      } else {
        // Vendiendo: necesitamos BASE ASSET
        assetNeeded = tradingPair.baseAssetId;
        requiredAmount = String(quantity);
        withoutFee = String(quantity);
      }

      return {
        assetNeeded,
        requiredAmount,
        withoutFee
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
        makerFeePercent: String(tradingPair.makerFeePercent),
        takerFeePercent: String(tradingPair.takerFeePercent),
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
