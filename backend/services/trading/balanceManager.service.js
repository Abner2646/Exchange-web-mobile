// services/trading/balanceManager.service.js
const { BalanceUsuario, TradingPair } = require('../../models');
const { sequelize } = require('../../models');
const money = require('../../utils/money');

// fee = amount * (feePercent / 100), exacto y como string canónico (mismo
// criterio que feeCalculator). Los inputs se normalizan con String() en el
// borde por si algún caller todavía pasa un Number; de acá para adentro toda la
// aritmética pasa por money.js (decimal.js), nunca por el float binario.
function feeOf(amount, feePercent) {
  return money.divide(money.multiply(String(amount), String(feePercent)), '100');
}

class BalanceManagerService {

  /**
   * Bloquea balance para una orden de trading.
   *
   * Fix 2026-08-19 (AUDITORIA_BACKEND.md Críticos #5): `transaction` recibía
   * el parámetro pero nunca lo reenviaba a hasAvailableBalance/blockBalance
   * — era decorativo, la operación no era atómica. La validación de acá
   * abajo (hasAvailableBalance) sigue siendo solo un chequeo rápido para dar
   * un error temprano y amigable; la protección real contra condiciones de
   * carrera vive ahora en BalanceUser.blockBalance (SELECT ... FOR UPDATE),
   * a la que si se le pasa `transaction` se le suma.
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
        const rawPrice = price || tradingPair.lastPrice;

        if (!rawPrice || money.compare(String(rawPrice), '0') <= 0) {
          return {
            success: false,
            error: 'No se puede determinar el precio para la orden'
          };
        }

        // Calcular total necesario (cantidad * precio) + fee estimado (taker,
        // porque es el más alto)
        const baseAmount = money.multiply(String(quantity), String(rawPrice));
        amountToLock = money.add(baseAmount, feeOf(baseAmount, tradingPair.takerFeePercent));

      } else {
        // VENTA: necesitamos bloquear BASE ASSET (ej: BTC para vender)
        assetToLock = tradingPair.baseAssetId;
        amountToLock = String(quantity);
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

      // Bloquear el balance (atómico: ver BalanceUser.blockBalance)
      await BalanceUsuario.blockBalance(
        userId,
        assetToLock,
        amountToLock,
        transaction
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

        // Calcular cuánto estaba bloqueado para la cantidad restante (+ fee)
        const rawPrice = order.price || tradingPair.lastPrice;
        const baseAmount = money.multiply(String(order.quantityRemaining), String(rawPrice));
        amountToUnlock = money.add(baseAmount, feeOf(baseAmount, order.feePercent));

      } else {
        // Era una venta - desbloqueamos BASE ASSET
        assetToUnlock = tradingPair.baseAssetId;
        amountToUnlock = String(order.quantityRemaining);
      }

      // Desbloquear el balance (atómico: ver BalanceUser.unblockBalance)
      await BalanceUsuario.unblockBalance(
        order.userId,
        assetToUnlock,
        amountToUnlock,
        transaction
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
      const buyerQuoteAmount = money.multiply(String(trade.quantity), String(trade.price));
      await BalanceUsuario.updateBalance(
        trade.buyerId,
        tradingPair.quoteAssetId,
        money.multiply(buyerQuoteAmount, '-1'),
        'bloqueado',
        transaction
      );

      // 2. Aumenta balance disponible de BASE ASSET (BTC) - descontando fee
      const buyerBaseAmount = money.subtract(String(trade.quantity), String(trade.buyerFee));
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
        money.multiply(String(trade.quantity), '-1'),
        'bloqueado',
        transaction
      );

      // 2. Aumenta balance disponible de QUOTE ASSET (USDT) - descontando fee
      const sellerQuoteAmount = money.subtract(buyerQuoteAmount, String(trade.sellerFee));
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
        const rawPrice = price || tradingPair.lastPrice;
        const baseAmount = money.multiply(String(quantity), String(rawPrice));
        amountNeeded = money.add(baseAmount, feeOf(baseAmount, tradingPair.takerFeePercent));
      } else {
        assetNeeded = tradingPair.baseAssetId;
        amountNeeded = String(quantity);
      }

      const balance = await BalanceUsuario.getByUserAndCrypto(userId, assetNeeded);

      if (!balance) {
        return {
          sufficient: false,
          error: 'No tienes balance en esta criptomoneda',
          required: amountNeeded,
          available: '0'
        };
      }

      const available = String(balance.balanceDisponible);
      const sufficient = money.compare(available, amountNeeded) >= 0;

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
          available: '0',
          locked: '0',
          total: '0'
        };
      }

      const available = String(balance.balanceDisponible);
      const locked = String(balance.balanceBloqueado);

      return {
        available,
        locked,
        total: money.add(available, locked)
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

      return balances.map(balance => {
        const available = String(balance.balanceDisponible);
        const locked = String(balance.balanceBloqueado);
        return {
          criptomonedaId: balance.criptomonedaId,
          available,
          locked,
          total: money.add(available, locked)
        };
      });
    } catch (error) {
      console.error('Error obteniendo todos los balances:', error);
      throw error;
    }
  }
}

module.exports = new BalanceManagerService();