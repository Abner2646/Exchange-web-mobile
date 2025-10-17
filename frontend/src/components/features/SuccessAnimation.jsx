// src/components/features/SuccessAnimation.jsx
import { CheckCircleIcon } from '@heroicons/react/24/outline';

export default function SuccessAnimation({ show }) {
  if (!show) return null;

  return (
    <div className="success-overlay">
      <div className="success-animation">
        <div className="success-checkmark">
          <CheckCircleIcon className="success-icon" />
        </div>
        <h2 className="success-title">¡Transferencia Exitosa!</h2>
        <p className="success-message">Tu transferencia se ha completado correctamente</p>
      </div>
    </div>
  );
}