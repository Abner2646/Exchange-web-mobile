import React from 'react';
import { getCryptoSymbolById, calcularCantidadCrypto } from '../../../utils/p2pHelpers';
import { canAddMetodoPago } from '../../../utils/validators';

const Paso2ImportePago = ({ 
  formData, 
  criptomonedas,
  metodosPago, 
  onInputChange,
  onToggleMetodoPago 
}) => {
  const cryptoSymbol = getCryptoSymbolById(formData.criptomonedaId, criptomonedas);
  
  const cantidadMinCrypto = calcularCantidadCrypto(
    formData.cantidadMin,
    formData.precioUnitario
  );
  
  const cantidadMaxCrypto = calcularCantidadCrypto(
    formData.cantidadMax,
    formData.precioUnitario
  );

  return (
    <div className="wizard-paso">
      {/* Título */}
      <h3 className="seccion-titulo">
        Especifica el rango que deseas {formData.tipo === 'compra' ? 'comprar' : 'vender'}
      </h3>

      {/* Límite de orden */}
      <div className="form-group">
        <label className="form-label">Límite de orden</label>
        <div className="limite-inputs">
          <div className="limite-input-group">
            <input
              type="number"
              className="form-input"
              placeholder="Mínimo"
              value={formData.cantidadMin}
              onChange={(e) => onInputChange('cantidadMin', e.target.value)}
              step="0.0001"
            />
            <span className="input-suffix">{formData.monedaFiat}</span>
          </div>
          <span className="limite-separador">~</span>
          <div className="limite-input-group">
            <input
              type="number"
              className="form-input"
              placeholder="Máximo"
              value={formData.cantidadMax}
              onChange={(e) => onInputChange('cantidadMax', e.target.value)}
              step="0.0001"
            />
            <span className="input-suffix">{formData.monedaFiat}</span>
          </div>
        </div>
        <div className="limite-hints">
          <span>≈ {cantidadMinCrypto.toFixed(4)} {cryptoSymbol}</span>
          <span>≈ {cantidadMaxCrypto.toFixed(4)} {cryptoSymbol}</span>
        </div>
      </div>

      {/* Dirección de pago (solo para ventas) */}
      {formData.tipo === 'venta' && (
        <div className="form-group">
          <label className="form-label">
            Dirección de pago <span className="campo-requerido">*</span>
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="Ej: alias.mp, CBU, CVU, email PayPal"
            value={formData.direccionFiat}
            onChange={(e) => onInputChange('direccionFiat', e.target.value)}
          />
          <p className="form-hint">
            Obligatorio para ofertas de venta. Ingresa tu CBU, CVU, Alias o email de PayPal.
          </p>
        </div>
      )}

      {/* Método de pago */}
      <div className="form-group">
        <label className="form-label">Método de pago</label>
        <p className="form-hint">Selecciona hasta 5 métodos</p>
        <div className="metodos-grid">
          {metodosPago.map(metodo => {
            const isSelected = formData.metodosPagoIds.includes(metodo.id);
            const canAdd = canAddMetodoPago(formData.metodosPagoIds, 5);
            
            return (
              <button
                key={metodo.id}
                className={`metodo-pill ${isSelected ? 'selected' : ''}`}
                onClick={() => onToggleMetodoPago(metodo.id)}
                disabled={!isSelected && !canAdd}
              >
                {isSelected && <span className="check-icon">✓</span>}
                {metodo.nombre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tiempo límite del pago */}
      <div className="form-group">
        <label className="form-label">Tiempo límite del pago</label>
        <select
          className="form-select"
          value={formData.tiempoLimite}
          onChange={(e) => onInputChange('tiempoLimite', e.target.value)}
        >
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>60 min</option>
        </select>
      </div>
    </div>
  );
};

export default Paso2ImportePago;