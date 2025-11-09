// src/components/features/BalanceCard.jsx (web)
import { useEffect, useRef, useState } from 'react';
import SkeletonLoader from '../common/SkeletonLoader';
import EmptyPortfolioMessage from './EmptyPortfolioMessage'; // ⭐ NUEVO

const BalanceCard = ({ totalUSDT, totalBTC, btcPriceError, onNavigate, isLoading }) => {
  const portfolioRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!hasAnimated && totalUSDT > 0 && !isLoading) {
      animateValue(0, totalUSDT, 1500);
      setHasAnimated(true);
    }
  }, [totalUSDT, hasAnimated, isLoading]);

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
        portfolioRef.current.textContent = current.toFixed(2);
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
                  {totalUSDT.toFixed(2)}
                </h1>
                <span className="balance-currency">USD</span>
              </div>
              {!btcPriceError ? (
                <p className="balance-btc">≈ {totalBTC.toFixed(8)} BTC</p>
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
            <button className="home-action-btn" onClick={() => onNavigate('/transferir')}>
              Transferir
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