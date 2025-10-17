// src/components/common/Toast.jsx
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function Toast({ message, type, onClose }) {
  if (!message) return null;

  return (
    <div className={`toast toast-${type}`}>
      {type === 'success' && <CheckCircleIcon className="toast-icon" />}
      {type === 'error' && <ExclamationTriangleIcon className="toast-icon" />}
      <span>{message}</span>
      <button className="toast-close" onClick={onClose}>
        <XMarkIcon className="toast-close-icon" />
      </button>
    </div>
  );
}