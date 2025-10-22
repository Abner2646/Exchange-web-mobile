// src/pages/VerificarEmail.jsx
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEmailVerification } from '../hooks/useEmailVerification';
import { toast } from 'react-hot-toast';
import '../styles/VerificarEmail.css';

const VerificarEmail = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Obtener email del state o del usuario autenticado
  const email = location.state?.email || user?.email || '';

  // Estado del código (6 dígitos)
  const [codigo, setCodigo] = useState('');

  // Hook de verificación
  const {
    verifyEmail,
    resendCode,
    skipVerification,
    isVerifying,
    isResending,
    canResend,
    resendCountdown,
  } = useEmailVerification();

  // ⭐ Verificar si el email ya está verificado al cargar la página
  useEffect(() => {
    // Si el usuario ya tiene el email verificado, redirigir a home
    if (user?.emailVerificado) {
      toast.success('Tu email ya está verificado', {
        duration: 3000,
        icon: '✅',
      });
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Handler del formulario
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (codigo.length !== 6) {
      return;
    }

    verifyEmail(codigo);
  };

  // Handler para cambio de input
  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCodigo(value);
  };

  // Handler para reenviar código
  const handleResend = () => {
    if (!canResend) return;
    resendCode();
  };

  // Estado de carga combinado
  const loading = isVerifying || isResending;

  return (
    <div className="verifyemail-container">
      <div className="verifyemail-card">
        {/* Icono de email */}
        <div className="verifyemail-icon">
          <svg
            className="verifyemail-icon-svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Título */}
        <h2 className="verifyemail-title">Verifica tu Email</h2>

        {/* Descripción */}
        <p className="verifyemail-description">
          Hemos enviado un código de verificación de 6 dígitos a
        </p>
        <p className="verifyemail-email">{email}</p>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="verifyemail-form">
          <div className="verifyemail-form-group">
            <label htmlFor="codigo" className="verifyemail-label">
              Código de verificación
            </label>
            <input
              type="text"
              id="codigo"
              className="verifyemail-input"
              placeholder="000000"
              value={codigo}
              onChange={handleCodeChange}
              maxLength="6"
              autoComplete="one-time-code"
              autoFocus
              disabled={loading}
              required
            />
            <p className="verifyemail-hint">
              Ingresa el código de 6 dígitos que recibiste
            </p>
          </div>

          {/* Botón verificar */}
          <button
            type="submit"
            disabled={loading || codigo.length !== 6}
            className={`verifyemail-submit-button ${loading ? 'loading' : ''}`}
          >
            {isVerifying ? (
              <>
                <span className="verifyemail-spinner"></span>
                Verificando...
              </>
            ) : (
              'Verificar Email'
            )}
          </button>
        </form>

        {/* Acciones adicionales */}
        <div className="verifyemail-actions">
          {/* Reenviar código */}
          <button
            type="button"
            onClick={handleResend}
            disabled={!canResend || loading}
            className="verifyemail-resend-button"
          >
            {isResending ? (
              <>
                <span className="verifyemail-spinner-small"></span>
                Enviando...
              </>
            ) : !canResend ? (
              `Reenviar en ${resendCountdown}s`
            ) : (
              'Reenviar código'
            )}
          </button>

          {/* Separador */}
          <span className="verifyemail-separator">•</span>

          {/* Verificar más tarde */}
          <button
            type="button"
            onClick={skipVerification}
            disabled={loading}
            className="verifyemail-skip-button"
          >
            Verificar más tarde
          </button>
        </div>

        {/* Info adicional */}
        <div className="verifyemail-info">
          <p className="verifyemail-info-text">
            <svg
              className="verifyemail-info-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Revisa tu bandeja de spam si no encuentras el email
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificarEmail;