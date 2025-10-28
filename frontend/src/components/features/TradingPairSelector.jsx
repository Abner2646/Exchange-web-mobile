// src/components/features/TradingPairSelector.jsx
import { useState, useMemo } from 'react';
import '../../styles/TradingPairSelector.css';

const TradingPairSelector = ({ pairs, activePair, onSelectPair, tickers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'gainers' | 'losers' | 'volume'

  // ✅ Asegurar que pairs siempre sea un array
  const safePairs = useMemo(() => {
    return Array.isArray(pairs) ? pairs : [];
  }, [pairs]);

  // Filtrar y ordenar pares
  const filteredPairs = useMemo(() => {
    let filtered = safePairs.filter(pair => {
      // ✅ Verificaciones seguras para evitar errores
      if (!pair || typeof pair !== 'object') return false;
      
      const symbol = pair.symbol || '';
      const baseSymbol = pair.baseAsset?.simbolo || '';
      
      return symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
             baseSymbol.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Aplicar filtros adicionales con verificaciones seguras
    switch (filter) {
      case 'gainers':
        filtered = filtered
          .filter(p => p && parseFloat(p.priceChange24h || 0) > 0)
          .sort((a, b) => parseFloat(b.priceChange24h || 0) - parseFloat(a.priceChange24h || 0));
        break;
      case 'losers':
        filtered = filtered
          .filter(p => p && parseFloat(p.priceChange24h || 0) < 0)
          .sort((a, b) => parseFloat(a.priceChange24h || 0) - parseFloat(b.priceChange24h || 0));
        break;
      case 'volume':
        filtered = filtered
          .filter(p => p)
          .sort((a, b) => parseFloat(b.volume24h || 0) - parseFloat(a.volume24h || 0));
        break;
      default:
        // Ordenar por símbolo alfabéticamente
        filtered = filtered
          .filter(p => p)
          .sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));
    }

    return filtered;
  }, [safePairs, searchTerm, filter]);

  const formatPrice = (price, precision = 2) => {
    if (!price) return '0.00';
    return parseFloat(price).toFixed(precision);
  };

  const formatVolume = (volume) => {
    if (!volume) return '0.00';
    const vol = parseFloat(volume);
    if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(2)}B`;
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(2)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(2)}K`;
    return vol.toFixed(2);
  };

  // ✅ Mostrar estado de carga si pairs es undefined (aún no se ha cargado)
  if (!Array.isArray(pairs)) {
    return (
      <div className="tradingpairs-container">
        <div className="tradingpairs-loading">
          <p>Cargando pares de trading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tradingpairs-container">
      {/* Header */}
      <div className="tradingpairs-header">
        <h3 className="tradingpairs-title">Pares de Trading</h3>
        <span className="tradingpairs-count">({safePairs.length} pares)</span>
      </div>

      {/* Search */}
      <div className="tradingpairs-search">
        <input
          type="text"
          className="tradingpairs-search-input"
          placeholder="Buscar par..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="tradingpairs-filters">
        <button
          className={`tradingpairs-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todos
        </button>
        <button
          className={`tradingpairs-filter-btn ${filter === 'gainers' ? 'active' : ''}`}
          onClick={() => setFilter('gainers')}
        >
          Ganadores
        </button>
        <button
          className={`tradingpairs-filter-btn ${filter === 'losers' ? 'active' : ''}`}
          onClick={() => setFilter('losers')}
        >
          Perdedores
        </button>
        <button
          className={`tradingpairs-filter-btn ${filter === 'volume' ? 'active' : ''}`}
          onClick={() => setFilter('volume')}
        >
          Volumen
        </button>
      </div>

      {/* Column headers */}
      <div className="tradingpairs-headers">
        <span className="tradingpairs-header-cell tradingpairs-header-pair">Par</span>
        <span className="tradingpairs-header-cell tradingpairs-header-price">Precio</span>
        <span className="tradingpairs-header-cell tradingpairs-header-change">24h</span>
      </div>

      {/* Pairs list */}
      <div className="tradingpairs-list">
        {filteredPairs.length === 0 ? (
          <div className="tradingpairs-empty">
            <p>No se encontraron pares</p>
            {searchTerm && (
              <p className="tradingpairs-empty-hint">
                Intenta con otros términos de búsqueda
              </p>
            )}
          </div>
        ) : (
          filteredPairs.map(pair => {
            // ✅ Verificaciones seguras para cada pair
            if (!pair) return null;
            
            const isActive = activePair?.id === pair.id;
            const change24h = parseFloat(pair.priceChange24h || 0);
            const isPositive = change24h >= 0;

            return (
              <div
                key={pair.id}
                className={`tradingpairs-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectPair(pair)}
              >
                <div className="tradingpairs-item-pair">
                    <span className="tradingpairs-item-symbol">
                        {/* ✅ Intentar múltiples propiedades posibles */}
                        {pair.baseAsset?.simbolo || 
                        pair.baseAsset?.symbol || 
                        pair.baseSymbol || 
                        pair.symbol?.split('/')[0] || 
                        'N/A'}
                    </span>
                    <span className="tradingpairs-item-quote">
                        /{pair.quoteAsset?.simbolo || 
                        pair.quoteAsset?.symbol || 
                        pair.quoteSymbol || 
                        pair.symbol?.split('/')[1] || 
                        'N/A'}
                    </span>
                </div>
                
                <div className="tradingpairs-item-price">
                  {formatPrice(pair.lastPrice, pair.pricePrecision)}
                </div>
                
                <div className={`tradingpairs-item-change ${isPositive ? 'positive' : 'negative'}`}>
                  {isPositive ? '+' : ''}{change24h.toFixed(2)}%
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ✅ Props por defecto para mayor seguridad
TradingPairSelector.defaultProps = {
  pairs: [],
  tickers: {},
  onSelectPair: () => {}
};

export default TradingPairSelector;