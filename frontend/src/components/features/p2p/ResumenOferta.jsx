import React from 'react';
import { getCryptoSymbolById, formatearPrecio } from '../../../utils/p2pHelpers';

const ResumenOferta = ({ formData, criptomonedas }) => {
  const cryptoSymbol = getCryptoSymbolById(formData.criptomonedaId, criptomonedas);

  return (
    <div className="resumen-oferta">
      <h3 className="resumen-titulo">Resumen de tu oferta</h3>
      
      <div className="resumen-item">
        <span>Tipo:</span>
        <strong>{formData.tipo === 'compra' ? 'Compra' : 'Venta'}</strong>
      </div>
      
      <div className="resumen-item">
        <span>Criptomoneda:</span>
        <strong>{cryptoSymbol}</strong>
      </div>
      
      <div className="resumen-item">
        <span>Precio:</span>
        <strong>{formatearPrecio(formData.precioUnitario, 2)} {formData.monedaFiat}</strong>
      </div>
      
      <div className="resumen-item">
        <span>Rango:</span>
        <strong>{formData.cantidadMin} - {formData.cantidadMax} {formData.monedaFiat}</strong>
      </div>
      
      <div className="resumen-item">
        <span>Métodos de pago:</span>
        <strong>{formData.metodosPagoIds.length} seleccionados</strong>
      </div>
      
      {formData.tipo === 'venta' && formData.direccionFiat && (
        <div className="resumen-item">
          <span>Dirección de pago:</span>
          <strong>{formData.direccionFiat}</strong>
        </div>
      )}
    </div>
  );
};

export default ResumenOferta;