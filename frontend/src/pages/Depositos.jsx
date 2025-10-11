import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import '../styles/deposits.css';

const Deposits = () => {
  const [criptomonedas, setCriptomonedas] = useState([]);
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [depositAddress, setDepositAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [recentDeposits, setRecentDeposits] = useState([]);
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  // Cargar criptomonedas activas al montar
  useEffect(() => {
    loadCriptomonedas();
  }, []);

  // Cargar dirección cuando se selecciona una criptomoneda
  useEffect(() => {
    if (selectedCrypto) {
      loadDepositAddress(selectedCrypto.id);
    }
  }, [selectedCrypto]);

  const loadCriptomonedas = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://localhost:3001/api/criptomoneda/public/active');
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Respuesta API criptomonedas:', data);
      
      // Validar que la respuesta sea un array
      let cryptoArray = [];
      if (Array.isArray(data)) {
        cryptoArray = data;
      } else if (data && Array.isArray(data.data)) {
        cryptoArray = data.data;
      } else if (data && Array.isArray(data.criptomonedas)) {
        cryptoArray = data.criptomonedas;
      } else {
        console.error('Formato de respuesta inesperado:', data);
        cryptoArray = [];
      }
      
      setCriptomonedas(cryptoArray);
      
      // Seleccionar primera criptomoneda por defecto si existe
      if (cryptoArray.length > 0) {
        setSelectedCrypto(cryptoArray[0]);
        setSelectedNetwork(cryptoArray[0].red);
      }
    } catch (error) {
      console.error('Error cargando criptomonedas:', error);
      setCriptomonedas([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDepositAddress = async (criptomonedaId) => {
    console.log('=== GET SIMPLE ===');
    console.log('CriptomonedaId:', criptomonedaId);
    
    setLoadingAddress(true);
    setDepositAddress(null);
    
    try {
      const miToken = localStorage.getItem('token');
      console.log('Token obtenido:', miToken ? 'Existe' : 'No existe');
      
      if (!miToken) {
        console.error('No hay token en localStorage');
        setDepositAddress(null);
        setLoadingAddress(false);
        return;
      }
      
      const url = `https://localhost:3001/api/direccionDeposito/user/me/crypto/${criptomonedaId}`;
      console.log('URL completa:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${miToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Status:', response.status);
      console.log('OK:', response.ok);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Datos:', data);
        setDepositAddress(data);
      } else {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        setDepositAddress(null);
      }
      
    } catch (error) {
      console.error('Error:', error.message);
      setDepositAddress(null);
    } finally {
      setLoadingAddress(false);
      console.log('=== FIN GET ===');
    }
  };

  const handleCryptoChange = (crypto) => {
    setSelectedCrypto(crypto);
    setSelectedNetwork(crypto.red);
    setDepositAddress(null);
  };

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
                  onClick={() => setShowMoreInfo(!showMoreInfo)}
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