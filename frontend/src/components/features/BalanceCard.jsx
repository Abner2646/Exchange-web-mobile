// src/components/features/BalanceCard.jsx (web)
import { useEffect, useRef, useState } from 'react';
import SkeletonLoader from '../common/SkeletonLoader';
import EmptyPortfolioMessage from './EmptyPortfolioMessage'; // ⭐ NUEVO

const BalanceCard = ({ totalUSDT, totalBTC, btcPriceError, onNavigate, isLoading }) => {
  const portfolioRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  const displayUSDT = (typeof totalUSDT === 'number' && !isNaN(totalUSDT)) ? totalUSDT : 0;
  const displayBTC = (typeof totalBTC === 'number' && !isNaN(totalBTC)) ? totalBTC : 0;

  useEffect(() => {
    if (!hasAnimated && displayUSDT > 0 && !isLoading) {
      animateValue(0, displayUSDT, 1500);
      setHasAnimated(true);
    }
  }, [displayUSDT, hasAnimated, isLoading]);

  const animateValue = (start, end, duration) => {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        current = end;
        clearInterval(timer);
      }
      if (portfolioRef.current) {
        portfolioRef.current.textContent = (typeof current === 'number' && !isNaN(current)) ? current.toFixed(2) : '0.00';
      }
    }, 16);
  };

  if (isLoading) {
    return (
      <div className="balance-card card">
        <SkeletonLoader type="balance-card" />
      </div>
    );
  }

  // ⭐ NUEVO: Mostrar mensaje de portfolio vacío
  const isEmptyPortfolio = false/*totalUSDT === 0*/; /* HARDCODEADO PARA QUE NUNCA APAREZCA EL EMPTY PORTFOLIO */

  return (
    <div className="balance-card card">
      {isEmptyPortfolio ? (
        <EmptyPortfolioMessage onNavigate={onNavigate} />
      ) : (
        <>
          <div className="balance-header">
            <div>
              <h3 className="balance-label">Portfolio Total</h3>
              <div className="balance-amount-container">
                <span className="balance-currency">$</span>
                <h1 className="balance-amount" ref={portfolioRef}>
                  {displayUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h1>
                <span className="balance-currency">USD</span>
              </div>
              {!btcPriceError ? (
                <p className="balance-btc">≈ {displayBTC.toFixed(8)} BTC</p>
              ) : (
                <p className="balance-btc balance-btc-error">
                  Precio BTC no disponible
                </p>
              )}
            </div>
          </div>
          <div className="balance-actions">
            <button className="home-action-btn" onClick={() => onNavigate('/depositos')}>
              Depositar
            </button>
            <button className="home-action-btn" onClick={() => onNavigate('/retiros')}>
              Retirar
            </button>
            <button className="home-action-btn" onClick={() => onNavigate('/activos')}>
              Entre Billeteras
            </button>
            <button className="home-action-btn" onClick={() => onNavigate('/transferir')}>
              Transferir P2P
            </button>
            <button className="home-action-btn primary" onClick={() => onNavigate('/swap')}>
              Swap
            </button>
            <button className="home-action-btn primary" onClick={() => onNavigate('/p2p')}>
              P2P
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default BalanceCard;