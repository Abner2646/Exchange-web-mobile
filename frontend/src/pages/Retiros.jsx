import React, { useEffect } from 'react';
import { useWithdrawals } from '../hooks/useWithdrawals';
import '../styles/withdrawal.css';

const Retiros = () => {
  const {
    // Datos
    criptomonedas,
    selectedCrypto,
    balance,
    
    // Estados del formulario
    withdrawalType,
    destinationAddress,
    amount,
    addressError,
    
    // Estados de carga
    isLoadingData,
    isProcessing,
    
    // Acciones
    setWithdrawalType,
    setDestinationAddress,
    setAmount,
    handleCryptoChange,
    handleAmountChange,
    setMaxAmount,
    handleAddressValidation,
    handleWithdraw,
  } = useWithdrawals();

  // Establecer primera criptomoneda al cargar
  useEffect(() => {
    if (criptomonedas.length > 0 && !selectedCrypto) {
      handleCryptoChange(criptomonedas[0].id);
    }
  }, [criptomonedas, selectedCrypto]);

  if (isLoadingData) {
    return (
      <div className="withdrawal-container">
        <div className="withdrawal-loading">
          <div className="loading-spinner"></div>
          <p>Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="withdrawal-container">
      <div className="withdrawal-wrapper">
        <header className="withdrawal-header">
          <div>
            <h1>Retirar Criptomonedas</h1>
            <p className="withdrawal-subtitle">
              Envia tus criptomonedas a una direccion externa de forma segura
            </p>
          </div>
        </header>

        <div className="withdrawal-form">
          <div className="form-step">
            <div className="step-header">
              <span className="step-number">1</span>
              <h3>Seleccionar moneda</h3>
            </div>
            
            <div className="form-group">
              <label>Criptomoneda</label>
              <select
                className="form-select"
                value={selectedCrypto ? selectedCrypto.id : ''}
                onChange={(e) => handleCryptoChange(e.target.value)}
              >
                {criptomonedas.map((crypto) => (
                  <option key={crypto.id} value={crypto.id}>
                    {crypto.symbol} - {crypto.nombre}
                  </option>
                ))}
              </select>
            </div>

            {selectedCrypto && (
              <div className="crypto-info">
                <div className="crypto-info-row">
                  <span>Red:</span>
                  <span className="crypto-network">{selectedCrypto.red}</span>
                </div>
                <div className="crypto-info-row">
                  <span>Balance disponible:</span>
                  <span className="crypto-balance">
                    {balance.disponible.toFixed(8)} {selectedCrypto.symbol}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="form-step">
            <div className="step-header">
              <span className="step-number">2</span>
              <h3>Retirar a</h3>
            </div>

            <div className="withdrawal-tabs">
              <button
                className={'tab ' + (withdrawalType === 'address' ? 'active' : '')}
                onClick={() => setWithdrawalType('address')}
              >
                Direccion
              </button>
              <button
                className={'tab ' + (withdrawalType === 'user' ? 'active' : '')}
                onClick={() => setWithdrawalType('user')}
                disabled
              >
                Usuario interno
              </button>
            </div>

            <div className="form-group">
              <label>Direccion de destino</label>
              <input
                type="text"
                className="form-input"
                placeholder="0x0000000000000000000000000000000000000000"
                value={destinationAddress}
                onChange={(e) => {
                  setDestinationAddress(e.target.value);
                }}
                onBlur={() => handleAddressValidation(destinationAddress)}
              />
              {addressError && (
                <span className="input-error">{addressError}</span>
              )}
            </div>

            {selectedCrypto && (
              <div className="form-group">
                <label>Red</label>
                <div className="network-display">
                  <span className="network-badge">{selectedCrypto.red}</span>
                  <span className="network-info">
                    Direccion del contrato terminada en .{selectedCrypto.red.toLowerCase()}
                  </span>
                </div>
              </div>
            )}

            <div className="warning-box">
              <p>
                <strong>PRECAUCION:</strong> Asegurate de que la direccion del destinatario 
                este activada y autorizada para recibir la direccion del contrato del token; 
                de lo contrario, tu retiro fallara.
              </p>
            </div>
          </div>

          <div className="form-step">
            <div className="step-header">
              <span className="step-number">3</span>
              <h3>Importe del retiro</h3>
            </div>

            <div className="form-group">
              <div className="amount-input-wrapper">
                <input
                  type="text"
                  className="form-input amount-input"
                  placeholder="0.00000000"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                />
                <div className="amount-suffix">
                  <span className="amount-crypto">
                    {selectedCrypto ? selectedCrypto.symbol : 'USDT'}
                  </span>
                  <button
                    className="btn-max"
                    onClick={setMaxAmount}
                    disabled={balance.disponible <= 0}
                  >
                    MAX.
                  </button>
                </div>
              </div>
              <span className="input-hint">como minimo: 0.00000001</span>
            </div>

            {destinationAddress && (
              <div className="info-box">
                <p>
                  Esta direccion no se ha utilizado recientemente. Para evitar errores, 
                  te recomendamos efectuar primero un <strong>retiro de prueba</strong> con el importe minimo.
                </p>
              </div>
            )}

            <div className="withdrawal-summary">
              <div className="summary-row">
                <span>Retiro disponible</span>
                <span className="summary-value">
                  {balance.disponible.toFixed(8)} {selectedCrypto ? selectedCrypto.symbol : 'USDT'}
                </span>
              </div>
              <div className="summary-row">
                <span>Limite restante a las 24 h</span>
                <span className="summary-value">
                  8 000 000,0 {selectedCrypto ? selectedCrypto.symbol : 'USDT'} / 8 000 000,0 {selectedCrypto ? selectedCrypto.symbol : 'USDT'}
                </span>
              </div>
              <div className="summary-row total">
                <span>Cantidad total</span>
                <span className="summary-total">
                  {amount || '0.00'} {selectedCrypto ? selectedCrypto.symbol : 'USDT'}
                </span>
              </div>
              <div className="summary-row">
                <span>Comision de la red</span>
                <span className="summary-value">
                  0.00 {selectedCrypto ? selectedCrypto.symbol : 'USDT'}
                </span>
              </div>
            </div>
          </div>

          <button
            className="btn-withdraw"
            onClick={handleWithdraw}
            disabled={isProcessing || !selectedCrypto || !destinationAddress || !amount}
          >
            {isProcessing ? 'Procesando...' : 'Retirar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Retiros;