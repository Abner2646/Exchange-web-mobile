import React from 'react';
import { formatearPrecio } from '../../utils/p2pHelpers';
import { 
  obtenerRolUsuario, 
  obtenerTextoRol,
  obtenerContraparte,
  puedeConfirmarPago,
  puedeLiberarCriptos,
  puedeCancelarTransaccion,
} from '../../utils/p2pTransactionHelpers';

/**
 * Componente individual de transacción P2P
 */
const MyTransaccionItem = ({ 
  transaccion, 
  userId,
  onViewDetails,
  onConfirmPayment,
  onReleaseCryptos,
  onCancel,
  isConfirmingPayment,
  isReleasingCryptos,
  isCancelling,
}) => {
  const userRole = obtenerRolUsuario(transaccion, userId);
  const isBuyer = userRole === 'buyer';
  const contraparte = obtenerContraparte(transaccion, userId);
  
  const showConfirmPayment = puedeConfirmarPago(transaccion, userId);
  const showReleaseCryptos = puedeLiberarCriptos(transaccion, userId);
  const showCancel = puedeCancelarTransaccion(transaccion.estado);

  return (
    <div className="my-p2p-list-item">
      <div className="my-p2p-item-header">
        <div>
          <div className="my-p2p-item-title">
            {isBuyer ? 'Compra' : 'Venta'} de {formatearPrecio(transaccion.cantidad, 8)} {transaccion.criptomoneda?.symbol}
          </div>
          <div className="my-p2p-item-subtitle">
            {contraparte?.rol}: {contraparte?.username}
          </div>
        </div>
        <div className={`my-p2p-item-badge my-p2p-badge-${userRole}`}>
          {obtenerTextoRol(userRole)}
        </div>
      </div>

      <div className="my-p2p-item-details">
        <div className="my-p2p-detail-item">
          <span className="my-p2p-detail-label">Estado</span>
          <span className={`my-p2p-item-badge my-p2p-badge-${transaccion.estado}`}>
            {transaccion.estado}
          </span>
        </div>
        <div className="my-p2p-detail-item">
          <span className="my-p2p-detail-label">Monto Total</span>
          <span className="my-p2p-detail-value">
            {formatearPrecio(transaccion.montoFiat, 2)} {transaccion.monedaFiat}
          </span>
        </div>
        <div className="my-p2p-detail-item">
          <span className="my-p2p-detail-label">Cantidad</span>
          <span className="my-p2p-detail-value">
            {formatearPrecio(transaccion.cantidad, 8)} {transaccion.criptomoneda?.symbol}
          </span>
        </div>
        <div className="my-p2p-detail-item">
          <span className="my-p2p-detail-label">Fecha</span>
          <span className="my-p2p-detail-value">
            {new Date(transaccion.created_at).toLocaleDateString('es-AR')}
          </span>
        </div>
      </div>

      <div className="my-p2p-item-actions">
        {/* Botón para ver detalles */}
        <button 
          className="my-p2p-btn my-p2p-btn-secondary"
          onClick={() => onViewDetails(transaccion.id)}
        >
          Ver Detalles
        </button>

        {/* Confirmar pago (comprador + estado iniciada) */}
        {showConfirmPayment && (
          <button 
            className="my-p2p-btn my-p2p-btn-success"
            onClick={() => onConfirmPayment(transaccion.id)}
            disabled={isConfirmingPayment}
          >
            Confirmar Pago
          </button>
        )}

        {/* Liberar criptos (vendedor + estado pago_confirmado) */}
        {showReleaseCryptos && (
          <button 
            className="my-p2p-btn my-p2p-btn-primary"
            onClick={() => onReleaseCryptos(transaccion.id)}
            disabled={isReleasingCryptos}
          >
            Liberar Criptomonedas
          </button>
        )}

        {/* Cancelar (ambos roles si estado lo permite) */}
        {showCancel && (
          <button 
            className="my-p2p-btn my-p2p-btn-warning"
            onClick={() => onCancel(transaccion.id)}
            disabled={isCancelling}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
};

export default MyTransaccionItem;