// src/pages/ForgotPassword.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import authService from '../services/authService';
import '../styles/Login.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    try {
      const res = await authService.requestPasswordReset(email);
      toast.success(res.message || 'Código de recuperación enviado si el email está registrado.', {
        duration: 6000,
      });
      // Redirigir al paso 2 con el email pre-completado
      navigate(`/reset-password?email=${encodeURIComponent(email)}`);
    } catch (error) {
      console.error('Error al solicitar recuperación:', error);
      toast.error(
        error.response?.data?.error ||
          'Error al procesar la solicitud. Por favor intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Recuperar Contraseña</h2>
        <p className="login-description">
          Ingresa tu correo electrónico y te enviaremos un código de verificación para restablecer tu contraseña.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-form-group">
            <label htmlFor="email" className="login-label">
              Correo Electrónico *
            </label>
            <input
              type="email"
              id="email"
              className="login-input"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`login-submit-button ${loading ? 'loading' : ''}`}
          >
            {loading ? 'Enviando código...' : 'Enviar Código de Recuperación'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link to="/login" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Volver a Iniciar Sesión
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
