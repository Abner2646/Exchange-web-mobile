// src/components/features/TransferSummary.jsx
import { PaperAirplaneIcon, BanknotesIcon, BoltIcon } from '@heroicons/react/24/outline';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function TransferSummary({
  criptoSeleccionada,
  destinatario,
  cantidad,
  balances,
  onSubmit,
  canSubmit,
  loading,
  error,
}) {
  const getBalanceDisponible = () => {
    if (!criptoSeleccionada) return 0;
    const balance = balances.find((b) => b.criptomonedaId === criptoSeleccionada.id);
    return balance ? parseFloat(balance.balanceDisponible) : 0;
  };

  return (
    <div className="summary-card">
      <h3 className="summary-title">Resumen</h3>

      {criptoSeleccionada ? (
        <div className="summary-content">
          <div className="summary-item">
            <span className="summary-label">Criptomoneda</span>
            <div className="summary-crypto">
              <img
                src={criptoSeleccionada.iconUrl || '/placeholder.svg'}
                alt={criptoSeleccionada.symbol}
                className="summary-crypto-icon"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="crypto-icon-fallback-summary" style={{ display: 'none' }}>
                {criptoSeleccionada.symbol.slice(0, 3)}
              </div>
              <span className="summary-value">{criptoSeleccionada.symbol}</span>
            </div>
          </div>

          <div className="summary-item">
            <span className="summary-label">Balance disponible</span>
            <span className="summary-value">
              {getBalanceDisponible()} {criptoSeleccionada.symbol}
            </span>
          </div>

          {destinatario && (
            <div className="summary-item">
              <span className="summary-label">Enviar a</span>
              <span className="summary-value">{destinatario.username}</span>
            </div>
          )}

          {cantidad && parseFloat(cantidad) > 0 && (
            <div className="summary-item highlight">
              <span className="summary-label">Monto a enviar</span>
              <span className="summary-value-large">
                {cantidad} {criptoSeleccionada.symbol}
              </span>
            </div>
          )}

          <div className="transfer-info">
            <div className="transfer-info-item">
              <BanknotesIcon className="info-icon" />
              <span>Sin comisión</span>
            </div>
            <div className="transfer-info-item">
              <BoltIcon className="info-icon" />
              <span>Instantáneo</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="summary-empty">
          <p>Selecciona una criptomoneda para ver el resumen</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <ExclamationTriangleIcon className="error-icon" />
          {error}
        </div>
      )}

      <button className="submit-button" onClick={onSubmit} disabled={!canSubmit}>
        <PaperAirplaneIcon className="button-icon" />
        {loading ? 'Enviando...' : 'Enviar Transferencia'}
      </button>
    </div>
  );
}