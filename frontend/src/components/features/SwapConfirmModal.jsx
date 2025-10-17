// src/components/features/SwapConfirmModal.jsx

const SwapConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  fromCrypto,
  toCrypto,
  fromAmount,
  toAmount,
  exchangeRate,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="swap-page-modal-overlay">
      <div className="swap-page-modal-container">
        <div className="swap-page-modal-header">
          <h2 className="swap-page-modal-title">Confirmar</h2>
          <button
            className="swap-page-modal-close-btn"
            onClick={onClose}
            disabled={isLoading}
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
                1 {fromCrypto.symbol} ≈ {exchangeRate ? exchangeRate.toFixed(8) : '0.00000000'}{' '}
                {toCrypto.symbol}
              </span>
            </div>
            <div className="swap-page-detail-row">
              <span className="swap-page-detail-label">Método de pago</span>
              <span className="swap-page-detail-value">
                {fromCrypto.nombre} ({fromCrypto.symbol})
              </span>
            </div>
            <div className="swap-page-detail-row">
              <span className="swap-page-detail-label">Comisiones de transacción</span>
              <span className="swap-page-detail-value">0 {toCrypto.symbol}</span>
            </div>
          </div>

          {/* Advertencia */}
          <div className="swap-page-price-warning">
            <span>
              ⚠️ IMPORTANTE: La cotización puede cambiar al momento de ejecutar la conversión debido a
              las fluctuaciones del mercado.
            </span>
          </div>

          {/* Info de actualización */}
          <div className="swap-page-refresh-info">
            <span>Los precios se actualizan en tiempo real</span>
          </div>

          {/* Botón convertir */}
          <button
            className="btn-primary swap-page-modal-convert-btn"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Convirtiendo...' : 'Convertir'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwapConfirmModal;