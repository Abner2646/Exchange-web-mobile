// src/components/common/ErrorState.jsx
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import '../../styles/ErrorState.css';

const ErrorState = ({ 
  title = 'Oops, algo salió mal',
  message = 'No pudimos cargar esta información. Por favor, intenta nuevamente.',
  onRetry 
}) => {
  return (
    <div className="errorstate-container">
      <div className="errorstate-icon-wrapper">
        <ExclamationTriangleIcon className="errorstate-icon" />
      </div>
      <h3 className="errorstate-title">{title}</h3>
      <p className="errorstate-message">{message}</p>
      {onRetry && (
        <button className="errorstate-btn" onClick={onRetry}>
          <ArrowPathIcon className="errorstate-btn-icon" />
          Intentar nuevamente
        </button>
      )}
    </div>
  );
};

export default ErrorState;