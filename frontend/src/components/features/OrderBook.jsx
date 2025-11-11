// src/components/features/OrderBook.jsx (web)
import { useMemo } from 'react';
import '../../styles/OrderBook.css';

const OrderBook = ({ orderBook, pair, loading }) => {
  const { bids = [], asks = [] } = orderBook;

  // Calcular totales acumulados y porcentajes
  const processedBids = useMemo(() => {
    let cumulative = 0;
    const maxTotal = bids.reduce((sum, bid) => sum + parseFloat(bid.totalValue || 0), 0);
    
    return bids.slice(0, 15).map(bid => {
      cumulative += parseFloat(bid.totalValue || bid.quantity * bid.price);
      return {
        ...bid,
        cumulative,
        percentage: maxTotal > 0 ? (cumulative / maxTotal) * 100 : 0,
      };
    });
  }, [bids]);

  const processedAsks = useMemo(() => {
    let cumulative = 0;
    const maxTotal = asks.reduce((sum, ask) => sum + parseFloat(ask.totalValue || 0), 0);
    
    return asks.slice(0, 15).map(ask => {
      cumulative += parseFloat(ask.totalValue || ask.quantity * ask.price);
      return {
        ...ask,
        cumulative,
        percentage: maxTotal > 0 ? (cumulative / maxTotal) * 100 : 0,
      };
    });
  }, [asks]);

  // Calcular spread
  const spread = useMemo(() => {
    if (bids.length === 0 || asks.length === 0) return null;
    const bestBid = parseFloat(bids[0]?.price || 0);
    const bestAsk = parseFloat(asks[0]?.price || 0);
    const diff = bestAsk - bestBid;
    const percentage = bestBid > 0 ? (diff / bestBid) * 100 : 0;
    return { diff, percentage };
  }, [bids, asks]);

  const formatPrice = (price) => {
    return parseFloat(price).toFixed(pair?.pricePrecision || 2);
  };

  const formatQuantity = (quantity) => {
    return parseFloat(quantity).toFixed(pair?.quantityPrecision || 4);
  };

  return (
    <div className="orderbook-container">
      {/* Header */}
      <div className="orderbook-header">
        <h3 className="orderbook-title">Libro de Órdenes</h3>
        {spread && (
          <div className="orderbook-spread">
            <span className="orderbook-spread-label">Spread:</span>
            <span className="orderbook-spread-value">
              {spread.percentage.toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="orderbook-headers">
        <span className="orderbook-header-cell">Precio</span>
        <span className="orderbook-header-cell">Cantidad</span>
        <span className="orderbook-header-cell">Total</span>
      </div>

      {/* Content */}
      <div className="orderbook-content">
        {loading ? (
          <div className="orderbook-loading">
            <div className="orderbook-spinner"></div>
            <p>Cargando libro...</p>
          </div>
        ) : (
          <>
            {/* Asks (Venta) */}
            <div className="orderbook-section orderbook-asks">
              {processedAsks.reverse().map((ask, index) => (
                <div key={`ask-${index}`} className="orderbook-row">
                  <div 
                    className="orderbook-row-bg orderbook-row-bg-ask"
                    style={{ width: `${ask.percentage}%` }}
                  ></div>
                  <span className="orderbook-cell orderbook-price-sell">
                    {formatPrice(ask.price)}
                  </span>
                  <span className="orderbook-cell">
                    {formatQuantity(ask.quantity)}
                  </span>
                  <span className="orderbook-cell orderbook-total">
                    {formatQuantity(ask.totalValue || ask.quantity * ask.price)}
                  </span>
                </div>
              ))}
            </div>

            {/* Current price */}
            {pair && (
              <div className="orderbook-current-price">
                <span className="orderbook-price-label">Precio actual</span>
                <span className={`orderbook-price-value ${parseFloat(pair.priceChange24h) >= 0 ? 'positive' : 'negative'}`}>
                  {formatPrice(pair.lastPrice)}
                </span>
              </div>
            )}

            {/* Bids (Compra) */}
            <div className="orderbook-section orderbook-bids">
              {processedBids.map((bid, index) => (
                <div key={`bid-${index}`} className="orderbook-row">
                  <div 
                    className="orderbook-row-bg orderbook-row-bg-bid"
                    style={{ width: `${bid.percentage}%` }}
                  ></div>
                  <span className="orderbook-cell orderbook-price-buy">
                    {formatPrice(bid.price)}
                  </span>
                  <span className="orderbook-cell">
                    {formatQuantity(bid.quantity)}
                  </span>
                  <span className="orderbook-cell orderbook-total">
                    {formatQuantity(bid.totalValue || bid.quantity * bid.price)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Empty state */}
      {!loading && bids.length === 0 && asks.length === 0 && (
        <div className="orderbook-empty">
          <p>No hay órdenes disponibles</p>
        </div>
      )}
    </div>
  );
};

export default OrderBook;