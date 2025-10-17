// src/pages/BalancePage.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBalances } from '../hooks/useBalances';
import '../styles/BalancePage.css';

const BalancePage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const {
    enrichedBalances,
    totalUSDT,
    totalBTC,
    btcPriceError,
    isLoading,
    error,
    activeTab,
    setActiveTab,
    hideSmallBalances,
    setHideSmallBalances,
  } = useBalances();

  const handleNavigation = (path) => {
    if (isAuthenticated) {
      navigate(path);
    } else {
      navigate('/login');
    }
  };

  // Estado de carga
  if (isLoading) {
    return (
      <div className="bp-page">
        <div className="bp-loading-state">
          <p>Cargando balances...</p>
        </div>
      </div>
    );
  }

  // Estado de error
  if (error) {
    return (
      <div className="bp-page">
        <div className="bp-error-state">
          <h3>Error al cargar datos</h3>
          <p>{error.message || 'Error desconocido'}</p>
          <button 
            className="bp-btn-primary" 
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bp-page">
      {/* Header con balance total y acciones */}
      <div className="bp-header bp-card">
        <div className="bp-header-grid">
          <div className="bp-info">
            <div className="bp-label">
              <h2>Balance estimado</h2>
              <span className="bp-icon-eye">👁</span>
            </div>

            <div className="bp-amount">
              <h1>{btcPriceError ? '---' : totalBTC.toFixed(8)}</h1>
              <span className="bp-currency">BTC ▼</span>
            </div>

            <p className="bp-fiat">
              ≈ {totalUSDT.toFixed(2)} USDT
              {btcPriceError && (
                <span className="bp-warning-text"> (Sin precio BTC)</span>
              )}
            </p>
          </div>

          <div className="bp-actions">
            <button 
              className="bp-action-btn" 
              onClick={() => handleNavigation('/depositos')}
            >
              Depositar
            </button>
            <button 
              className="bp-action-btn" 
              onClick={() => handleNavigation('/retiros')}
            >
              Retirar
            </button>
            <button 
              className="bp-action-btn" 
              onClick={() => handleNavigation('/transferir')}
            >
              Transferir
            </button>
          </div>
        </div>
      </div>

      {/* Sección de activos */}
      <div className="bp-assets-section bp-card">
        <header className="bp-assets-header">
          <h2>Mis activos</h2>

          <div className="bp-assets-controls">
            <div className="bp-assets-tabs">
              <button
                className={`bp-tab ${activeTab === 'moneda' ? 'bp-active' : ''}`}
                onClick={() => setActiveTab('moneda')}
              >
                Vista por moneda
              </button>
            </div>

            <div className="bp-assets-filters">
              <label className="bp-hide-small-checkbox">
                <input
                  type="checkbox"
                  checked={hideSmallBalances}
                  onChange={(e) => setHideSmallBalances(e.target.checked)}
                />
                Ocultar activos inferiores a 1 USD
              </label>
            </div>
          </div>
        </header>

        {/* Tabla de activos */}
        <table className="bp-assets-table">
          <thead>
            <tr>
              <th className="bp-th-coin">Moneda</th>
              <th className="bp-th-amount">Importe</th>
              <th className="bp-th-value">Valor</th>
              <th className="bp-th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {enrichedBalances.length === 0 ? (
              <tr>
                <td colSpan="4" className="bp-empty-state">
                  No tienes activos disponibles
                </td>
              </tr>
            ) : (
              enrichedBalances.map((balance) => (
                <tr key={balance.id} className="bp-asset-row">
                  <td className="bp-coin-cell">
                    <div className="bp-coin-info">
                      <div className="bp-coin-avatar">
                        {balance.crypto.iconUrl ? (
                          <img 
                            src={balance.crypto.iconUrl} 
                            alt={balance.crypto.symbol}
                            className="bp-coin-icon"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <span className="bp-coin-fallback">
                          {balance.crypto.symbol.charAt(0)}
                        </span>
                      </div>
                      <div className="bp-coin-details">
                        <div className="bp-coin-symbol">
                          {balance.crypto.symbol}
                        </div>
                        <div className="bp-coin-name">
                          {balance.crypto.nombre}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="bp-amount-cell">
                    <div className="bp-amount-crypto">
                      {balance.balanceAmount.toFixed(8)}
                    </div>
                  </td>
                  <td className="bp-value-cell">
                    <div className="bp-value-amount">
                      {balance.valueInUSDT.toFixed(2)} USDT
                    </div>
                    <div className="bp-value-price">
                      {balance.price.toFixed(2)} USDT
                    </div>
                  </td>
                  <td className="bp-actions-cell">
                    <button className="bp-expand-btn">⋯</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BalancePage;