// src/components/features/TopMoversSection.jsx (web)
import { useState } from 'react';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import SkeletonLoader from '../common/SkeletonLoader';
import ErrorState from '../common/ErrorState';
import '../../styles/TopMoversSection.css';

const TopMoversSection = ({ 
  gainers24h = [],
  losers24h = [],
  gainers7d = [],
  losers7d = [],
  onCryptoClick, 
  isLoading,
  error,
  onRetry 
}) => {
  // ⭐ NUEVO: State para manejar el tab activo
  const [activeTab, setActiveTab] = useState('24h'); // '24h' o '7d'

  // Seleccionar datos según tab activo
  const gainers = activeTab === '24h' ? gainers24h : gainers7d;
  const losers = activeTab === '24h' ? losers24h : losers7d;

  // ⭐ NUEVO: Validar si hay datos suficientes (mínimo 3 de cada lado)
  const hasEnoughData = gainers.length >= 3 && losers.length >= 3;

  if (error) {
    return (
      <section className="topmovers-section">
        <ErrorState 
          title="Error al cargar movimientos"
          message="No pudimos obtener los mayores movimientos del día."
          onRetry={onRetry}
        />
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="topmovers-section">
        <h2 className="section-title">Mayores Movimientos</h2>
        
        {/* ⭐ NUEVO: Tabs Skeleton */}
        <div className="topmovers-tabs">
          <SkeletonLoader type="text" width="80px" height="36px" />
          <SkeletonLoader type="text" width="80px" height="36px" />
        </div>

        <div className="topmovers-grid">
          <div className="topmovers-column">
            <div className="topmovers-header topmovers-header-gain">
              <ArrowUpIcon className="topmovers-header-icon" />
              <h3>Top Ganadores</h3>
            </div>
            <div className="topmovers-list">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="topmovers-item">
                  <SkeletonLoader type="circle" width="32px" height="32px" />
                  <div className="topmovers-info">
                    <SkeletonLoader type="text" width="50px" />
                    <SkeletonLoader type="text" width="70px" />
                  </div>
                  <SkeletonLoader type="text" width="60px" />
                </div>
              ))}
            </div>
          </div>
          <div className="topmovers-column">
            <div className="topmovers-header topmovers-header-loss">
              <ArrowDownIcon className="topmovers-header-icon" />
              <h3>Top Perdedores</h3>
            </div>
            <div className="topmovers-list">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="topmovers-item">
                  <SkeletonLoader type="circle" width="32px" height="32px" />
                  <div className="topmovers-info">
                    <SkeletonLoader type="text" width="50px" />
                    <SkeletonLoader type="text" width="70px" />
                  </div>
                  <SkeletonLoader type="text" width="60px" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ⭐ NUEVO: No mostrar sección si no hay datos suficientes
  if (!hasEnoughData) {
    console.log('TopMoversSection: No hay datos suficientes para mostrar');
    return null;
  }

  return (
    <section className="topmovers-section">
      <h2 className="section-title">Mayores Movimientos</h2>
      
      {/* ⭐ NUEVO: Tabs */}
      <div className="topmovers-tabs">
        <button
          className={`topmovers-tab ${activeTab === '24h' ? 'topmovers-tab-active' : ''}`}
          onClick={() => setActiveTab('24h')}
        >
          24 Horas
        </button>
        <button
          className={`topmovers-tab ${activeTab === '7d' ? 'topmovers-tab-active' : ''}`}
          onClick={() => setActiveTab('7d')}
        >
          7 Días
        </button>
      </div>
      
      <div className="topmovers-grid">
        {/* GAINERS */}
        <div className="topmovers-column">
          <div className="topmovers-header topmovers-header-gain">
            <ArrowUpIcon className="topmovers-header-icon" />
            <h3>Top Ganadores</h3>
          </div>
          <div className="topmovers-list">
            {gainers.map((coin) => (
              <div 
                key={coin.id} 
                className="topmovers-item"
                onClick={() => onCryptoClick?.(coin.symbol.toUpperCase())}
              >
                <img 
                  src={coin.image} 
                  alt={coin.name} 
                  className="topmovers-icon" 
                />
                <div className="topmovers-info">
                  <span className="topmovers-symbol">
                    {coin.symbol.toUpperCase()}
                  </span>
                  <span className="topmovers-price">
                    ${coin.current_price.toFixed(2)}
                  </span>
                </div>
                <span className="topmovers-change topmovers-change-positive">
                  +{coin.changePercentage.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* LOSERS */}
        <div className="topmovers-column">
          <div className="topmovers-header topmovers-header-loss">
            <ArrowDownIcon className="topmovers-header-icon" />
            <h3>Top Perdedores</h3>
          </div>
          <div className="topmovers-list">
            {losers.map((coin) => (
              <div 
                key={coin.id} 
                className="topmovers-item"
                onClick={() => onCryptoClick?.(coin.symbol.toUpperCase())}
              >
                <img 
                  src={coin.image} 
                  alt={coin.name} 
                  className="topmovers-icon" 
                />
                <div className="topmovers-info">
                  <span className="topmovers-symbol">
                    {coin.symbol.toUpperCase()}
                  </span>
                  <span className="topmovers-price">
                    ${coin.current_price.toFixed(2)}
                  </span>
                </div>
                <span className="topmovers-change topmovers-change-negative">
                  {coin.changePercentage.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TopMoversSection;