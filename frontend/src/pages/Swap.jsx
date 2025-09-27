import React, { useState, useEffect } from 'react';
import useSwap from '../hooks/useSwap';
import '../styles/Swap.css';

const Swap = () => {
  // Hook personalizado con integración real del backend
  const {
    // Estados del swap
    fromCrypto,
    toCrypto,
    fromAmount,
    toAmount,
    exchangeRate,
    exchangeData,
    
    // Estados de la UI
    loading,
    error,
    
    // Funciones
    getBalance,
    executeSwap,
    clearError,
    getAvailableFromCryptos,
    getAvailableToCryptos,
    calculateDetailedExchange,
    
    // Handlers
    handleFromCryptoChange,
    handleToCryptoChange,
    handleFromAmountChange,
    handleSwapCryptos,
    handleUseMaxBalance,
    
    // Validaciones
    hasInsufficientBalance,
    isSameCurrency
  } = useSwap();

  // Estados locales de la UI
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = () => {
      setShowFromDropdown(false);
      setShowToDropdown(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Manejar confirmación del swap
  const handleConfirm = () => {
    if (!fromAmount || !fromCrypto || !toCrypto || hasInsufficientBalance || isSameCurrency) return;
    
    setShowConfirmModal(true);
  };

  // Ejecutar intercambio real
  const handleExecuteSwap = async () => {
    setSwapLoading(true);
    try {
      await executeSwap();
      setShowConfirmModal(false);
      
      // Mostrar banner de éxito
      setShowSuccessBanner(true);
      
      // Auto-ocultar después de 5 segundos
      setTimeout(() => {
        setShowSuccessBanner(false);
      }, 5000);
      
    } catch (err) {
      console.error('Error en swap:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setSwapLoading(false);
    }
  };

  // Manejar cambio de cantidad
  const handleAmountChange = (e) => {
    const value = e.target.value;
    handleFromAmountChange(value);
  };

  return (
    <div className="swap-container">
      {/* Header */}
      <header className="swap-header">
        <h1 className="swap-title">
          Intercambiar Criptomonedas
        </h1>
        <p className="swap-subtitle">
          Precio inmediato | Precio garantizado | Cualquier par
        </p>
      </header>

      {/* Banner de éxito */}
      {showSuccessBanner && (
        <div className="success-banner">
          <div className="success-content">
            <div className="success-icon">✅</div>
            <div className="success-text">
              <div className="success-title">¡Intercambio realizado exitosamente!</div>
              <div className="success-subtitle">Tus balances han sido actualizados</div>
            </div>
            <button 
              className="success-close"
              onClick={() => setShowSuccessBanner(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Mostrar error global si existe */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError} className="error-close">×</button>
        </div>
      )}

      {/* Tipo de orden */}
      <div className="order-types">
        {['Instantáneo', 'Recurrente', 'Límite'].map((type, index) => (
          <button
            key={type}
            className={`order-type-btn ${index === 0 ? 'active' : ''}`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Contenedor principal del swap */}
      <div className="swap-main-container">
        {/* Campo "De" */}
        <div className="swap-field">
          <div className="swap-field-header">
            <span className="field-label">De</span>
            <span className="balance-text">
              Saldo disponible {fromCrypto ? getBalance(fromCrypto.symbol).toFixed(8) : '0.00000000'} {fromCrypto?.symbol || ''}
            </span>
          </div>
          
          <div className="swap-input-container">
            {/* Selector de criptomoneda origen */}
            <div className="crypto-selector">
              <button
                className="crypto-select-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFromDropdown(!showFromDropdown);
                  setShowToDropdown(false);
                }}
              >
                {fromCrypto ? (
                  <>
                    <div className={`crypto-icon ${fromCrypto.symbol.toLowerCase()}`}>
                      {fromCrypto.symbol.charAt(0)}
                    </div>
                    <span className="crypto-symbol">{fromCrypto.symbol}</span>
                  </>
                ) : (
                  <span className="crypto-symbol">Seleccionar</span>
                )}
                <span className="dropdown-arrow">▼</span>
              </button>

              {/* Dropdown origen */}
              {showFromDropdown && (
                <div className="crypto-dropdown">
                  {getAvailableFromCryptos().length > 0 ? (
                    getAvailableFromCryptos().map(crypto => (
                      <button
                        key={crypto.id}
                        className="crypto-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFromCryptoChange(crypto);
                          setShowFromDropdown(false);
                        }}
                      >
                        <div className={`crypto-icon ${crypto.symbol.toLowerCase()}`}>
                          {crypto.symbol.charAt(0)}
                        </div>
                        <div className="crypto-info">
                          <div className="crypto-symbol">{crypto.symbol}</div>
                          <div className="crypto-name">{crypto.nombre}</div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="no-options">No hay criptomonedas disponibles</div>
                  )}
                </div>
              )}
            </div>

            {/* Input de cantidad */}
            <input
              type="number"
              value={fromAmount}
              onChange={handleAmountChange}
              placeholder="0"
              className="amount-input"
              disabled={loading}
            />

            {/* Botón Max */}
            <button 
              className="max-btn"
              onClick={handleUseMaxBalance}
              disabled={!fromCrypto || loading}
            >
              Max
            </button>
          </div>

          {/* Mostrar error de balance insuficiente */}
          {hasInsufficientBalance && (
            <div className="balance-error">
              Balance insuficiente. Disponible: {getBalance(fromCrypto.symbol).toFixed(8)} {fromCrypto.symbol}
            </div>
          )}
        </div>

        {/* Botón intercambiar */}
        <div className="swap-button-container">
          <button 
            className="swap-currencies-btn" 
            onClick={handleSwapCryptos}
            disabled={loading}
          >
            <span className="swap-icon">⇅</span>
          </button>
        </div>

        {/* Campo "A" */}
        <div className="swap-field">
          <div className="swap-field-header">
            <span className="field-label">A</span>
            <span className="balance-text">
              Saldo disponible {toCrypto ? getBalance(toCrypto.symbol).toFixed(8) : '0.00000000'} {toCrypto?.symbol || ''}
            </span>
          </div>
          
          <div className="swap-input-container">
            {/* Selector de criptomoneda destino */}
            <div className="crypto-selector">
              <button
                className="crypto-select-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowToDropdown(!showToDropdown);
                  setShowFromDropdown(false);
                }}
              >
                {toCrypto ? (
                  <>
                    <div className={`crypto-icon ${toCrypto.symbol.toLowerCase()}`}>
                      {toCrypto.symbol.charAt(0)}
                    </div>
                    <span className="crypto-symbol">{toCrypto.symbol}</span>
                  </>
                ) : (
                  <span className="crypto-symbol">Seleccionar</span>
                )}
                <span className="dropdown-arrow">▼</span>
              </button>

              {/* Dropdown destino */}
              {showToDropdown && (
                <div className="crypto-dropdown">
                  {getAvailableToCryptos().length > 0 ? (
                    getAvailableToCryptos().map(crypto => (
                      <button
                        key={crypto.id}
                        className="crypto-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToCryptoChange(crypto);
                          setShowToDropdown(false);
                        }}
                      >
                        <div className={`crypto-icon ${crypto.symbol.toLowerCase()}`}>
                          {crypto.symbol.charAt(0)}
                        </div>
                        <div className="crypto-info">
                          <div className="crypto-symbol">{crypto.symbol}</div>
                          <div className="crypto-name">{crypto.nombre}</div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="no-options">No hay criptomonedas disponibles</div>
                  )}
                </div>
              )}
            </div>

            {/* Output de cantidad */}
            <div className="amount-output">
              {loading && fromAmount ? (
                <span className="calculating">Calculando...</span>
              ) : (
                toAmount || '0.00000000'
              )}
            </div>
          </div>
        </div>

        {/* Información de tasa */}
        {exchangeRate && fromCrypto && toCrypto && !isSameCurrency && (
          <div className="exchange-info">
            <span className="exchange-rate">
              Tasa: 1 {fromCrypto.symbol} ≈ {exchangeRate.toFixed(8)} {toCrypto.symbol}
            </span>
          </div>
        )}

        {/* Advertencia de misma moneda */}
        {isSameCurrency && (
          <div className="same-currency-warning">
            <span>⚠️ No puedes intercambiar la misma criptomoneda</span>
          </div>
        )}

        {/* Botón confirmar */}
        <button 
          className="btn-primary swap-confirm-btn"
          onClick={handleConfirm}
          disabled={!fromAmount || !fromCrypto || !toCrypto || hasInsufficientBalance || isSameCurrency || loading || swapLoading}
        >
          {swapLoading ? 'Obteniendo detalles...' :
           loading ? 'Cargando...' : 
           isSameCurrency ? 'Selecciona monedas diferentes' :
           hasInsufficientBalance ? 'Balance insuficiente' :
           'Vista previa'}
        </button>
      </div>

      {/* Modal de confirmación */}
      {showConfirmModal && fromCrypto && toCrypto && fromAmount && toAmount && exchangeRate && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="modal-title">Confirmar</h2>
              <button 
                className="modal-close-btn"
                onClick={() => setShowConfirmModal(false)}
                disabled={swapLoading}
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              {/* Iconos de conversión */}
              <div className="conversion-display">
                <div className="conversion-from">
                  <div className={`crypto-icon large ${fromCrypto.symbol.toLowerCase()}`}>
                    {fromCrypto.symbol.charAt(0)}
                  </div>
                  <span className="conversion-label">De</span>
                  <span className="conversion-amount">
                    {fromAmount} {fromCrypto.symbol}
                  </span>
                </div>

                <div className="conversion-arrow">→</div>

                <div className="conversion-to">
                  <div className={`crypto-icon large ${toCrypto.symbol.toLowerCase()}`}>
                    {toCrypto.symbol.charAt(0)}
                  </div>
                  <span className="conversion-label">A</span>
                  <span className="conversion-amount">
                    {toAmount} {toCrypto.symbol}
                  </span>
                </div>
              </div>

              {/* Detalles */}
              <div className="modal-details">
                <div className="detail-row">
                  <span className="detail-label">Tasa</span>
                  <span className="detail-value">
                    1 {fromCrypto.symbol} ≈ {exchangeRate ? exchangeRate.toFixed(8) : '0.00000000'} {toCrypto.symbol}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Método de pago</span>
                  <span className="detail-value">{fromCrypto.nombre} ({fromCrypto.symbol})</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Comisiones de transacción</span>
                  <span className="detail-value">
                    {exchangeData?.comision || '0'} {toCrypto.symbol}
                  </span>
                </div>
              </div>

              {/* Advertencia sobre cambio de cotización */}
              <div className="price-warning">
                <span>IMPORTANTE: La cotización puede cambiar al momento de ejecutar la conversión debido a las fluctuaciones del mercado.</span>
              </div>

              {/* Contador de actualización */}
              <div className="refresh-info">
                <span>Los precios se actualizan en tiempo real</span>
              </div>

              {/* Botón convertir */}
              <button 
                className="btn-primary modal-convert-btn"
                onClick={handleExecuteSwap}
                disabled={swapLoading}
              >
                {swapLoading ? 'Convirtiendo...' : 'Convertir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Swap;