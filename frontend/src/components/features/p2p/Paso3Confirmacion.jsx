import React from 'react';
import ResumenOferta from './ResumenOferta';

const Paso3Confirmacion = ({ formData, criptomonedas, onInputChange }) => {
  return (
    <div className="wizard-paso">
      <div className="form-group">
        <label className="form-label">Condiciones adicionales (opcional)</label>
        <textarea
          className="form-textarea"
          placeholder="Ej: Solo titulares, respuesta en 10 min, etc."
          value={formData.condicionesAdicionales}
          onChange={(e) => onInputChange('condicionesAdicionales', e.target.value)}
          rows={5}
        />
        <p className="form-hint">Agrega condiciones específicas para tu oferta</p>
      </div>

      {/* Resumen de la oferta */}
      <ResumenOferta formData={formData} criptomonedas={criptomonedas} />
    </div>
  );
};

export default Paso3Confirmacion;