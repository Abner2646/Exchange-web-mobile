import React, { useState, useEffect } from 'react';
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

  // Simular token de autenticación (en la app real vendría del contexto de auth)
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

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
      const response = await fetch('http://localhost:3001/criptomoneda/public/active');
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Respuesta API criptomonedas:', data);
      
      // Validar que la respuesta sea un array o tenga una propiedad data que sea array
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
      
      // Seleccionar USDT por defecto si existe
      const usdt = cryptoArray.find(crypto => crypto.symbol === 'USDT');
      if (usdt) {
        setSelectedCrypto(usdt);
        setSelectedNetwork(usdt.red);
      }
    } catch (error) {
      console.error('Error cargando criptomonedas:', error);
      setCriptomonedas([]); // Asegurar que sea array vacío en caso de error
    } finally {
      setLoading(false);
    }
  };

  const loadDepositAddress = async (criptomonedaId) => {
    setLoadingAddress(true);
    try {
      // Primero intentar obtener la dirección existente
      const response = await fetch(
        `http://localhost:3001/direccion-deposito/user/me/crypto/${criptomonedaId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dirección obtenida:', data);
        
        // Si la dirección existe y no es "none", usarla
        if (data && data.direccion && data.direccion !== 'none') {
          setDepositAddress(data);
          return;
        }
      }
      
      // Si no existe dirección o es "none", crear una nueva
      console.log('Creando nueva dirección para criptomoneda:', criptomonedaId);
      const createResponse = await fetch(
        'http://localhost:3001/direccion-deposito/',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            criptomonedaId: criptomonedaId
          })
        }
      );
      
      if (!createResponse.ok) {
        throw new Error(`Error creando dirección: ${createResponse.status}`);
      }
      
      const createData = await createResponse.json();
      console.log('Dirección creada:', createData);
      
      // Según tus comentarios, hay que hacer un GET después del POST para recuperar correctamente
      // Esperar un momento y volver a intentar obtener la dirección
      setTimeout(async () => {
        try {
          const finalResponse = await fetch(
            `http://localhost:3001/direccion-deposito/user/me/crypto/${criptomonedaId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (finalResponse.ok) {
            const finalData = await finalResponse.json();
            console.log('Dirección final obtenida:', finalData);
            setDepositAddress(finalData);
          } else {
            // Si falla, usar la dirección del response de creación
            if (createData.data && createData.data.direccion) {
              setDepositAddress(createData.data);
            } else {
              throw new Error('No se pudo obtener la dirección creada');
            }
          }
        } catch (finalError) {
          console.error('Error en GET final:', finalError);
          // Fallback: usar la dirección del response de creación si existe
          if (createData.data && createData.data.direccion) {
            setDepositAddress(createData.data);
          }
        } finally {
          setLoadingAddress(false);
        }
      }, 1000); // Esperar 1 segundo antes del GET final
      
    } catch (error) {
      console.error('Error cargando/creando dirección:', error);
      setDepositAddress(null);
      setLoadingAddress(false);
    }
  };

  const handleCryptoChange = (crypto) => {
    setSelectedCrypto(crypto);
    setSelectedNetwork(crypto.red);
    setDepositAddress(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Aquí podrías agregar una notificación de "copiado"
  };

  const generateQRCode = (address) => {
    // Generar QR code simple usando un servicio externo
    return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${address}`;
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const truncateAddress = (address, start = 10, end = 8) => {
    if (!address) return '';
    if (address.length <= start + end) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
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
                <div className="loading-address">Generando dirección...</div>
              ) : depositAddress ? (
                <div className="address-display">
                  <div className="qr-section">
                    <img 
                      src={generateQRCode(depositAddress.direccion)}
                      alt="QR Code"
                      className="qr-code"
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
                <div className="no-address">No se pudo generar la dirección</div>
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