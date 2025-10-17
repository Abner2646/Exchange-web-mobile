// src/components/features/PasswordChangeForm.jsx
import { useState } from 'react';

const PasswordChangeForm = ({ onSubmit, isLoading, onCancel }) => {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('[PasswordChangeForm] Formulario enviado');
    onSubmit(passwordForm);
  };

  const handleChange = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="configuracion-password-form">
      <div className="configuracion-field">
        <label className="configuracion-label">Contraseña actual</label>
        <input
          type="password"
          value={passwordForm.currentPassword}
          onChange={(e) => handleChange('currentPassword', e.target.value)}
          required
          className="configuracion-input"
        />
      </div>

      <div className="configuracion-field">
        <label className="configuracion-label">Nueva contraseña</label>
        <input
          type="password"
          value={passwordForm.newPassword}
          onChange={(e) => handleChange('newPassword', e.target.value)}
          required
          minLength="6"
          className="configuracion-input"
        />
      </div>

      <div className="configuracion-field">
        <label className="configuracion-label">Confirmar nueva contraseña</label>
        <input
          type="password"
          value={passwordForm.confirmPassword}
          onChange={(e) => handleChange('confirmPassword', e.target.value)}
          required
          className="configuracion-input"
        />
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          type="submit"
          disabled={isLoading}
          className={`configuracion-btn-primary ${isLoading ? 'loading' : ''}`}
        >
          {isLoading ? 'Guardando...' : 'Actualizar Contraseña'}
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="configuracion-btn-secondary"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default PasswordChangeForm;