// src/components/features/OrderForm.jsx
import { useState, useMemo, useEffect } from 'react';
import '../../styles/OrderForm.css';

const OrderForm = ({ pair, balance, onSubmit, loading }) => {
  const [side, setSide] = useState('buy'); // 'buy' | 'sell'
  const [orderType, setOrderType] = useState('limit'); // 'limit' | 'market'
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [percentage, setPercentage] = useState(null);
  const [errors, setErrors] = useState({});

  // Obtener balance disponible según el lado de la orden
const availableBalance = useMemo(() => {
  console.log('💰 === CALCULANDO BALANCE DISPONIBLE ===');
  console.log('📦 Balance completo:', balance);
  console.log('🎯 Pair actual:', pair);
  console.log('🔄 Side:', side);
  
  if (!balance || !pair) {
    console.log('⚠️ No hay balance o pair');
    return 0;
  }

  if (side === 'buy') {
    console.log('🔍 Buscando QUOTE asset (para comprar)');
    console.log('🆔 Quote Asset ID buscado:', pair.quoteAssetId);
    
    const quoteBalance = balance.find(b => {
      console.log('  Comparando:', b.criptomonedaId, '===', pair.quoteAssetId, '?', b.criptomonedaId === pair.quoteAssetId);
      return b.criptomonedaId === pair.quoteAssetId;
    });
    
    console.log('✅ Quote balance encontrado:', quoteBalance);
    const available = parseFloat(quoteBalance?.available || 0);
    console.log('💵 Disponible (QUOTE):', available);
    return available;
  } else {
    console.log('🔍 Buscando BASE asset (para vender)');
    console.log('🆔 Base Asset ID buscado:', pair.baseAssetId);
    
    const baseBalance = balance.find(b => {
      console.log('  Comparando:', b.criptomonedaId, '===', pair.baseAssetId, '?', b.criptomonedaId === pair.baseAssetId);
      return b.criptomonedaId === pair.baseAssetId;
    });
    
    console.log('✅ Base balance encontrado:', baseBalance);
    const available = parseFloat(baseBalance?.available || 0);
    console.log('💵 Disponible (BASE):', available);
    return available;
  }
}, [balance, pair, side]);

  // Calcular total
  const total = useMemo(() => {
    const qty = parseFloat(quantity) || 0;
    const prc = orderType === 'market' ? parseFloat(pair?.lastPrice || 0) : parseFloat(price) || 0;
    return qty * prc;
  }, [quantity, price, orderType, pair]);

  // Setear precio cuando cambia el par o el tipo de orden
  useEffect(() => {
    if (orderType === 'market' && pair) {
      setPrice(pair.lastPrice);
    }
  }, [orderType, pair]);

  // Validar formulario
  const validate = () => {
    const newErrors = {};

    if (!quantity || parseFloat(quantity) <= 0) {
      newErrors.quantity = 'La cantidad debe ser mayor a 0';
    }

    if (pair) {
      const qty = parseFloat(quantity) || 0;
      if (qty < parseFloat(pair.minOrderAmount)) {
        newErrors.quantity = `Cantidad mínima: ${pair.minOrderAmount}`;
      }
      if (qty > parseFloat(pair.maxOrderAmount)) {
        newErrors.quantity = `Cantidad máxima: ${pair.maxOrderAmount}`;
      }
    }

    if (orderType === 'limit') {
      if (!price || parseFloat(price) <= 0) {
        newErrors.price = 'El precio debe ser mayor a 0';
      }
    }

    if (side === 'buy' && total > availableBalance) {
      newErrors.balance = 'Balance insuficiente';
    }

    if (side === 'sell' && parseFloat(quantity) > availableBalance) {
      newErrors.balance = 'Balance insuficiente';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar submit
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    const orderData = {
      side,
      orderType,
      quantity: parseFloat(quantity),
      price: orderType === 'limit' ? parseFloat(price) : null,
      timeInForce: 'GTC',
    };

    onSubmit(orderData);
  };

  // Setear cantidad por porcentaje
  const handlePercentageClick = (percent) => {
    setPercentage(percent);
    
    if (side === 'buy') {
      // Calcular cuánto podemos comprar con el porcentaje del balance
      const available = availableBalance * (percent / 100);
      const currentPrice = orderType === 'market' ? parseFloat(pair?.lastPrice || 0) : parseFloat(price) || 0;
      if (currentPrice > 0) {
        const qty = available / currentPrice;
        setQuantity(qty.toFixed(pair?.quantityPrecision || 4));
      }
    } else {
      // Calcular el porcentaje del balance base
      const qty = availableBalance * (percent / 100);
      setQuantity(qty.toFixed(pair?.quantityPrecision || 4));
    }
  };

  return (
    <div className="orderform-container">
      {/* Side selector */}
      <div className="orderform-side-selector">
        <button
          className={`orderform-side-btn orderform-side-buy ${side === 'buy' ? 'active' : ''}`}
          onClick={() => setSide('buy')}
        >
          Comprar
        </button>
        <button
          className={`orderform-side-btn orderform-side-sell ${side === 'sell' ? 'active' : ''}`}
          onClick={() => setSide('sell')}
        >
          Vender
        </button>
      </div>

      {/* Order type selector */}
      <div className="orderform-type-selector">
        <button
          className={`orderform-type-btn ${orderType === 'limit' ? 'active' : ''}`}
          onClick={() => setOrderType('limit')}
        >
          Limit
        </button>
        <button
          className={`orderform-type-btn ${orderType === 'market' ? 'active' : ''}`}
          onClick={() => setOrderType('market')}
        >
          Market
        </button>
      </div>

      {/* Available balance */}
      <div className="orderform-balance">
        <span className="orderform-balance-label">Disponible:</span>
        <span className="orderform-balance-value">
          {availableBalance.toFixed(pair?.quantityPrecision || 4)} {side === 'buy' ? pair?.quoteAsset?.simbolo : pair?.baseAsset?.simbolo}
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="orderform-form">
        {/* Price input (solo para limit orders) */}
        {orderType === 'limit' && (
          <div className="orderform-input-group">
            <label className="orderform-label">Precio</label>
            <div className="orderform-input-wrapper">
              <input
                type="number"
                className={`orderform-input ${errors.price ? 'error' : ''}`}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                step="any"
              />
              <span className="orderform-input-suffix">{pair?.quoteAsset?.simbolo}</span>
            </div>
            {errors.price && <span className="orderform-error">{errors.price}</span>}
          </div>
        )}

        {/* Quantity input */}
        <div className="orderform-input-group">
          <label className="orderform-label">Cantidad</label>
          <div className="orderform-input-wrapper">
            <input
              type="number"
              className={`orderform-input ${errors.quantity ? 'error' : ''}`}
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setPercentage(null);
              }}
              placeholder="0.00"
              step="any"
            />
            <span className="orderform-input-suffix">{pair?.baseAsset?.simbolo}</span>
          </div>
          {errors.quantity && <span className="orderform-error">{errors.quantity}</span>}
        </div>

        {/* Percentage buttons */}
        <div className="orderform-percentages">
          {[25, 50, 75, 100].map(percent => (
            <button
              key={percent}
              type="button"
              className={`orderform-percentage-btn ${percentage === percent ? 'active' : ''}`}
              onClick={() => handlePercentageClick(percent)}
            >
              {percent}%
            </button>
          ))}
        </div>

        {/* Total */}
        <div className="orderform-total">
          <span className="orderform-total-label">Total:</span>
          <span className="orderform-total-value">
            {total.toFixed(pair?.pricePrecision || 2)} {pair?.quoteAsset?.simbolo}
          </span>
        </div>

        {/* Balance error */}
        {errors.balance && (
          <div className="orderform-error-banner">
            {errors.balance}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          className={`orderform-submit orderform-submit-${side}`}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="orderform-spinner"></span>
              Procesando...
            </>
          ) : (
            <>
              {side === 'buy' ? 'Comprar' : 'Vender'} {pair?.baseAsset?.simbolo}
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default OrderForm;