// src/pages/ResetPassword.jsx
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import authService from '../services/authService';
import '../styles/Login.css';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [codigo, setCodigo] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }

    if (codigo.length < 6) {
      toast.error('El código debe tener al menos 6 dígitos.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(email, codigo, newPassword, confirmPassword);
      toast.success('¡Contraseña restablecida exitosamente! Ya puedes iniciar sesión.');
      navigate('/login');
    } catch (error) {
      console.error('Error al restablecer contraseña:', error);
      toast.error(
        error.response?.data?.error ||
          'Código inválido o expirado. Por favor solicita uno nuevo.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Restablecer Contraseña</h2>
        <p className="login-description">
          Ingresa el código enviado a tu correo y tu nueva contraseña.
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="login-form-group">
            <label htmlFor="codigo" className="login-label">
              Código de Verificación (6 dígitos) *
            </label>
            <input
              type="text"
              id="codigo"
              className="login-input"
              placeholder="123456"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength="6"
              disabled={loading}
              required
              autoFocus
            />
          </div>

          <div className="login-form-group">
            <label htmlFor="newPassword" className="login-label">
              Nueva Contraseña *
            </label>
            <input
              type="password"
              id="newPassword"
              className="login-input"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="login-form-group">
            <label htmlFor="confirmPassword" className="login-label">
              Confirmar Contraseña *
            </label>
            <input
              type="password"
              id="confirmPassword"
              className="login-input"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`login-submit-button ${loading ? 'loading' : ''}`}
          >
            {loading ? 'Restableciendo...' : 'Guardar Nueva Contraseña'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link to="/login" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Cancelar y volver al Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
