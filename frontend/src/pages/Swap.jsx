// src/pages/Swap.jsx
import { useState, useEffect } from 'react';
import useSwap from '../hooks/useSwap';
import SwapConfirmModal from '../components/features/SwapConfirmModal';
import '../styles/Swap.css';

const Swap = () => {
  // Hook con React Query
  const {
    fromCrypto,
    toCrypto,
    fromAmount,
    toAmount,
    exchangeRate,
    isLoading,
    priceLoading,
    isExecuting,
    getBalance,
    getAvailableFromCryptos,
    getAvailableToCryptos,
    handleFromCryptoChange,
    handleToCryptoChange,
    handleFromAmountChange,
    handleSwapCryptos,
    handleUseMaxBalance,
    executeSwap,
    hasInsufficientBalance,
    isSameCurrency,
    isPairValid,
  } = useSwap();

  // Estados locales de la UI
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  console.log('[Swap] Component state:', {
    fromCrypto: fromCrypto?.symbol,
    toCrypto: toCrypto?.symbol,
    fromAmount,
    toAmount,
    exchangeRate,
    isPairValid,
  });

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = () => {
      setShowFromDropdown(false);
      setShowToDropdown(false);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handlers
  const handleConfirm = () => {
    if (
      !fromAmount ||
      !fromCrypto ||
      !toCrypto ||
      hasInsufficientBalance ||
      isSameCurrency ||
      !isPairValid
    )
      return;

    setShowConfirmModal(true);
  };

  const handleExecuteSwap = () => {
    console.log('[Swap] Executing swap');
    executeSwap();
    setShowConfirmModal(false);
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    handleFromAmountChange(value);
  };

  return (
    <div className="swap-page-container">
      {/* Header */}
      <header className="swap-page-header">
        <h1 className="swap-page-title">Intercambiar Criptomonedas</h1>
        <p className="swap-page-subtitle">
          Precio inmediato | Precio garantizado | Cualquier par
        </p>
      </header>

      {/* Contenedor principal del swap */}
      <div className="swap-page-main-container">
        {/* Campo "De" */}
        <div className="swap-page-field">
          <div className="swap-page-field-header">
            <span className="swap-page-field-label">De</span>
            <span className="swap-page-balance-text">
              Saldo disponible{' '}
              {fromCrypto ? getBalance(fromCrypto.symbol).toFixed(8) : '0.00000000'}{' '}
              {fromCrypto?.symbol || ''}
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
                    getAvailableFromCryptos().map((crypto) => (
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
              disabled={isLoading || priceLoading}
              step="any"
            />

            {/* Botón Max */}
            <button
              className="swap-page-max-btn"
              onClick={handleUseMaxBalance}
              disabled={!fromCrypto || isLoading || priceLoading}
            >
              Max
            </button>
          </div>

          {/* Error de balance insuficiente */}
          {hasInsufficientBalance && (
            <div className="swap-page-balance-error">
              Balance insuficiente. Disponible: {getBalance(fromCrypto.symbol).toFixed(8)}{' '}
              {fromCrypto.symbol}
            </div>
          )}
        </div>

        {/* Botón intercambiar */}
        <div className="swap-page-button-container">
          <button
            className="swap-page-currencies-btn"
            onClick={handleSwapCryptos}
            disabled={isLoading || priceLoading}
          >
            <span className="swap-page-icon">⇅</span>
          </button>
        </div>

        {/* Campo "A" */}
        <div className="swap-page-field">
          <div className="swap-page-field-header">
            <span className="swap-page-field-label">A</span>
            <span className="swap-page-balance-text">
              Saldo disponible {toCrypto ? getBalance(toCrypto.symbol).toFixed(8) : '0.00000000'}{' '}
              {toCrypto?.symbol || ''}
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
                    getAvailableToCryptos().map((crypto) => (
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
              {priceLoading && fromAmount ? (
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

        {/* Advertencias */}
        {isSameCurrency && (
          <div className="swap-page-same-currency-warning">
            <span>⚠️ No puedes intercambiar la misma criptomoneda</span>
          </div>
        )}

        {!isSameCurrency && fromCrypto && toCrypto && !isPairValid && (
          <div className="swap-page-invalid-pair-warning">
            <span>
              ❌ El par {fromCrypto.symbol}/{toCrypto.symbol} no está disponible para intercambio
            </span>
          </div>
        )}

        {/* Botón confirmar */}
        <button
          className="btn-primary swap-page-confirm-btn"
          onClick={handleConfirm}
          disabled={
            !fromAmount ||
            !fromCrypto ||
            !toCrypto ||
            hasInsufficientBalance ||
            isSameCurrency ||
            !isPairValid ||
            isLoading ||
            priceLoading ||
            isExecuting
          }
        >
          {isExecuting
            ? 'Procesando...'
            : priceLoading
            ? 'Cargando...'
            : isLoading
            ? 'Cargando...'
            : isSameCurrency
            ? 'Selecciona monedas diferentes'
            : !isPairValid && fromCrypto && toCrypto
            ? 'Par no disponible'
            : hasInsufficientBalance
            ? 'Balance insuficiente'
            : 'Vista previa'}
        </button>
      </div>

      {/* Modal de confirmación */}
      {showConfirmModal && fromCrypto && toCrypto && fromAmount && toAmount && exchangeRate && (
        <SwapConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleExecuteSwap}
          fromCrypto={fromCrypto}
          toCrypto={toCrypto}
          fromAmount={fromAmount}
          toAmount={toAmount}
          exchangeRate={exchangeRate}
          isLoading={isExecuting}
        />
      )}
    </div>
  );
};

export default Swap;