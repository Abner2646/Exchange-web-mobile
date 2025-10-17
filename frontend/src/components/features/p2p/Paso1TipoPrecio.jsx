import React from 'react';
import { getCryptoSymbolById, formatearPrecio } from '../../../utils/p2pHelpers';

const Paso1TipoPrecio = ({ formData, criptomonedas, onInputChange }) => {
  const cryptoSymbol = getCryptoSymbolById(formData.criptomonedaId, criptomonedas);

  return (
    <div className="wizard-paso">
      {/* Tabs Quiero comprar / Quiero vender */}
      <div className="tipo-tabs">
        <button
          className={`tipo-tab ${formData.tipo === 'compra' ? 'active' : ''}`}
          onClick={() => onInputChange('tipo', 'compra')}
        >
          Quiero comprar
        </button>
        <button
          className={`tipo-tab ${formData.tipo === 'venta' ? 'active' : ''}`}
          onClick={() => onInputChange('tipo', 'venta')}
        >
          Quiero vender
        </button>
      </div>

      <div className="form-row">
        {/* Activo (Criptomoneda) */}
        <div className="form-group">
          <label className="form-label">Activo</label>
          <select
            className="form-select"
            value={formData.criptomonedaId}
            onChange={(e) => onInputChange('criptomonedaId', e.target.value)}
          >
            {criptomonedas.map(crypto => (
              <option key={crypto.id} value={crypto.id}>
                {crypto.symbol} - {crypto.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Moneda Fiat */}
        <div className="form-group">
          <label className="form-label">Con fiat</label>
          <select
            className="form-select"
            value={formData.monedaFiat}
            onChange={(e) => onInputChange('monedaFiat', e.target.value)}
          >
            <option value="ARS">ARS - Peso argentino</option>
            <option value="USD">USD - Dólar</option>
            <option value="EUR">EUR - Euro</option>
          </select>
        </div>
      </div>

      {/* Precio */}
      <div className="form-group">
        <label className="form-label">Precio unitario</label>
        <div className="precio-input-wrapper">
          <input
            type="number"
            className="form-input precio-input"
            placeholder="Ingresa el precio"
            value={formData.precioUnitario}
            onChange={(e) => onInputChange('precioUnitario', e.target.value)}
            step="0.01"
          />
          <span className="precio-moneda">{formData.monedaFiat}</span>
        </div>
        <p className="form-hint">
          Precio: {formData.precioUnitario ? formatearPrecio(formData.precioUnitario, 2) : '0'} {formData.monedaFiat} por {cryptoSymbol}
        </p>
      </div>
    </div>
  );
};

export default Paso1TipoPrecio;