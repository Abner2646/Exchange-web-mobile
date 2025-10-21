// src/pages/Register.jsx
import { useAuth } from '../context/AuthContext';
import { useRegister } from '../hooks/useRegister';
import '../styles/Register.css';

const Register = () => {
  const { loginWithGoogle } = useAuth();
  const {
    formData,
    validationErrors,
    isLoading,
    handleChange,
    handleSubmit,
  } = useRegister();

  const handleGoogleLogin = () => {
    loginWithGoogle();
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <h2 className="register-title">Crear Cuenta</h2>

        <p className="register-description">
          Únete a la plataforma de trading
        </p>

        {/* Botón de Google */}
        <button onClick={handleGoogleLogin} className="register-google-button">
          <svg className="register-google-icon" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Registrarse con Google
        </button>

        {/* Separador */}
        <div className="register-divider">
          <span>o</span>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="register-form">
          <div className="register-form-group">
            <label htmlFor="email" className="register-label">
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className={`register-input ${validationErrors.email ? 'error' : ''}`}
              placeholder="tu@email.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
            {validationErrors.email && (
              <span className="register-field-error">{validationErrors.email}</span>
            )}
          </div>

          <div className="register-form-group">
            <label htmlFor="username" className="register-label">
              Usuario *
            </label>
            <input
              type="text"
              id="username"
              name="username"
              className={`register-input ${validationErrors.username ? 'error' : ''}`}
              placeholder="Elige tu nombre de usuario"
              value={formData.username}
              onChange={handleChange}
              required
            />
            {validationErrors.username && (
              <span className="register-field-error">{validationErrors.username}</span>
            )}
          </div>

          <div className="register-form-group">
            <label htmlFor="password" className="register-label">
              Contraseña *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              className={`register-input ${validationErrors.password ? 'error' : ''}`}
              placeholder="Mínimo 8 caracteres"
              value={formData.password}
              onChange={handleChange}
              required
            />
            {validationErrors.password && (
              <span className="register-field-error">{validationErrors.password}</span>
            )}
          </div>

          <div className="register-form-group">
            <label htmlFor="confirmPassword" className="register-label">
              Confirmar Contraseña *
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className={`register-input ${validationErrors.confirmPassword ? 'error' : ''}`}
              placeholder="Repite tu contraseña"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
            {validationErrors.confirmPassword && (
              <span className="register-field-error">
                {validationErrors.confirmPassword}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`register-submit-button ${isLoading ? 'loading' : ''}`}
          >
            {isLoading ? (
              <>
                <span className="register-spinner"></span>
                Creando cuenta...
              </>
            ) : (
              'Crear Cuenta'
            )}
          </button>

          {/* Mensaje de términos */}
          <p className="register-terms-message">
            Al registrarte, aceptas nuestros{' '}
            <a href="/terminos-y-condiciones" className="register-terms-link">
              términos y condiciones
            </a>
          </p>
        </form>

        {/* Footer con enlace de login */}
        <div className="register-terms">
          <p>
            ¿Ya tienes cuenta?
            <a href="/login" className="register-login-link">
              Inicia Sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;