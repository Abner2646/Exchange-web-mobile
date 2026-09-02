// services/trading/balanceManager.service.js
const { BalanceUsuario, TradingPair } = require('../../models');
const { sequelize } = require('../../models');
const money = require('../../utils/money');
const crypto = require('crypto');
const { liquidarTrade, reservarParaOrden, liberarReserva } = require('../ledger/operations');

// Modelo de fee (alineado 2026-08-31, antes Radar #12a): el fee taker se cobra
// del ASSET RECIBIDO al liquidar (compra → fee en base; venta → fee en quote),
// estilo Binance, y así ya lo hace updateBalancesAfterTrade. Por lo tanto el
// bloqueo NO reserva fee en el asset entregado: una compra bloquea exactamente
// cantidad*precio en quote (una venta, cantidad en base). Antes la compra
// reservaba además el fee taker en quote pero la liquidación solo consumía
// cantidad*precio → el fee reservado quedaba trabado para siempre en bloqueado.
class BalanceManagerService {

  /**
   * Bloquea balance para una orden de trading.
   *
   * Repoint Spot (2026-09-02): usa reservarParaOrden (spot:disponible →
   * spot:bloqueado) en vez de BalanceUsuario.blockBalance (Funding). El check
   * rápido hasAvailableEnCompartimento también lee de Spot. El guard real contra
   * condiciones de carrera sigue siendo el FOR UPDATE de postTransaction.
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

        // Total necesario = cantidad * precio (sin fee: el fee taker se cobra del
        // base recibido al liquidar, no se reserva en quote — ver nota arriba).
        amountToLock = money.multiply(String(quantity), String(rawPrice));

      } else {
        // VENTA: necesitamos bloquear BASE ASSET (ej: BTC para vender)
        assetToLock = tradingPair.baseAssetId;
        amountToLock = String(quantity);
      }

      // Verificar saldo disponible en Spot (early-error amigable).
      const hasBalance = await BalanceUsuario.hasAvailableEnCompartimento(
        userId, assetToLock, amountToLock, 'spot', transaction
      );

      if (!hasBalance) {
        return {
          success: false,
          error: 'Balance insuficiente en Spot para crear la orden (transferí fondos a Spot)'
        };
      }

      // Reservar en Spot (atómico: FOR UPDATE dentro de postTransaction).
      await reservarParaOrden(
        { userId, criptomonedaId: assetToLock, cantidad: amountToLock, referencia: `reserva:${crypto.randomUUID()}` },
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

        // Lo bloqueado para la cantidad restante = restante * precio (sin fee,
        // simétrico con lockBalanceForOrder).
        const rawPrice = order.price || tradingPair.lastPrice;
        amountToUnlock = money.multiply(String(order.quantityRemaining), String(rawPrice));

      } else {
        // Era una venta - desbloqueamos BASE ASSET
        assetToUnlock = tradingPair.baseAssetId;
        amountToUnlock = String(order.quantityRemaining);
      }

      // Liberar la reserva en Spot.
      await liberarReserva(
        { userId: order.userId, criptomonedaId: assetToUnlock, cantidad: amountToUnlock, referencia: `liberacion:${crypto.randomUUID()}` },
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
      const montoQuote = money.multiply(String(trade.quantity), String(trade.price));

      // Paso D: liquidación rica en el ledger (un asiento). Comprador↔vendedor
      // (spot: bloqueado→disponible por cripto) + ambas comisiones a fee_revenue.
      await liquidarTrade({
        compradorId: trade.buyerId,
        vendedorId: trade.sellerId,
        baseAssetId: tradingPair.baseAssetId,
        quoteAssetId: tradingPair.quoteAssetId,
        cantidad: String(trade.quantity),
        montoQuote,
        feeComprador: String(trade.buyerFee),
        feeVendedor: String(trade.sellerFee),
        referencia: `trade:${trade.id}`,
      }, transaction);

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
        amountNeeded = money.multiply(String(quantity), String(rawPrice));
      } else {
        assetNeeded = tradingPair.baseAssetId;
        amountNeeded = String(quantity);
      }

      const balance = await BalanceUsuario.getSaldoCompartimento(userId, assetNeeded, 'spot');
      const available = String(balance.disponible);
      const sufficient = money.compare(available, amountNeeded) >= 0;

      return {
        sufficient,
        required: amountNeeded,
        available,
        error: sufficient ? null : `Balance insuficiente en Spot. Requerido: ${amountNeeded}, Disponible: ${available}`
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
      const balance = await BalanceUsuario.getSaldoCompartimento(userId, criptomonedaId, 'spot');
      const available = String(balance.disponible);
      const locked = String(balance.bloqueado);

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
      const balances = await BalanceUsuario.getByUserIdCompartimento(userId, 'spot');

      return balances.map(balance => {
        const available = String(balance.disponible);
        const locked = String(balance.bloqueado);
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
