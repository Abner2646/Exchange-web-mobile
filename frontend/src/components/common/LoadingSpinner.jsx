// src/components/common/LoadingSpinner.jsx
import '../../styles/LoadingSpinner.css';

const LoadingSpinner = ({ size = 'md', message }) => {
  return (
    <div className="loadingspinner-container">
      <div className={`loadingspinner-spinner loadingspinner-spinner-${size}`}></div>
      {message && <p className="loadingspinner-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner;