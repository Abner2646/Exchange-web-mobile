import React, { useEffect } from 'react';
import QRCode from 'react-qr-code';
import { useCryptos } from '../hooks/useCrypto';
import { useDeposits } from '../hooks/useDeposits';
import '../styles/deposits.css';

const Deposits = () => {
  // Hook para obtener criptomonedas activas
  const { cryptos: criptomonedas, isLoading: loading } = useCryptos();

  // Hook para manejar depósitos
  const {
    selectedCrypto,
    selectedNetwork,
    depositAddress,
    loadingAddress,
    showMoreInfo,
    setSelectedCrypto,
    handleCryptoChange,
    toggleMoreInfo,
  } = useDeposits();

  // Estado local para depósitos recientes (UI ready, no implementado)
  const recentDeposits = [];

  /**
   * Seleccionar primera criptomoneda por defecto al cargar
   */
  useEffect(() => {
    if (criptomonedas.length > 0 && !selectedCrypto) {
      console.log('=== Deposits: Auto-seleccionando primera crypto ===');
      setSelectedCrypto(criptomonedas[0]);
    }
  }, [criptomonedas, selectedCrypto, setSelectedCrypto]);

  /**
   * Copiar texto al portapapeles
   */
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="deposits-container">
      {/* Header */}
      <header className="deposits-header">
        <h1 className="deposits-title">Depósitos</h1>
        <p className="deposits-subtitle">
          Deposita criptomonedas de forma segura en tu cuenta
        </p>
      </header>

      {/* Contenido principal */}
      <div className="deposits-content">
        {/* Panel principal de depósito */}
        <div className="deposit-panel">
          {/* Paso 1: Seleccionar moneda */}
          <div className="step-section">
            <div className="step-header">
              <span className="step-number">1</span>
              <h3 className="step-title">Seleccionar moneda</h3>
            </div>
            
            <div className="crypto-selector">
              {loading ? (
                <div className="loading-selector">Cargando monedas...</div>
              ) : (
                <div className="custom-select">
                  <div className="select-display">
                    {selectedCrypto ? (
                      <div className="selected-crypto">
                        <div className="crypto-icon">
                          {selectedCrypto.symbol.slice(0, 2)}
                        </div>
                        <div className="crypto-info">
                          <span className="crypto-symbol">{selectedCrypto.symbol}</span>
                          <span className="crypto-name">{selectedCrypto.nombre}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="select-placeholder">Selecciona una moneda</span>
                    )}
                    <span className="select-arrow">▼</span>
                  </div>
                  
                  <div className="select-dropdown">
                    {Array.isArray(criptomonedas) && criptomonedas.length > 0 ? (
                      criptomonedas.map(crypto => (
                        <div 
                          key={crypto.id}
                          className="select-option"
                          onClick={() => handleCryptoChange(crypto)}
                        >
                          <div className="crypto-icon">
                            {crypto.symbol ? crypto.symbol.slice(0, 2) : '??'}
                          </div>
                          <div className="crypto-info">
                            <span className="crypto-symbol">{crypto.symbol || 'N/A'}</span>
                            <span className="crypto-name">{crypto.nombre || 'Sin nombre'}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="select-option">
                        <span className="text-secondary">No hay criptomonedas disponibles</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Paso 2: Seleccionar red */}
          {selectedCrypto && (
            <div className="step-section">
              <div className="step-header">
                <span className="step-number">2</span>
                <h3 className="step-title">Seleccionar red</h3>
              </div>
              
              <div className="network-selector">
                <div className="network-display">
                  <span className="network-name">{selectedNetwork}</span>
                  <span className="network-description">
                    {selectedCrypto.nombre} ({selectedCrypto.symbol})
                  </span>
                </div>
                
                {selectedCrypto.direccionContrato && (
                  <div className="contract-info">
                    <span className="contract-label">Dirección del contrato terminada en</span>
                    <span className="contract-address">
                      {selectedCrypto.direccionContrato.slice(-5)}
                    </span>
                    <button 
                      className="copy-btn"
                      onClick={() => copyToClipboard(selectedCrypto.direccionContrato)}
                    >
                      📋
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Paso 3: Dirección de depósito */}
          {selectedCrypto && (
            <div className="step-section">
              <div className="step-header">
                <span className="step-number">3</span>
                <h3 className="step-title">Dirección de depósito</h3>
                <button className="manage-btn">
                  Gestionar →
                </button>
              </div>
              
              {loadingAddress ? (
                <div className="loading-address">Obteniendo dirección...</div>
              ) : depositAddress ? (
                <div className="address-display">
                  <div className="qr-section">
                    <QRCode
                      value={depositAddress.direccion}
                      size={120}
                      style={{ 
                        height: "120px", 
                        width: "120px",
                        border: `1px solid var(--border-secondary)`,
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--spacing-sm)',
                        background: 'var(--bg-primary)'
                      }}
                      fgColor="var(--text-primary)"
                      bgColor="var(--bg-primary)"
                    />
                  </div>
                  
                  <div className="address-section">
                    <label className="address-label">Dirección</label>
                    <div className="address-container">
                      <input
                        type="text"
                        value={depositAddress.direccion}
                        readOnly
                        className="address-input"
                      />
                      <button 
                        className="copy-address-btn"
                        onClick={() => copyToClipboard(depositAddress.direccion)}
                      >
                        📋
                      </button>
                      <span className="address-dropdown">▼</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-address">No se pudo obtener la dirección</div>
              )}
              
              <div className="deposit-info">
                <div className="min-deposit">
                  <span className="info-label">Depósito mínimo</span>
                  <span className="info-value">Más de 0,01 {selectedCrypto?.symbol}</span>
                </div>
                
                <button 
                  className="more-info-btn"
                  onClick={toggleMoreInfo}
                >
                  Más información {showMoreInfo ? '▲' : '▼'}
                </button>
              </div>

              {showMoreInfo && (
                <div className="extra-info">
                  <div className="info-card">
                    <h4>Información importante</h4>
                    <ul>
                      <li>Envía solo {selectedCrypto?.symbol} a esta dirección</li>
                      <li>Los depósitos en otras redes se perderán</li>
                      <li>Se requiere al menos 1 confirmación de red</li>
                      <li>Los depósitos pequeños pueden tardar más en procesarse</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Panel lateral - Depósitos recientes */}
        <div className="recent-deposits-panel">
          <h3 className="recent-title">Depósitos recientes</h3>
          
          {recentDeposits.length > 0 ? (
            <div className="deposits-list">
              {recentDeposits.map(deposit => (
                <div key={deposit.id} className="deposit-item">
                  <div className="deposit-crypto">
                    <div className="crypto-icon">
                      {deposit.symbol.slice(0, 2)}
                    </div>
                    <div className="deposit-details">
                      <span className="deposit-amount">{deposit.amount} {deposit.symbol}</span>
                      <span className="deposit-network">{deposit.network}</span>
                    </div>
                  </div>
                  <div className="deposit-status">
                    <span className={`status-badge status-${deposit.status}`}>
                      {deposit.status}
                    </span>
                    <span className="deposit-time">{deposit.time}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-deposits">
              <div className="no-deposits-icon">📥</div>
              <p className="no-deposits-text">No tienes depósitos recientes</p>
              <p className="no-deposits-subtitle">
                Tus transacciones aparecerán aquí una vez que realices un depósito
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Deposits;