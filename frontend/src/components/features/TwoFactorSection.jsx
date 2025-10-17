// src/components/features/TwoFactorSection.jsx

const TwoFactorSection = ({ is2FAEnabled, onToggle, isLoading }) => {
  return (
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
          onClick={onToggle}
          disabled={isLoading}
          className={`configuracion-2fa-toggle ${is2FAEnabled ? 'active' : 'inactive'} ${
            isLoading ? 'loading' : ''
          }`}
        >
          {isLoading ? 'Procesando...' : is2FAEnabled ? 'Activado' : 'Desactivado'}
        </button>
      </div>

      <span className={`configuracion-badge ${is2FAEnabled ? 'secure' : 'basic'}`}>
        {is2FAEnabled ? 'Seguro' : 'Básico'}
      </span>
    </div>
  );
};

export default TwoFactorSection;