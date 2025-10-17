// src/components/features/TransferForm.jsx
import {
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { EMAIL_REGEX } from '../../utils/validators';
import { getPercentageAmount } from '../../utils/formatters';
import CryptoSelector from './CryptoSelector';
import RecentRecipients from './RecentRecipients';

export default function TransferForm({
  email,
  setEmail,
  destinatario,
  searching,
  notFound,
  historial = [], // ⭐ Valor por defecto
  onSelectRecipient,
  criptomonedas = [], // ⭐ Valor por defecto
  criptoSeleccionada,
  onSelectCrypto,
  cantidad,
  setCantidad,
  balances = [], // ⭐ Valor por defecto
  balanceInsuficiente,
  nota,
  setNota,
}) {
  // Obtener balance disponible
  const getBalanceDisponible = () => {
    if (!criptoSeleccionada) return 0;
    const balance = balances.find((b) => b.criptomonedaId === criptoSeleccionada.id);
    return balance ? parseFloat(balance.balanceDisponible) : 0;
  };

  const setPercentageAmount = (percentage) => {
    const balance = getBalanceDisponible();
    const amount = getPercentageAmount(balance, percentage);
    setCantidad(amount);
    console.log(`💰 ${percentage}% del balance:`, amount);
  };

  return (
    <div className="transferencia-card">
      {/* Campo de email destinatario */}
      <div className="form-group">
        <label className="form-label">
          <MagnifyingGlassIcon className="label-icon" />
          Email del destinatario
        </label>
        <input
          type="email"
          className="form-input"
          placeholder="ejemplo@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {searching && (
          <div className="input-feedback info">
            <div className="skeleton-loader"></div>
            <span>Verificando usuario...</span>
          </div>
        )}
        {destinatario && (
          <div className="input-feedback success">
            <CheckCircleIcon className="feedback-icon" />
            Usuario encontrado: <strong>{destinatario.username}</strong>
          </div>
        )}
        {notFound && EMAIL_REGEX.test(email) && (
          <div className="input-feedback error">
            <ExclamationTriangleIcon className="feedback-icon" />
            Usuario no encontrado
          </div>
        )}
      </div>

      {/* Destinatarios recientes */}
      {!destinatario && (
        <RecentRecipients historial={historial} onSelectRecipient={onSelectRecipient} />
      )}

      {/* Selector de criptomoneda */}
      <div className="form-group">
        <label className="form-label">Criptomoneda</label>
        <CryptoSelector
          criptomonedas={criptomonedas}
          criptoSeleccionada={criptoSeleccionada}
          onSelect={onSelectCrypto}
        />
      </div>

      {/* Campo de cantidad */}
      <div className="form-group">
        <label className="form-label">
          Cantidad
          {criptoSeleccionada && (
            <span className="balance-info">
              Disponible: {getBalanceDisponible()} {criptoSeleccionada.symbol}
            </span>
          )}
        </label>
        <div className="amount-input-wrapper">
          <input
            type="number"
            className="form-input"
            placeholder="0.00"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            step="0.00000001"
            min="0"
          />
          {criptoSeleccionada && (
            <button
              type="button"
              className="max-button"
              onClick={() => setCantidad(getBalanceDisponible().toString())}
            >
              MÁX
            </button>
          )}
        </div>

        {criptoSeleccionada && (
          <div className="percentage-buttons">
            <button
              type="button"
              onClick={() => setPercentageAmount(25)}
              className="percentage-btn"
            >
              25%
            </button>
            <button
              type="button"
              onClick={() => setPercentageAmount(50)}
              className="percentage-btn"
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => setPercentageAmount(75)}
              className="percentage-btn"
            >
              75%
            </button>
            <button
              type="button"
              onClick={() => setPercentageAmount(100)}
              className="percentage-btn"
            >
              100%
            </button>
          </div>
        )}

        {balanceInsuficiente && (
          <div className="input-feedback error">
            <ExclamationTriangleIcon className="feedback-icon" />
            Balance insuficiente
          </div>
        )}
      </div>

      {/* Nota */}
      <div className="form-group">
        <label className="form-label">Nota (opcional)</label>
        <textarea
          className="form-textarea"
          placeholder="Agrega una nota a tu transferencia..."
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows="3"
          maxLength="200"
        />
        <span className="char-count">{nota.length}/200</span>
      </div>
    </div>
  );
}