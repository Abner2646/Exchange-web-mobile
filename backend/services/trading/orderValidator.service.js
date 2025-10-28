// services/trading/orderValidator.service.js
const { TradingPair, Usuario } = require('../../models');

class OrderValidatorService {

  /**
   * Valida una orden completa antes de crearla
   */
  async validateOrder(orderData) {
    const { 
      tradingPairId, 
      orderType, 
      side, 
      quantity, 
      price, 
      stopPrice,
      timeInForce,
      userId 
    } = orderData;

    try {
      // 1. Validar que el usuario exista
      const user = await Usuario.findByPk(userId);
      if (!user) {
        return {
          valid: false,
          error: 'Usuario no encontrado'
        };
      }

      // 2. Validar que el par de trading exista y esté activo
      const tradingPair = await TradingPair.findByPk(tradingPairId);
      if (!tradingPair) {
        return {
          valid: false,
          error: 'Par de trading no encontrado'
        };
      }

      if (tradingPair.status !== 'active') {
        return {
          valid: false,
          error: 'El par de trading no está activo para operar'
        };
      }

      // 3. Validar tipo de orden
      if (!['market', 'limit', 'stop_limit', 'stop_market'].includes(orderType)) {
        return {
          valid: false,
          error: 'Tipo de orden inválido'
        };
      }

      // 4. Validar lado (buy/sell)
      if (!['buy', 'sell'].includes(side)) {
        return {
          valid: false,
          error: 'Lado de orden inválido (debe ser buy o sell)'
        };
      }

      // 5. Validar cantidad
      const quantityValidation = this.validateQuantity(quantity, tradingPair);
      if (!quantityValidation.valid) {
        return quantityValidation;
      }

      // 6. Validar precio (si es limit order)
      if (['limit', 'stop_limit'].includes(orderType)) {
        if (!price || parseFloat(price) <= 0) {
          return {
            valid: false,
            error: 'Precio requerido para órdenes limit'
          };
        }

        const priceValidation = this.validatePrice(price, tradingPair);
        if (!priceValidation.valid) {
          return priceValidation;
        }
      }

      // 7. Validar stop price (si es stop order)
      if (['stop_limit', 'stop_market'].includes(orderType)) {
        if (!stopPrice || parseFloat(stopPrice) <= 0) {
          return {
            valid: false,
            error: 'Stop price requerido para órdenes stop'
          };
        }

        const stopPriceValidation = this.validatePrice(stopPrice, tradingPair);
        if (!stopPriceValidation.valid) {
          return stopPriceValidation;
        }
      }

      // 8. Validar time in force
      if (timeInForce && !['GTC', 'IOC', 'FOK'].includes(timeInForce)) {
        return {
          valid: false,
          error: 'Time in force inválido'
        };
      }

      // 9. Validar que FOK e IOC solo se usen con market orders
      if (['IOC', 'FOK'].includes(timeInForce) && orderType === 'limit') {
        return {
          valid: false,
          error: 'IOC y FOK solo están disponibles para market orders'
        };
      }

      // 10. Validaciones específicas según tipo de trading
      if (!tradingPair.allowedTradingTypes.includes('spot')) {
        return {
          valid: false,
          error: 'Trading spot no está habilitado para este par'
        };
      }

      return {
        valid: true,
        tradingPair
      };

    } catch (error) {
      console.error('Error validando orden:', error);
      return {
        valid: false,
        error: `Error en validación: ${error.message}`
      };
    }
  }

  /**
   * Valida la cantidad de una orden
   */
  validateQuantity(quantity, tradingPair) {
    try {
      const qty = parseFloat(quantity);

      // Validar que sea un número válido
      if (isNaN(qty) || qty <= 0) {
        return {
          valid: false,
          error: 'La cantidad debe ser un número positivo'
        };
      }

      // Validar cantidad mínima
      if (qty < parseFloat(tradingPair.minOrderAmount)) {
        return {
          valid: false,
          error: `Cantidad mínima: ${tradingPair.minOrderAmount} ${tradingPair.symbol.split('/')[0]}`
        };
      }

      // Validar cantidad máxima (si existe)
      if (tradingPair.maxOrderAmount && qty > parseFloat(tradingPair.maxOrderAmount)) {
        return {
          valid: false,
          error: `Cantidad máxima: ${tradingPair.maxOrderAmount} ${tradingPair.symbol.split('/')[0]}`
        };
      }

      // Validar precisión de decimales
      const qtyString = quantity.toString();
      const decimals = qtyString.includes('.') ? qtyString.split('.')[1].length : 0;
      
      if (decimals > tradingPair.quantityPrecision) {
        return {
          valid: false,
          error: `Máximo ${tradingPair.quantityPrecision} decimales permitidos en cantidad`
        };
      }

      return { valid: true };

    } catch (error) {
      return {
        valid: false,
        error: `Error validando cantidad: ${error.message}`
      };
    }
  }

  /**
   * Valida el precio de una orden
   */
  validatePrice(price, tradingPair) {
    try {
      const prc = parseFloat(price);

      // Validar que sea un número válido
      if (isNaN(prc) || prc <= 0) {
        return {
          valid: false,
          error: 'El precio debe ser un número positivo'
        };
      }

      // Validar precisión de decimales
      const priceString = price.toString();
      const decimals = priceString.includes('.') ? priceString.split('.')[1].length : 0;
      
      if (decimals > tradingPair.pricePrecision) {
        return {
          valid: false,
          error: `Máximo ${tradingPair.pricePrecision} decimales permitidos en precio`
        };
      }

      // Validar que el precio no sea demasiado diferente del último precio
      // (prevenir errores de usuario - precio fuera de rango razonable)
      if (tradingPair.lastPrice && parseFloat(tradingPair.lastPrice) > 0) {
        const lastPrice = parseFloat(tradingPair.lastPrice);
        const deviation = Math.abs(prc - lastPrice) / lastPrice;
        
        // Permitir máximo 50% de desviación del último precio
        if (deviation > 0.5) {
          return {
            valid: false,
            error: `El precio está muy alejado del precio de mercado (${lastPrice}). Verifica tu orden.`
          };
        }
      }

      return { valid: true };

    } catch (error) {
      return {
        valid: false,
        error: `Error validando precio: ${error.message}`
      };
    }
  }

  /**
   * Valida que una orden puede ser cancelada
   */
  validateCancellation(order, userId) {
    try {
      // Validar que la orden pertenezca al usuario
      if (order.userId !== userId) {
        return {
          valid: false,
          error: 'No puedes cancelar órdenes de otros usuarios'
        };
      }

      // Validar que la orden esté en un estado cancelable
      const cancelableStatuses = ['open', 'partially_filled', 'pending'];
      if (!cancelableStatuses.includes(order.status)) {
        return {
          valid: false,
          error: `La orden no puede ser cancelada (estado: ${order.status})`
        };
      }

      return { valid: true };

    } catch (error) {
      return {
        valid: false,
        error: `Error validando cancelación: ${error.message}`
      };
    }
  }

  /**
   * Valida parámetros de búsqueda de order book
   */
  validateOrderBookQuery(tradingPairId, depth) {
    try {
      if (!tradingPairId) {
        return {
          valid: false,
          error: 'Trading pair ID es requerido'
        };
      }

      const depthNum = parseInt(depth);
      if (isNaN(depthNum) || depthNum < 1 || depthNum > 100) {
        return {
          valid: false,
          error: 'Depth debe estar entre 1 y 100'
        };
      }

      return { valid: true };

    } catch (error) {
      return {
        valid: false,
        error: `Error validando consulta: ${error.message}`
      };
    }
  }
}

module.exports = new OrderValidatorService();