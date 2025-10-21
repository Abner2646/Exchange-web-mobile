// src/components/features/MarketTable.jsx (COMPLETO)
import { ChevronLeftIcon, ChevronRightIcon, StarIcon as StarOutline } from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import useWatchlist from "../../hooks/useWatchlist";

const MarketTable = ({
  data = [],
  loading,
  currentPage,
  totalPages,
  onPageChange,
  onCryptoClick,
  isTransitioning = false,
}) => {
  const { isInWatchlist, toggleWatchlist } = useWatchlist();

  const handlePageChange = (newPage) => {
    if (newPage !== currentPage && newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  const handleWatchlistClick = (e, coinId) => {
    e.stopPropagation();
    toggleWatchlist(coinId);
  };

  // ⭐ NUEVO: Calcular páginas a mostrar (máximo 7 páginas visibles)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7; // Máximo de páginas visibles
    
    if (totalPages <= maxVisible) {
      // Si hay 7 o menos páginas, mostrar todas
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Si hay más de 7 páginas, mostrar con ellipsis
      if (currentPage <= 4) {
        // Cerca del inicio: 1 2 3 4 5 ... 10
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Cerca del final: 1 ... 6 7 8 9 10
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // En el medio: 1 ... 4 5 6 ... 10
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`markets-table-container ${isTransitioning ? "transitioning" : ""}`}>
      {loading && data.length === 0 ? (
        <table className="markets-table">
          <thead>
            <tr>
              <th className="watchlist-column">★</th>
              <th>Moneda</th>
              <th className="text-center">Precio</th>
              <th className="text-center">Cambio 24h</th>
              <th>Volumen 24h</th>
              <th>Cap. Mercado</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(10)].map((_, i) => (
              <tr key={i} className="skeleton-row">
                <td>
                  <div className="skeleton skeleton-icon-small"></div>
                </td>
                <td className="coin-cell">
                  <div className="coin-info">
                    <div className="skeleton skeleton-icon"></div>
                    <div>
                      <div className="skeleton skeleton-text skeleton-text-short"></div>
                      <div className="skeleton skeleton-text skeleton-text-long"></div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="skeleton skeleton-text skeleton-text-medium"></div>
                </td>
                <td>
                  <div className="skeleton skeleton-text skeleton-text-short"></div>
                </td>
                <td>
                  <div className="skeleton skeleton-text skeleton-text-medium"></div>
                </td>
                <td>
                  <div className="skeleton skeleton-text skeleton-text-medium"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          {isTransitioning && <div className="table-overlay" />}
          <div className={`table-content ${isTransitioning ? "fading" : ""}`}>
            <table className="markets-table">
              <thead>
                <tr>
                  <th className="watchlist-column">★</th>
                  <th>Moneda</th>
                  <th className="text-center">Precio</th>
                  <th className="text-center">Cambio 24h</th>
                  <th>Volumen 24h</th>
                  <th>Cap. Mercado</th>
                </tr>
              </thead>
              <tbody>
                {data.map((coin) => (
                  <tr key={coin.id} className="market-row" onClick={() => onCryptoClick(coin.symbol.toUpperCase())}>
                    <td className="watchlist-cell">
                      <button
                        className="watchlist-btn"
                        onClick={(e) => handleWatchlistClick(e, coin.id)}
                        aria-label={isInWatchlist(coin.id) ? "Remove from watchlist" : "Add to watchlist"}
                      >
                        {isInWatchlist(coin.id) ? (
                          <StarSolid className="watchlist-icon watchlist-icon-active" />
                        ) : (
                          <StarOutline className="watchlist-icon" />
                        )}
                      </button>
                    </td>
                    <td className="coin-cell">
                      <div className="coin-info">
                        <img src={coin.image || "/placeholder.svg"} alt={coin.name} className="home-crypto-icon" />
                        <div>
                          <div className="coin-symbol">{coin.symbol.toUpperCase()}</div>
                          <div className="coin-name">{coin.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="price-cell">
                      $
                      {coin.current_price.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className={`change-cell ${coin.price_change_percentage_24h >= 0 ? "positive" : "negative"}`}>
                      {coin.price_change_percentage_24h >= 0 ? "+" : ""}
                      {coin.price_change_percentage_24h.toFixed(2)}%
                    </td>
                    <td className="volume-cell">${(coin.total_volume / 1000000).toFixed(2)}M</td>
                    <td className="marketcap-cell">${(coin.market_cap / 1000000000).toFixed(2)}B</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isTransitioning}
            >
              <ChevronLeftIcon className="pagination-icon" />
              <span>Anterior</span>
            </button>

            <div className="pagination-pages">
              {pageNumbers.map((page, index) => (
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="pagination-ellipsis">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    className={`pagination-page ${currentPage === page ? "active" : ""}`}
                    onClick={() => handlePageChange(page)}
                    disabled={isTransitioning}
                  >
                    {page}
                  </button>
                )
              ))}
            </div>

            <button
              className="pagination-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isTransitioning}
            >
              <span>Siguiente</span>
              <ChevronRightIcon className="pagination-icon" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketTable;