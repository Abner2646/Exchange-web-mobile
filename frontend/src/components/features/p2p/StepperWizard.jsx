import React from 'react';

const StepperWizard = ({ pasoActual }) => {
  const pasos = [
    { numero: 1, texto: 'Establecer tipo y precio' },
    { numero: 2, texto: 'Establecer importe y método de pago' },
    { numero: 3, texto: 'Condiciones y confirmación' },
  ];

  return (
    <div className="stepper-wizard">
      {pasos.map((paso, index) => (
        <React.Fragment key={paso.numero}>
          <div className={`paso ${pasoActual >= paso.numero ? 'active' : ''}`}>
            <div className="paso-numero">{paso.numero}</div>
            <span className="paso-texto">{paso.texto}</span>
          </div>
          {index < pasos.length - 1 && <div className="paso-linea"></div>}
        </React.Fragment>
      ))}
    </div>
  );
};

export default StepperWizard;