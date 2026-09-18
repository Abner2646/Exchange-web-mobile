// src/pages/BalancePage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useBalances } from '../hooks/useBalances';
import balanceService from '../services/balanceService';
import TransferModal from '../components/features/TransferModal';
import '../styles/BalancePage.css';

const BalancePage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferDefaultCryptoId, setTransferDefaultCryptoId] = useState('');
  const [isClaimingFaucet, setIsClaimingFaucet] = useState(false);
  
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

  const handleOpenTransfer = (cryptoId = '') => {
    setTransferDefaultCryptoId(cryptoId);
    setIsTransferModalOpen(true);
  };

  const handleClaimFaucet = async () => {
    try {
      setIsClaimingFaucet(true);
      await balanceService.claimTestnetFaucet({ symbol: 'ALL' });
      toast.success('¡10,000 USDT y 1 BTC de prueba acreditados exitosamente! 🎉');
      refetch();
    } catch (err) {
      console.error('Error reclamando faucet:', err);
      try {
        await balanceService.claimBtc();
        toast.success('¡1 BTC de regalo acreditado exitosamente! 🎉');
        refetch();
      } catch (fallbackErr) {
        const msg = err.errorMessage || err.response?.data?.message || err.message || 'Error al reclamar fondos de prueba';
        toast.error(msg);
      }
    } finally {
      setIsClaimingFaucet(false);
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
            <button 
              className="bp-action-btn"
              style={{ background: '#2563eb', color: '#ffffff', border: 'none', fontWeight: '600' }}
              onClick={() => handleOpenTransfer()}
            >
              ⇄ Entre Billeteras
            </button>
            <button 
              className="bp-action-btn"
              style={{ background: '#059669', color: '#ffffff', border: 'none', fontWeight: '600' }}
              onClick={handleClaimFaucet}
              disabled={isClaimingFaucet}
            >
              {isClaimingFaucet ? 'Reclamando...' : '🎁 Fondos de Prueba'}
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
                      {balance.balanceAmount.toFixed(8)} {balance.crypto.symbol}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      Funding: {parseFloat(balance.compartments?.funding?.available || 0).toFixed(4)} | Spot: {parseFloat(balance.compartments?.spot?.available || 0).toFixed(4)}
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
                    <button 
                      className="bp-action-btn-transfer"
                      onClick={() => handleOpenTransfer(balance.criptomonedaId || balance.cryptoId || balance.crypto?.id)}
                      title="Transferir entre billeteras Funding y Spot"
                      style={{
                        padding: '0.4rem 0.8rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ⇄ Transferir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Transferencia entre Billeteras */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={() => refetch()}
        defaultCryptoId={transferDefaultCryptoId}
        balances={enrichedBalances}
      />
    </div>
  );
};

export default BalancePage;