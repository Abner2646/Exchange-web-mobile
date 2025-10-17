// src/components/features/VerificationModal.jsx
import { useState } from 'react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export default function VerificationModal({
  show,
  onClose,
  onVerify,
  onResend,
  verifying,
  error,
}) {
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);

  const handleCodeInput = (index, value) => {
    if (value.length > 1) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`)?.focus();
    }

    console.log('🔢 Código ingresado:', newCode.join(''));
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setVerificationCode(newCode);

    const lastIndex = Math.min(pastedData.length, 5);
    document.getElementById(`code-${lastIndex}`)?.focus();

    console.log('📋 Código pegado:', newCode.join(''));
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      document.getElementById(`code-${index - 1}`)?.focus();
    }
  };

  const handleVerify = () => {
    const codigo = verificationCode.join('');
    onVerify(codigo);
  };

  const handleClose = () => {
    setVerificationCode(['', '', '', '', '', '']);
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={handleClose}>
          <XMarkIcon className="close-icon" />
        </button>

        <div className="modal-header">
          <h2 className="modal-title">Verificar Transferencia</h2>
          <p className="modal-description">
            Ingresa el código de 6 dígitos que enviamos a tu email
          </p>
        </div>

        <div className="verification-code-inputs">
          {verificationCode.map((digit, index) => (
            <input
              key={index}
              id={`code-${index}`}
              type="text"
              maxLength="1"
              className="code-input"
              value={digit}
              onChange={(e) => handleCodeInput(index, e.target.value)}
              onKeyDown={(e) => handleCodeKeyDown(index, e)}
              onPaste={handleCodePaste}
            />
          ))}
        </div>

        {error && (
          <div className="modal-error">
            <ExclamationTriangleIcon className="error-icon" />
            {error}
          </div>
        )}

        <button
          className="modal-submit-button"
          onClick={handleVerify}
          disabled={verifying || verificationCode.join('').length !== 6}
        >
          {verifying ? 'Verificando...' : 'Confirmar Transferencia'}
        </button>

        <button className="modal-resend-button" onClick={onResend}>
          Reenviar código
        </button>
      </div>
    </div>
  );
}