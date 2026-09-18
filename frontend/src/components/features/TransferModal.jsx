// src/components/features/TransferModal.jsx
import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { ArrowsRightLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import balanceService from '../../services/balanceService';
import LoadingSpinner from '../common/LoadingSpinner';
import '../../styles/TransferModal.css';

/**
 * Modal para transferir fondos entre los compartimentos Funding (Billetera Principal)
 * y Spot (Billetera de Trading) del usuario autenticado.
 */
const TransferModal = ({
  isOpen,
  onClose,
  onSuccess,
  defaultCryptoId,
  defaultFrom = 'funding',
  defaultTo = 'spot',
  balances: propBalances = [],
}) => {
  const queryClient = useQueryClient();
  const [fromCompartment, setFromCompartment] = useState(defaultFrom);
  const [toCompartment, setToCompartment] = useState(defaultTo);
  const [selectedCryptoId, setSelectedCryptoId] = useState(defaultCryptoId || '');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [internalBalances, setInternalBalances] = useState([]);

  // Cargar balances si no vienen por prop
  useEffect(() => {
    if (isOpen) {
      if (propBalances && propBalances.length > 0) {
        setInternalBalances(propBalances);
      } else {
        balanceService.getMyBalances()
          .then((data) => setInternalBalances(data || []))
          .catch((err) => console.error('Error cargando balances para transfer:', err));
      }
    }
  }, [isOpen, propBalances]);

  // Sincronizar crypto seleccionada por defecto
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setAmount('');
      setFromCompartment(defaultFrom);
      setToCompartment(defaultTo);

      if (defaultCryptoId) {
        setSelectedCryptoId(defaultCryptoId);
      } else if (internalBalances.length > 0 && !selectedCryptoId) {
        // Preferir USDT o BTC o el primero
        const usdt = internalBalances.find((b) => (b.crypto?.symbol || b.symbol) === 'USDT');
        const btc = internalBalances.find((b) => (b.crypto?.symbol || b.symbol) === 'BTC');
        const defaultItem = usdt || btc || internalBalances[0];
        if (defaultItem) {
          setSelectedCryptoId(defaultItem.criptomonedaId || defaultItem.cryptoId || defaultItem.id);
        }
      }
    }
  }, [isOpen, defaultCryptoId, defaultFrom, defaultTo, internalBalances]);

  // Buscar objeto de balance para la crypto seleccionada
  const currentBalance = useMemo(() => {
    if (!selectedCryptoId || !internalBalances.length) return null;
    return internalBalances.find(
      (b) => (b.criptomonedaId || b.cryptoId || b.id) === selectedCryptoId
    );
  }, [selectedCryptoId, internalBalances]);

  // Símbolo de la crypto seleccionada
  const currentSymbol = useMemo(() => {
    return currentBalance?.crypto?.symbol || currentBalance?.symbol || 'Crypto';
  }, [currentBalance]);

  // Saldo disponible en el compartimento origen
  const availableInOrigin = useMemo(() => {
    if (!currentBalance) return '0.00000000';
    if (fromCompartment === 'funding') {
      return currentBalance.compartments?.funding?.available || currentBalance.availableBalance || '0';
    } else {
      return currentBalance.compartments?.spot?.available || '0';
    }
  }, [currentBalance, fromCompartment]);

  // Invertir sentido de transferencia
  const handleSwapDirection = () => {
    setFromCompartment(toCompartment);
    setToCompartment(fromCompartment);
    setAmount('');
    setError(null);
  };

  // Botón MAX
  const handleMaxAmount = () => {
    const cleanAvailable = parseFloat(availableInOrigin) || 0;
    if (cleanAvailable > 0) {
      setAmount(String(availableInOrigin));
      setError(null);
    }
  };

  // Validar y ejecutar transferencia
  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    const numAvailable = parseFloat(availableInOrigin) || 0;

    if (!selectedCryptoId) {
      setError('Por favor selecciona una criptomoneda');
      return;
    }

    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Ingresa un monto válido mayor a 0');
      return;
    }

    if (numAmount > numAvailable) {
      setError(`Saldo insuficiente en ${fromCompartment.toUpperCase()}. Disponible: ${availableInOrigin} ${currentSymbol}`);
      return;
    }

    try {
      setLoading(true);
      await balanceService.transferCompartments({
        cryptoId: selectedCryptoId,
        amount: String(amount),
        from: fromCompartment,
        to: toCompartment,
      });

      toast.success(
        `¡Transferencia de ${amount} ${currentSymbol} a ${toCompartment.toUpperCase()} completada! 🎉`
      );

      // Invalidar cache de balances en React Query
      queryClient.invalidateQueries('myBalances');
      queryClient.invalidateQueries('tradingBalance');

      if (onSuccess) {
        onSuccess({
          cryptoId: selectedCryptoId,
          amount,
          from: fromCompartment,
          to: toCompartment,
        });
      }

      onClose();
    } catch (err) {
      console.error('Error en transferencia entre compartimentos:', err);
      const msg =
        err.errorMessage ||
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Error al realizar la transferencia';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const compartmentLabels = {
    funding: 'Funding (Billetera Principal)',
    spot: 'Spot (Billetera de Trading)',
  };

  return (
    <div className="transfer-modal-overlay" onClick={onClose}>
      <div className="transfer-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="transfer-modal-header">
          <h2 className="transfer-modal-title">
            <ArrowsRightLeftIcon style={{ width: '1.5rem', height: '1.5rem', color: '#38bdf8' }} />
            Transferir entre Billeteras
          </h2>
          <button className="transfer-modal-close-btn" onClick={onClose} disabled={loading}>
            <XMarkIcon style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>

        {/* Body */}
        <div className="transfer-modal-body">
          {/* Selector de Dirección Funding <-> Spot */}
          <div className="transfer-direction-card">
            <div className="transfer-compartment-box">
              <span className="transfer-compartment-label">Desde</span>
              <span className="transfer-compartment-name">
                {compartmentLabels[fromCompartment]}
              </span>
            </div>

            <button
              type="button"
              className="transfer-switch-btn"
              onClick={handleSwapDirection}
              disabled={loading}
              title="Invertir dirección"
            >
              <ArrowsRightLeftIcon style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>

            <div className="transfer-compartment-box" style={{ textAlign: 'right' }}>
              <span className="transfer-compartment-label">Hacia</span>
              <span className="transfer-compartment-name" style={{ justifyContent: 'flex-end' }}>
                {compartmentLabels[toCompartment]}
              </span>
            </div>
          </div>

          {/* Selector de Criptomoneda */}
          <div className="transfer-form-group">
            <label className="transfer-form-label">Criptomoneda</label>
            <select
              className="transfer-select"
              value={selectedCryptoId}
              onChange={(e) => {
                setSelectedCryptoId(e.target.value);
                setAmount('');
                setError(null);
              }}
              disabled={loading}
            >
              {internalBalances.map((b) => {
                const id = b.criptomonedaId || b.cryptoId || b.id;
                const sym = b.crypto?.symbol || b.symbol || '???';
                const name = b.crypto?.nombre || b.crypto?.name || sym;
                return (
                  <option key={id} value={id}>
                    {sym} - {name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Input de Monto */}
          <div className="transfer-form-group">
            <div className="transfer-form-label">
              <span>Importe a transferir</span>
              <span className="transfer-balance-value">
                Disponible: {availableInOrigin} {currentSymbol}
              </span>
            </div>

            <div className="transfer-amount-wrapper">
              <input
                type="number"
                step="any"
                min="0"
                className="transfer-amount-input"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                disabled={loading}
              />
              <div className="transfer-amount-actions">
                <button
                  type="button"
                  className="transfer-max-btn"
                  onClick={handleMaxAmount}
                  disabled={loading}
                >
                  MAX
                </button>
                <span className="transfer-amount-symbol">{currentSymbol}</span>
              </div>
            </div>

            <div className="transfer-balance-hint">
              <span>Transferencia instantánea sin comisiones</span>
              <span>Cero fees internos</span>
            </div>
          </div>

          {/* Mensaje de error si hay */}
          {error && <p className="transfer-error-text">{error}</p>}
        </div>

        {/* Footer actions */}
        <div className="transfer-modal-actions">
          <button
            type="button"
            className="transfer-btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="transfer-btn-confirm"
            onClick={handleSubmit}
            disabled={loading || !amount || parseFloat(amount) <= 0}
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Confirmar Transferencia'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransferModal;
