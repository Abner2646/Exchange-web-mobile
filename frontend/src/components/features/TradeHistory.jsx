// src/components/features/TradeHistory.jsx
import { useMemo } from 'react';
import '../../styles/TradeHistory.css';

const TradeHistory = ({ trades, pair, loading }) => {
  // ✅ Asegurar que trades siempre sea un array
  const safeTrades = useMemo(() => {
    return Array.isArray(trades) ? trades : [];
  }, [trades]);

  // Formatear precio
  const formatPrice = (price, precision = 2) => {
    if (!price || isNaN(price)) return '0.00';
    return parseFloat(price).toFixed(precision);
  };

  // Formatear cantidad
  const formatQuantity = (quantity, precision = 4) => {
    if (!quantity || isNaN(quantity)) return '0.0000';
    return parseFloat(quantity).toFixed(precision);
  };

  // Formatear tiempo
  const formatTime = (dateString) => {
    if (!dateString) return '--:--:--';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '--:--:--';
      return date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '--:--:--';
    }
  };

  // ✅ Mostrar estado de carga si trades es undefined
  if (!Array.isArray(trades)) {
    return (
      <div className="tradehistory-container">
        <div className="tradehistory-loading">
          <p>Cargando trades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tradehistory-container">
      {/* Header */}
      <div className="tradehistory-header">
        <h3 className="tradehistory-title">Trades Recientes</h3>
      </div>

      {/* Column headers */}
      <div className="tradehistory-headers">
        <span className="tradehistory-header-cell">Precio</span>
        <span className="tradehistory-header-cell">Cantidad</span>
        <span className="tradehistory-header-cell">Hora</span>
      </div>

      {/* Trades list */}
      <div className="tradehistory-list">
        {loading ? (
          <div className="tradehistory-loading">
            <div className="tradehistory-spinner"></div>
            <p>Cargando trades...</p>
          </div>
        ) : safeTrades.length === 0 ? (
          <div className="tradehistory-empty">
            <p>No hay trades recientes</p>
          </div>
        ) : (
          safeTrades.map((trade, index) => {
            // ✅ Verificación segura para cada trade
            if (!trade || typeof trade !== 'object') return null;

            // Determinar si el trade fue de compra o venta
            const isBuyerMaker = trade.makerSide === 'buy';
            const isBuy = !isBuyerMaker; // Si el maker fue comprador, el taker fue vendedor

            return (
              <div key={trade.id || `trade-${index}`} className="tradehistory-item">
                <span className={`tradehistory-price ${isBuy ? 'buy' : 'sell'}`}>
                  {formatPrice(trade.price, pair?.pricePrecision)}
                </span>
                <span className="tradehistory-quantity">
                  {formatQuantity(trade.quantity, pair?.quantityPrecision)}
                </span>
                <span className="tradehistory-time">
                  {formatTime(trade.createdAt)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ✅ Props por defecto para mayor seguridad
TradeHistory.defaultProps = {
  trades: [],
  loading: false,
};

export default TradeHistory;