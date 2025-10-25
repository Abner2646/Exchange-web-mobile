// src/components/features/TopAssets.jsx
/*
import React from 'react';

const TopAssets = ({ assets, onNavigate }) => {
  // No mostrar si no hay activos
  if (!assets || assets.length === 0) {
    return null;
  }

  return (
    <div className="assets-card card">
      <h3>Top Activos</h3>
      <div className="assets-list">
        {assets.map((asset, index) => (
          <div key={index} className="asset-item">
            <div className="asset-info">
              <span className="asset-symbol">{asset.symbol}</span>
              <span className="asset-percentage">{asset.percentage}%</span>
            </div>
            <div className="asset-bar">
              <div 
                className="asset-bar-fill" 
                style={{ width: `${asset.percentage}%` }} 
              />
            </div>
            <span className="asset-value">
              ${(asset.value ?? 0).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <button
        className="home-view-all-assets-btn"
        onClick={() => onNavigate('/activos')}
        style={{
          width: '100%',
          marginTop: 'var(--spacing-md)',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'var(--brand-primary)';
          e.target.style.color = 'var(--text-inverse)';
          e.target.style.borderColor = 'var(--brand-primary)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'var(--bg-secondary)';
          e.target.style.color = 'var(--text-primary)';
          e.target.style.borderColor = 'var(--border-primary)';
        }}
      >
        Ver todos mis activos
      </button>
    </div>
  );
};

export default TopAssets;
*/

// src/components/features/TopAssets.jsx 
import SkeletonLoader from '../common/SkeletonLoader';

const TopAssets = ({ assets, onNavigate, isLoading }) => {
  if (isLoading) {
    return (
      <div className="assets-card card">
        <h3>Mis Activos Principales</h3>
        <div className="assets-list">
          <SkeletonLoader type="asset-item" count={5} />
        </div>
      </div>
    );
  }

  // No mostrar si no hay activos
  if (!assets || assets.length === 0) {
    return (
      <div className="assets-card card">
        <h3>Mis Activos Principales</h3>
        <div className="assets-empty">
          <p>No tienes activos aún. ¡Empieza a operar!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="assets-card card">
      <h3>Mis Activos Principales</h3>
      <div className="assets-list">
        {assets.map((asset, index) => (
          <div key={index} className="asset-item">
            <div className="asset-info">
              <span className="asset-symbol">{asset.symbol}</span>
              <span className="asset-percentage">{asset.percentage}%</span>
            </div>
            <div className="asset-bar">
              <div 
                className="asset-bar-fill" 
                style={{ width: `${asset.percentage}%` }} 
              />
            </div>
            <span className="asset-value">
              ${(asset.value ?? 0).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <button
        className="home-view-all-assets-btn"
        onClick={() => onNavigate('/activos')}
      >
        Ver todos mis activos
      </button>
    </div>
  );
};

export default TopAssets;