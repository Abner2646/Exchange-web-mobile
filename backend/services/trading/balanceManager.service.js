// services/trading/balanceManager.service.js
const { BalanceUsuario, TradingPair } = require('../../models');
const { sequelize } = require('../../models');

class BalanceManagerService {

  /**
   * Bloquea balance para una orden de trading
   */
  async lockBalanceForOrder(data, transaction = null) {
    const { userId, tradingPair, side, quantity, price } = data;

    try {
      // Determinar qué asset necesitamos bloquear
      let assetToLock, amountToLock;

      if (side === 'buy') {
        // COMPRA: necesitamos bloquear QUOTE ASSET (ej: USDT para comprar BTC)
        assetToLock = tradingPair.quoteAssetId;
        
        // Si es market order, price será null - usar lastPrice
        const effectivePrice = price || parseFloat(tradingPair.lastPrice);
        
        if (!effectivePrice || effectivePrice <= 0) {
          return {
            success: false,
            error: 'No se puede determinar el precio para la orden'
          };
        }

        // Calcular total necesario (cantidad * precio)
        amountToLock = parseFloat(quantity) * effectivePrice;
        
        // Agregar el fee estimado (taker fee porque es más alto)
        const feeAmount = amountToLock * (parseFloat(tradingPair.takerFeePercent) / 100);
        amountToLock += feeAmount;

      } else {
        // VENTA: necesitamos bloquear BASE ASSET (ej: BTC para vender)
        assetToLock = tradingPair.baseAssetId;
        amountToLock = parseFloat(quantity);
      }

      // Verificar que el usuario tenga balance suficiente
      const hasBalance = await BalanceUsuario.hasAvailableBalance(
        userId,
        assetToLock,
        amountToLock
      );

      if (!hasBalance) {
        return {
          success: false,
          error: 'Balance insuficiente para crear la orden'
        };
      }

      // Bloquear el balance
      await BalanceUsuario.blockBalance(
        userId,
        assetToLock,
        amountToLock
      );

      return {
        success: true,
        assetLocked: assetToLock,
        amountLocked: amountToLock
      };

    } catch (error) {
      console.error('Error bloqueando balance:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Desbloquea balance cuando se cancela una orden
   */
  async unlockBalanceFromOrder(order, transaction = null) {
    try {
      const tradingPair = order.tradingPair || await TradingPair.findByPk(order.tradingPairId);

      if (!tradingPair) {
        throw new Error('Trading pair no encontrado');
      }

      let assetToUnlock, amountToUnlock;

      if (order.side === 'buy') {
        // Era una compra - desbloqueamos QUOTE ASSET
        assetToUnlock = tradingPair.quoteAssetId;
        
        // Calcular cuánto estaba bloqueado para la cantidad restante
        const effectivePrice = parseFloat(order.price) || parseFloat(tradingPair.lastPrice);
        amountToUnlock = parseFloat(order.quantityRemaining) * effectivePrice;
        
        // Agregar fee
        const feeAmount = amountToUnlock * (parseFloat(order.feePercent) / 100);
        amountToUnlock += feeAmount;

      } else {
        // Era una venta - desbloqueamos BASE ASSET
        assetToUnlock = tradingPair.baseAssetId;
        amountToUnlock = parseFloat(order.quantityRemaining);
      }

      // Desbloquear el balance
      await BalanceUsuario.unblockBalance(
        order.userId,
        assetToUnlock,
        amountToUnlock
      );

      return {
        success: true,
        assetUnlocked: assetToUnlock,
        amountUnlocked: amountToUnlock
      };

    } catch (error) {
      console.error('Error desbloqueando balance:', error);
      throw error;
    }
  }

  /**
   * Actualiza balances después de ejecutar un trade
   */
  async updateBalancesAfterTrade(trade, buyOrder, sellOrder, transaction) {
    try {
      const tradingPair = buyOrder.tradingPair || await TradingPair.findByPk(trade.tradingPairId, { transaction });

      // COMPRADOR
      // 1. Reduce balance bloqueado de QUOTE ASSET (USDT)
      const buyerQuoteAmount = parseFloat(trade.quantity) * parseFloat(trade.price);
      await BalanceUsuario.updateBalance(
        trade.buyerId,
        tradingPair.quoteAssetId,
        -buyerQuoteAmount,
        'bloqueado',
        transaction
      );

      // 2. Aumenta balance disponible de BASE ASSET (BTC) - descontando fee
      const buyerBaseAmount = parseFloat(trade.quantity) - parseFloat(trade.buyerFee);
      await BalanceUsuario.updateBalance(
        trade.buyerId,
        tradingPair.baseAssetId,
        buyerBaseAmount,
        'disponible',
        transaction
      );

      // VENDEDOR
      // 1. Reduce balance bloqueado de BASE ASSET (BTC)
      await BalanceUsuario.updateBalance(
        trade.sellerId,
        tradingPair.baseAssetId,
        -parseFloat(trade.quantity),
        'bloqueado',
        transaction
      );

      // 2. Aumenta balance disponible de QUOTE ASSET (USDT) - descontando fee
      const sellerQuoteAmount = buyerQuoteAmount - parseFloat(trade.sellerFee);
      await BalanceUsuario.updateBalance(
        trade.sellerId,
        tradingPair.quoteAssetId,
        sellerQuoteAmount,
        'disponible',
        transaction
      );

      return {
        success: true
      };

    } catch (error) {
      console.error('Error actualizando balances después del trade:', error);
      throw error;
    }
  }

  /**
   * Verifica si el usuario tiene fondos suficientes para una orden
   */
  async checkSufficientBalance(userId, tradingPairId, side, quantity, price = null) {
    try {
      const tradingPair = await TradingPair.findByPk(tradingPairId);
      
      if (!tradingPair) {
        return {
          sufficient: false,
          error: 'Trading pair no encontrado'
        };
      }

      let assetNeeded, amountNeeded;

      if (side === 'buy') {
        assetNeeded = tradingPair.quoteAssetId;
        const effectivePrice = price || parseFloat(tradingPair.lastPrice);
        amountNeeded = parseFloat(quantity) * effectivePrice;
        
        // Agregar fee
        const feeAmount = amountNeeded * (parseFloat(tradingPair.takerFeePercent) / 100);
        amountNeeded += feeAmount;
      } else {
        assetNeeded = tradingPair.baseAssetId;
        amountNeeded = parseFloat(quantity);
      }

      const balance = await BalanceUsuario.getByUserAndCrypto(userId, assetNeeded);

      if (!balance) {
        return {
          sufficient: false,
          error: 'No tienes balance en esta criptomoneda',
          required: amountNeeded,
          available: 0
        };
      }

      const available = parseFloat(balance.balanceDisponible);
      const sufficient = available >= amountNeeded;

      return {
        sufficient,
        required: amountNeeded,
        available,
        error: sufficient ? null : `Balance insuficiente. Requerido: ${amountNeeded}, Disponible: ${available}`
      };

    } catch (error) {
      console.error('Error verificando balance:', error);
      return {
        sufficient: false,
        error: error.message
      };
    }
  }

  /**
   * Obtiene el balance disponible para trading de un usuario
   */
  async getTradingBalance(userId, criptomonedaId) {
    try {
      const balance = await BalanceUsuario.getByUserAndCrypto(userId, criptomonedaId);

      if (!balance) {
        return {
          available: 0,
          locked: 0,
          total: 0
        };
      }

      return {
        available: parseFloat(balance.balanceDisponible),
        locked: parseFloat(balance.balanceBloqueado),
        total: parseFloat(balance.balanceDisponible) + parseFloat(balance.balanceBloqueado)
      };
    } catch (error) {
      console.error('Error obteniendo balance de trading:', error);
      throw error;
    }
  }

  /**
   * Obtiene todos los balances de trading de un usuario
   */
  async getAllTradingBalances(userId) {
    try {
      const balances = await BalanceUsuario.getByUserId(userId);

      return balances.map(balance => ({
        criptomonedaId: balance.criptomonedaId,
        available: parseFloat(balance.balanceDisponible),
        locked: parseFloat(balance.balanceBloqueado),
        total: parseFloat(balance.balanceDisponible) + parseFloat(balance.balanceBloqueado)
      }));
    } catch (error) {
      console.error('Error obteniendo todos los balances:', error);
      throw error;
    }
  }
}

module.exports = new BalanceManagerService();