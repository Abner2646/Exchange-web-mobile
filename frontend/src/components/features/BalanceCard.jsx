// src/components/features/BalanceCard.jsx
import { useEffect, useRef, useState } from 'react';

const BalanceCard = ({ totalUSDT, totalBTC, onNavigate }) => {
  const portfolioRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!hasAnimated && totalUSDT > 0) {
      animateValue(0, totalUSDT, 1500);
      setHasAnimated(true);
    }
  }, [totalUSDT, hasAnimated]);

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

  return (
    <div className="balance-card card">
      <div className="balance-header">
        <div>
          <h3 className="balance-label">Portfolio</h3>
          <div className="balance-amount-container">
            <span className="balance-currency">$</span>
            <h1 className="balance-amount" ref={portfolioRef}>
              {totalUSDT.toFixed(2)}
            </h1>
            <span className="balance-currency">USD</span>
          </div>
          <p className="balance-btc">≈ {totalBTC.toFixed(8)} BTC</p>
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
    </div>
  );
};

export default BalanceCard;