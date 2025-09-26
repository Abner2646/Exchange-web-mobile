/*
Mantené:
Autenticación de dos factores
Cambiar contraseña
Actividad de seguridad

Cambiá para añadir un kyc (preguntame con que api me quiero conectar y dame opciones)


Eliminá:
Editar la información personal y cambialo por editar el username y el país


*/

import React, { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import '../styles/ConfiguracionPerfil.css';

const ConfiguracionPerfil = () => {
  const { themeMode } = useTheme();
  
  // Estados para el perfil
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    is2FAEnabled: false
  });
  
  // Estados para cambio de contraseña
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // Estados para mensajes y loading
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Cargar perfil al montar componente
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/usuario/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      showMessage('error', 'Error al cargar el perfil');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('error', 'Las contraseñas no coinciden');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      showMessage('error', 'La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/usuario/me/change-password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      
      if (response.ok) {
        showMessage('success', 'Contraseña cambiada exitosamente');
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setShowPasswordForm(false);
      } else {
        const error = await response.json();
        showMessage('error', error.message || 'Error al cambiar contraseña');
      }
    } catch (error) {
      showMessage('error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const toggle2FA = async () => {
    setLoading(true);
    
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/usuario/me/2fa-toggle', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(prev => ({ ...prev, is2FAEnabled: data.is2FAEnabled }));
        showMessage('success', 
          data.is2FAEnabled 
            ? 'Autenticación de dos factores activada' 
            : 'Autenticación de dos factores desactivada'
        );
      } else {
        const error = await response.json();
        showMessage('error', error.message || 'Error al cambiar configuración 2FA');
      }
    } catch (error) {
      showMessage('error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
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

      {/* Mensaje de estado */}
      {message.text && (
        <div className={`configuracion-message ${message.type}`}>
          <span className="configuracion-message-icon">
            {message.type === 'success' ? '✓' : '⚠'}
          </span>
          {message.text}
        </div>
      )}

      {/* Grid principal */}
      <div className="configuracion-grid">
        
        {/* Información del Perfil */}
        <div className="configuracion-card">
          <h3 className="configuracion-card-title">Información Personal</h3>
          
          <div className="configuracion-form-group">
            <div className="configuracion-field">
              <label className="configuracion-label">Nombre completo</label>
              <input
                type="text"
                value={profile.name}
                readOnly
                className="configuracion-input configuracion-input-readonly"
              />
            </div>
            
            <div className="configuracion-field">
              <label className="configuracion-label">Email</label>
              <input
                type="email"
                value={profile.email}
                readOnly
                className="configuracion-input configuracion-input-readonly"
              />
            </div>
            
            <div className="configuracion-field">
              <label className="configuracion-label">Teléfono</label>
              <input
                type="tel"
                value={profile.phone}
                readOnly
                className="configuracion-input configuracion-input-readonly"
              />
            </div>
          </div>
        </div>

        {/* Configuración de Seguridad */}
        <div className="configuracion-card">
          <h3 className="configuracion-card-title">Configuración de Seguridad</h3>
          
          {/* 2FA Toggle */}
          <div className="configuracion-2fa-section">
            <div className="configuracion-2fa-header">
              <div className="configuracion-2fa-info">
                <h4 className="configuracion-2fa-title">
                  Autenticación de Dos Factores (2FA)
                </h4>
                <p className="configuracion-2fa-description">
                  Añade una capa extra de seguridad a tu cuenta
                </p>
              </div>
              
              <button
                onClick={toggle2FA}
                disabled={loading}
                className={`configuracion-2fa-toggle ${profile.is2FAEnabled ? 'active' : 'inactive'} ${loading ? 'loading' : ''}`}
              >
                {loading ? 'Procesando...' : (profile.is2FAEnabled ? 'Activado' : 'Desactivado')}
              </button>
            </div>
            
            <span className={`configuracion-badge ${profile.is2FAEnabled ? 'secure' : 'basic'}`}>
              {profile.is2FAEnabled ? 'Seguro' : 'Básico'}
            </span>
          </div>

          {/* Cambio de Contraseña */}
          <div className="configuracion-password-section">
            <div className="configuracion-password-header">
              <h4 className="configuracion-password-title">Contraseña</h4>
              
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="configuracion-btn-secondary"
              >
                {showPasswordForm ? 'Cancelar' : 'Cambiar Contraseña'}
              </button>
            </div>

            {showPasswordForm && (
              <form onSubmit={handlePasswordChange} className="configuracion-password-form">
                <div className="configuracion-field">
                  <label className="configuracion-label">Contraseña actual</label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                    required
                    className="configuracion-input"
                  />
                </div>

                <div className="configuracion-field">
                  <label className="configuracion-label">Nueva contraseña</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
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
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                    className="configuracion-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`configuracion-btn-primary ${loading ? 'loading' : ''}`}
                >
                  {loading ? 'Guardando...' : 'Actualizar Contraseña'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Sección adicional - Actividad reciente */}
      <div className="configuracion-card configuracion-activity-card">
        <h3 className="configuracion-card-title">Actividad de Seguridad</h3>
        
        <div className="configuracion-activity-item">
          <div className="configuracion-activity-icon">🔒</div>
          
          <div className="configuracion-activity-info">
            <h4 className="configuracion-activity-title">Última sesión</h4>
            <p className="configuracion-activity-description">
              Hace 2 horas • IP: 192.168.1.1 • Chrome en Windows
            </p>
          </div>
          
          <span className="configuracion-badge active">Activa</span>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracionPerfil;