// src/components/features/TopGainersSection.jsx
import { useState, useEffect } from 'react';
import { ArrowTrendingUpIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../../context/AuthContext';
import useTopGainers from '../../hooks/useTopGainers';
import '../../styles/TopGainersSection.css';

const TopGainersSection = ({ onCryptoClick }) => {
  const { isAuthenticated } = useAuth();
  const { gainers, isLoading, hasGainers } = useTopGainers();
  const [currentIndex, setCurrentIndex] = useState(0);

  const coinsPerView = isAuthenticated ? 4 : 2;

  useEffect(() => {
    if (!hasGainers || gainers.length <= coinsPerView) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (isAuthenticated) {
          return (prev + 4) % gainers.length;
        }
        return (prev + 2) % gainers.length;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [gainers, hasGainers, isAuthenticated, coinsPerView]);

  if (isAuthenticated && gainers.length < 4) {
    return null;
  }

  if (isLoading || !hasGainers) {
    return null;
  }

  const visibleCoins = gainers.slice(currentIndex, currentIndex + coinsPerView);

  if (visibleCoins.length < coinsPerView) {
    const remaining = coinsPerView - visibleCoins.length;
    visibleCoins.push(...gainers.slice(0, remaining));
  }

  return (
    <section className={`gainers-section ${isAuthenticated ? 'gainers-section-auth' : ''}`}>
      <div className="gainers-container">
        <div className="gainers-header">
          <ArrowTrendingUpIcon className="gainers-icon" />
          <h3 className="gainers-title">Top Gainers 24h</h3>
        </div>

        <div className={`gainers-grid ${isAuthenticated ? 'gainers-grid-auth' : ''}`}>
          {visibleCoins.map((coin) => (
            <div
              key={coin.id}
              className="gainers-card"
              onClick={() => onCryptoClick?.(coin.symbol.toUpperCase())}
            >
              <img 
                src={coin.image} 
                alt={coin.name} 
                className="gainers-coin-icon" 
              />
              <div className="gainers-info">
                <span className="gainers-coin-symbol">
                  {coin.symbol.toUpperCase()}
                </span>
                <span className="gainers-coin-name">{coin.name}</span>
              </div>
              <div className="gainers-stats">
                <span className="gainers-price">
                  ${coin.current_price.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="gainers-change">
                  +{coin.price_change_percentage_24h.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {gainers.length > coinsPerView && (
          <div className="gainers-indicators">
            {Array.from({ length: Math.ceil(gainers.length / coinsPerView) }).map((_, index) => (
              <button
                key={index}
                className={`gainers-indicator ${Math.floor(currentIndex / coinsPerView) === index ? 'gainers-indicator-active' : ''}`}
                onClick={() => setCurrentIndex(index * coinsPerView)}
                aria-label={`Ver grupo ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TopGainersSection;