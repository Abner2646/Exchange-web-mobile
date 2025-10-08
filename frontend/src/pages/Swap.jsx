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
    
    // Estados de la UI
    loading,
    error,
    
    // Funciones
    getBalance,
    executeSwap,
    clearError,
    getAvailableFromCryptos,
    getAvailableToCryptos,
    checkPairExists,
    
    // Handlers
    handleFromCryptoChange,
    handleToCryptoChange,
    handleFromAmountChange,
    handleSwapCryptos,
    handleUseMaxBalance,
    
    // Validaciones
    hasInsufficientBalance,
    isSameCurrency,
    isPairValid
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
    if (!fromAmount || !fromCrypto || !toCrypto || hasInsufficientBalance || isSameCurrency || !isPairValid) return;
    
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
    <div className="swap-page-container">
      {/* Banner de éxito */}
      {showSuccessBanner && (
        <div className="swap-page-success-banner">
          <div className="swap-page-success-content">
            <div className="swap-page-success-icon">✅</div>
            <div className="swap-page-success-text">
              <div className="swap-page-success-title">¡Intercambio realizado exitosamente!</div>
              <div className="swap-page-success-subtitle">Tus balances han sido actualizados</div>
            </div>
            <button 
              className="swap-page-success-close"
              onClick={() => setShowSuccessBanner(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Mostrar error global si existe */}
      {error && (
        <div className="swap-page-error-banner">
          <span>{error}</span>
          <button onClick={clearError} className="swap-page-error-close">×</button>
        </div>
      )}

      {/* Header */}
      <header className="swap-page-header">
        <h1 className="swap-page-title">
          Intercambiar Criptomonedas
        </h1>
        <p className="swap-page-subtitle">
          Precio inmediato | Precio garantizado | Cualquier par
        </p>
      </header>

      {/* Tipo de orden */}
      <div className="swap-page-order-types">
        {['Instantáneo', 'Recurrente', 'Límite'].map((type, index) => (
          <button
            key={type}
            className={`swap-page-order-type-btn ${index === 0 ? 'active' : ''}`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Contenedor principal del swap */}
      <div className="swap-page-main-container">
        {/* Campo "De" */}
        <div className="swap-page-field">
          <div className="swap-page-field-header">
            <span className="swap-page-field-label">De</span>
            <span className="swap-page-balance-text">
              Saldo disponible {fromCrypto ? getBalance(fromCrypto.symbol).toFixed(8) : '0.00000000'} {fromCrypto?.symbol || ''}
            </span>
          </div>
          
          <div className="swap-page-input-container">
            {/* Selector de criptomoneda origen */}
            <div className="swap-page-crypto-selector">
              <button
                className="swap-page-crypto-select-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFromDropdown(!showFromDropdown);
                  setShowToDropdown(false);
                }}
              >
                {fromCrypto ? (
                  <>
                    {fromCrypto.iconUrl ? (
                      <img 
                        src={fromCrypto.iconUrl} 
                        alt={fromCrypto.symbol}
                        className="swap-page-crypto-icon"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="swap-page-crypto-icon placeholder" 
                      style={{ display: fromCrypto.iconUrl ? 'none' : 'flex' }}
                    >
                      {fromCrypto.symbol.charAt(0)}
                    </div>
                    <span className="swap-page-crypto-symbol">{fromCrypto.symbol}</span>
                  </>
                ) : (
                  <span className="swap-page-crypto-symbol">Seleccionar</span>
                )}
                <span className="swap-page-dropdown-arrow">▼</span>
              </button>

              {/* Dropdown origen */}
              {showFromDropdown && (
                <div className="swap-page-crypto-dropdown">
                  {getAvailableFromCryptos().length > 0 ? (
                    getAvailableFromCryptos().map(crypto => (
                      <button
                        key={crypto.id}
                        className="swap-page-crypto-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFromCryptoChange(crypto);
                          setShowFromDropdown(false);
                        }}
                      >
                        {crypto.iconUrl ? (
                          <img 
                            src={crypto.iconUrl} 
                            alt={crypto.symbol}
                            className="swap-page-crypto-icon"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="swap-page-crypto-icon placeholder" 
                          style={{ display: crypto.iconUrl ? 'none' : 'flex' }}
                        >
                          {crypto.symbol.charAt(0)}
                        </div>
                        <div className="swap-page-crypto-info">
                          <div className="swap-page-crypto-symbol">{crypto.symbol}</div>
                          <div className="swap-page-crypto-name">{crypto.nombre}</div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="swap-page-no-options">No hay criptomonedas disponibles</div>
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
              className="swap-page-amount-input"
              disabled={loading}
              step="any"
            />

            {/* Botón Max */}
            <button 
              className="swap-page-max-btn"
              onClick={handleUseMaxBalance}
              disabled={!fromCrypto || loading}
            >
              Max
            </button>
          </div>

          {/* Mostrar error de balance insuficiente */}
          {hasInsufficientBalance && (
            <div className="swap-page-balance-error">
              Balance insuficiente. Disponible: {getBalance(fromCrypto.symbol).toFixed(8)} {fromCrypto.symbol}
            </div>
          )}
        </div>

        {/* Botón intercambiar */}
        <div className="swap-page-button-container">
          <button 
            className="swap-page-currencies-btn" 
            onClick={handleSwapCryptos}
            disabled={loading}
          >
            <span className="swap-page-icon">⇅</span>
          </button>
        </div>

        {/* Campo "A" */}
        <div className="swap-page-field">
          <div className="swap-page-field-header">
            <span className="swap-page-field-label">A</span>
            <span className="swap-page-balance-text">
              Saldo disponible {toCrypto ? getBalance(toCrypto.symbol).toFixed(8) : '0.00000000'} {toCrypto?.symbol || ''}
            </span>
          </div>
          
          <div className="swap-page-input-container">
            {/* Selector de criptomoneda destino */}
            <div className="swap-page-crypto-selector">
              <button
                className="swap-page-crypto-select-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowToDropdown(!showToDropdown);
                  setShowFromDropdown(false);
                }}
              >
                {toCrypto ? (
                  <>
                    {toCrypto.iconUrl ? (
                      <img 
                        src={toCrypto.iconUrl} 
                        alt={toCrypto.symbol}
                        className="swap-page-crypto-icon"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="swap-page-crypto-icon placeholder" 
                      style={{ display: toCrypto.iconUrl ? 'none' : 'flex' }}
                    >
                      {toCrypto.symbol.charAt(0)}
                    </div>
                    <span className="swap-page-crypto-symbol">{toCrypto.symbol}</span>
                  </>
                ) : (
                  <span className="swap-page-crypto-symbol">Seleccionar</span>
                )}
                <span className="swap-page-dropdown-arrow">▼</span>
              </button>

              {/* Dropdown destino */}
              {showToDropdown && (
                <div className="swap-page-crypto-dropdown">
                  {getAvailableToCryptos().length > 0 ? (
                    getAvailableToCryptos().map(crypto => (
                      <button
                        key={crypto.id}
                        className="swap-page-crypto-option"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToCryptoChange(crypto);
                          setShowToDropdown(false);
                        }}
                      >
                        {crypto.iconUrl ? (
                          <img 
                            src={crypto.iconUrl} 
                            alt={crypto.symbol}
                            className="swap-page-crypto-icon"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="swap-page-crypto-icon placeholder" 
                          style={{ display: crypto.iconUrl ? 'none' : 'flex' }}
                        >
                          {crypto.symbol.charAt(0)}
                        </div>
                        <div className="swap-page-crypto-info">
                          <div className="swap-page-crypto-symbol">{crypto.symbol}</div>
                          <div className="swap-page-crypto-name">{crypto.nombre}</div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="swap-page-no-options">No hay criptomonedas disponibles</div>
                  )}
                </div>
              )}
            </div>

            {/* Output de cantidad */}
            <div className="swap-page-amount-output">
              {loading && fromAmount ? (
                <span className="swap-page-calculating">Calculando...</span>
              ) : (
                toAmount || '0.00000000'
              )}
            </div>
          </div>
        </div>

        {/* Información de tasa */}
        {exchangeRate && fromCrypto && toCrypto && !isSameCurrency && isPairValid && (
          <div className="swap-page-exchange-info">
            <span className="swap-page-exchange-rate">
              Tasa: 1 {fromCrypto.symbol} ≈ {exchangeRate.toFixed(8)} {toCrypto.symbol}
            </span>
          </div>
        )}

        {/* Advertencia de misma moneda */}
        {isSameCurrency && (
          <div className="swap-page-same-currency-warning">
            <span>⚠️ No puedes intercambiar la misma criptomoneda</span>
          </div>
        )}

        {/* Advertencia de par inválido */}
        {!isSameCurrency && fromCrypto && toCrypto && !isPairValid && (
          <div className="swap-page-invalid-pair-warning">
            <span>❌ El par {fromCrypto.symbol}/{toCrypto.symbol} no está disponible para intercambio</span>
          </div>
        )}

        {/* Botón confirmar */}
        <button 
          className="btn-primary swap-page-confirm-btn"
          onClick={handleConfirm}
          disabled={!fromAmount || !fromCrypto || !toCrypto || hasInsufficientBalance || isSameCurrency || !isPairValid || loading || swapLoading}
        >
          {swapLoading ? 'Obteniendo detalles...' :
           loading ? 'Cargando...' : 
           isSameCurrency ? 'Selecciona monedas diferentes' :
           !isPairValid && fromCrypto && toCrypto ? 'Par no disponible' :
           hasInsufficientBalance ? 'Balance insuficiente' :
           'Vista previa'}
        </button>
      </div>

      {/* Modal de confirmación */}
      {showConfirmModal && fromCrypto && toCrypto && fromAmount && toAmount && exchangeRate && (
        <div className="swap-page-modal-overlay">
          <div className="swap-page-modal-container">
            <div className="swap-page-modal-header">
              <h2 className="swap-page-modal-title">Confirmar</h2>
              <button 
                className="swap-page-modal-close-btn"
                onClick={() => setShowConfirmModal(false)}
                disabled={swapLoading}
              >
                ✕
              </button>
            </div>

            <div className="swap-page-modal-content">
              {/* Iconos de conversión */}
              <div className="swap-page-conversion-display">
                <div className="swap-page-conversion-from">
                  {fromCrypto.iconUrl ? (
                    <img 
                      src={fromCrypto.iconUrl} 
                      alt={fromCrypto.symbol}
                      className="swap-page-crypto-icon large"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="swap-page-crypto-icon large placeholder" 
                    style={{ display: fromCrypto.iconUrl ? 'none' : 'flex' }}
                  >
                    {fromCrypto.symbol.charAt(0)}
                  </div>
                  <span className="swap-page-conversion-label">De</span>
                  <span className="swap-page-conversion-amount">
                    {fromAmount} {fromCrypto.symbol}
                  </span>
                </div>

                <div className="swap-page-conversion-arrow">→</div>

                <div className="swap-page-conversion-to">
                  {toCrypto.iconUrl ? (
                    <img 
                      src={toCrypto.iconUrl} 
                      alt={toCrypto.symbol}
                      className="swap-page-crypto-icon large"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className="swap-page-crypto-icon large placeholder" 
                    style={{ display: toCrypto.iconUrl ? 'none' : 'flex' }}
                  >
                    {toCrypto.symbol.charAt(0)}
                  </div>
                  <span className="swap-page-conversion-label">A</span>
                  <span className="swap-page-conversion-amount">
                    {toAmount} {toCrypto.symbol}
                  </span>
                </div>
              </div>

              {/* Detalles */}
              <div className="swap-page-modal-details">
                <div className="swap-page-detail-row">
                  <span className="swap-page-detail-label">Tasa</span>
                  <span className="swap-page-detail-value">
                    1 {fromCrypto.symbol} ≈ {exchangeRate ? exchangeRate.toFixed(8) : '0.00000000'} {toCrypto.symbol}
                  </span>
                </div>
                <div className="swap-page-detail-row">
                  <span className="swap-page-detail-label">Método de pago</span>
                  <span className="swap-page-detail-value">{fromCrypto.nombre} ({fromCrypto.symbol})</span>
                </div>
                <div className="swap-page-detail-row">
                  <span className="swap-page-detail-label">Comisiones de transacción</span>
                  <span className="swap-page-detail-value">
                    0 {toCrypto.symbol}
                  </span>
                </div>
              </div>

              {/* Advertencia sobre cambio de cotización */}
              <div className="swap-page-price-warning">
                <span>⚠️ IMPORTANTE: La cotización puede cambiar al momento de ejecutar la conversión debido a las fluctuaciones del mercado.</span>
              </div>

              {/* Contador de actualización */}
              <div className="swap-page-refresh-info">
                <span>Los precios se actualizan en tiempo real</span>
              </div>

              {/* Botón convertir */}
              <button 
                className="btn-primary swap-page-modal-convert-btn"
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