// src/components/features/MarketTable.jsx
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const MarketTable = ({ 
  data = [], 
  loading, 
  currentPage, 
  totalPages, 
  onPageChange, 
  onCryptoClick,
  isTransitioning = false 
}) => {
  const handlePageChange = (newPage) => {
    if (newPage !== currentPage && newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };

  return (
    <section className="markets-section" id="markets-section">
      <h2 className="section-title">Mercados Populares</h2>
      <div className={`markets-table-container ${isTransitioning ? 'transitioning' : ''}`}>
        {loading && data.length === 0 ? (
          <table className="markets-table">
            <thead>
              <tr>
                <th>Moneda</th>
                <th>Precio</th>
                <th>Cambio 24h</th>
                <th>Volumen 24h</th>
                <th>Cap. Mercado</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(10)].map((_, i) => (
                <tr key={i} className="skeleton-row">
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
            <div className={`table-content ${isTransitioning ? 'fading' : ''}`}>
              <table className="markets-table">
                <thead>
                  <tr>
                    <th>Moneda</th>
                    <th>Precio</th>
                    <th>Cambio 24h</th>
                    <th>Volumen 24h</th>
                    <th>Cap. Mercado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((coin) => (
                    <tr
                      key={coin.id}
                      className="market-row"
                      onClick={() => onCryptoClick(coin.symbol.toUpperCase())}
                    >
                      <td className="coin-cell">
                        <div className="coin-info">
                          <img 
                            src={coin.image || '/placeholder.svg'} 
                            alt={coin.name} 
                            className="home-crypto-icon" 
                          />
                          <div>
                            <div className="coin-symbol">{coin.symbol.toUpperCase()}</div>
                            <div className="coin-name">{coin.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="price-cell">
                        $
                        {coin.current_price.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td
                        className={`change-cell ${
                          coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'
                        }`}
                      >
                        {coin.price_change_percentage_24h >= 0 ? '+' : ''}
                        {coin.price_change_percentage_24h.toFixed(2)}%
                      </td>
                      <td className="volume-cell">${(coin.total_volume / 1000000).toFixed(2)}M</td>
                      <td className="marketcap-cell">${(coin.market_cap / 1000000000).toFixed(2)}B</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isTransitioning}
              >
                <ChevronLeftIcon className="pagination-icon" />
                Anterior
              </button>

              <div className="pagination-pages">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    className={`pagination-page ${currentPage === i + 1 ? 'active' : ''}`}
                    onClick={() => handlePageChange(i + 1)}
                    disabled={isTransitioning}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isTransitioning}
              >
                Siguiente
                <ChevronRightIcon className="pagination-icon" />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default MarketTable;