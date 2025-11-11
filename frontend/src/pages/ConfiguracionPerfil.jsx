// src/pages/ConfiguracionPerfil.jsx (web)
import { useState, useRef, useEffect } from 'react';
import { useProfile } from '../hooks/useProfile';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Toast from '../components/common/Toast';
import '../styles/ConfiguracionPerfil.css';

// Hero Icons
const UserIcon = () => (
  <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="sidebar-icon" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
  </svg>
);

const ConfiguracionPerfil = () => {
  const { profile, loading, changePassword, changingPassword, toggle2FA, toggling2FA, submitKYC, submittingKYC } = useProfile();
  
  const [activeSection, setActiveSection] = useState('perfil');
  const [toast, setToast] = useState(null);

  // Refs para scroll
  const perfilRef = useRef(null);
  const seguridadRef = useRef(null);
  const kycRef = useRef(null);

  // IntersectionObserver para detectar sección activa
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '-50% 0px -50% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-section');
          setActiveSection(id);
        }
      });
    }, options);

    if (perfilRef.current) observer.observe(perfilRef.current);
    if (seguridadRef.current) observer.observe(seguridadRef.current);
    if (kycRef.current) observer.observe(kycRef.current);

    return () => {
      if (perfilRef.current) observer.unobserve(perfilRef.current);
      if (seguridadRef.current) observer.unobserve(seguridadRef.current);
      if (kycRef.current) observer.unobserve(kycRef.current);
    };
  }, [loading]);

  // Estados para formulario de cambio de contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados para KYC
  const [kycForm, setKycForm] = useState({
    nombreCompleto: '',
    fechaNacimiento: '',
    nacionalidad: '',
    direccion: '',
    ciudad: '',
    codigoPostal: '',
    documentoTipo: 'dni',
    documentoNumero: '',
  });
  const [documentoFrontal, setDocumentoFrontal] = useState(null);
  const [selfie, setSelfie] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const scrollToSection = (section) => {
    setActiveSection(section);
    const refs = { perfil: perfilRef, seguridad: seguridadRef, kyc: kycRef };
    refs[section]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      showToast('Las contraseñas no coinciden', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('La contraseña debe tener al menos 6 caracteres', 'error');
      return;
    }

    const result = await changePassword(currentPassword, newPassword);
    
    if (result.success) {
      showToast('Contraseña cambiada exitosamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleToggle2FA = async () => {
    const newState = !profile.dosFactoresActivado;
    console.log(`🔄 Intentando ${newState ? 'activar' : 'desactivar'} 2FA...`);
    
    const result = await toggle2FA(newState);
    
    if (result.success) {
      showToast(`Autenticación de dos factores ${newState ? 'activada' : 'desactivada'}`);
    } else {
      console.error('❌ Error en toggle 2FA:', result.error);
      showToast(result.error || 'Error al cambiar estado de 2FA', 'error');
    }
  };

  const handleKYCSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones básicas
    if (!kycForm.nombreCompleto || !kycForm.fechaNacimiento || !kycForm.documentoNumero) {
      showToast('Por favor completa todos los campos obligatorios', 'error');
      return;
    }

    if (!documentoFrontal || !selfie) {
      showToast('Por favor sube todos los documentos requeridos', 'error');
      return;
    }

    const kycData = {
      ...kycForm,
      documentoFrontal: documentoFrontal.name,
      selfie: selfie.name,
    };

    const result = await submitKYC(kycData);
    
    if (result.success) {
      showToast('Verificación KYC enviada. Será revisada en 24-48 horas');
      // Reset form
      setKycForm({
        nombreCompleto: '',
        fechaNacimiento: '',
        nacionalidad: '',
        direccion: '',
        ciudad: '',
        codigoPostal: '',
        documentoTipo: 'dni',
        documentoNumero: '',
      });
      setDocumentoFrontal(null);
      setSelfie(null);
    } else {
      showToast(result.error, 'error');
    }
  };

  const handleFileChange = (e, setter) => {
    const file = e.target.files[0];
    if (file) {
      setter(file);
    }
  };

  if (loading) {
    return (
      <div className="config-loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="config-error">
        <p>Error cargando perfil</p>
      </div>
    );
  }

  return (
    <div className="config-container">
      {toast && <Toast message={toast.message} type={toast.type} />}
      
      {/* SIDEBAR */}
      <aside className="config-sidebar">
        <div className="config-sidebar-header">
          <h2 className="config-sidebar-title">Configuración</h2>
        </div>

        <nav className="config-sidebar-nav">
          <button
            className={`config-sidebar-item ${activeSection === 'perfil' ? 'active' : ''}`}
            onClick={() => scrollToSection('perfil')}
          >
            <UserIcon />
            <span>Perfil</span>
          </button>

          <button
            className={`config-sidebar-item ${activeSection === 'seguridad' ? 'active' : ''}`}
            onClick={() => scrollToSection('seguridad')}
          >
            <ShieldIcon />
            <span>Seguridad</span>
          </button>

          <button
            className={`config-sidebar-item ${activeSection === 'kyc' ? 'active' : ''}`}
            onClick={() => scrollToSection('kyc')}
          >
            <DocumentIcon />
            <span>Verificación KYC</span>
          </button>
        </nav>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="config-content">
        {/* SECCIÓN PERFIL */}
        <section ref={perfilRef} data-section="perfil" className="config-section">
          <div className="config-section-header">
            <h2 className="config-section-title">Información de Perfil</h2>
            <p className="config-section-description">
              Información de tu cuenta
            </p>
          </div>

          <div className="config-card">
            <div className="config-info-grid">
              <div className="config-info-item">
                <label className="config-info-label">Usuario</label>
                <p className="config-info-value">{profile.username}</p>
              </div>

              <div className="config-info-item">
                <label className="config-info-label">Email</label>
                <p className="config-info-value">{profile.email}</p>
              </div>

              <div className="config-info-item">
                <label className="config-info-label">ID de Usuario</label>
                <p className="config-info-value config-info-mono">{profile.id}</p>
              </div>

              <div className="config-info-item">
                <label className="config-info-label">Rol</label>
                <p className="config-info-value">
                  <span className="config-badge">{profile.rol}</span>
                </p>
              </div>

              <div className="config-info-item">
                <label className="config-info-label">Email Verificado</label>
                <p className="config-info-value">
                  {profile.emailVerificado ? (
                    <span className="config-status config-status-success">Verificado</span>
                  ) : (
                    <span className="config-status config-status-error">No verificado</span>
                  )}
                </p>
              </div>

              <div className="config-info-item">
                <label className="config-info-label">Fecha de Registro</label>
                <p className="config-info-value">
                  {new Date(profile.created_at).toLocaleDateString('es-AR')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN SEGURIDAD */}
        <section ref={seguridadRef} data-section="seguridad" className="config-section">
          <div className="config-section-header">
            <h2 className="config-section-title">Seguridad</h2>
            <p className="config-section-description">
              Gestiona la seguridad de tu cuenta
            </p>
          </div>

          {/* Cambiar Contraseña */}
          <div className="config-card">
            <h3 className="config-card-title">Cambiar Contraseña</h3>
            
            <form onSubmit={handleChangePassword} className="config-form">
              <div className="config-input-group">
                <label className="config-label">Contraseña Actual</label>
                <input
                  type="password"
                  className="config-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña actual"
                  required
                />
              </div>

              <div className="config-input-group">
                <label className="config-label">Nueva Contraseña</label>
                <input
                  type="password"
                  className="config-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>

              <div className="config-input-group">
                <label className="config-label">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  className="config-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  required
                />
              </div>

              <button
                type="submit"
                className="config-btn config-btn-primary"
                disabled={changingPassword}
              >
                {changingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          </div>

          {/* Autenticación de Dos Factores */}
          <div className="config-card">
            <div className="config-2fa-header">
              <div>
                <h3 className="config-card-title">Autenticación de Dos Factores</h3>
                <p className="config-card-description">
                  Agrega una capa extra de seguridad a tu cuenta
                </p>
              </div>
              <div className="config-2fa-toggle">
                <label className="config-toggle">
                  <input
                    type="checkbox"
                    checked={profile.dosFactoresActivado}
                    onChange={handleToggle2FA}
                    disabled={toggling2FA}
                  />
                  <span className="config-toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="config-2fa-status">
              {profile.dosFactoresActivado ? (
                <div className="config-status-box config-status-box-success">
                  <p>✓ La autenticación de dos factores está <strong>activada</strong></p>
                </div>
              ) : (
                <div className="config-status-box config-status-box-warning">
                  <p>⚠ La autenticación de dos factores está <strong>desactivada</strong></p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECCIÓN KYC */}
        <section ref={kycRef} data-section="kyc" className="config-section">
          <div className="config-section-header">
            <h2 className="config-section-title">Verificación de Identidad (KYC)</h2>
            <p className="config-section-description">
              Completa tu verificación para acceder a límites más altos
            </p>
          </div>

          <div className="config-card">
            {profile.kycVerificado ? (
              <div className="config-kyc-verified">
                <div className="config-kyc-verified-icon">✓</div>
                <h3>Identidad Verificada</h3>
                <p>Tu cuenta ha sido verificada exitosamente</p>
              </div>
            ) : (
              <form onSubmit={handleKYCSubmit} className="config-form">
                <h3 className="config-card-title">Datos Personales</h3>
                
                <div className="config-form-row">
                  <div className="config-input-group">
                    <label className="config-label">Nombre Completo *</label>
                    <input
                      type="text"
                      className="config-input"
                      value={kycForm.nombreCompleto}
                      onChange={(e) => setKycForm({ ...kycForm, nombreCompleto: e.target.value })}
                      placeholder="Juan Pérez"
                      required
                    />
                  </div>

                  <div className="config-input-group">
                    <label className="config-label">Fecha de Nacimiento *</label>
                    <input
                      type="date"
                      className="config-input"
                      value={kycForm.fechaNacimiento}
                      onChange={(e) => setKycForm({ ...kycForm, fechaNacimiento: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="config-form-row">
                  <div className="config-input-group">
                    <label className="config-label">Nacionalidad</label>
                    <input
                      type="text"
                      className="config-input"
                      value={kycForm.nacionalidad}
                      onChange={(e) => setKycForm({ ...kycForm, nacionalidad: e.target.value })}
                      placeholder="Argentina"
                    />
                  </div>

                  <div className="config-input-group">
                    <label className="config-label">Ciudad</label>
                    <input
                      type="text"
                      className="config-input"
                      value={kycForm.ciudad}
                      onChange={(e) => setKycForm({ ...kycForm, ciudad: e.target.value })}
                      placeholder="Buenos Aires"
                    />
                  </div>
                </div>

                <div className="config-input-group">
                  <label className="config-label">Dirección</label>
                  <input
                    type="text"
                    className="config-input"
                    value={kycForm.direccion}
                    onChange={(e) => setKycForm({ ...kycForm, direccion: e.target.value })}
                    placeholder="Av. Corrientes 1234"
                  />
                </div>

                <div className="config-input-group">
                  <label className="config-label">Código Postal</label>
                  <input
                    type="text"
                    className="config-input"
                    value={kycForm.codigoPostal}
                    onChange={(e) => setKycForm({ ...kycForm, codigoPostal: e.target.value })}
                    placeholder="1043"
                  />
                </div>

                <h3 className="config-card-title config-mt">Documentos de Identidad</h3>

                <div className="config-form-row">
                  <div className="config-input-group">
                    <label className="config-label">Tipo de Documento *</label>
                    <select
                      className="config-input"
                      value={kycForm.documentoTipo}
                      onChange={(e) => setKycForm({ ...kycForm, documentoTipo: e.target.value })}
                    >
                      <option value="dni">DNI</option>
                      <option value="pasaporte">Pasaporte</option>
                      <option value="licencia">Licencia de Conducir</option>
                    </select>
                  </div>

                  <div className="config-input-group">
                    <label className="config-label">Número de Documento *</label>
                    <input
                      type="text"
                      className="config-input"
                      value={kycForm.documentoNumero}
                      onChange={(e) => setKycForm({ ...kycForm, documentoNumero: e.target.value })}
                      placeholder="12345678"
                      required
                    />
                  </div>
                </div>

                <h3 className="config-card-title config-mt">Cargar Documentos</h3>

                <div className="config-upload-grid">
                  <div className="config-upload-box">
                    <label className="config-upload-label">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(e, setDocumentoFrontal)}
                        className="config-upload-input"
                      />
                      <div className="config-upload-content">
                        <svg className="config-upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="config-upload-text">
                          {documentoFrontal ? documentoFrontal.name : 'Foto Frontal del Documento'}
                        </p>
                        <p className="config-upload-hint">JPG, PNG o PDF (max 5MB)</p>
                      </div>
                    </label>
                  </div>

                  <div className="config-upload-box">
                    <label className="config-upload-label">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, setSelfie)}
                        className="config-upload-input"
                      />
                      <div className="config-upload-content">
                        <svg className="config-upload-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="config-upload-text">
                          {selfie ? selfie.name : 'Selfie con Documento'}
                        </p>
                        <p className="config-upload-hint">JPG o PNG (max 5MB)</p>
                      </div>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  className="config-btn config-btn-primary config-mt"
                  disabled={submittingKYC}
                >
                  {submittingKYC ? 'Enviando...' : 'Enviar Verificación'}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default ConfiguracionPerfil;