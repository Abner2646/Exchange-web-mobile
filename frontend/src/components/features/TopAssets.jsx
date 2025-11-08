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