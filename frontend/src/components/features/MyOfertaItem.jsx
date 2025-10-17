import React from 'react';
import { formatearPrecio } from '../../utils/p2pHelpers';

/**
 * Componente individual de oferta propia
 */
const MyOfertaItem = ({ oferta, onToggle, isToggling }) => {
  return (
    <div className="my-p2p-list-item">
      <div className="my-p2p-item-header">
        <div>
          <div className="my-p2p-item-title">
            {oferta.tipo === 'venta' ? 'Venta' : 'Compra'} de {oferta.criptomoneda?.symbol}
          </div>
          <div className="my-p2p-item-subtitle">
            Precio: {formatearPrecio(oferta.precioUnitario, 2)} {oferta.monedaFiat} • Rango: {formatearPrecio(oferta.cantidadMin, 8)} - {formatearPrecio(oferta.cantidadMax, 8)} {oferta.criptomoneda?.symbol}
          </div>
        </div>
        <div className={`my-p2p-item-badge ${
          oferta.activa ? 'my-p2p-badge-active' : 'my-p2p-badge-inactive'
        }`}>
          {oferta.activa ? 'Activa' : 'Inactiva'}
        </div>
      </div>

      <div className="my-p2p-item-details">
        <div className="my-p2p-detail-item">
          <span className="my-p2p-detail-label">Tipo</span>
          <span className="my-p2p-detail-value">
            {oferta.tipo === 'venta' ? 'Venta' : 'Compra'}
          </span>
        </div>
        <div className="my-p2p-detail-item">
          <span className="my-p2p-detail-label">Precio Unitario</span>
          <span className="my-p2p-detail-value">
            {formatearPrecio(oferta.precioUnitario, 2)} {oferta.monedaFiat}
          </span>
        </div>
        <div className="my-p2p-detail-item">
          <span className="my-p2p-detail-label">Rango</span>
          <span className="my-p2p-detail-value">
            {formatearPrecio(oferta.cantidadMin, 8)} - {formatearPrecio(oferta.cantidadMax, 8)} {oferta.criptomoneda?.symbol}
          </span>
        </div>
        <div className="my-p2p-detail-item">
          <span className="my-p2p-detail-label">Métodos de Pago</span>
          <span className="my-p2p-detail-value">
            {oferta.metodosPago?.length || 0} métodos
          </span>
        </div>
      </div>

      <div className="my-p2p-item-actions">
        <button 
          className={`my-p2p-btn ${
            oferta.activa ? 'my-p2p-btn-warning' : 'my-p2p-btn-success'
          }`}
          onClick={() => onToggle(oferta.id)}
          disabled={isToggling}
        >
          {oferta.activa ? 'Desactivar' : 'Activar'}
        </button>
        {oferta.condicionesAdicionales && (
          <button className="my-p2p-btn my-p2p-btn-secondary">
            Ver Condiciones
          </button>
        )}
      </div>
    </div>
  );
};

export default MyOfertaItem;