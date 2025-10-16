import { useAuth } from '../context/AuthContext';
import { useAdmin } from '../hooks/useAdmin';
import '../styles/SuperAdmin.css';

const SuperAdmin = () => {
  const { isAuthenticated } = useAuth();
  const {
    userInfo,
    isLoading,
    hasError,
    userEmail,
    setUserEmail,
    userLookup,
    criptoSeleccionada,
    setCriptoSeleccionada,
    searchCrypto,
    setSearchCrypto,
    showCryptoDropdown,
    setShowCryptoDropdown,
    amount,
    setAmount,
    criptosFiltradas,
    nombre,
    setNombre,
    descripcion,
    setDescripcion,
    showConfirmModal,
    confirmAction,
    confirmStep,
    handleConfirmNext,
    handleConfirmCancel,
    dropdownRef,
    cryptoSearchRef,
    handleSensitiveAction,
    handleUpdateBalance,
    handleCreatePaymentMethod,
    loadingStates,
  } = useAdmin();

  if (isLoading) {
    return (
      <div className="sa-container">
        <div className="sa-loading">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="sa-container">
        <div className="sa-error">Debes iniciar sesión para acceder a esta página</div>
      </div>
    );
  }

  if (hasError || userInfo?.rol !== 'super_admin') {
    return (
      <div className="sa-container">
        <div className="sa-error">No tienes permisos para acceder a esta página</div>
      </div>
    );
  }

  return (
    <div className="sa-container">
      <div className="sa-header">
        <h1 className="sa-title">Panel de Super Administrador</h1>
        <div className="sa-user-info">
          <span className="sa-username">{userInfo?.username}</span>
          <span className="sa-role">{userInfo?.rol}</span>
        </div>
      </div>

      <div className="sa-grid">
        <div className="sa-card sa-card-danger">
          <div className="sa-warning-badge">⚠️ Operaciones Sensibles</div>
          <h2 className="sa-card-title">Operaciones Críticas del Sistema</h2>
          <p className="sa-card-description">
            Estas operaciones pueden afectar el funcionamiento del sistema. Requieren confirmación múltiple.
          </p>

          <div className="sa-button-group">
            <button
              className="sa-button sa-button-danger"
              onClick={() => handleSensitiveAction('initializeWallets')}
              disabled={loadingStates.card1}
            >
              {loadingStates.card1 ? 'Procesando...' : 'Inicializar Wallets'}
            </button>

            <button
              className="sa-button sa-button-danger"
              onClick={() => handleSensitiveAction('generatePairs')}
              disabled={loadingStates.card3}
            >
              {loadingStates.card3 ? 'Procesando...' : 'Generar Pares'}
            </button>
          </div>
        </div>

        <div className="sa-card">
          <h2 className="sa-card-title">SUMAR Balance</h2>
          <p className="sa-card-description">Actualiza el balance de un usuario para una criptomoneda específica</p>
          <div className="sa-form">
            <div className="sa-input-group">
              <label className="sa-label">Email del Usuario</label>
              <input
                type="email"
                className="sa-input"
                placeholder="usuario@ejemplo.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
              {userLookup && (
                <div className={`sa-user-lookup ${userLookup.found ? 'sa-user-found' : 'sa-user-not-found'}`}>
                  {userLookup.found ? (
                    <>
                      ✓ Usuario encontrado: <strong>{userLookup.username}</strong>
                    </>
                  ) : (
                    <>✗ Usuario no encontrado</>
                  )}
                </div>
              )}
            </div>

            <div className="sa-input-group">
              <label className="sa-label">Criptomoneda</label>
              <div className="sa-crypto-selector" ref={dropdownRef}>
                <button
                  type="button"
                  className="sa-crypto-selector-button"
                  onClick={() => setShowCryptoDropdown(!showCryptoDropdown)}
                >
                  {criptoSeleccionada ? (
                    <div className="sa-crypto-selected">
                      <img
                        src={criptoSeleccionada.iconUrl || '/placeholder.svg'}
                        alt={criptoSeleccionada.symbol}
                        className="sa-crypto-icon"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="sa-crypto-icon-fallback" style={{ display: 'none' }}>
                        {criptoSeleccionada.symbol.slice(0, 3)}
                      </div>
                      <div className="sa-crypto-info">
                        <span className="sa-crypto-symbol">{criptoSeleccionada.symbol}</span>
                        <span className="sa-crypto-name">{criptoSeleccionada.nombre}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="sa-crypto-placeholder">Seleccionar criptomoneda</span>
                  )}
                </button>

                {showCryptoDropdown && (
                  <div className="sa-crypto-dropdown">
                    <div className="sa-crypto-search">
                      <input
                        ref={cryptoSearchRef}
                        type="text"
                        placeholder="Buscar..."
                        value={searchCrypto}
                        onChange={(e) => setSearchCrypto(e.target.value)}
                        className="sa-crypto-search-input"
                      />
                    </div>
                    <div className="sa-crypto-list">
                      {criptosFiltradas.map((crypto) => (
                        <button
                          key={crypto.id}
                          type="button"
                          className="sa-crypto-item"
                          onClick={() => {
                            setCriptoSeleccionada(crypto);
                            setShowCryptoDropdown(false);
                            setSearchCrypto('');
                          }}
                        >
                          <img
                            src={crypto.iconUrl || '/placeholder.svg'}
                            alt={crypto.symbol}
                            className="sa-crypto-icon-small"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div className="sa-crypto-icon-fallback-small" style={{ display: 'none' }}>
                            {crypto.symbol.slice(0, 3)}
                          </div>
                          <span className="sa-crypto-item-symbol">{crypto.symbol}</span>
                          <span className="sa-crypto-item-name">{crypto.nombre}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="sa-input-group">
              <label className="sa-label">Cantidad</label>
              <input
                type="number"
                className="sa-input"
                placeholder="1000.50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.00000001"
              />
            </div>
          </div>
          <button className="sa-button sa-button-primary" onClick={handleUpdateBalance} disabled={loadingStates.card2}>
            {loadingStates.card2 ? 'Procesando...' : 'AGREGAR Balance'}
          </button>
        </div>

        <div className="sa-card">
          <h2 className="sa-card-title">Crear Método de Pago</h2>
          <p className="sa-card-description">Agrega un nuevo método de pago al sistema</p>
          <div className="sa-form">
            <div className="sa-input-group">
              <label className="sa-label">Nombre</label>
              <input
                type="text"
                className="sa-input"
                placeholder="Transferencia Bancaria"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="sa-input-group">
              <label className="sa-label">Descripción</label>
              <textarea
                className="sa-input sa-textarea"
                placeholder="Método de pago mediante transferencia bancaria..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <button
            className="sa-button sa-button-primary"
            onClick={handleCreatePaymentMethod}
            disabled={loadingStates.card4}
          >
            {loadingStates.card4 ? 'Procesando...' : 'Crear Método de Pago'}
          </button>
        </div>
      </div>

      {showConfirmModal && (
        <div className="sa-modal-overlay">
          <div className="sa-modal-content">
            <h2 className="sa-modal-title">{confirmStep === 1 ? '¿Está seguro?' : '⚠️ Advertencia Final'}</h2>
            <p className="sa-modal-description">
              {confirmStep === 1
                ? `Está a punto de ejecutar una operación crítica: ${confirmAction === 'initializeWallets' ? 'Inicializar Wallets' : 'Generar Pares de Exchange'}.`
                : 'Esto podría ocasionar un error en las referencias a las criptomonedas y afectar el funcionamiento del sistema.'}
            </p>
            <div className="sa-modal-buttons">
              <button className="sa-button sa-button-secondary" onClick={handleConfirmCancel}>
                Cancelar
              </button>
              <button className="sa-button sa-button-danger" onClick={handleConfirmNext}>
                {confirmStep === 1 ? 'Continuar' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdmin;