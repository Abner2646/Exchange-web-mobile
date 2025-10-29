// src/components/features/TradingPairSelector.jsx
import { useState, useMemo } from 'react';
import '../../styles/TradingPairSelector.css';

const TradingPairSelector = ({ pairs, activePair, onSelectPair, tickers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [quoteFilter, setQuoteFilter] = useState('ALL'); // 'ALL', 'USDT', 'BTC', 'ETH'
  const [sortBy, setSortBy] = useState('volume'); // 'volume', 'change', 'name'


const CoinIcon = ({ coin, className }) => {
  // Lista blanca de dominios confiables
  const trustedDomains = [
    'cdn.jsdelivr.net',
    'cryptologos.cc', 
    's2.coinmarketcap.com',
    'assets.coingecko.com',
    'cryptoicons.org'
  ];

  // Verificar si la URL es de un dominio confiable
  const isTrustedUrl = coin?.iconUrl && trustedDomains.some(domain => 
    coin.iconUrl.includes(domain)
  );

  // Si no hay URL confiable, mostrar fallback SIN intentar cargar
  if (!isTrustedUrl) {
    return (
      <div className={`tradingpairs-item-icon-fallback ${className}`}>
        {coin?.symbol?.substring(0, 3) || '?'}
      </div>
    );
  }

  // Si hay URL confiable, intentar cargar con fallback inline
  return (
    <img 
      src={coin.iconUrl} 
      alt={coin.symbol}
      className={className}
      onError={(e) => {
        // Ocultar imagen y mostrar texto
        e.target.style.display = 'none';
        const fallback = document.createElement('div');
        fallback.className = `tradingpairs-item-icon-fallback ${className}`;
        fallback.textContent = coin?.symbol?.substring(0, 3) || '?';
        e.target.parentNode.appendChild(fallback);
      }}
    />
  );
};

  // ✅ Filtrar pares que NO tienen precio (sin datos)
  const validPairs = useMemo(() => {
    return Array.isArray(pairs) ? pairs.filter(pair => {
      return pair && 
             pair.lastPrice && 
             parseFloat(pair.lastPrice) > 0 &&
             pair.baseAsset &&
             pair.quoteAsset;
    }) : [];
  }, [pairs]);

  // Obtener quote assets únicos para los tabs
  const quoteAssets = useMemo(() => {
    const quotes = new Set();
    validPairs.forEach(pair => {
      if (pair.quoteAsset?.symbol) {
        quotes.add(pair.quoteAsset.symbol);
      }
    });
    return ['ALL', ...Array.from(quotes)];
  }, [validPairs]);

  // Filtrar y ordenar pares
  const filteredPairs = useMemo(() => {
    let filtered = validPairs.filter(pair => {
      // Filtro de búsqueda
      const searchMatch = 
        pair.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pair.baseAsset?.symbol?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro por quote asset
      const quoteMatch = quoteFilter === 'ALL' || 
                        pair.quoteAsset?.symbol === quoteFilter;
      
      return searchMatch && quoteMatch;
    });

    // Ordenar
    switch (sortBy) {
      case 'volume':
        filtered = filtered.sort((a, b) => 
          parseFloat(b.volume24h || 0) - parseFloat(a.volume24h || 0)
        );
        break;
      case 'change':
        filtered = filtered.sort((a, b) => 
          Math.abs(parseFloat(b.priceChange24h || 0)) - 
          Math.abs(parseFloat(a.priceChange24h || 0))
        );
        break;
      case 'name':
        filtered = filtered.sort((a, b) => 
          (a.symbol || '').localeCompare(b.symbol || '')
        );
        break;
    }

    return filtered;
  }, [validPairs, searchTerm, quoteFilter, sortBy]);

const formatPrice = (price, precision = 2) => {
  if (!price) return '0.00';
  
  const numPrice = parseFloat(price);
  
  // Para precios muy pequeños (< 0.01)
  if (numPrice < 0.01 && numPrice > 0) {
    // Formato científico simplificado o decimales necesarios
    const formatted = numPrice.toFixed(8);
    // Remover ceros innecesarios del final
    return formatted.replace(/\.?0+$/, '');
  }
  
  // Para precios normales, limitar a 8 caracteres totales
  let formatted = numPrice.toLocaleString('es-AR', {
    minimumFractionDigits: Math.min(precision, 2),
    maximumFractionDigits: precision
  });
  
  // Si es muy largo, truncar
  if (formatted.length > 8) {
    // Intentar con menos decimales
    if (numPrice >= 1000) {
      // Miles: formato compacto (ej: 1,234.5)
      formatted = numPrice.toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 1
      });
    } else if (numPrice >= 100) {
      // Centenas: 2 decimales max
      formatted = numPrice.toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    } else if (numPrice >= 1) {
      // Unidades: 3 decimales max
      formatted = numPrice.toFixed(3);
    }
    
    // Si aún es muy largo, truncar forzosamente
    if (formatted.length > 8) {
      formatted = formatted.substring(0, 8);
    }
  }
  
  return formatted;
};

  const formatVolume = (volume) => {
    if (!volume) return '0';
    const vol = parseFloat(volume);
    if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(2)}B`;
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(2)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(2)}K`;
    return vol.toFixed(2);
  };

  return (
    <div className="tradingpairs-container">
      {/* Header */}
      <div className="tradingpairs-header">
        <h3 className="tradingpairs-title">Mercados</h3>
        <span className="tradingpairs-count">({filteredPairs.length})</span>
      </div>

      {/* Search */}
      <div className="tradingpairs-search">
        <svg className="tradingpairs-search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 14L10.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <input
          type="text"
          className="tradingpairs-search-input"
          placeholder="Buscar par..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button 
            className="tradingpairs-search-clear"
            onClick={() => setSearchTerm('')}
          >
            ×
          </button>
        )}
      </div>

      {/* Quote Asset Tabs */}
      <div className="tradingpairs-tabs">
        {quoteAssets.map(quote => (
          <button
            key={quote}
            className={`tradingpairs-tab ${quoteFilter === quote ? 'active' : ''}`}
            onClick={() => setQuoteFilter(quote)}
          >
            {quote}
          </button>
        ))}
      </div>

      {/* Sort Options */}
      <div className="tradingpairs-sort">
        <button
          className={`tradingpairs-sort-btn ${sortBy === 'volume' ? 'active' : ''}`}
          onClick={() => setSortBy('volume')}
        >
          Volumen
        </button>
        <button
          className={`tradingpairs-sort-btn ${sortBy === 'change' ? 'active' : ''}`}
          onClick={() => setSortBy('change')}
        >
          Cambio
        </button>
        <button
          className={`tradingpairs-sort-btn ${sortBy === 'name' ? 'active' : ''}`}
          onClick={() => setSortBy('name')}
        >
          Nombre
        </button>
      </div>

      {/* Column headers */}
      <div className="tradingpairs-headers">
        <span className="tradingpairs-header-cell tradingpairs-header-pair">Par</span>
        <span className="tradingpairs-header-cell tradingpairs-header-price">Precio</span>
        <span className="tradingpairs-header-cell tradingpairs-header-change">24h %</span>
      </div>

      {/* Pairs list */}
      <div className="tradingpairs-list">
        {filteredPairs.length === 0 ? (
          <div className="tradingpairs-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <p>No se encontraron pares</p>
            {searchTerm && (
              <p className="tradingpairs-empty-hint">
                Intenta con otros términos
              </p>
            )}
          </div>
        ) : (
          filteredPairs.map(pair => {
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
                  {/* ✅ ICONOS DE LAS MONEDAS */}
                  <div className="tradingpairs-item-icons">
  <CoinIcon 
    coin={pair.baseAsset}
    className="tradingpairs-item-icon tradingpairs-item-icon-base"
  />
  <CoinIcon 
    coin={pair.quoteAsset}
    className="tradingpairs-item-icon tradingpairs-item-icon-quote"
  />
</div>
                  <div className="tradingpairs-item-info">
                    <span className="tradingpairs-item-symbol">
                      {pair.baseAsset?.symbol || 'N/A'}
                      <span className="tradingpairs-item-quote-text">
                        /{pair.quoteAsset?.symbol || 'N/A'}
                      </span>
                    </span>
                    <span className="tradingpairs-item-volume">
                      Vol {formatVolume(pair.volume24h)}
                    </span>
                  </div>
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

export default TradingPairSelector;