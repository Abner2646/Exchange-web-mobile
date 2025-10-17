// src/pages/ConfiguracionPerfil.jsx
import { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import useProfile from '../hooks/useProfile';
import PasswordChangeForm from '../components/features/PasswordChangeForm';
import TwoFactorSection from '../components/features/TwoFactorSection';
import SecurityActivity from '../components/features/SecurityActivity';
import '../styles/ConfiguracionPerfil.css';

const ConfiguracionPerfil = () => {
  const { themeMode } = useTheme();
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Hook con React Query
  const {
    profile,
    isLoading,
    changePassword,
    toggle2FA,
    isChangingPassword,
    isToggling2FA,
    passwordChanged,
  } = useProfile();

  console.log('[ConfiguracionPerfil] Component state:', {
    profile,
    isLoading,
    showPasswordForm,
  });

  // Cerrar formulario de contraseña cuando se cambia exitosamente
  useEffect(() => {
    if (passwordChanged) {
      console.log('[ConfiguracionPerfil] Contraseña cambiada, cerrando formulario');
      setShowPasswordForm(false);
    }
  }, [passwordChanged]);

  const handlePasswordSubmit = (passwordForm) => {
    console.log('[ConfiguracionPerfil] Enviando cambio de contraseña');
    changePassword(passwordForm);
  };

  const handleToggle2FA = () => {
    console.log('[ConfiguracionPerfil] Toggle 2FA clicked');
    toggle2FA();
  };

  const handleCancelPasswordChange = () => {
    console.log('[ConfiguracionPerfil] Cancelando cambio de contraseña');
    setShowPasswordForm(false);
  };

  return (
    <div className="configuracion-perfil">
      {/* Header */}
      <header className="configuracion-header">
        <h1 className="configuracion-title">Configuración del Perfil</h1>
        <p className="configuracion-subtitle">
          Gestiona tu cuenta y configuraciones de seguridad
        </p>
      </header>

      {/* Grid principal */}
      <div className="configuracion-grid">
        {/* Información del Perfil */}
        <div className="configuracion-card">
          <h3 className="configuracion-card-title">Información Personal</h3>

          {isLoading ? (
            // Loading skeleton
            <div className="configuracion-form-group">
              <div className="configuracion-field">
                <div className="skeleton-label"></div>
                <div className="skeleton-input"></div>
              </div>
              <div className="configuracion-field">
                <div className="skeleton-label"></div>
                <div className="skeleton-input"></div>
              </div>
              <div className="configuracion-field">
                <div className="skeleton-label"></div>
                <div className="skeleton-input"></div>
              </div>
            </div>
          ) : (
            <div className="configuracion-form-group">
              <div className="configuracion-field">
                <label className="configuracion-label">Nombre completo</label>
                <input
                  type="text"
                  value={profile?.name || ''}
                  readOnly
                  className="configuracion-input configuracion-input-readonly"
                />
              </div>

              <div className="configuracion-field">
                <label className="configuracion-label">Email</label>
                <input
                  type="email"
                  value={profile?.email || ''}
                  readOnly
                  className="configuracion-input configuracion-input-readonly"
                />
              </div>

              <div className="configuracion-field">
                <label className="configuracion-label">Teléfono</label>
                <input
                  type="tel"
                  value={profile?.phone || ''}
                  readOnly
                  className="configuracion-input configuracion-input-readonly"
                />
              </div>
            </div>
          )}
        </div>

        {/* Configuración de Seguridad */}
        <div className="configuracion-card">
          <h3 className="configuracion-card-title">Configuración de Seguridad</h3>

          {/* 2FA Toggle */}
          {!isLoading && profile && (
            <TwoFactorSection
              is2FAEnabled={profile.is2FAEnabled}
              onToggle={handleToggle2FA}
              isLoading={isToggling2FA}
            />
          )}

          {/* Cambio de Contraseña */}
          <div className="configuracion-password-section">
            <div className="configuracion-password-header">
              <h4 className="configuracion-password-title">Contraseña</h4>

              {!showPasswordForm && (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="configuracion-btn-secondary"
                >
                  Cambiar Contraseña
                </button>
              )}
            </div>

            {showPasswordForm && (
              <PasswordChangeForm
                onSubmit={handlePasswordSubmit}
                isLoading={isChangingPassword}
                onCancel={handleCancelPasswordChange}
              />
            )}
          </div>
        </div>
      </div>

      {/* Sección adicional - Actividad reciente */}
      <SecurityActivity />
    </div>
  );
};

export default ConfiguracionPerfil;